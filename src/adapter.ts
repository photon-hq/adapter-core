import {
  type Content,
  defineFusorPlatform,
  type FusorMessagesReturn,
  type FusorRespond,
  type FusorVerifyRequest,
  fusor,
} from "spectrum-ts";
import type { ProviderMessageRecord } from "spectrum-ts/authoring";
import type z from "zod";
import { createClientCache, type StoreLike } from "./store";

/**
 * The contract a Spectrum client-side adapter must satisfy. Captures the
 * platform-specific pieces — everything generic (the `fusor()` brand, the
 * outbound-client cache, threading the client into inbound mapping, the
 * name-in-three-places wiring) is supplied by {@link defineFusorAdapter}.
 *
 * `TEvent` is your platform's parsed native event (what `verify` returns and
 * `messages` maps); `TClient` is your outbound API client.
 */
export interface FusorAdapterSpec<
  TName extends string,
  TConfigSchema extends z.ZodType<object>,
  TEvent,
  TClient,
  TResolvedUser extends { id: string },
  TResolvedSpace extends { id: string },
  TSpaceParamsSchema extends z.ZodType<object> | undefined = undefined,
> {
  /** A `zod` object schema for user-supplied config (keys, secrets, options). */
  config: TConfigSchema;

  /**
   * Build the outbound client from config. Called once per provider instance;
   * the result is cached on `store` and threaded into `verify` / `messages` /
   * `send`, so adapters never wire up the cache themselves.
   */
  makeClient: (config: z.infer<TConfigSchema>) => TClient;

  /**
   * Map a verified event to the message record(s) to deliver, or `undefined`
   * for events you don't surface. The cached outbound `client` is provided so
   * inbound media `read()` closures can authenticate; `respond` sets a
   * synchronous reply for protocol handshakes.
   */
  messages: (
    event: TEvent,
    ctx: {
      client: TClient;
      config: z.infer<TConfigSchema>;
      respond: FusorRespond;
    }
  ) => FusorMessagesReturn | Promise<FusorMessagesReturn>;
  /**
   * The platform id — the single constant used as the `defineFusorPlatform`
   * name, the `fusor()` routing key, and the webhook URL path segment.
   */
  platform: TName;

  /** Resolve recipients (+ optional params) to your platform's space record. */
  resolveSpace: (ctx: {
    input: {
      users: (TResolvedUser & { __platform: TName })[];
      params?: TSpaceParamsSchema extends z.ZodType<object>
        ? z.infer<TSpaceParamsSchema>
        : undefined;
    };
    config: z.infer<TConfigSchema>;
  }) => Promise<TResolvedSpace>;

  /** Resolve a user id to your platform's user record. */
  resolveUser: (ctx: {
    input: { userID: string };
    config: z.infer<TConfigSchema>;
  }) => Promise<TResolvedUser>;

  /**
   * Dispatch outbound `Content` by `content.type`. Return a record for content
   * that produces a message, `undefined` for fire-and-forget signals; throw
   * `UnsupportedError.content(type)` for content you can't express.
   */
  send: (ctx: {
    content: Content;
    space: TResolvedSpace & { id: string; __platform: TName };
    client: TClient;
    config: z.infer<TConfigSchema>;
    store: StoreLike;
  }) => Promise<ProviderMessageRecord | undefined>;

  /** Optional `zod` schema for `space(...)` params (e.g. a target chat id). */
  spaceParams?: TSpaceParamsSchema;

  /**
   * Authenticate the raw inbound request against `rawBody` and parse it into a
   * typed event. **Throw to reject** — a throw makes the event poison (Fusor
   * returns 400 and does not retry).
   */
  verify: (
    req: FusorVerifyRequest,
    ctx: { config: z.infer<TConfigSchema> }
  ) => TEvent | Promise<TEvent>;
}

/**
 * Build a Spectrum client-side adapter from the platform-specific pieces,
 * enforcing the adapter contract at the type level and supplying all the generic
 * wiring: the `fusor(name, verify)` brand, a store-backed outbound-client cache,
 * and — crucially — threading that client into `verify` / `messages` / `send`
 * (so inbound media reads can authenticate without each adapter reinventing the
 * payload plumbing).
 *
 * Returns the same value `defineFusorPlatform(name, def)` does — drop it into
 * `Spectrum({ providers: [adapter.config({...})] })`. For the rare adapter that
 * needs an escape hatch the contract doesn't expose (extra event streams,
 * `actions.getMessage`, `destroyClient`, custom space actions), call
 * `defineFusorPlatform` directly.
 */
export const defineFusorAdapter = <
  TName extends string,
  TConfigSchema extends z.ZodType<object>,
  TEvent,
  TClient,
  TResolvedUser extends { id: string },
  TResolvedSpace extends { id: string },
  TSpaceParamsSchema extends z.ZodType<object> | undefined = undefined,
>(
  spec: FusorAdapterSpec<
    TName,
    TConfigSchema,
    TEvent,
    TClient,
    TResolvedUser,
    TResolvedSpace,
    TSpaceParamsSchema
  >
) => {
  type Config = z.infer<TConfigSchema>;
  // biome-ignore lint/style/useConsistentTypeDefinitions: must stay a type alias — an interface here would leak this private name into the emitted .d.ts (TS4025); the structural alias inlines cleanly.
  type Payload = { event: TEvent; client: TClient; config: Config };
  const clientCache = createClientCache<TClient>(`${spec.platform}.client`);

  return defineFusorPlatform(spec.platform, {
    config: spec.config,
    lifecycle: {
      createClient: ({ config, store }) => {
        const client = clientCache.init(store, () => spec.makeClient(config));
        const verify = async (req: FusorVerifyRequest): Promise<Payload> => ({
          event: await spec.verify(req, { config }),
          client,
          config,
        });
        return Promise.resolve(fusor<Payload>(spec.platform, verify));
      },
    },
    user: {
      resolve: ({ input, config }) => spec.resolveUser({ input, config }),
    },
    space: {
      params: spec.spaceParams,
      resolve: ({ input, config }) => spec.resolveSpace({ input, config }),
    },
    messages: ({ payload, respond }) =>
      spec.messages(payload.event, {
        client: payload.client,
        config: payload.config,
        respond,
      }),
    send: ({ space, content, config, store }) =>
      spec.send({
        space,
        content,
        client: clientCache.get(store, () => spec.makeClient(config)),
        config,
        store,
      }),
  });
};
