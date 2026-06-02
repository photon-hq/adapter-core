import { createHmac, timingSafeEqual } from "node:crypto";

const MILLIS_PER_SECOND = 1000;

/**
 * Constant-time compare of two hex-encoded strings (e.g. an expected HMAC digest
 * against a signature header). Returns `false` — never throws — on zero-length or
 * unequal-length input (`timingSafeEqual` throws on length mismatch, so the
 * length is checked first; this leaks only length equality, never contents).
 */
export const safeEqualHex = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return (
    left.length > 0 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
};

/**
 * Constant-time compare of two UTF-8 strings (e.g. a shared secret token against
 * a request header). Same length-guard semantics as {@link safeEqualHex}: an
 * empty string never matches.
 */
export const safeEqualUtf8 = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return (
    left.length > 0 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
};

/** HMAC-SHA256 of `payload` keyed by `secret`, as a hex digest. */
export const hmacHex = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("hex");

/**
 * Verify an HMAC-SHA256 signature over a platform-defined signed string. The
 * caller assembles `signedValue` (often `` `${timestamp}.${rawBody}` ``) so the
 * per-platform signing scheme is not baked in here. Constant-time; returns a
 * boolean so the caller can throw a platform-branded error.
 */
export const verifyHmac = (params: {
  secret: string;
  signedValue: string;
  signature: string;
}): boolean =>
  safeEqualHex(hmacHex(params.secret, params.signedValue), params.signature);

/**
 * Throw if `timestampSec` is non-numeric or more than `toleranceSec` away from
 * now — a replay guard for signed-timestamp schemes. Accepts a string (headers
 * arrive as strings) or number.
 */
export const assertFresh = (
  timestampSec: string | number,
  toleranceSec: number
): void => {
  const ts = Number(timestampSec);
  if (!Number.isFinite(ts)) {
    throw new Error("webhook timestamp is not numeric");
  }
  const nowSec = Date.now() / MILLIS_PER_SECOND;
  if (Math.abs(nowSec - ts) > toleranceSec) {
    throw new Error("webhook timestamp outside tolerance (possible replay)");
  }
};
