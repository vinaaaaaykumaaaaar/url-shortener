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
import type { Config } from "./config";
import { createUrlRouter } from "./modules/urls/urls.routes";
import { createUrlService } from "./modules/urls/urls.service";

export interface AppDependencies {
    config: Config;
    logger: AppLogger;
    rateLimitStore?: RateLimitStore;
    lifecycle?: Lifecycle;
}

export function buildApp(deps: AppDependencies): Express {
    const { config, logger } = deps;

    const service = createUrlService({
        shortLinkBaseUrl: config.shortLinkBaseUrl,
        shortCodeLength: config.shortCodeLength,
        blockPrivateTargets: config.isProduction,
    });

    const app = express();

    app.disable("x-powered-by");
    if (config.trustProxy) app.set("trust proxy", 1);

    app.use(securityHeaders({ hsts: config.isProduction }));
    app.use(requestContext(logger));
    app.use(requestLogger({ quietPaths: ["/health"] }));
    app.use(
        cors({
            origin: config.corsOrigins,
            methods: ["POST", "OPTIONS"],
            maxAge: 600,
        }),
    );

    // Operational probes should not consume a caller's rate-limit budget.
    app.use(
        "/health",
        createHealthRouter({ service: "write-server", lifecycle: deps.lifecycle }),
    );

    app.use(rateLimit({ ...config.rateLimit, store: deps.rateLimitStore }));
    app.use(express.json({ limit: config.bodyLimit }));

    app.use("/api/v1/urls", createUrlRouter(service));

    app.use(notFoundHandler());
    app.use(errorHandler({ logger, exposeStack: !config.isProduction }));

    return app;
}
