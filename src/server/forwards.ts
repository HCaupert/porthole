import { ForwardSchema } from "../shared/domain.ts";
import type { Exchange, Subscription } from "../shared/domain.ts";
import { db } from "./db.ts";
import { onExchange } from "./exchanges.ts";
import { replayExchange } from "./replay.ts";
import { listSubscriptions } from "./subscriptions.ts";

interface Row {
  url: string;
  forwarded_at: string;
  status: number | null;
  error: string | null;
}

async function callTarget(exchange: Exchange, url: string) {
  try {
    const { status } = await replayExchange(exchange, url);

    return { status, error: null };
  } catch (error) {
    return { status: null, error: String(error) };
  }
}

async function forward(exchange: Exchange, { url }: Subscription) {
  const forwardedAt = new Date().toISOString();
  const { status, error } = await callTarget(exchange, url);

  db.query(
    `INSERT INTO forwards (exchange_id, url, forwarded_at, status, error)
     VALUES (?, ?, ?, ?, ?)`
  ).run(exchange.id, url, forwardedAt, status, error);
}

export function listForwards(exchangeId: number) {
  return db
    .query<Row, [number]>(
      "SELECT * FROM forwards WHERE exchange_id = ? ORDER BY id"
    )
    .all(exchangeId)
    .map((row) =>
      ForwardSchema.parse({
        url: row.url,
        forwardedAt: row.forwarded_at,
        status: row.status,
        error: row.error,
      })
    );
}

export function startForwarding() {
  onExchange(async (exchange) => {
    if (exchange.direction === "inbound") {
      await Promise.all(
        listSubscriptions(exchange.source).map(
          async (subscription) => await forward(exchange, subscription)
        )
      );
    }
  });
}
