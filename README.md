# @photon-ai/adapter-core

Shared building blocks for [Spectrum](https://photon.codes/spectrum) **client-side
adapters** — the small packages that consume [Fusor](https://github.com/photon-hq/fusor)
webhook deliveries and integrate a messaging platform with the `spectrum-ts` SDK
via `defineFusorPlatform`. Extracted from the reference adapters
([`@photon-ai/linq`](https://github.com/photon-hq/linq),
[`@photon-ai/telegram`](https://github.com/photon-hq/telegram)) so each one isn't
re-implementing the same webhook plumbing.

`spectrum-ts` is a **peer dependency**; there are no runtime dependencies.

## Install

```sh
bun add @photon-ai/adapter-core spectrum-ts
```

## What's in here

### `crypto` — webhook signature primitives

```typescript
import { safeEqualHex, safeEqualUtf8, hmacHex, verifyHmac, assertFresh } from "@photon-ai/adapter-core";

// HMAC schemes (e.g. LinQ signs `${timestamp}.${rawBody}`):
assertFresh(timestamp, 300); // replay guard — throws if stale / non-numeric
if (!verifyHmac({ secret, signedValue: `${timestamp}.${bodyText}`, signature })) {
  throw new Error("…webhook signature mismatch");
}

// Shared secret-token schemes (e.g. Telegram's X-Telegram-Bot-Api-Secret-Token):
if (!safeEqualUtf8(headerToken, config.secretToken)) {
  throw new Error("…secret token mismatch");
}
```

All comparisons are constant-time and return `false` (never throw) on unequal /
zero length — they leak only length equality, never contents.

### `store` — cache the outbound client

`createClient` returns the inbound Fusor brand, so build your outbound client
once and cache it on the per-platform `store`:

```typescript
import { createClientCache, type StoreLike } from "@photon-ai/adapter-core";

const clientCache = createClientCache<MyClient>("myplatform.client");

export const initClient = (store: StoreLike, config: MyConfig) =>
  clientCache.init(store, () => makeClient(config));   // in lifecycle.createClient
export const getClient = (store: StoreLike, config: MyConfig) =>
  clientCache.get(store, () => makeClient(config));    // in send
```

`StoreLike` is the structural shape of spectrum-ts's internal store (which it
does not export as a type).

### `dedup` — at-most-once handling

```typescript
import { boundedSeenSet } from "@photon-ai/adapter-core";

const seenSet = boundedSeenSet();          // bounded, insertion-order eviction
if (seenSet.seen(message.id)) return;      // Fusor delivery is at-least-once
```

### `content` — re-send resolved content

```typescript
import { passthrough } from "@photon-ai/adapter-core";

await message.reply(passthrough(message.content)); // echo an inbound Content back
```

### `lifecycle` — optional `createClient` sugar

```typescript
import { makeFusorLifecycle } from "@photon-ai/adapter-core";

defineFusorPlatform(MY_PLATFORM, {
  // …
  lifecycle: makeFusorLifecycle({ name: MY_PLATFORM, verify: makeVerify, init: initClient }),
});
```

Equivalent to wiring `fusor(name, makeVerify(config))` by hand inside
`createClient`; use it only to trim the repeated boilerplate.

## See also

- [`spectrum-ts`](https://github.com/photon-hq/spectrum-ts) — the SDK and the `defineFusorPlatform` / `fusor` contract.
- [`fusor` client-adapters guide](https://github.com/photon-hq/fusor/blob/main/docs/client-adapters.md) — how an adapter consumes Fusor's delivery.
