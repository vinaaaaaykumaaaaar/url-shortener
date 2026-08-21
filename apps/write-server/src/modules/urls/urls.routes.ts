import { Router } from "express";
import {
    methodNotAllowed,
    requireContentType,
    validateRequest,
} from "@url-shortener/shared";


export function createUrlRouter(): Router {
    const router = Router();

    router.post("/",);
    router.all("/", methodNotAllowed(["POST"]));

    return router;
}