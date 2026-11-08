import { SubscriptionSchema } from "../shared/domain.ts";
import { db } from "./db.ts";
import { fail } from "./errors.ts";
import { getSource } from "./sources.ts";

interface Row {
  id: number;
  source: string;
  url: string;
  expires_at: string;
}

export interface NewSubscription {
  source: string;
  url: string;
  ttlSeconds: number;
}

function toSubscription(row: Row) {
  return SubscriptionSchema.parse({
    id: row.id,
    source: row.source,
    url: row.url,
    expiresAt: row.expires_at,
  });
}

export function createSubscription({
  source,
  url,
  ttlSeconds,
}: NewSubscription) {
  if (getSource(source)?.direction !== "inbound") {
    throw fail(404, "SOURCE_NOT_FOUND");
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const row = db
    .query<Row, [string, string, string]>(
      "INSERT INTO subscriptions (source, url, expires_at) VALUES (?, ?, ?) RETURNING *"
    )
    .get(source, url, expiresAt)!;

  return toSubscription(row);
}

export function listSubscriptions(source?: string) {
  return db
    .query<Row, Record<string, string | null>>(
      `SELECT * FROM subscriptions
       WHERE ($source IS NULL OR source = $source) AND expires_at > $now
       ORDER BY id`
    )
    .all({ $source: source ?? null, $now: new Date().toISOString() })
    .map(toSubscription);
}

export function deleteSubscription(id: number) {
  db.query("DELETE FROM subscriptions WHERE id = ?").run(id);
}

export function pruneSubscriptions(now: Date) {
  db.query("DELETE FROM subscriptions WHERE expires_at <= ?").run(
    now.toISOString()
  );
}
