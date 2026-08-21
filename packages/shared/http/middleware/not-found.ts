import type { RequestHandler } from "express";
import { NotFoundError } from "../errors";

/**
 * Mounted after every route so an unmatched request becomes a normal AppError instead of
 * Express's default HTML page, which would break the response contract for API clients.
 */
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(
      new NotFoundError(`No route matches ${req.method} ${req.path}.`, {
        code: "ROUTE_NOT_FOUND",
      }),
    );
  };
}
