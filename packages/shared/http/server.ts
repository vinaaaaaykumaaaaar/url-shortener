import { createServer, type Server } from "node:http";
import type { Express } from "express";
import type { AppLogger } from "../logger/logger";
import type { Lifecycle } from "./lifecycle";

export interface StartServerOptions {
    app: Express;
    port: number;
    name: string;
    logger: AppLogger;
    shutdownTimeoutMs: number;
    drainDelayMs?: number;
    lifecycle?: Lifecycle;
    onShutdown?: () => Promise<void>;
}

export interface RunningServer {
    server: Server;
    shutdown: (reason: string) => Promise<void>;
}

export async function startServer(options: StartServerOptions): Promise<RunningServer> {
    const { app, port, name, logger, shutdownTimeoutMs } = options;
    const server = createServer(app);

    // headersTimeout must exceed keepAliveTimeout, or a connection can be reaped mid-request
    // and the client sees an unexplained socket hang up.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;
    server.requestTimeout = 30_000;

    await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException): void => {
            reject(
                error.code === "EADDRINUSE"
                    ? new Error(`Port ${port} is already in use (${name}).`, { cause: error })
                    : error,
            );
        };

        server.once("error", onError);
        server.listen(port, () => {
            server.off("error", onError);
            resolve();
        });
    });

    logger.info("server listening", { name, port, pid: process.pid });

    let shutdownPromise: Promise<void> | undefined;

    const shutdown = (reason: string): Promise<void> => {
        // Signals can arrive more than once; the first one owns the sequence.
        if (shutdownPromise) return shutdownPromise;

        shutdownPromise = (async () => {
            logger.info("shutdown started", { name, reason });

            const forceExit = setTimeout(() => {
                logger.error("shutdown timed out, forcing exit", { name, shutdownTimeoutMs });
                process.exit(1);
            }, shutdownTimeoutMs);
            forceExit.unref?.();

            try {
                // Fail readiness first, then keep serving briefly so the load balancer can stop
                // routing here before the socket closes.
                options.lifecycle?.startDraining();
                const drainDelayMs = options.drainDelayMs ?? 0;
                if (drainDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, drainDelayMs));

                // Stop accepting new connections, then let in-flight requests finish.
                await new Promise<void>((resolve) => server.close(() => resolve()));
                server.closeIdleConnections?.();
                await options.onShutdown?.();
                logger.info("shutdown complete", { name });
            } catch (error) {
                logger.error("shutdown failed", { name, err: error });
            } finally {
                clearTimeout(forceExit);
                await logger.close();
            }
        })();

        return shutdownPromise;
    };

    const onSignal = (signal: NodeJS.Signals): void => {
        void shutdown(signal).then(() => process.exit(0));
    };

    process.once("SIGTERM", onSignal);
    process.once("SIGINT", onSignal);

    process.on("unhandledRejection", (reason) => {
        logger.error("unhandled rejection", { name, err: reason });
        void shutdown("unhandledRejection").then(() => process.exit(1));
    });

    process.on("uncaughtException", (error) => {
        // Process state is unknown after this point; drain and leave rather than keep serving.
        logger.error("uncaught exception", { name, err: error });
        void shutdown("uncaughtException").then(() => process.exit(1));
    });

    return { server, shutdown };
}
