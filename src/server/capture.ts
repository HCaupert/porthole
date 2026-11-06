import { Hono } from "hono";

import { fail } from "./errors.ts";
import { addExchange } from "./exchanges.ts";
import { presets } from "./presets.ts";
import type { HeaderRecord } from "./presets.ts";
import { getSource } from "./sources.ts";

const SECRET_HEADER = /authorization|cookie|token|secret|api-?key|password/iu;

function maskSecrets(headers: HeaderRecord) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SECRET_HEADER.test(name) ? "***" : value,
    ])
  );
}

function pathAfter(path: string, prefix: string) {
  return path.slice(prefix.length) || "/";
}

export const capture = new Hono();

capture.all("/_webhooks/:name/*", async (c) => {
  const name = c.req.param("name");
  const source = getSource(name);

  if (source?.direction !== "inbound") {
    throw fail(404, "SOURCE_NOT_FOUND");
  }

  const receivedAt = new Date().toISOString();
  const body = await c.req.text();
  const headers = Object.fromEntries(c.req.raw.headers);
  const preset = presets[source.preset];

  if (source.secret && !preset.verify(headers, body, source.secret)) {
    throw fail(401, "INVALID_SIGNATURE");
  }

  const path = pathAfter(c.req.path, `/_webhooks/${name}`);
  addExchange({
    source: name,
    direction: "inbound",
    receivedAt,
    method: c.req.method,
    path,
    query: new URL(c.req.url).search,
    headers,
    body,
    eventName: preset.eventName({ method: c.req.method, path, headers, body }),
    response: null,
  });

  return c.body(null, 200);
});

capture.all("/_outbound/:name/*", async (c) => {
  const name = c.req.param("name");
  const source = getSource(name);

  if (source?.direction !== "outbound") {
    throw fail(404, "SOURCE_NOT_FOUND");
  }

  const startedAt = Date.now();
  const receivedAt = new Date(startedAt).toISOString();
  const body = await c.req.text();
  const path = pathAfter(c.req.path, `/_outbound/${name}`);
  const query = new URL(c.req.url).search;
  const headers = new Headers(c.req.raw.headers);
  headers.delete("host");
  headers.set("accept-encoding", "identity");

  const upstream = await fetch(`${source.upstream}${path}${query}`, {
    method: c.req.method,
    headers,
    body: body || undefined,
    redirect: "manual",
    decompress: false,
  });

  const [forCaller, forCapture] = upstream.body?.tee() ?? [null, null];

  const record = async () => {
    addExchange({
      source: name,
      direction: "outbound",
      receivedAt,
      method: c.req.method,
      path,
      query,
      headers: maskSecrets(Object.fromEntries(c.req.raw.headers)),
      body,
      eventName: c.req.method,
      response: {
        status: upstream.status,
        headers: maskSecrets(Object.fromEntries(upstream.headers)),
        body: await new Response(forCapture).text(),
        durationMs: Date.now() - startedAt,
      },
    });
  };

  void record();

  return new Response(forCaller, {
    status: upstream.status,
    headers: upstream.headers,
  });
});
