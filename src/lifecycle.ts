import { type FusorVerify, fusor } from "spectrum-ts";
import type { StoreLike } from "./store";

/**
 * Build the `lifecycle.createClient` for a Fusor platform: run `init` (which
 * builds + caches the outbound client on `store`) and return the inbound
 * `fusor(name, verify)` brand. `verify` and `init` receive the resolved config,
 * so they can close over it.
 *
 * Optional sugar — the inline form (call `fusor(...)` directly inside
 * `createClient`) is equally valid and keeps the `defineFusorPlatform` shape
 * fully visible; reach for this only to trim the repeated wiring.
 */
export const makeFusorLifecycle = <TPayload, TConfig>(params: {
  name: string;
  verify: (config: TConfig) => FusorVerify<TPayload>;
  init: (store: StoreLike, config: TConfig) => void;
}): {
  createClient: (ctx: {
    config: TConfig;
    store: StoreLike;
  }) => Promise<ReturnType<typeof fusor<TPayload>>>;
} => ({
  createClient: ({ config, store }) => {
    params.init(store, config);
    return Promise.resolve(fusor<TPayload>(params.name, params.verify(config)));
  },
});
