import type { Response } from "express";

export interface ResponseMeta {
    requestId: string;
    timestamp: string;
}

export interface SuccessEnvelope<T> {
    data: T;
    meta: ResponseMeta;
}

export interface ErrorBody {
    code: string;
    message: string;
    details?: unknown;
    /** Development only — never populated when the app runs in production. */
    stack?: string;
}

export interface ErrorEnvelope {
    error: ErrorBody;
    meta: ResponseMeta;
}

const meta = (requestId: string): ResponseMeta => ({
    requestId,
    timestamp: new Date().toISOString(),
});

export const successEnvelope = <T>(data: T, requestId: string): SuccessEnvelope<T> => ({
    data,
    meta: meta(requestId),
});

export const errorEnvelope = (error: ErrorBody, requestId: string): ErrorEnvelope => ({
    error,
    meta: meta(requestId),
});

export function sendData<T>(
    res: Response,
    status: number,
    data: T,
    headers?: Record<string, string>,
): void {
    if (headers) {
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    }
    res.status(status).json(successEnvelope(data, (res.req as typeof res.req & { id: string }).id));
}
