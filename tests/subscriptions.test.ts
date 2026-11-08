import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";

import { addExchange } from "../src/server/exchanges.ts";
import { listForwards, startForwarding } from "../src/server/forwards.ts";
import { presets } from "../src/server/presets.ts";
import { createSource } from "../src/server/sources.ts";
import {
  createSubscription,
  listSubscriptions,
  pruneSubscriptions,
} from "../src/server/subscriptions.ts";

const SECRET = "s3cret";
const received: { headers: Record<string, string>; body: string }[] = [];

const target = Bun.serve({
  port: 0,
  async fetch(request) {
    received.push({
      headers: Object.fromEntries(request.headers),
      body: await request.text(),
    });

    return new Response("ok");
  },
});

function deliver(source: string, body: string) {
  return addExchange({
    source,
    direction: "inbound",
    receivedAt: new Date().toISOString(),
    method: "POST",
    path: "/",
    query: "",
    headers: { "x-github-event": "push", "x-hub-signature-256": "sha256=old" },
    body,
    eventName: "push",
    response: null,
  });
}

async function forwardsOf(exchangeId: number) {
  while (listForwards(exchangeId).length === 0) {
    await Bun.sleep(5);
  }

  return listForwards(exchangeId);
}

beforeAll(() => {
  createSource({
    name: "forwarded",
    direction: "inbound",
    preset: "github",
    secret: SECRET,
  });
  startForwarding();
});

afterAll(() => {
  void target.stop(true);
});

describe("subscriptions", () => {
  test("forward a new delivery signed again with the secret of the source", async () => {
    createSubscription({
      source: "forwarded",
      url: target.url.href,
      ttlSeconds: 60,
    });
    received.length = 0;

    const exchange = deliver("forwarded", '{"ref":"main"}');
    const [forward] = await forwardsOf(exchange.id);

    expect(forward).toMatchObject({
      url: target.url.href,
      status: 200,
      error: null,
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.body).toBe('{"ref":"main"}');
    expect(
      presets.github.verify(received[0]!.headers, received[0]!.body, SECRET)
    ).toBe(true);
  });

  test("record the error of a target that is down", async () => {
    const down = Bun.serve({ port: 0, fetch: () => new Response() });
    const { href } = down.url;
    await down.stop(true);
    createSubscription({ source: "forwarded", url: href, ttlSeconds: 60 });

    const exchange = deliver("forwarded", "{}");
    const forwards = await forwardsOf(exchange.id);

    expect(forwards.find((forward) => forward.url === href)).toMatchObject({
      status: null,
    });
  });

  test("ignore and prune expired subscriptions", async () => {
    createSource({ name: "expiring", direction: "inbound", preset: "generic" });
    createSubscription({
      source: "expiring",
      url: target.url.href,
      ttlSeconds: 60,
    });
    expect(listSubscriptions("expiring")).toHaveLength(1);

    setSystemTime(new Date(Date.now() + 61_000));

    try {
      const exchange = deliver("expiring", "{}");
      await Bun.sleep(50);

      expect(listSubscriptions("expiring")).toHaveLength(0);
      expect(listForwards(exchange.id)).toHaveLength(0);

      pruneSubscriptions(new Date());
      setSystemTime();

      expect(listSubscriptions("expiring")).toHaveLength(0);
    } finally {
      setSystemTime();
    }
  });
});
