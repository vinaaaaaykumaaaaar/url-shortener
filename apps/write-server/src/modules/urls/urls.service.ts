import {
    RESERVED_SHORT_CODES,
    isPrivateTarget,
    isUniqueViolation,
    prisma,
    type AppLogger,
} from "@url-shortener/shared";
import { generateShortCode } from "./short-code";
import {
    ShortCodeExhaustedError,
    ShortCodeReservedError,
    ShortCodeTakenError,
    TargetNotAllowedError,
} from "./urls.error";
import type { CreateUrlInput } from "./urls.schema";

export interface ShortLink {
    shortCode: string;
    shortUrl: string;
    longUrl: string;
    createdAt: Date;
}

export interface UrlRecord {
    shortCode: string;
    longUrl: string;
    createdAt: Date;
}

interface CreateUrlRow {
    shortCode: string;
    longUrl: string;
}

function createUrlRecord(row: CreateUrlRow): Promise<UrlRecord> {
    return prisma.url.create({
        data: row,
        // Avoid returning the BigInt primary key, which cannot be JSON-stringified.
        select: { shortCode: true, longUrl: true, createdAt: true },
    });
}

export interface RequestContext {
    log: AppLogger;
}

export interface UrlServiceOptions {
    shortLinkBaseUrl: string;
    shortCodeLength: number;
    blockPrivateTargets: boolean;
    maxGenerationAttempts?: number;
}

export interface UrlService {
    create(input: CreateUrlInput, ctx: RequestContext): Promise<ShortLink>;
}

export function createUrlService(options: UrlServiceOptions): UrlService {
    const maxAttempts = options.maxGenerationAttempts ?? 5;

    const toShortLink = (record: UrlRecord): ShortLink => ({
        shortCode: record.shortCode,
        shortUrl: `${options.shortLinkBaseUrl}/${record.shortCode}`,
        longUrl: record.longUrl,
        createdAt: record.createdAt,
    });

    return {
        async create(input, ctx) {
            // Business rule 1: production links may not target a private/internal address.
            if (options.blockPrivateTargets && isPrivateTarget(input.longUrl)) {
                throw new TargetNotAllowedError("The target URL resolves to a private network address.");
            }

            if (input.shortCode) {
                // Business rule 2: some codes collide with real routes such as /health.
                if (RESERVED_SHORT_CODES.has(input.shortCode.toLowerCase())) {
                    throw new ShortCodeReservedError(input.shortCode);
                }

                try {
                    return toShortLink(
                        await createUrlRecord({
                            shortCode: input.shortCode,
                            longUrl: input.longUrl,
                        }),
                    );
                } catch (error) {
                    // Only the caller can choose a replacement for a caller-provided code.
                    if (isUniqueViolation(error, "short_code")) {
                        throw new ShortCodeTakenError(input.shortCode);
                    }
                    throw error;
                }
            }

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const shortCode = generateShortCode(options.shortCodeLength);

                try {
                    return toShortLink(
                        await createUrlRecord({ shortCode, longUrl: input.longUrl }),
                    );
                } catch (error) {
                    if (!isUniqueViolation(error, "short_code")) throw error;
                    ctx.log.debug("Generated short code collision", { shortCode, attempt });
                }
            }

            throw new ShortCodeExhaustedError(maxAttempts);
        },
    };
}
