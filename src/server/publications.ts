import { PublicationSchema } from "../shared/domain.ts";
import { db } from "./db.ts";

interface Row {
  port: number;
  expires_at: string;
}

function toPublication(row: Row) {
  return PublicationSchema.parse({
    port: row.port,
    expiresAt: row.expires_at,
  });
}

export function publish(port: number, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const row = db
    .query<Row, [number, string]>(
      `INSERT INTO publications (port, expires_at) VALUES (?, ?)
       ON CONFLICT (port) DO UPDATE SET expires_at = excluded.expires_at
       RETURNING *`
    )
    .get(port, expiresAt)!;

  return toPublication(row);
}

export function listPublications() {
  return db
    .query<Row, [string]>(
      "SELECT * FROM publications WHERE expires_at > ? ORDER BY port"
    )
    .all(new Date().toISOString())
    .map(toPublication);
}

export function isPublished(port: number) {
  return listPublications().some((publication) => publication.port === port);
}

export function unpublish(port: number) {
  db.query("DELETE FROM publications WHERE port = ?").run(port);
}

export function prunePublications(now: Date) {
  db.query("DELETE FROM publications WHERE expires_at <= ?").run(
    now.toISOString()
  );
}
