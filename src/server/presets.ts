import { createHmac, timingSafeEqual } from "node:crypto";

import { Webhook } from "standardwebhooks";
import { z } from "zod";

import type { presetNames } from "../shared/domain.ts";
import { parseJson } from "./json.ts";

export type HeaderRecord = Record<string, string>;

interface Delivery {
  method: string;
  path: string;
  headers: HeaderRecord;
  body: string;
}

interface Preset {
  verify: (headers: HeaderRecord, body: string, secret: string) => boolean;
  sign: (headers: HeaderRecord, body: string, secret: string) => HeaderRecord;
  eventName: (delivery: Delivery) => string;
}

const PayloadSchema = z.object({
  action: z.string().optional(),
  object_kind: z.string().optional(),
  object_attributes: z.object({ action: z.string().optional() }).optional(),
  webhookEvent: z.string().optional(),
});

function payloadOf(body: string): z.infer<typeof PayloadSchema> {
  try {
    return parseJson(PayloadSchema, body);
  } catch {
    return {};
  }
}

function joinEvent(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(".") || "unknown";
}

function hmacHex(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function hubSignature(header: string) {
  return {
    verify(headers: HeaderRecord, body: string, secret: string) {
      const received = Buffer.from(headers[header] ?? "");
      const expected = Buffer.from(hmacHex(secret, body));

      return (
        received.length === expected.length &&
        timingSafeEqual(received, expected)
      );
    },
    sign(headers: HeaderRecord, body: string, secret: string) {
      return { ...headers, [header]: hmacHex(secret, body) };
    },
  };
}

const standardWebhooks = {
  verify(headers: HeaderRecord, body: string, secret: string) {
    try {
      new Webhook(secret).verify(body, headers, { jsonParse: false });

      return true;
    } catch {
      return false;
    }
  },
  sign(headers: HeaderRecord, body: string, secret: string) {
    const timestamp = new Date();

    return {
      ...headers,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": new Webhook(secret).sign(
        headers["webhook-id"] ?? crypto.randomUUID(),
        timestamp,
        body
      ),
    };
  },
};

export const presets: Record<(typeof presetNames)[number], Preset> = {
  github: {
    ...hubSignature("x-hub-signature-256"),
    eventName: ({ headers, body }) =>
      joinEvent(headers["x-github-event"], payloadOf(body).action),
  },
  gitlab: {
    ...standardWebhooks,
    eventName: ({ body }) => {
      const payload = payloadOf(body);

      return joinEvent(payload.object_kind, payload.object_attributes?.action);
    },
  },
  jira: {
    ...hubSignature("x-hub-signature"),
    eventName: ({ body }) => joinEvent(payloadOf(body).webhookEvent),
  },
  generic: {
    verify: () => true,
    sign: (headers) => headers,
    eventName: ({ method, path }) => `${method} ${path}`,
  },
};
