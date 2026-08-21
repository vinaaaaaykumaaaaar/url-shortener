import { createLogger, format, transports, type Logger as WinstonLogger } from "winston";

export type LogFields = Record<string, unknown>;

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface AppLogger {
    error(message: string, fields?: LogFields): void;
    warn(message: string, fields?: LogFields): void;
    info(message: string, fields?: LogFields): void;
    debug(message: string, fields?: LogFields): void;
    child(fields: LogFields): AppLogger;
    close(): Promise<void>;
}

export interface LoggerOptions {
    level: LogLevel;
    pretty: boolean;
    base?: LogFields;
}

const ESC = String.fromCharCode(27);

const ANSI = {
    reset: `${ESC}[0m`,
    dim: `${ESC}[2m`,
    red: `${ESC}[31m`,
    yellow: `${ESC}[33m`,
    cyan: `${ESC}[36m`,
    grey: `${ESC}[90m`,
} as const;

const LEVEL_COLOR: Record<string, string> = {
    error: ANSI.red,
    warn: ANSI.yellow,
    info: ANSI.cyan,
    debug: ANSI.grey,
};

/**
 * Error fields are non-enumerable, so `JSON.stringify(new Error("x"))` is `{}`.
 * Any log pipeline has to unwrap them explicitly or the failure detail vanishes.
 */
function serializeError(error: Error): LogFields {
    const serialized: LogFields = {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };

    const code = (error as { code?: unknown }).code;
    if (code !== undefined) serialized["code"] = code;

    if (error.cause instanceof Error) serialized["cause"] = serializeError(error.cause);
    else if (error.cause !== undefined) serialized["cause"] = error.cause;

    return serialized;
}

function normalizeFields(fields: LogFields | undefined): LogFields {
    if (!fields) return {};

    const normalized: LogFields = {};
    for (const [key, value] of Object.entries(fields)) {
        normalized[key] = value instanceof Error ? serializeError(value) : value;
    }
    return normalized;
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return /\s/.test(value) ? JSON.stringify(value) : value;
    if (value === null || typeof value !== "object") return String(value);
    return JSON.stringify(value);
}

const prettyFormat = format.printf((entry) => {
    const { level, message, timestamp, ...rest } = entry as Record<string, unknown> & {
        level: string;
        message: string;
    };

    const color = LEVEL_COLOR[level] ?? "";
    const head =
        `${ANSI.grey}${String(timestamp)}${ANSI.reset} ` +
        `${color}${level.toUpperCase().padEnd(5)}${ANSI.reset} ${String(message)}`;

    const err = rest["err"] as { name?: string; message?: string; stack?: string } | undefined;

    const pairs = Object.entries(rest)
        .filter(([key]) => key !== "err")
        .map(([key, value]) => `${ANSI.dim}${key}=${ANSI.reset}${formatValue(value)}`);

    const errSummary = err ? `${ANSI.dim}err=${ANSI.reset}${err.name}: ${err.message}` : "";
    const tail = [errSummary, ...pairs].filter(Boolean).join(" ");

    return [head, tail && `  ${tail}`, err?.stack && `${ANSI.grey}${err.stack}${ANSI.reset}`]
        .filter(Boolean)
        .join("\n");
});

export function createAppLogger(options: LoggerOptions): AppLogger {
    const winston = createLogger({
        level: options.level,
        defaultMeta: options.base,
        format: options.pretty
            ? format.combine(format.timestamp({ format: "HH:mm:ss.SSS" }), prettyFormat)
            : format.combine(format.timestamp(), format.json()),
        transports: [new transports.Console()],
    });

    return wrap(winston);
}

function wrap(winston: WinstonLogger): AppLogger {
    return {
        error: (message, fields) => void winston.error(message, normalizeFields(fields)),
        warn: (message, fields) => void winston.warn(message, normalizeFields(fields)),
        info: (message, fields) => void winston.info(message, normalizeFields(fields)),
        debug: (message, fields) => void winston.debug(message, normalizeFields(fields)),
        child: (fields) => wrap(winston.child(normalizeFields(fields))),
        close: () =>
            new Promise<void>((resolve) => {
                winston.once("finish", () => resolve());
                winston.end();
            }),
    };
}
