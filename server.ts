import path from "node:path";

import start from "./dist/server/server.js";
import { app } from "./src/server/app.ts";
import { config } from "./src/server/config.ts";
import { gateway } from "./src/server/gateway.ts";
import { proxyWebSocket } from "./src/server/proxy.ts";
import type { ProxySocket } from "./src/server/proxy.ts";
import { startRetention } from "./src/server/retention.ts";

const CLIENT_DIRECTORY = path.join(import.meta.dir, "dist", "client");

app.notFound(async (c) => {
  const { pathname } = new URL(c.req.url);
  const file = Bun.file(path.join(CLIENT_DIRECTORY, pathname));

  return pathname !== "/" && (await file.exists())
    ? new Response(file)
    : await start.fetch(c.req.raw);
});

startRetention();

const server = Bun.serve<ProxySocket>({
  hostname: "127.0.0.1",
  port: config.port,
  idleTimeout: 255,
  fetch: gateway(app),
  websocket: proxyWebSocket,
});

console.log(`porthole listening on ${server.url.href}`);
