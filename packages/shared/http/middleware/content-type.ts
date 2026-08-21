import type { RequestHandler } from "express";
import { UnsupportedMediaTypeError } from "../errors";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * `express.json()` ignores requests whose Content-Type is not JSON and leaves `req.body`
 * undefined rather than failing. Without this guard a `text/plain` POST reaches validation and
 * is reported as a missing-field 400, which sends the caller looking in the wrong place.
 */
export function requireContentType(accepted: readonly string[] = ["application/json"]): RequestHandler {
  return (req, _res, next) => {
    if (!METHODS_WITH_BODY.has(req.method)) {
      next();
      return;
    }

    if (!req.is(accepted as string[])) {
      next(new UnsupportedMediaTypeError(accepted));
      return;
    }

    next();
  };
}
