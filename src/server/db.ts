import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { config } from "./config.ts";

mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);

db.run(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sources (
    name TEXT PRIMARY KEY,
    config TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    direction TEXT NOT NULL,
    received_at TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    query TEXT NOT NULL,
    headers TEXT NOT NULL,
    body TEXT NOT NULL,
    event_name TEXT NOT NULL,
    response TEXT
  );
  CREATE INDEX IF NOT EXISTS exchanges_sample ON exchanges (source, event_name);
  CREATE TABLE IF NOT EXISTS service_names (
    cwd TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
`);
