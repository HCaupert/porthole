import type { Hono } from "hono";

import { config } from "./config.ts";
import { isWebSocketUpgrade, proxyHttp, proxySocketData } from "./proxy.ts";
import type { ProxySocket } from "./proxy.ts";
import { isPublished } from "./publications.ts";
import { getService } from "./services.ts";

const OWN_HOSTS = new Set([
  config.publicUrl.hostname,
  "localhost",
  "127.0.0.1",
]);

function portPattern(template: string) {
  return new RegExp(
    `^${template
      .replaceAll(/[.+?^${}()|[\]\\]/gu, String.raw`\$&`)
      .replace("*", String.raw`(\d+)`)}$`,
    "iu"
  );
}

const SERVICE_HOST = portPattern(config.serviceHost);

const PUBLIC_SERVICE_HOST = config.publicServiceHost
  ? portPattern(config.publicServiceHost)
  : undefined;

function notFound(message: string) {
  return new Response(message, { status: 404 });
}

async function proxyService(
  request: Request,
  server: Bun.Server<ProxySocket>,
  port: number
) {
  const service = getService(port);

  if (!service) {
    return notFound(`No service listens on port ${port}`);
  }

  if (!isWebSocketUpgrade(request)) {
    return await proxyHttp(request, service);
  }

  server.upgrade(request, { data: proxySocketData(request, service) });
}

export function gateway(app: Hono) {
  return async (request: Request, server: Bun.Server<ProxySocket>) => {
    const { hostname } = new URL(`http://${request.headers.get("host")}`);
    const port = SERVICE_HOST.exec(hostname)?.[1];
    const publicPort = PUBLIC_SERVICE_HOST?.exec(hostname)?.[1];

    if (port) {
      return await proxyService(request, server, Number(port));
    }

    if (publicPort) {
      return isPublished(Number(publicPort))
        ? await proxyService(request, server, Number(publicPort))
        : notFound(`Port ${publicPort} is not published`);
    }

    return OWN_HOSTS.has(hostname)
      ? await app.fetch(request)
      : notFound("Unknown host");
  };
}
