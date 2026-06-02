/**
 * The minimal structural shape of spectrum-ts's per-platform key-value store,
 * which is reachable on the lifecycle / send ctx but **not** exported as a type
 * from `spectrum-ts`. Adapters depend on this subset; the real `Store` is a
 * structural superset, so passing it where a `StoreLike` is expected type-checks.
 */
export interface StoreLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface ClientCache<T> {
  /** Read the cached value, building + caching it via `factory` when absent. */
  get(store: StoreLike, factory: () => T): T;
  /** Build via `factory`, cache it under the key, and return it. */
  init(store: StoreLike, factory: () => T): T;
}

/**
 * A typed store-cache bound to one string key — generalizes the
 * `initClient` / `getClient` pattern adapters use to build their outbound client
 * once (in `createClient`) and read it back in `send`. The `factory` is supplied
 * at each call site (closing over config), so the cache itself stays
 * config-agnostic and never captures a stale config.
 */
export const createClientCache = <T>(key: string): ClientCache<T> => {
  const init = (store: StoreLike, factory: () => T): T => {
    const value = factory();
    store.set(key, value);
    return value;
  };
  const get = (store: StoreLike, factory: () => T): T =>
    (store.get(key) as T | undefined) ?? init(store, factory);
  return { get, init };
};
