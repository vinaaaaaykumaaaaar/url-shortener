import { baseEnvSchema, loadEnv, portSchema, positiveIntSchema } from "@url-shortener/shared";
import { z } from "zod";

const envSchema = baseEnvSchema.extend({
    WRITE_SERVER_PORT: portSchema.default(3000),
    SHORT_LINK_BASE_URL: z.url().default("http://localhost:4000"),
    SHORT_CODE_LENGTH: positiveIntSchema.min(4).max(32).default(8),
    BODY_LIMIT: z.string().default("16kb"),
    RATE_LIMIT_WINDOW_MS: positiveIntSchema.default(60_000),
    RATE_LIMIT_MAX: positiveIntSchema.default(60),
    CORS_ORIGINS: z.string().default("*"),
});

export type Env = z.infer<typeof envSchema>;

export interface Config {
    env: Env["NODE_ENV"];
    isProduction: boolean;
    port: number;
    logLevel: Env["LOG_LEVEL"];
    databaseUrl: string;
    shutdownTimeoutMs: number;
    shutdownDrainMs: number;
    trustProxy: boolean;
    shortLinkBaseUrl: string;
    shortCodeLength: number;
    bodyLimit: string;
    rateLimit: { windowMs: number; max: number };
    corsOrigins: string[] | "*";
}

export function loadConfig(source?: Record<string, string | undefined>): Config {
    const env = loadEnv(envSchema, source);

    return {
        env: env.NODE_ENV,
        isProduction: env.NODE_ENV === "production",
        port: env.WRITE_SERVER_PORT,
        logLevel: env.LOG_LEVEL,
        databaseUrl: env.DATABASE_URL,
        shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
        shutdownDrainMs: env.SHUTDOWN_DRAIN_MS,
        trustProxy: env.TRUST_PROXY,
        // Trailing slashes would produce `https://host//abc` when joined.
        shortLinkBaseUrl: env.SHORT_LINK_BASE_URL.replace(/\/+$/, ""),
        shortCodeLength: env.SHORT_CODE_LENGTH,
        bodyLimit: env.BODY_LIMIT,
        rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX },
        corsOrigins: env.CORS_ORIGINS === "*" ? "*" : env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    };
}