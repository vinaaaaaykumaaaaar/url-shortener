export { prisma } from "./db/client.ts";
export { isDatabaseUnavailable, isUniqueViolation } from "./db/errors";
export {
    baseEnvSchema,
    loadEnv,
    logLevelSchema,
    nodeEnvSchema,
    portSchema,
    positiveIntSchema,
    type BaseEnv,
} from "./config/env.ts";

export {
    createAppLogger,
    type AppLogger,
    type LogFields,
    type LogLevel,
    type LoggerOptions,
} from "./logger/logger.ts";

import "./http/types";

export {
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    GoneError,
    InternalServerError,
    MethodNotAllowedError,
    NotFoundError,
    PayloadTooLargeError,
    ServiceUnavailableError,
    TooManyRequestsError,
    UnauthorizedError,
    UnsupportedMediaTypeError,
    ValidationError,
    isAppError,
    type AppErrorOptions,
} from "./http/errors";

export {
    errorEnvelope,
    sendData,
    successEnvelope,
    type ErrorBody,
    type ErrorEnvelope,
    type ResponseMeta,
    type SuccessEnvelope,
} from "./http/envelope";

export { requestContext } from "./http/middleware/request-context";
export { requestLogger, type RequestLoggerOptions } from "./http/middleware/request-logger";
export { createHealthRouter, type HealthRouterOptions } from "./http/health";
export { requireContentType } from "./http/middleware/content-type";
export {
    getValidated,
    validateRequest,
    type FieldIssue,
    type RequestSchemas,
} from "./http/middleware/validate";
export { notFoundHandler } from "./http/middleware/not-found";
export { methodNotAllowed } from "./http/middleware/method-not-allowed";
export { errorHandler, toAppError, type ErrorHandlerOptions } from "./http/middleware/error-handler";
export { securityHeaders, type SecurityHeaderOptions } from "./http/middleware/security-headers";
export {
    MemoryRateLimitStore,
    rateLimit,
    type RateLimitHit,
    type RateLimitOptions,
    type RateLimitStore,
} from "./http/middleware/rate-limit";

export { createLifecycle, type Lifecycle } from "./http/lifecycle";
export { startServer, type RunningServer, type StartServerOptions } from "./http/server";

export {
    MAX_LONG_URL_LENGTH,
    MAX_SHORT_CODE_LENGTH,
    MIN_SHORT_CODE_LENGTH,
    RESERVED_SHORT_CODES,
    isPrivateTarget,
    longUrlSchema,
    shortCodeSchema,
} from "./domain/domain.ts";

