import { z } from "zod";

export const MAX_LONG_URL_LENGTH = 2_048;
export const MIN_SHORT_CODE_LENGTH = 4;
export const MAX_SHORT_CODE_LENGTH = 32;

/**
 * Paths the read server serves itself. A short code equal to one of these would be shadowed by
 * the route that owns it, so the code could be created but never resolved.
 */
export const RESERVED_SHORT_CODES: ReadonlySet<string> = new Set([
    "health",
    "healthz",
    "live",
    "ready",
    "metrics",
    "api",
    "admin",
    "static",
    "assets",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    ".well-known",
]);

/**
 * Shared so the two services cannot drift. If the write server accepted a character the read
 * server rejected, it would mint links that 404 forever.
 */
export const shortCodeSchema = z
    .string()
    .trim()
    .min(MIN_SHORT_CODE_LENGTH)
    .max(MAX_SHORT_CODE_LENGTH)
    .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscores, and hyphens.");

/**
 * The WHATWG URL parser silently strips tabs, CR and LF, so a target containing them still
 * parses as a valid URL. Rejecting them outright reports what happened instead of quietly
 * storing something the caller did not write.
 */
function hasControlCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code < 32 || code === 127) return true;
    }
    return false;
}

export const longUrlSchema = z
    .string()
    .trim()
    .min(1)
    .max(MAX_LONG_URL_LENGTH)
    .refine((value) => !hasControlCharacter(value), "Must not contain control characters.")
    .pipe(
        z.url({
            // `z.regexes.domain` requires a registrable domain name, which also rejects bare IP
            // addresses and `localhost` — two forms a public short link has no business pointing at.
            protocol: /^https?$/,
            hostname: z.regexes.domain,
            error: "Must be a valid http or https URL.",
        }),
    )
    // Canonicalise on write: lowercases the host, drops a default port, percent-encodes what has
    // to be encoded. One stored spelling per destination, and a value already safe for a
    // Location header.
    .transform((value) => new URL(value).href);

const PRIVATE_HOSTNAMES: ReadonlySet<string> = new Set([
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata",
]);

const PRIVATE_SUFFIXES = [".localhost", ".internal", ".local", ".home.arpa"];

function isPrivateIpv4(hostname: string): boolean {
    const parts = hostname.split(".");
    if (parts.length !== 4) return false;

    const octets = parts.map((part) => (/^[0-9]{1,3}$/.test(part) ? Number(part) : Number.NaN));
    if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) return false;

    const [a = 0, b = 0] = octets;

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT

    return false;
}

/**
 * Blocks links that only resolve inside a private network. The server never fetches the target,
 * so this is not SSRF — the risk is that a public short link points a victim's own browser at
 * something on their network (a router admin page, a cloud metadata endpoint).
 *
 * Not airtight by construction: a public hostname can resolve to a private address, and can
 * change after this check. Treat it as abuse reduction, not a security boundary.
 */
export function isPrivateTarget(rawUrl: string): boolean {
    let hostname: string;
    try {
        hostname = new URL(rawUrl).hostname.toLowerCase();
    } catch {
        return false;
    }

    const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

    if (PRIVATE_HOSTNAMES.has(bare)) return true;
    if (PRIVATE_SUFFIXES.some((suffix) => bare.endsWith(suffix))) return true;
    if (isPrivateIpv4(bare)) return true;

    if (bare === "::1" || bare === "::") return true;
    if (bare.startsWith("fc") || bare.startsWith("fd") || bare.startsWith("fe80:")) return true;

    return false;
}
