import type { RequestHandler } from "express";
import { getValidated, sendData } from "@url-shortener/shared";
import type { CreateUrlInput } from "./urls.schema";
import type { UrlService } from "./urls.service";

export function createUrlController(service: UrlService): RequestHandler {
    return async (req, res) => {
        const input = getValidated<CreateUrlInput>(req, "body");
        const link = await service.create(input, { log: req.log });

        // 201 means "a resource was created". Location tells the client where that resource lives.
        sendData(res, 201, link, { Location: link.shortUrl });
    };
}
