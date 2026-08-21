import type { RequestHandler } from "express";

export interface RequestLoggerOptions {
  /** Paths logged at debug instead of info — orchestrator probes would otherwise dominate the log. */
  quietPaths?: readonly string[];
}

/**
 * One line per request, emitted on completion so it can carry the status and duration.
 * `route` is the matched pattern rather than the raw path: `/:shortCode` stays a single
 * series in logs and metrics instead of exploding into one per short code.
 */
export function requestLogger(options: RequestLoggerOptions = {}): RequestHandler {
  const quietPaths = options.quietPaths ?? [];

  return (req, res, next) => {
    let settled = false;

    const finish = (outcome: "completed" | "aborted"): void => {
      if (settled) return;
      settled = true;

      const durationMs = Math.round((performance.now() - req.startedAt) * 100) / 100;
      const fields = {
        method: req.method,
        route: req.route?.path ?? req.path,
        status: res.statusCode,
        durationMs,
      };

      const quiet = quietPaths.some((prefix) => req.path.startsWith(prefix));

      if (outcome === "aborted") req.log.warn("request aborted", fields);
      else if (res.statusCode >= 500) req.log.error("request failed", fields);
      else if (res.statusCode >= 400) req.log.warn("request rejected", fields);
      else if (quiet) req.log.debug("request completed", fields);
      else req.log.info("request completed", fields);
    };

    res.on("finish", () => finish("completed"));
    res.on("close", () => finish(res.writableEnded ? "completed" : "aborted"));

    next();
  };
}
