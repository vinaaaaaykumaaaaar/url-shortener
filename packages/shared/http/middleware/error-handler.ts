import type { ErrorRequestHandler, Request } from "express";
import { isDatabaseUnavailable, isUniqueViolation } from "../../db/errors";
import type { AppLogger } from "../../logger/logger";
import { errorEnvelope, type ErrorBody } from "../envelope";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  UnsupportedMediaTypeError,
  isAppError,
} from "../errors";

export interface ErrorHandlerOptions {
  logger: AppLogger;
  /** Development only. Stack traces in a response body are an information leak in production. */
  exposeStack: boolean;
  /** Serve an HTML body when the client prefers HTML — for endpoints browsers hit directly. */
  negotiateHtml?: boolean;
}

interface BodyParserError {
  type?: string;
  status?: number;
  statusCode?: number;
  expose?: boolean;
  message?: string;
}

/** body-parser signals every failure through `err.type`, which is stabler than matching messages. */
const BODY_PARSER_ERRORS: Record<string, (error: BodyParserError) => AppError> = {
  "entity.parse.failed": (error) =>
    new BadRequestError("The request body is not valid JSON.", {
      code: "MALFORMED_JSON",
      cause: error,
    }),
  "entity.too.large": (error) => new PayloadTooLargeError(undefined, { cause: error }),
  "parameters.too.many": (error) =>
    new PayloadTooLargeError("The request has too many parameters.", { cause: error }),
  "request.size.invalid": (error) =>
    new BadRequestError("Content-Length did not match the body size.", {
      code: "INVALID_REQUEST_SIZE",
      cause: error,
    }),
  "request.aborted": (error) =>
    new BadRequestError("The client aborted the request.", {
      code: "REQUEST_ABORTED",
      cause: error,
    }),
  "encoding.unsupported": (error) =>
    new UnsupportedMediaTypeError(["application/json"], { cause: error }),
  "charset.unsupported": (error) =>
    new UnsupportedMediaTypeError(["application/json; charset=utf-8"], { cause: error }),
};

function isZodError(error: unknown): error is { name: string; issues: unknown[] } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "ZodError" &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

/**
 * Collapses every failure the stack can produce into one AppError, so the responder below has a
 * single shape to serialise. Anything unrecognised becomes a 500 with its detail withheld.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (typeof error === "object" && error !== null) {
    const candidate = error as BodyParserError;

    if (candidate.type && BODY_PARSER_ERRORS[candidate.type]) {
      return BODY_PARSER_ERRORS[candidate.type]!(candidate);
    }

    if (isZodError(error)) {
      // A ZodError escaping to here means a schema ran outside the validation middleware.
      return new BadRequestError("The request failed validation.", {
        code: "VALIDATION_FAILED",
        details: { issues: (error as { issues: unknown[] }).issues },
        cause: error,
      });
    }

    if (isUniqueViolation(error)) {
      return new ConflictError("That value is already taken.", {
        code: "ALREADY_EXISTS",
        cause: error,
      });
    }

    if (isDatabaseUnavailable(error)) {
      return new ServiceUnavailableError(undefined, {
        code: "DATABASE_UNAVAILABLE",
        cause: error,
      });
    }

    const status = candidate.status ?? candidate.statusCode;
    if (typeof status === "number" && status >= 400 && status < 600) {
      const message = candidate.expose && candidate.message ? candidate.message : undefined;
      return status < 500
        ? new AppError(status, "REQUEST_FAILED", message ?? "The request could not be completed.", {
            cause: error,
          })
        : new InternalServerError(undefined, { cause: error });
    }
  }

  return new InternalServerError(undefined, { cause: error });
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  );

const wantsHtml = (req: Request): boolean => req.accepts(["json", "html"]) === "html";

export function errorHandler(options: ErrorHandlerOptions): ErrorRequestHandler {
  return (error, req, res, next) => {
    // The response is already streaming; the only correct move is to let Express destroy it.
    if (res.headersSent) {
      next(error);
      return;
    }

    // 1) Normalize library errors, database failures, and our own errors into one known shape.
    const appError = toAppError(error);
    const log = req.log ?? options.logger;

    const originalError = appError.cause instanceof Error ? appError.cause : appError;
    const logFields = {
      status: appError.status,
      code: appError.code,
      method: req.method,
      route: req.route?.path ?? req.path,
      err: originalError,
    };

    // 2) Keep the real error in server logs. Expected 4xx failures are quieter than server faults.
    if (appError.status >= 500) log.error("request errored", logFields);
    else log.debug("request rejected", { ...logFields, err: undefined });

    // 3) Some statuses need headers to be useful: 405 needs Allow and 429 needs Retry-After.
    if (appError.headers) {
      for (const [name, value] of Object.entries(appError.headers)) res.setHeader(name, value);
    }

    // 4) Build the safe public body. Unknown 500 messages are deliberately replaced.
    const body: ErrorBody = {
      code: appError.code,
      message: appError.expose ? appError.message : "An unexpected error occurred.",
    };

    if (appError.details !== undefined) body.details = appError.details;
    if (options.exposeStack && appError.stack) body.stack = appError.stack;

    res.status(appError.status);

    // 5) The read service may serve a tiny HTML page to a browser; APIs receive JSON.
    if (options.negotiateHtml && wantsHtml(req)) {
      res
        .type("html")
        .send(
          `<!doctype html><meta charset="utf-8"><title>${appError.status}</title>` +
            `<h1>${appError.status}</h1><p>${escapeHtml(body.message)}</p>`,
        );
      return;
    }

    res.json(errorEnvelope(body, req.id ?? "unknown"));
  };
}
