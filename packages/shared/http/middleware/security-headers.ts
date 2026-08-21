import type { RequestHandler } from "express";

export interface SecurityHeaderOptions {
  /** Send HSTS. Only meaningful once traffic is actually HTTPS, and it is hard to undo. */
  hsts?: boolean;
}

/**
 * `Referrer-Policy: no-referrer` is the load-bearing one for a shortener: without it the browser
 * sends the short URL to the destination site in the `Referer` header, handing every destination
 * a log of which link brought each visitor.
 */
export function securityHeaders(options: SecurityHeaderOptions = {}): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    if (options.hsts) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  };
}
