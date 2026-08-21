export interface AppErrorOptions {
    /** Overrides the subclass default, for a more specific machine-readable code. */
    code?: string;
    /** Machine-readable payload for the client — field errors, allowed values, retry hints. */
    details?: unknown;
    /** Response headers the status requires to be meaningful (Allow, Retry-After, ...). */
    headers?: Record<string, string>;
    /** Whether `message` is safe to return to the caller. Defaults to true below 500. */
    expose?: boolean;
    cause?: unknown;
}

/**
 * One error type carries everything the HTTP layer needs to answer: the status, a stable code
 * clients can branch on, and whether the message is safe to reveal. Throwing these anywhere in
 * the stack means the central error handler needs no knowledge of the module that threw.
 */
export class AppError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details?: unknown;
    readonly headers?: Record<string, string>;
    readonly expose: boolean;

    constructor(status: number, code: string, message: string, options: AppErrorOptions = {}) {
        super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
        this.name = new.target.name;
        this.status = status;
        this.code = options.code ?? code;
        this.details = options.details;
        this.headers = options.headers;
        this.expose = options.expose ?? status < 500;
        Error.captureStackTrace?.(this, new.target);
    }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export class BadRequestError extends AppError {
    constructor(message = "The request could not be understood.", options: AppErrorOptions = {}) {
        super(400, "BAD_REQUEST", message, options);
    }
}

export class ValidationError extends AppError {
    constructor(message = "The request failed validation.", options: AppErrorOptions = {}) {
        super(400, "VALIDATION_FAILED", message, options);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Authentication is required.", options: AppErrorOptions = {}) {
        super(401, "UNAUTHORIZED", message, options);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "You may not perform this action.", options: AppErrorOptions = {}) {
        super(403, "FORBIDDEN", message, options);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "The requested resource does not exist.", options: AppErrorOptions = {}) {
        super(404, "NOT_FOUND", message, options);
    }
}

export class MethodNotAllowedError extends AppError {
    constructor(allowed: readonly string[], options: AppErrorOptions = {}) {
        const allow = allowed.join(", ");
        super(405, "METHOD_NOT_ALLOWED", `Allowed methods: ${allow}.`, {
            ...options,
            headers: { Allow: allow, ...options.headers },
        });
    }
}

export class ConflictError extends AppError {
    constructor(message = "The request conflicts with existing state.", options: AppErrorOptions = {}) {
        super(409, "CONFLICT", message, options);
    }
}

export class GoneError extends AppError {
    constructor(message = "The resource is no longer available.", options: AppErrorOptions = {}) {
        super(410, "GONE", message, options);
    }
}

export class PayloadTooLargeError extends AppError {
    constructor(message = "The request body is too large.", options: AppErrorOptions = {}) {
        super(413, "PAYLOAD_TOO_LARGE", message, options);
    }
}

export class UnsupportedMediaTypeError extends AppError {
    constructor(accepted: readonly string[], options: AppErrorOptions = {}) {
        super(415, "UNSUPPORTED_MEDIA_TYPE", `Content-Type must be one of: ${accepted.join(", ")}.`, {
            ...options,
            details: options.details ?? { accepted },
        });
    }
}

export class TooManyRequestsError extends AppError {
    constructor(retryAfterSeconds: number, options: AppErrorOptions = {}) {
        super(429, "TOO_MANY_REQUESTS", "Rate limit exceeded.", {
            ...options,
            headers: { "Retry-After": String(retryAfterSeconds), ...options.headers },
        });
    }
}

export class InternalServerError extends AppError {
    constructor(message = "An unexpected error occurred.", options: AppErrorOptions = {}) {
        super(500, "INTERNAL_ERROR", message, { expose: false, ...options });
    }
}

export class ServiceUnavailableError extends AppError {
    constructor(message = "The service is temporarily unavailable.", options: AppErrorOptions = {}) {
        super(503, "SERVICE_UNAVAILABLE", message, {
            expose: true,
            ...options,
            headers: { "Retry-After": "5", ...options.headers },
        });
    }
}
