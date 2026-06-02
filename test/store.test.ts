import { describe, expect, it } from "bun:test";
import { createClientCache, type StoreLike } from "../src/store";

const makeStore = (): StoreLike => {
  const map = new Map<string, unknown>();
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
  };
};

describe("createClientCache", () => {
  it("init builds, stores, and returns the value", () => {
    const cache = createClientCache<{ n: number }>("k");
    const store = makeStore();
    const value = cache.init(store, () => ({ n: 1 }));
    expect(value).toEqual({ n: 1 });
    expect(store.get("k")).toBe(value);
  });

  it("get returns the cached value without rebuilding", () => {
    const cache = createClientCache<{ n: number }>("k");
    const store = makeStore();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { n: calls };
    };
    const first = cache.init(store, factory);
    expect(cache.get(store, factory)).toBe(first);
    expect(cache.get(store, factory)).toBe(first);
    expect(calls).toBe(1);
  });

  it("get builds exactly once when the store is empty", () => {
    const cache = createClientCache<{ n: number }>("k");
    const store = makeStore();
    let calls = 0;
    const value = cache.get(store, () => {
      calls += 1;
      return { n: 42 };
    });
    expect(value).toEqual({ n: 42 });
    expect(calls).toBe(1);
    expect(store.get("k")).toBe(value);
  });

  it("keeps separate keys from colliding on one store", () => {
    const a = createClientCache<string>("a");
    const b = createClientCache<string>("b");
    const store = makeStore();
    a.init(store, () => "A");
    b.init(store, () => "B");
    expect(a.get(store, () => "x")).toBe("A");
    expect(b.get(store, () => "y")).toBe("B");
  });
});
