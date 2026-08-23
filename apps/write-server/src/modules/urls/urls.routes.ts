import { Router } from "express";
import {
    methodNotAllowed,
    requireContentType,
    validateRequest,
} from "@url-shortener/shared";
import { createUrlController } from "./urls.controllers";
import { createUrlBodySchema } from "./urls.schema";
import type { UrlService } from "./urls.service";

export function createUrlRouter(service: UrlService): Router {
    const router = Router();

    router.post(
        "/",
        requireContentType(),
        validateRequest({ body: createUrlBodySchema }),
        createUrlController(service),
    );
    router.all("/", methodNotAllowed(["POST"]));

    return router;
}
