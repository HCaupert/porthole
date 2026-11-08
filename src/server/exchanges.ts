import {
  ExchangeSchema,
  HeadersSchema,
  ResponseSchema,
} from "../shared/domain.ts";
import type { Exchange } from "../shared/domain.ts";
import { db } from "./db.ts";
import { parseJson } from "./json.ts";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type NewExchange = DistributiveOmit<Exchange, "id">;

export interface ExchangeFilter {
  source?: string;
  direction?: Exchange["direction"];
  eventName?: string;
  after?: number;
  limit: number;
}

interface Row {
  id: number;
  source: string;
  direction: string;
  received_at: string;
  method: string;
  path: string;
  query: string;
  headers: string;
  body: string;
  event_name: string;
  response: string | null;
}

type Listener = (exchange: Exchange) => void | Promise<void>;

const listeners = new Set<Listener>();

export function onExchange(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function toExchange(row: Row) {
  return ExchangeSchema.parse({
    id: row.id,
    source: row.source,
    direction: row.direction,
    receivedAt: row.received_at,
    method: row.method,
    path: row.path,
    query: row.query,
    headers: parseJson(HeadersSchema, row.headers),
    body: row.body,
    eventName: row.event_name,
    response: row.response && parseJson(ResponseSchema, row.response),
  });
}

export function addExchange(exchange: NewExchange) {
  const row = db
    .query<Row, Record<string, string | null>>(
      `INSERT INTO exchanges
        (source, direction, received_at, method, path, query, headers, body, event_name, response)
       VALUES ($source, $direction, $receivedAt, $method, $path, $query, $headers, $body, $eventName, $response)
       RETURNING *`
    )
    .get({
      $source: exchange.source,
      $direction: exchange.direction,
      $receivedAt: exchange.receivedAt,
      $method: exchange.method,
      $path: exchange.path,
      $query: exchange.query,
      $headers: JSON.stringify(exchange.headers),
      $body: exchange.body,
      $eventName: exchange.eventName,
      $response: exchange.response && JSON.stringify(exchange.response),
    })!;

  const stored = toExchange(row);

  for (const listener of listeners) {
    void listener(stored);
  }

  return stored;
}

export function getExchange(id: number) {
  const row = db
    .query<Row, [number]>("SELECT * FROM exchanges WHERE id = ?")
    .get(id);

  return row && toExchange(row);
}

export function latestExchangeId() {
  return (
    db
      .query<{ id: number | null }, []>("SELECT MAX(id) AS id FROM exchanges")
      .get()!.id ?? 0
  );
}

export function listExchanges({
  source,
  direction,
  eventName,
  after,
  limit,
}: ExchangeFilter) {
  const order = after === undefined ? "DESC" : "ASC";

  return db
    .query<Row, Record<string, string | number | null>>(
      `SELECT * FROM exchanges
       WHERE ($source IS NULL OR source = $source)
         AND ($direction IS NULL OR direction = $direction)
         AND ($eventName IS NULL OR event_name = $eventName)
         AND ($after IS NULL OR id > $after)
       ORDER BY id ${order}
       LIMIT $limit`
    )
    .all({
      $source: source ?? null,
      $direction: direction ?? null,
      $eventName: eventName ?? null,
      $after: after ?? null,
      $limit: limit,
    })
    .map(toExchange);
}

export function purgeExchanges(olderThan: Date) {
  db.query(
    `DELETE FROM exchanges
     WHERE received_at < ?
       AND id NOT IN (SELECT MAX(id) FROM exchanges GROUP BY source, event_name)`
  ).run(olderThan.toISOString());
  db.query(
    "DELETE FROM forwards WHERE exchange_id NOT IN (SELECT id FROM exchanges)"
  ).run();
}

export async function waitForExchanges(
  filter: ExchangeFilter,
  seconds: number
) {
  const { promise, resolve } = Promise.withResolvers<Exchange[]>();

  const resolveIfFound = () => {
    const found = listExchanges(filter);

    if (found.length > 0) {
      resolve(found);
    }
  };

  const timer = setTimeout(() => resolve([]), seconds * 1000);
  const unsubscribe = onExchange(resolveIfFound);
  resolveIfFound();

  try {
    return await promise;
  } finally {
    clearTimeout(timer);
    unsubscribe();
  }
}
