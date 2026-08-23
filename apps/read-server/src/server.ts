import {
    createAppLogger,
    createLifecycle,
    prisma,
    startServer,
} from "@url-shortener/shared";

import { buildApp } from "./app";


const SERVICE_NAME = "read-server";

async function main(): Promise<void> {
    const logger = createAppLogger({
        level: "info",
        pretty: true,
        base: { service: SERVICE_NAME, enviroment: "development" }
    })

    const lifecycle = createLifecycle();

    try {
        await prisma.$queryRaw`SELECT 1`;
        logger.info("database connected");


        const app = buildApp({ logger, lifecycle });

        await startServer({
            app,
            port: 4000,
            name: SERVICE_NAME,
            logger,
            lifecycle,
            shutdownTimeoutMs: 10,
            drainDelayMs: 10,
            onShutdown: () => prisma.$disconnect(),
        })

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

