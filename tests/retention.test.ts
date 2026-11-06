import { describe, expect, test } from "bun:test";

import {
  addExchange,
  listExchanges,
  purgeExchanges,
} from "../src/server/exchanges.ts";

function deliver(eventName: string, receivedAt: string) {
  return addExchange({
    source: "github",
    direction: "inbound",
    receivedAt,
    method: "POST",
    path: "/",
    query: "",
    headers: {},
    body: "{}",
    eventName,
    response: null,
  });
}

describe("purgeExchanges", () => {
  test("deletes old exchanges except the latest of each source and event", () => {
    const oldPush = deliver("push", "2026-01-01T00:00:00.000Z");
    const latestOldPush = deliver("push", "2026-01-02T00:00:00.000Z");
    const oldPing = deliver("ping", "2026-01-01T00:00:00.000Z");
    const recentPing = deliver("ping", "2026-02-01T00:00:00.000Z");
    const recentPush = deliver("push", "2026-02-01T00:00:00.000Z");

    purgeExchanges(new Date("2026-01-15T00:00:00.000Z"));

    const kept = listExchanges({ limit: 100 }).map(({ id }) => id);
    expect(kept).not.toContain(oldPush.id);
    expect(kept).not.toContain(latestOldPush.id);
    expect(kept).not.toContain(oldPing.id);
    expect(kept).toContain(recentPing.id);
    expect(kept).toContain(recentPush.id);
  });

  test("keeps the latest old exchange of an event with no recent one", () => {
    const lonely = deliver("release", "2026-01-01T00:00:00.000Z");

    purgeExchanges(new Date("2026-01-15T00:00:00.000Z"));

    expect(
      listExchanges({ eventName: "release", limit: 10 }).map(({ id }) => id)
    ).toEqual([lonely.id]);
  });
});
