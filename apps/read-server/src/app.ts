import cors from "cors";
import express, { type Express } from "express";
import type { AppLogger } from "@url-shortener/shared";
import {
    createHealthRouter,
    errorHandler,
    notFoundHandler,
    rateLimit,
    requestContext,
    requestLogger,
    securityHeaders,
    type Lifecycle,
    type RateLimitStore,
} from "@url-shortener/shared";
import { createUrlRouter } from "./urls/urls.routes";


export interface AppDependencies {
    logger: AppLogger;
    rateLimitStore?: RateLimitStore;
    lifecycle?: Lifecycle;
}

export function buildApp(deps: AppDependencies): Express {
    const { logger } = deps;

    const app = express();

    app.disable("x-powered-by");

    app.use(securityHeaders({ hsts: false }));
    app.use(requestContext(logger));
    app.use(requestLogger({ quietPaths: ["/health"] }));
    app.use(
        cors({
            origin: "*",
            methods: ["GET", "OPTIONS"],
            maxAge: 600,
        }),
    );

    app.use("/health", createHealthRouter({ service: "read-server", lifecycle: deps.lifecycle }),);

    app.use("/", createUrlRouter());
    app.use(notFoundHandler());
    app.use(errorHandler({ logger, exposeStack: true }));

    return app;


}
