import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { AppLogger } from "../../logger";

/**
 * An inbound id is reflected back into a response header and into logs, so it is only trusted
 * when it looks like an id — otherwise a caller could inject newlines into the log stream.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function requestContext(logger: AppLogger): RequestHandler {
  return (req, res, next) => {
    const inbound = req.get("x-request-id");

    req.id = inbound && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();
    req.startedAt = performance.now();
    req.log = logger.child({ requestId: req.id });
    req.validated = {};

    res.setHeader("X-Request-Id", req.id);
    next();
  };
}
