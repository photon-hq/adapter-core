import { describe, expect, it } from "bun:test";
import { boundedSeenSet } from "../src/dedup";

describe("boundedSeenSet", () => {
  it("returns false on first sight and true on repeat", () => {
    const set = boundedSeenSet();
    expect(set.seen("a")).toBe(false);
    expect(set.seen("a")).toBe(true);
  });

  it("tracks distinct ids independently", () => {
    const set = boundedSeenSet();
    expect(set.seen("a")).toBe(false);
    expect(set.seen("b")).toBe(false);
    expect(set.seen("a")).toBe(true);
    expect(set.seen("b")).toBe(true);
  });

  it("evicts the oldest id past the cap", () => {
    const set = boundedSeenSet(3);
    expect(set.seen("a")).toBe(false);
    expect(set.seen("b")).toBe(false);
    expect(set.seen("c")).toBe(false);
    expect(set.seen("d")).toBe(false); // "a" is evicted here
    expect(set.seen("a")).toBe(false); // re-added because it was evicted
    expect(set.seen("d")).toBe(true); // still tracked
  });
});
