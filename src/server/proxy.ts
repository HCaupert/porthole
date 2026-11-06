import type { WebSocketHandler } from "bun";
import { z } from "zod";

import type { Service } from "../shared/domain.ts";

const SocketMessage = z.union([z.string(), z.instanceof(ArrayBuffer)]);

const HANDSHAKE_HEADERS = new Set([
  "connection",
  "upgrade",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions",
  "sec-websocket-protocol",
]);

export interface ProxySocket {
  target: string;
  protocols: string[];
  headers: Record<string, string>;
  upstream?: WebSocket;
  queue: (string | Buffer)[];
}

function targetOf(request: Request, { host, port }: Service, scheme: string) {
  const { pathname, search } = new URL(request.url);

  return `${scheme}://${host}:${port}${pathname}${search}`;
}

export function isWebSocketUpgrade(request: Request) {
  return request.headers.get("upgrade")?.toLowerCase() === "websocket";
}

export async function proxyHttp(request: Request, service: Service) {
  return await fetch(targetOf(request, service, "http"), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "manual",
    decompress: false,
  });
}

export function proxySocketData(
  request: Request,
  service: Service
): ProxySocket {
  const protocols = (request.headers.get("sec-websocket-protocol") ?? "")
    .split(",")
    .map((protocol) => protocol.trim())
    .filter(Boolean);

  return {
    target: targetOf(request, service, "ws"),
    protocols,
    headers: Object.fromEntries(
      [...request.headers].filter(([name]) => !HANDSHAKE_HEADERS.has(name))
    ),
    queue: [],
  };
}

export const proxyWebSocket: WebSocketHandler<ProxySocket> = {
  open(ws) {
    const { target, protocols, headers } = ws.data;
    const upstream = new WebSocket(target, { protocols, headers });
    upstream.binaryType = "arraybuffer";
    upstream.addEventListener("open", () => {
      for (const message of ws.data.queue) {
        upstream.send(message);
      }
    });
    upstream.addEventListener("message", ({ data }: MessageEvent<unknown>) => {
      ws.send(SocketMessage.parse(data));
    });
    upstream.addEventListener("close", () => ws.close());
    upstream.addEventListener("error", () => ws.close());
    ws.data.upstream = upstream;
  },
  message(ws, message) {
    const { upstream, queue } = ws.data;

    if (upstream?.readyState === WebSocket.OPEN) {
      upstream.send(message);
    } else {
      queue.push(message);
    }
  },
  close(ws) {
    ws.data.upstream?.close();
  },
};
