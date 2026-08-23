import {
    createAppLogger,
    createLifecycle,
    prisma,
    startServer,
} from "@url-shortener/shared";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const SERVICE_NAME = "write-server";

async function main(): Promise<void> {
    const config = loadConfig();
    const logger = createAppLogger({
        level: config.logLevel,
        pretty: !config.isProduction,
        base: { service: SERVICE_NAME, environment: config.env },
    });
    const lifecycle = createLifecycle();

    try {
        // PrismaPg creates connections lazily, so $connect() alone does not prove that Postgres is
        // reachable. A real query prevents the HTTP server from advertising health with a bad URL.
        await prisma.$queryRaw`SELECT 1`;
        logger.info("database connected");

        const app = buildApp({ config, logger, lifecycle });

        await startServer({
            app,
            port: config.port,
            name: SERVICE_NAME,
            logger,
            lifecycle,
            shutdownTimeoutMs: config.shutdownTimeoutMs,
            drainDelayMs: config.shutdownDrainMs,
            onShutdown: () => prisma.$disconnect(),
        });
    } catch (error) {
        logger.error("server failed to start", { err: error });

        try {
            await prisma.$disconnect();
        } catch (disconnectError) {
            logger.error("database disconnect failed", { err: disconnectError });
        }

        await logger.close();
        process.exitCode = 1;
    }
}

await main();
