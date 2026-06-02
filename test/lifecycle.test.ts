import { describe, expect, it } from "bun:test";
import { isFusorClient } from "spectrum-ts";
import { makeFusorLifecycle } from "../src/lifecycle";
import type { StoreLike } from "../src/store";

const makeStore = (): StoreLike => {
  const map = new Map<string, unknown>();
  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
  };
};

describe("makeFusorLifecycle", () => {
  it("runs init and returns a fusor client from createClient", async () => {
    let initialized = false;
    const lifecycle = makeFusorLifecycle<{ ok: boolean }, { token: string }>({
      name: "demo",
      verify: () => () => ({ ok: true }),
      init: (store, config) => {
        store.set("demo.client", { token: config.token });
        initialized = true;
      },
    });

    const store = makeStore();
    const client = await lifecycle.createClient({
      config: { token: "t" },
      store,
    });

    expect(initialized).toBe(true);
    expect(store.get("demo.client")).toEqual({ token: "t" });
    expect(isFusorClient(client)).toBe(true);
  });
});
