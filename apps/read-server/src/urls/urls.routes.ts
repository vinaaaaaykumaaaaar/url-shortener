import { Router } from "express";
import {
    methodNotAllowed,
    requireContentType,
    validateRequest,
} from "@url-shortener/shared";


export function createUrlRouter(): Router {
    const router = Router();

    router.get("/:id", requireContentType(),);

    router.all("/", methodNotAllowed(["GET"]));
    return router;
}