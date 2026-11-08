import { afterAll, describe, expect, setSystemTime, test } from "bun:test";

import { app } from "../src/server/app.ts";
import { gateway } from "../src/server/gateway.ts";
import { proxyWebSocket } from "../src/server/proxy.ts";
import type { ProxySocket } from "../src/server/proxy.ts";
import { publish, unpublish } from "../src/server/publications.ts";

const service = Bun.serve({ port: 0, fetch: () => new Response("service") });

const porthole = Bun.serve<ProxySocket>({
  port: 0,
  fetch: gateway(app),
  websocket: proxyWebSocket,
});

async function open(port: number) {
  return await fetch(porthole.url, {
    headers: { host: `${port}-public.example.test` },
  });
}

afterAll(() => {
  void service.stop(true);
  void porthole.stop(true);
});

describe("public services", () => {
  test("answer 404 for a port that is not published", async () => {
    const response = await open(service.port!);

    expect(response.status).toBe(404);
  });

  test("proxy a published port, until it is unpublished", async () => {
    publish(service.port!, 60);

    const response = await open(service.port!);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("service");

    unpublish(service.port!);

    expect((await open(service.port!)).status).toBe(404);
  });

  test("answer 404 once the publication expires", async () => {
    publish(service.port!, 60);
    setSystemTime(new Date(Date.now() + 61_000));

    try {
      expect((await open(service.port!)).status).toBe(404);
    } finally {
      setSystemTime();
    }
  });
});
