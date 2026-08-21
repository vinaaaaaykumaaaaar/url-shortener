import { Router } from "express";
import { sendData } from "./envelope";
import { ServiceUnavailableError } from "./errors";
import type { Lifecycle } from "./lifecycle";

export interface HealthRouterOptions {
    service: string;
    lifecycle?: Lifecycle;
}

export function createHealthRouter(options: HealthRouterOptions): Router {
    const router = Router();
    const startedAt = Date.now();

    router.get("/live", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        sendData(res, 200, {
            status: "ok",
            service: options.service,
            uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
    });

    return router;
}