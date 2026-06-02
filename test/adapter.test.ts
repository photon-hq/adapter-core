import { describe, expect, it } from "bun:test";
import { RawInboundEvent } from "@photon-ai/proto/photon/fusor/v1/inbound";
import { type Message, type Space, Spectrum } from "spectrum-ts";
import { asText } from "spectrum-ts/authoring";
import z from "zod";
import { defineFusorAdapter } from "../src/adapter";

interface FakeClient {
  tag: string;
}

interface FakeEvent {
  id: string;
  text: string;
}

// A minimal adapter built entirely through the contract — no fusor()/cache
// wiring by hand. `verify` returns a parsed event; `messages` maps it using the
// client the builder threads in (proving the inbound-client plumbing works).
const fake = defineFusorAdapter({
  platform: "fake",
  config: z.object({ token: z.string() }),
  makeClient: (config): FakeClient => ({ tag: `client:${config.token}` }),
  verify: (req): FakeEvent =>
    JSON.parse(new TextDecoder().decode(req.rawBody)) as FakeEvent,
  messages: (event, { client }) => ({
    id: event.id,
    content: asText(`${client.tag}:${event.text}`),
    space: { id: "space-1" },
  }),
  send: ({ content }) =>
    Promise.resolve({ id: "out", content, space: { id: "space-1" } }),
  resolveUser: ({ input }) => Promise.resolve({ id: input.userID }),
  resolveSpace: ({ input }) =>
    Promise.resolve({ id: input.users[0]?.id ?? "space-1" }),
});

const encode = (body: string): Uint8Array => {
  const wire = `POST /fake HTTP/1.1\r\ncontent-type: application/json\r\n\r\n${body}`;
  return RawInboundEvent.encode(
    RawInboundEvent.create({
      eventId: "e",
      projectId: "p",
      platform: "fake",
      rawRequest: new TextEncoder().encode(wire),
    })
  ).finish();
};

describe("defineFusorAdapter", () => {
  it("threads the cached client into inbound mapping and delivers", async () => {
    const app = await Spectrum({ providers: [fake.config({ token: "abc" })] });
    let resolve: (() => void) | undefined;
    const ready = new Promise<void>((r) => {
      resolve = r;
    });
    const received: Message[] = [];

    const result = await app.webhook(
      { headers: {}, body: encode(JSON.stringify({ id: "m1", text: "hi" })) },
      (_space: Space, message: Message) => {
        received.push(message);
        resolve?.();
      }
    );
    expect(result.status).toBe(200);
    await ready;

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe("m1");
    expect(received[0]?.platform).toBe("fake");
    // "client:abc" proves makeClient(config) ran and was threaded into messages.
    expect(received[0]?.content).toEqual({
      type: "text",
      text: "client:abc:hi",
    });

    await app.stop();
  });

  it("rejects a verify throw as poison (400)", async () => {
    const app = await Spectrum({ providers: [fake.config({ token: "abc" })] });
    const result = await app.webhook(
      { headers: {}, body: encode("not json") },
      () => undefined
    );
    expect(result.status).toBe(400);
    await app.stop();
  });
});
