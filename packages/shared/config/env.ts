import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as readDotenvFile } from "dotenv";
import { z } from "zod";

let envFileLoaded = false;

function loadEnvFile(): void {
    if (envFileLoaded) return;
    envFileLoaded = true;

    let directory = import.meta.dir;

    for (let depth = 0; depth < 10; depth += 1) {
        const candidate = join(directory, ".env");
        if (existsSync(candidate)) {
            readDotenvFile({ path: candidate, override: false, quiet: true });
            return;
        }

        const parent = dirname(directory);
        if (parent === directory) return;
        directory = parent;
    }
}

export const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const logLevelSchema = z.enum(["error", "warn", "info", "debug"]).default("info");

export const portSchema = z.coerce.number().int().min(1).max(65_535);

export const positiveIntSchema = z.coerce.number().int().positive();

export const baseEnvSchema = z.object({
    NODE_ENV: nodeEnvSchema,
    LOG_LEVEL: logLevelSchema,
    DATABASE_URL: z.string().min(1),
    SHUTDOWN_TIMEOUT_MS: positiveIntSchema.default(10_000),
    /** Keep serving this long after readiness starts failing, so load balancers can drain. */
    SHUTDOWN_DRAIN_MS: positiveIntSchema.or(z.literal(0)).default(0),
    TRUST_PROXY: z.stringbool().default(false),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function loadEnv<T extends z.ZodType>(
    schema: T,
    source?: Record<string, string | undefined>,
): z.infer<T> {
    // An explicit source means a test is supplying config; leave the filesystem alone.
    if (!source) loadEnvFile();

    const result = schema.safeParse(source ?? process.env);

    if (!result.success) {
        const lines = result.error.issues.map((issue) => {
            const key = issue.path.join(".") || "(root)";
            return `  ${key}: ${issue.message}`;
        });
        process.stderr.write(`Invalid environment configuration:\n${lines.join("\n")}\n`);
        process.exit(1);
    }

    return result.data;
}

