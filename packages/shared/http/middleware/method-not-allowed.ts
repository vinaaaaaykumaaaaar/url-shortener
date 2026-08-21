import type { RequestHandler } from "express";
import { MethodNotAllowedError } from "../errors";

/**
 * Mount after the handlers for a path. 405 plus an `Allow` header says "this resource exists,
 * that verb does not" — 404 would wrongly claim the resource itself is missing.
 */
export function methodNotAllowed(allowed: readonly string[]): RequestHandler {
  return (_req, _res, next) => next(new MethodNotAllowedError(allowed));
}
