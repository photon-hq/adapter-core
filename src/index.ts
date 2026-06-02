// Public entry for `@photon-ai/adapter-core` — the shared toolkit Spectrum
// client-side adapters (e.g. `@photon-ai/telegram`) build on. Named re-exports
// only; this is the package's API surface.

// biome-ignore lint/performance/noBarrelFile: this is the package's single public API entry point
export { defineFusorAdapter, type FusorAdapterSpec } from "./adapter";
export { passthrough } from "./content";
export {
  assertFresh,
  hmacHex,
  safeEqualHex,
  safeEqualUtf8,
  verifyHmac,
} from "./crypto";
export { boundedSeenSet, type SeenSet } from "./dedup";
export { makeFusorLifecycle } from "./lifecycle";
export { type ClientCache, createClientCache, type StoreLike } from "./store";
