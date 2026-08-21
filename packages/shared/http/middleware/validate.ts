import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors";

/**
 * A route may validate any combination of these three request parts.
 *
 * Most routes in this tutorial use only one part:
 * - POST /api/v1/urls validates `body`
 * - GET /:shortCode validates `params`
 *
 * Keeping the shape general lets you add query-string validation later without learning a
 * second middleware pattern.
 */
export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export interface FieldIssue {
  source: "body" | "params" | "query";
  field: string;
  code: string;
  message: string;
}

export interface ValidateOptions {
  /**
   * Most invalid input is a 400. The redirect route intentionally changes invalid short codes
   * to 404 because, to a visitor, an invalid code and a missing code mean the same thing.
   */
  onInvalid?: (issues: FieldIssue[], req: Request) => Error;
}

/**
 * Express middleware runs before the controller. Zod changes untrusted `unknown` input into a
 * checked value and we save that value on `req.validated`.
 *
 * We do not overwrite `req.body`, `req.params`, or `req.query`. Keeping raw and validated input
 * separate makes debugging clearer, and Express 5 does not allow `req.query` to be replaced.
 */
export function validateRequest(
  schemas: RequestSchemas,
  options: ValidateOptions = {},
): RequestHandler {
  return (req, _res, next) => {
    const issues: FieldIssue[] = [];

    for (const source of ["body", "params", "query"] as const) {
      const schema = schemas[source];
      if (!schema) continue;

      // An absent JSON body is treated as an empty object so Zod can report the missing fields.
      const rawValue = source === "body" && req.body === undefined ? {} : req[source];
      const result = schema.safeParse(rawValue);

      if (result.success) {
        req.validated[source] = result.data;
        continue;
      }

      for (const issue of result.error.issues) {
        issues.push({
          source,
          field: issue.path.map(String).join(".") || source,
          code: issue.code,
          message: issue.message,
        });
      }
    }

    if (issues.length > 0) {
      next(
        options.onInvalid?.(issues, req) ??
          new ValidationError("The request failed validation.", { details: { issues } }),
      );
      return;
    }

    next();
  };
}

/**
 * TypeScript cannot automatically know that an earlier Express middleware filled in a value.
 * This small helper is the bridge between runtime validation (Zod) and compile-time types.
 *
 * IMPORTANT: call it only in a route that uses `validateRequest` for the same source. The
 * runtime guard catches wiring mistakes during development instead of returning undefined.
 * `T` is still a TypeScript assertion, not another validation step, so always use the type
 * inferred from the exact schema mounted by that route.
 */
export function getValidated<T>(
  req: Request,
  source: "body" | "params" | "query",
): T {
  const value = req.validated[source];
  if (value === undefined) {
    throw new Error(`Route did not validate request ${source} before the controller ran.`);
  }
  return value as T;
}
