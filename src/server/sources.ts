import { SourceSchema } from "../shared/domain.ts";
import type { Source, SourceUpdate, SourceView } from "../shared/domain.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";
import { fail } from "./errors.ts";
import { parseJson } from "./json.ts";

interface Row {
  config: string;
}

function parse({ config: json }: Row) {
  return parseJson(SourceSchema, json);
}

export function listSources() {
  return db
    .query<Row, []>("SELECT config FROM sources ORDER BY name")
    .all()
    .map(parse);
}

export function getSource(name: string) {
  const row = db
    .query<Row, [string]>("SELECT config FROM sources WHERE name = ?")
    .get(name);

  return row && parse(row);
}

export function createSource(source: Source) {
  const row = db
    .query<Row, [string, string]>(
      "INSERT INTO sources (name, config) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING config"
    )
    .get(source.name, JSON.stringify(source));

  if (!row) {
    throw fail(409, "SOURCE_EXISTS");
  }

  return source;
}

function applyUpdate(name: string, update: SourceUpdate, current: Source) {
  if (update.direction === "outbound") {
    return { name, ...update };
  }

  const secret =
    update.secret === undefined && current.direction === "inbound"
      ? current.secret
      : (update.secret ?? undefined);

  return { name, ...update, secret };
}

export function updateSource(name: string, update: SourceUpdate) {
  const current = getSource(name);

  if (!current) {
    throw fail(404, "SOURCE_NOT_FOUND");
  }

  const source = applyUpdate(name, update, current);

  db.query("UPDATE sources SET config = ? WHERE name = ?").run(
    JSON.stringify(source),
    name
  );

  return source;
}

export function deleteSource(name: string) {
  db.query("DELETE FROM exchanges WHERE source = ?").run(name);
  db.query("DELETE FROM sources WHERE name = ?").run(name);
}

export function toSourceView(source: Source): SourceView {
  if (source.direction === "outbound") {
    return { ...source, url: `${config.localUrl}/_outbound/${source.name}` };
  }

  const { secret, ...rest } = source;

  return {
    ...rest,
    hasSecret: secret !== undefined,
    url: `${config.publicUrl.origin}/_webhooks/${source.name}`,
  };
}
