import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  assertFresh,
  hmacHex,
  safeEqualHex,
  safeEqualUtf8,
  verifyHmac,
} from "../src/crypto";

const nowSec = (): number => Math.floor(Date.now() / 1000);

describe("safeEqualHex", () => {
  it("returns true for equal hex strings", () => {
    expect(safeEqualHex("deadbeef", "deadbeef")).toBe(true);
  });

  it("returns false for differing equal-length hex", () => {
    expect(safeEqualHex("deadbeef", "deadbee0")).toBe(false);
  });

  it("returns false for unequal-length hex without throwing", () => {
    expect(safeEqualHex("dead", "deadbeef")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("safeEqualUtf8", () => {
  it("returns true for equal strings", () => {
    expect(safeEqualUtf8("s3cr3t-token", "s3cr3t-token")).toBe(true);
  });

  it("returns false for differing equal-length strings", () => {
    expect(safeEqualUtf8("aaaa", "aaab")).toBe(false);
  });

  it("returns false for unequal-length strings without throwing", () => {
    expect(safeEqualUtf8("abc", "abcd")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(safeEqualUtf8("", "")).toBe(false);
  });
});

describe("hmacHex / verifyHmac", () => {
  it("matches node's HMAC-SHA256 hex digest", () => {
    const expected = createHmac("sha256", "k").update("msg").digest("hex");
    expect(hmacHex("k", "msg")).toBe(expected);
  });

  it("verifies a correct signature", () => {
    const signature = hmacHex("secret", "12345.body");
    expect(
      verifyHmac({ secret: "secret", signedValue: "12345.body", signature })
    ).toBe(true);
  });

  it("rejects a tampered signed value", () => {
    const signature = hmacHex("secret", "12345.body");
    expect(
      verifyHmac({ secret: "secret", signedValue: "12345.evil", signature })
    ).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const signature = hmacHex("secret", "12345.body");
    expect(
      verifyHmac({ secret: "other", signedValue: "12345.body", signature })
    ).toBe(false);
  });
});

describe("assertFresh", () => {
  it("accepts a current timestamp (number and string)", () => {
    expect(() => assertFresh(nowSec(), 300)).not.toThrow();
    expect(() => assertFresh(String(nowSec()), 300)).not.toThrow();
  });

  it("throws for a stale timestamp", () => {
    expect(() => assertFresh(nowSec() - 600, 60)).toThrow("tolerance");
  });

  it("throws for a future timestamp beyond tolerance", () => {
    expect(() => assertFresh(nowSec() + 600, 60)).toThrow("tolerance");
  });

  it("throws for a non-numeric timestamp", () => {
    expect(() => assertFresh("not-a-number", 300)).toThrow("numeric");
  });
});
