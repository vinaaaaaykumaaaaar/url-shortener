import { longUrlSchema, shortCodeSchema } from "@url-shortener/shared";
import { z } from "zod";

export const createUrlBodySchema = z.strictObject({
    longUrl: longUrlSchema,
    shortCode: shortCodeSchema.optional(),
});

export type CreateUrlInput = z.infer<typeof createUrlBodySchema>;