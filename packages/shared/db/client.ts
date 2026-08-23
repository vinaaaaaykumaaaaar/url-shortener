import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { loadEnvFile } from "../config/env";

// The write server can be launched from apps/write-server, while .env lives at the repository
// root. Load it before reading DATABASE_URL so Prisma never captures an undefined connection.
loadEnvFile();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
}

const adapter = new PrismaPg({
    connectionString,
});
export const prisma = new PrismaClient({
    adapter,
});

