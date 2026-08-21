/**
 * Driver errors are matched by code rather than by `instanceof`, because the concrete class
 * depends on which Prisma runtime/adapter is loaded and a duplicated copy of the package in
 * node_modules silently breaks prototype checks.
 */

const UNIQUE_VIOLATION = "P2002";

const UNAVAILABLE_PRISMA_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1010", "P1017"]);

const UNAVAILABLE_PG_CODES = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EPIPE",
    "08000", // connection_exception
    "08003", // connection_does_not_exist
    "08006", // connection_failure
    "08001", // sqlclient_unable_to_establish_sqlconnection
    "08004", // sqlserver_rejected_establishment_of_sqlconnection
    "57P01", // admin_shutdown
    "57P02", // crash_shutdown
    "57P03", // cannot_connect_now
    "53300", // too_many_connections
]);

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

function uniqueViolationTargets(error: unknown): string[] {
    if (typeof error !== "object" || error === null) return [];
    const target = (error as { meta?: { target?: unknown } }).meta?.target;

    if (Array.isArray(target)) return target.filter((value): value is string => typeof value === "string");
    if (typeof target === "string") return [target];
    return [];
}

/**
 * Prisma reports the violated target inconsistently across versions and adapters: the column
 * (`short_code`), the model field (`shortCode`), or the index name (`urls_short_code_key`).
 * Comparing on alphanumerics alone matches all three.
 */
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * @param field when given, only reports true if this column caused the violation — so a future
 *              second unique index cannot be mistaken for a short-code collision.
 */
export function isUniqueViolation(error: unknown, field?: string): boolean {
    if (errorCode(error) !== UNIQUE_VIOLATION) return false;
    if (!field) return true;

    const targets = uniqueViolationTargets(error);
    if (targets.length === 0) return true;

    const needle = normalize(field);
    return targets.some((target) => normalize(target).includes(needle));
}

export function isDatabaseUnavailable(error: unknown): boolean {
    const code = errorCode(error);
    if (code && (UNAVAILABLE_PRISMA_CODES.has(code) || UNAVAILABLE_PG_CODES.has(code))) return true;

    if (typeof error === "object" && error !== null) {
        const name = (error as { name?: unknown }).name;
        if (name === "PrismaClientInitializationError") return true;

        const cause = (error as { cause?: unknown }).cause;
        if (cause !== undefined && cause !== error) return isDatabaseUnavailable(cause);
    }

    return false;
}
