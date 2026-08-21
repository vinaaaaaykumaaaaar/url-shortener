import { prisma } from "@url-shortener/shared";


export interface UrlRecord {
    shortCode: string;
    longUrl: string;
    createdAt: Date;
}

export interface CreateUrlRow {
    shortCode: string;
    longUrl: string;
}

/**
 * The only layer that knows Prisma exists. Everything above it depends on this interface, which
 * is what makes the service testable without a database and the ORM replaceable without touching
 * business logic.
 */
export interface UrlRepository {
    create(row: CreateUrlRow): Promise<UrlRecord>;
}

export function createUrlRepository(prisma: any): UrlRepository {
    return {
        create: (row) =>
            prisma.url.create({
                data: row,
                // `id` is a BigInt, which JSON.stringify throws on, and an autoincrement value tells
                // every caller how many links exist. It never leaves this layer.
                select: { shortCode: true, longUrl: true, createdAt: true },
            }),
    };
}
