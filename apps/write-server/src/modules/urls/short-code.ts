const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MAX_UNBIASED_BYTE = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
const REJECTION_RATE = MAX_UNBIASED_BYTE / 256;

export function byteToAlphabetIndex(byte: number): number | undefined {
    return byte < MAX_UNBIASED_BYTE ? byte % ALPHABET.length : undefined;
}

export function generateShortCode(length: number): string {
    if (!Number.isInteger(length) || length < 1) {
        throw new RangeError(`Short code length must be a positive integer, received ${length}.`);
    }

    let code = "";

    while (code.length < length) {
        // Over-allocate by the expected rejection rate so one pass almost always suffices.
        const remaining = length - code.length;
        const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(remaining / REJECTION_RATE) + 4));

        for (const byte of bytes) {
            const alphabetIndex = byteToAlphabetIndex(byte);
            if (alphabetIndex === undefined) continue;
            code += ALPHABET.charAt(alphabetIndex);
            if (code.length === length) break;
        }
    }

    return code;
}

export const shortCodeKeyspace = (length: number): number => ALPHABET.length ** length;