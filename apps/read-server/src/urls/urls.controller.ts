import { getValidated, NotFoundError, prisma } from "@url-shortener/shared";
import type { RequestHandler } from "express";


interface ShortCodeParams {
    shortCode: string;
}

export const redirectUrlController: RequestHandler = async (req, res) => {
    const { shortCode } = getValidated<ShortCodeParams>(req, "params");

    const link = await prisma.url.findUnique({
        where: { shortCode },
        select: { longUrl: true },
    });

    if (!link) {
        throw new NotFoundError("Short link not found.");
    }

    res.redirect(302, link.longUrl);
};
