import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const SESSION_COOKIE_NAME = "bms_session";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Hashes both inputs to a fixed-length digest before comparing, so a PIN
 * shorter or longer than APP_PIN never hits `timingSafeEqual`'s
 * length-mismatch throw, and comparison time doesn't leak input length.
 */
export function constantTimeStringEquals(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a).digest();
  const bufB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bufA, bufB);
}

function hmac(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("base64url");
}

/** `base64url(payload).base64url(hmacSha256(payload))` — no external JWT dependency. */
export function signSessionToken(expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = hmac(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
