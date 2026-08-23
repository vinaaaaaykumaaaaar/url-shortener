import { Router } from "express";
import {
    methodNotAllowed,
    NotFoundError,
    shortCodeSchema,
    validateRequest,
} from "@url-shortener/shared";
import { z } from "zod";
import { redirectUrlController } from "./urls.controller";

const shortCodeParamsSchema = z.object({
    shortCode: shortCodeSchema,
});

export function createUrlRouter(): Router {
    const router = Router();

    router.get(
        "/:shortCode",
        validateRequest(
            { params: shortCodeParamsSchema },
            { onInvalid: () => new NotFoundError("Short link not found.") },
        ),
        redirectUrlController,
    );

    router.all("/:shortCode", methodNotAllowed(["GET"]));
    return router;
}
