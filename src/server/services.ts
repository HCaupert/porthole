import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { Service } from "../shared/domain.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";

const CACHE_MS = 1000;
const LISTEN_STATE = "0A";

interface Listener {
  port: number;
  host: string;
  inode: string;
}

function decodeAddress(hex: string) {
  const bytes = Buffer.from(hex, "hex");

  for (let i = 0; i < bytes.length; i += 4) {
    bytes.subarray(i, i + 4).reverse();
  }

  if (bytes.every((byte) => byte === 0)) {
    return "127.0.0.1";
  }

  if (bytes.length === 4) {
    return [...bytes].join(".");
  }

  const groups = bytes.toString("hex").match(/.{4}/gu)!;

  return `[${groups.join(":")}]`;
}

function readListeners(file: string) {
  return readFileSync(file, "utf-8")
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/u))
    .filter((columns) => columns[3] === LISTEN_STATE)
    .map((columns): Listener => {
      const [address, port] = columns[1]!.split(":");

      return {
        host: decodeAddress(address!),
        port: Number.parseInt(port!, 16),
        inode: columns[9]!,
      };
    });
}

function socketOwners() {
  const owners = new Map<string, number>();

  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/u.test(entry)) {
      continue;
    }

    try {
      for (const fd of readdirSync(`/proc/${entry}/fd`)) {
        const target = readlinkSync(`/proc/${entry}/fd/${fd}`);

        if (target.startsWith("socket:[")) {
          owners.set(target.slice(8, -1), Number(entry));
        }
      }
    } catch {
      continue;
    }
  }

  return owners;
}

export function shortestUniqueNames(cwds: string[]) {
  const unique = [...new Set(cwds)];
  const segmentsOf = (cwd: string) => cwd.split("/").filter(Boolean);

  const suffix = (cwd: string, length: number) =>
    segmentsOf(cwd).slice(-length).join("/");

  return new Map(
    unique.map((cwd) => {
      const total = segmentsOf(cwd).length;
      let length = 1;

      while (
        length < total &&
        unique.some(
          (other) =>
            other !== cwd && suffix(other, length) === suffix(cwd, length)
        )
      ) {
        length += 1;
      }

      return [cwd, suffix(cwd, length) || cwd];
    })
  );
}

function customNames() {
  return new Map(
    db
      .query<{ cwd: string; name: string }, []>(
        "SELECT cwd, name FROM service_names"
      )
      .all()
      .map(({ cwd, name }) => [cwd, name])
  );
}

function serviceUrl(port: number) {
  const host = config.serviceHost.replace("*", String(port));

  return `${config.publicUrl.protocol}//${host}`;
}

function detect() {
  const owners = socketOwners();

  const listeners = [
    ...readListeners("/proc/net/tcp"),
    ...readListeners("/proc/net/tcp6"),
  ].filter(({ port }) => port !== config.port);

  const processes = new Map<
    number,
    { service: Omit<Service, "name" | "url">; nameSource: string }
  >();

  for (const { port, host, inode } of listeners) {
    const pid = owners.get(inode);

    if (pid !== undefined && !processes.has(port)) {
      const cwd = readlinkSync(`/proc/${pid}/cwd`);
      const argv = readFileSync(`/proc/${pid}/cmdline`, "utf-8").split("\0");

      processes.set(port, {
        service: { port, host, pid, cwd, command: argv.join(" ").trim() },
        nameSource: [homedir(), "/"].includes(cwd)
          ? path.basename(argv[0]!)
          : cwd,
      });
    }
  }

  const found = [...processes.values()].toSorted(
    (a, b) => a.service.port - b.service.port
  );

  const defaults = shortestUniqueNames(
    found.map(({ nameSource }) => nameSource)
  );

  const custom = customNames();

  return found.map(({ service, nameSource }): Service => ({
    ...service,
    name: custom.get(service.cwd) ?? defaults.get(nameSource)!,
    url: serviceUrl(service.port),
  }));
}

const cache = { at: Number.NEGATIVE_INFINITY, services: new Array<Service>() };

export function listServices() {
  if (performance.now() - cache.at > CACHE_MS) {
    cache.at = performance.now();
    cache.services = detect();
  }

  return cache.services;
}

export function getService(port: number) {
  return listServices().find((service) => service.port === port);
}

export function renameService(cwd: string, name: string) {
  db.query(
    "INSERT INTO service_names (cwd, name) VALUES (?, ?) ON CONFLICT (cwd) DO UPDATE SET name = excluded.name"
  ).run(cwd, name);
  cache.at = Number.NEGATIVE_INFINITY;
}
