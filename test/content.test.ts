import { describe, expect, it } from "bun:test";
import { asText, asVoice } from "spectrum-ts/authoring";
import { passthrough } from "../src/content";

describe("passthrough", () => {
  it("wraps resolved text content into a builder that returns it", async () => {
    const content = asText("hello");
    expect(await passthrough(content).build()).toBe(content);
  });

  it("round-trips non-text content by reference", async () => {
    const content = asVoice({
      mimeType: "audio/ogg",
      read: () => Promise.resolve(Buffer.alloc(0)),
    });
    expect(await passthrough(content).build()).toBe(content);
  });
});
