import { z } from "zod";

import {
  directions,
  ExchangeSchema,
  ReplayResultSchema,
  ServiceSchema,
  SourceViewSchema,
} from "../shared/domain.ts";
import type { Source } from "../shared/domain.ts";

async function request<Schema extends z.ZodType>(
  schema: Schema,
  path: string,
  init?: RequestInit
): Promise<z.infer<Schema>> {
  const response = await fetch(path, init);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return schema.parse(await response.json());
}

async function send(
  method: string,
  path: string,
  body?: Source | { name: string }
) {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export const DirectionFilter = z.enum(["", ...directions]);

export interface ExchangeFilter {
  source: string;
  direction: z.infer<typeof DirectionFilter>;
  eventName: string;
}

export const api = {
  exchanges: async (filter: ExchangeFilter) =>
    await request(
      ExchangeSchema.array(),
      `/api/exchanges?${new URLSearchParams(
        Object.entries({ ...filter, limit: "100" }).filter(([, value]) => value)
      )}`
    ),
  sources: async () => await request(SourceViewSchema.array(), "/api/sources"),
  saveSource: async (source: Source, isNew: boolean) => {
    await send(
      isNew ? "POST" : "PUT",
      isNew ? "/api/sources" : `/api/sources/${source.name}`,
      source
    );
  },
  deleteSource: async (name: string) => {
    await send("DELETE", `/api/sources/${name}`);
  },
  services: async () => await request(ServiceSchema.array(), "/api/services"),
  renameService: async (port: number, name: string) => {
    await send("PUT", `/api/services/${port}`, { name });
  },
  replay: async (id: number, url: string) =>
    await request(ReplayResultSchema, `/api/exchanges/${id}/replay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }),
};
