import type { Request, RequestHandler } from "express";
import { TooManyRequestsError } from "../errors";

export interface RateLimitHit {
  count: number;
  resetAt: number;
}

/**
 * A later exercise can swap the in-memory store for a Redis-backed one. That makes the limit
 * global instead of per-process. With N replicas the memory store allows N times the intended
 * rate because each process counts only its own share of the traffic.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
  close(): void;
}

/**
 * A small class is used here because the store owns state (the counters) and a resource (the
 * cleanup timer). `private` means only methods in this class may change those values.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitHit>();
  private readonly sweeper: ReturnType<typeof setInterval>;

  constructor(sweepIntervalMs = 60_000) {
    this.sweeper = setInterval(() => this.sweep(), sweepIntervalMs);
    // Never hold the event loop open just to expire counters.
    this.sweeper.unref?.();
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      return fresh;
    }

    existing.count += 1;
    return existing;
  }

  close(): void {
    clearInterval(this.sweeper);
    this.buckets.clear();
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  store?: RateLimitStore;
  /** Defaults to the client IP, which is only trustworthy when `trust proxy` matches your edge. */
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const store = options.store ?? new MemoryRateLimitStore();
  const keyOf = options.keyGenerator ?? ((req: Request) => req.ip ?? "unknown");

  return (req, res, next) => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    store
      .hit(keyOf(req), options.windowMs)
      .then((hit) => {
        const remaining = Math.max(0, options.max - hit.count);
        const resetSeconds = Math.max(0, Math.ceil((hit.resetAt - Date.now()) / 1000));

        res.setHeader("RateLimit-Limit", String(options.max));
        res.setHeader("RateLimit-Remaining", String(remaining));
        res.setHeader("RateLimit-Reset", String(resetSeconds));

        if (hit.count > options.max) {
          next(new TooManyRequestsError(resetSeconds));
          return;
        }

        next();
      })
      .catch(next);
  };
}
