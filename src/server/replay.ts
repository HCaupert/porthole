import type { Exchange } from "../shared/domain.ts";
import { fail } from "./errors.ts";
import { presets } from "./presets.ts";
import { getSource } from "./sources.ts";

const DROPPED_HEADERS = new Set(["host", "content-length"]);

export async function replayExchange(exchange: Exchange, url: string) {
  const source = getSource(exchange.source);

  if (exchange.direction !== "inbound" || source?.direction !== "inbound") {
    throw fail(400, "NOT_REPLAYABLE");
  }

  const headers = Object.fromEntries(
    Object.entries(exchange.headers).filter(
      ([name]) => !DROPPED_HEADERS.has(name)
    )
  );

  const response = await fetch(url, {
    method: exchange.method,
    headers: source.secret
      ? presets[source.preset].sign(headers, exchange.body, source.secret)
      : headers,
    body: exchange.body || undefined,
  });

  return { status: response.status, body: await response.text() };
}
