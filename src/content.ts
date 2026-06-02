import type { Content, ContentBuilder } from "spectrum-ts";

/**
 * Wrap an already-resolved inbound `Content` back into a `ContentBuilder`, so it
 * can be re-sent through `space.send(...)` / `message.reply(...)` (which take
 * builders). Useful for echo / relay handlers.
 */
export const passthrough = (content: Content): ContentBuilder => ({
  build: async () => content,
});
