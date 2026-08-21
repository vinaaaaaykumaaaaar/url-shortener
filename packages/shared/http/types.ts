import type { AppLogger } from "../logger/logger";

/**
 * Express's published Request type does not know about fields our middleware adds. TypeScript
 * declaration merging extends that existing interface for this project.
 *
 * This block creates NO runtime values. `requestContext` is still responsible for assigning the
 * fields before controllers use them; these declarations only teach the compiler their shapes.
 */
declare global {
    namespace Express {
        interface Request {
            /** Correlation id echoed as `X-Request-Id` and attached to every log line for this request. */
            id: string;
            /** Request-scoped logger; already carries `requestId`. */
            log: AppLogger;
            startedAt: number;
            /**
             * Output of the validation middleware. Express 5 makes `req.query` read-only, and
             * overwriting `req.body`/`req.params` in place would hide what was actually received,
             * so validated values live here instead of replacing the raw input.
             */
            validated: { body?: unknown; params?: unknown; query?: unknown };
        }
    }
}

export { };
