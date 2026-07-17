import { describe, expect, test } from "bun:test";

// session-token reads AUTH_SECRET lazily (per call, via env's getter), so
// setting it here — before any sign/verify call — is sufficient even
// though the import is hoisted above this line.
process.env.AUTH_SECRET ??= "test-only-secret";

import {
  constantTimeStringEquals,
  signSessionToken,
  verifySessionToken,
} from "./session-token";

describe("session token sign/verify", () => {
  test("a freshly signed, unexpired token verifies", () => {
    const token = signSessionToken(Date.now() + 60_000);
    expect(verifySessionToken(token)).toBe(true);
  });

  test("an expired token is rejected", () => {
    const token = signSessionToken(Date.now() - 1_000);
    expect(verifySessionToken(token)).toBe(false);
  });

  test("a tampered payload (extended expiry, original signature) is rejected", () => {
    const token = signSessionToken(Date.now() + 60_000);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ exp: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
    ).toString("base64url");
    expect(verifySessionToken(`${forgedPayload}.${signature}`)).toBe(false);
  });

  test("a tampered signature is rejected", () => {
    const token = signSessionToken(Date.now() + 60_000);
    const [payload, signature] = token.split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(verifySessionToken(`${payload}.${flipped}`)).toBe(false);
  });

  test("malformed and missing tokens are rejected, never throw", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("no-dot-in-sight")).toBe(false);
    expect(verifySessionToken("only.")).toBe(false);
    expect(verifySessionToken(".only")).toBe(false);
    expect(verifySessionToken("not-base64url.not-a-signature")).toBe(false);
  });
});

describe("constantTimeStringEquals", () => {
  test("equal strings compare true", () => {
    expect(constantTimeStringEquals("1234", "1234")).toBe(true);
  });

  test("different strings compare false", () => {
    expect(constantTimeStringEquals("1234", "1235")).toBe(false);
  });

  test("length mismatch compares false instead of throwing", () => {
    // Raw timingSafeEqual throws on length mismatch; the sha256
    // normalization must turn that into a clean false.
    expect(constantTimeStringEquals("1234", "12345678")).toBe(false);
    expect(constantTimeStringEquals("", "1234")).toBe(false);
  });
});
