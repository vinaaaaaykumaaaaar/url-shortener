import { ConflictError, ServiceUnavailableError, ValidationError } from "@url-shortener/shared";

export class ShortCodeTakenError extends ConflictError {
    constructor(shortCode: string) {
        super(`The short code "${shortCode}" is already in use.`, {
            code: "SHORT_CODE_TAKEN",
            details: { shortCode },
        });
    }
}

export class ShortCodeReservedError extends ValidationError {
    constructor(shortCode: string) {
        super(`The short code "${shortCode}" is reserved.`, {
            code: "SHORT_CODE_RESERVED",
            details: { shortCode },
        });
    }
}

export class TargetNotAllowedError extends ValidationError {
    constructor(reason: string) {
        super(reason, { code: "TARGET_NOT_ALLOWED" });
    }
}

/**
 * 503 rather than 500: repeated collisions mean the keyspace is saturating, which is a capacity
 * condition the caller can retry, not a bug in the request.
 */
export class ShortCodeExhaustedError extends ServiceUnavailableError {
    constructor(attempts: number) {
        super("Could not allocate a unique short code. Please retry.", {
            code: "SHORT_CODE_EXHAUSTED",
            details: { attempts },
        });
    }
}
