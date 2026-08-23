import type { RequestHandler } from "express";
import { getValidated, sendData } from "@url-shortener/shared";
import type { CreateUrlInput } from "./urls.schema";

export function createUrlController(): RequestHandler {
    return async (req, res) => {
        const input = getValidated<CreateUrlInput>(req, "body");
    }
}