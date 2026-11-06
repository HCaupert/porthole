import { createHmac } from "node:crypto";

import { Webhook } from "standardwebhooks";
import { z } from "zod";

import { ExchangeSchema, ServiceSchema } from "../src/shared/domain.ts";
import type { Exchange, Service, Source } from "../src/shared/domain.ts";

const base =
  process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:5200";

const run = crypto.randomUUID().slice(0, 8);
const failures: string[] = [];

const EchoedSchema = z.object({
  url: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
});

type Echoed = z.infer<typeof EchoedSchema>;

const ReplayResultSchema = z.object({ status: z.number(), body: z.string() });

function check(condition: boolean, message: string) {
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);

  if (!condition) {
    failures.push(message);
  }
}

async function send(path: string, init: RequestInit = {}) {
  return await fetch(`${base}${path}`, init);
}

async function sendJson(
  method: string,
  path: string,
  body: Record<string, string | undefined>
) {
  return await send(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function exchangesOf(query: string): Promise<Exchange[]> {
  const response = await send(`/api/exchanges?${query}`);

  return ExchangeSchema.array().parse(await response.json());
}

async function servicesOf(): Promise<Service[]> {
  const response = await send("/api/services");

  return ServiceSchema.array().parse(await response.json());
}

async function createSource(source: Source) {
  return await sendJson("POST", "/api/sources", source);
}

const echo = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request, server) {
    if (server.upgrade(request)) {
      return;
    }

    const { pathname, search } = new URL(request.url);

    return Response.json({
      url: pathname + search,
      headers: Object.fromEntries(request.headers),
      body: await request.text(),
    } satisfies Echoed);
  },
  websocket: {
    message(ws, message) {
      ws.send(`echo:${message.toString()}`);
    },
  },
});

const echoUrl = echo.url.origin;
const echoPort = Number(echo.url.port);

async function pollUntil<T>(read: () => Promise<T | undefined>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = await read();

    if (value) {
      return value;
    }

    await Bun.sleep(200);
  }
}

function hubSignature(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function githubSource() {
  const name = `smoke-github-${run}`;
  const secret = "github-secret";
  await createSource({ name, direction: "inbound", preset: "github", secret });
  const body = JSON.stringify({ action: "opened", number: 1 });

  const deliver = async (path: string, key: string) =>
    await send(path, {
      method: "POST",
      headers: {
        "x-github-event": "pull_request",
        "x-hub-signature-256": hubSignature(key, body),
      },
      body,
    });

  const good = await deliver(`/_webhooks/${name}`, secret);
  check(good.status === 200, "github: signed delivery answers 200");
  const [stored] = await exchangesOf(`source=${name}`);
  check(
    stored?.eventName === "pull_request.opened",
    "github: delivery is stored with event pull_request.opened"
  );
  const bad = await deliver(`/_webhooks/${name}`, "wrong");
  check(bad.status === 401, "github: bad signature answers 401");
  check(
    (await exchangesOf(`source=${name}`)).length === 1,
    "github: bad signature is not stored"
  );
  const unknown = await deliver(`/_webhooks/unknown-${run}`, secret);
  check(unknown.status === 404, "unknown source answers 404");

  return { name, secret, exchange: stored! };
}

async function gitlabSource() {
  const name = `smoke-gitlab-${run}`;
  const secret = `whsec_${Buffer.from("gitlab-secret").toString("base64")}`;
  await createSource({ name, direction: "inbound", preset: "gitlab", secret });

  const body = JSON.stringify({
    object_kind: "merge_request",
    object_attributes: { action: "open" },
  });

  const deliver = async (key: string) => {
    const id = `msg_${crypto.randomUUID()}`;
    const timestamp = new Date();

    return await send(`/_webhooks/${name}`, {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
        "webhook-signature": new Webhook(key).sign(id, timestamp, body),
      },
      body,
    });
  };

  const good = await deliver(secret);
  check(good.status === 200, "gitlab: standard webhooks delivery answers 200");
  const [stored] = await exchangesOf(`source=${name}`);
  check(
    stored?.eventName === "merge_request.open",
    "gitlab: delivery is stored with event merge_request.open"
  );
  const bad = await deliver(`whsec_${Buffer.from("other").toString("base64")}`);
  check(bad.status === 401, "gitlab: bad signature answers 401");
  check(
    (await exchangesOf(`source=${name}`)).length === 1,
    "gitlab: bad signature is not stored"
  );
}

async function longPoll(github: Awaited<ReturnType<typeof githubSource>>) {
  const after = github.exchange.id;
  const waiting = exchangesOf(`source=${github.name}&after=${after}&wait=10`);
  await Bun.sleep(300);
  const startedAt = Date.now();
  await send(`/_webhooks/${github.name}`, {
    method: "POST",
    headers: {
      "x-github-event": "ping",
      "x-hub-signature-256": hubSignature(github.secret, "{}"),
    },
    body: "{}",
  });
  const [found, ...others] = await waiting;
  check(
    found?.eventName === "ping" && found.id > after && others.length === 0,
    "long-poll: wait returns the delivery sent after it started"
  );
  check(
    Date.now() - startedAt < 3000,
    "long-poll: wait returns without timing out"
  );

  const empty = await exchangesOf(`source=${github.name}&wait=1`);
  check(empty.length === 0, "long-poll: wait returns an empty list at timeout");
}

async function replay(github: Awaited<ReturnType<typeof githubSource>>) {
  const response = await sendJson(
    "POST",
    `/api/exchanges/${github.exchange.id}/replay`,
    { url: `${echoUrl}/hook` }
  );

  const result = ReplayResultSchema.parse(await response.json());
  const received = EchoedSchema.parse(JSON.parse(result.body));
  check(result.status === 200, "replay: returns the status of the target");
  check(
    received.url === "/hook",
    "replay: the echo server receives the request"
  );
  check(
    received.headers["x-hub-signature-256"] ===
      hubSignature(github.secret, received.body),
    "replay: the signature verifies with the secret of the source"
  );
  check(
    received.headers.host === `127.0.0.1:${echoPort}`,
    "replay: the host header of the original delivery is dropped"
  );
}

async function outbound() {
  const name = `smoke-out-${run}`;
  await createSource({ name, direction: "outbound", upstream: echoUrl });

  const response = await send(`/_outbound/${name}/x?y=1`, {
    method: "POST",
    headers: { authorization: "Bearer topsecret", "x-trace": "visible" },
    body: "payload",
  });

  const echoed = EchoedSchema.parse(await response.json());
  check(
    response.status === 200,
    "outbound: caller receives the upstream status"
  );
  check(
    echoed.url === "/x?y=1" && echoed.body === "payload",
    "outbound: path, query and body reach the upstream"
  );
  check(
    echoed.headers.authorization === "Bearer topsecret",
    "outbound: the upstream receives the real authorization header"
  );

  const stored = await pollUntil(async () => {
    const [exchange] = await exchangesOf(`source=${name}`);

    return exchange;
  });

  check(stored?.direction === "outbound", "outbound: the call is stored");
  check(
    stored?.headers.authorization === "***",
    "outbound: authorization is masked in the stored request"
  );
  check(
    stored?.headers["x-trace"] === "visible",
    "outbound: other headers are stored as sent"
  );
  check(
    stored?.response?.status === 200 &&
      stored.response.body.includes('"/x?y=1"'),
    "outbound: the upstream response is stored"
  );
  check(
    !JSON.stringify([stored?.headers, stored?.response?.headers]).includes(
      "topsecret"
    ),
    "outbound: the secret appears in no stored header"
  );
}

async function services() {
  const found = await pollUntil(async () =>
    (await servicesOf()).find((service) => service.port === echoPort)
  );

  check(
    found?.cwd === process.cwd(),
    "services: the echo server is detected with its cwd"
  );
  check(
    found?.command.includes("smoke.ts") === true,
    "services: the command line is reported"
  );

  const renamed = `echo-${run}`;
  await sendJson("PUT", `/api/services/${echoPort}`, { name: renamed });

  const after = (await servicesOf()).find(
    (service) => service.port === echoPort
  );

  check(after?.name === renamed, "services: the custom name persists");

  return found!;
}

async function proxy(service: Service) {
  const { host } = new URL(service.url);
  const response = await send("/hello?z=1", { headers: { host } });
  const echoed = EchoedSchema.parse(await response.json());
  check(
    echoed.url === "/hello?z=1" && echoed.headers.host === host,
    "proxy: the service answers through its host with the host header preserved"
  );

  const unknownPort = await send("/", {
    headers: { host: host.replace(String(echoPort), "1") },
  });

  check(
    unknownPort.status === 404,
    "proxy: a service host with no listener answers 404"
  );

  const unknownHost = await send("/", {
    headers: { host: "other.example.test" },
  });

  check(unknownHost.status === 404, "proxy: an unknown host answers 404");

  const socket = new WebSocket(`${base.replace("http", "ws")}/socket`, {
    headers: { host },
  });

  const reply = Promise.withResolvers<string>();
  socket.addEventListener("open", () => socket.send("ping"));
  socket.addEventListener("message", ({ data }: MessageEvent<unknown>) =>
    reply.resolve(String(data))
  );
  socket.addEventListener("error", () =>
    reply.reject(new Error("websocket error"))
  );
  check(
    (await reply.promise) === "echo:ping",
    "proxy: a websocket through the service host echoes a message"
  );
  socket.close();
}

async function cleanup() {
  for (const kind of ["github", "gitlab", "out"]) {
    await send(`/api/sources/smoke-${kind}-${run}`, { method: "DELETE" });
  }

  await echo.stop(true);
}

const github = await githubSource();

await gitlabSource();

await longPoll(github);

await replay(github);

await outbound();

await proxy(await services());

await cleanup();

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

console.log("\nall checks passed");

process.exit(0);
