import { z } from "zod";

import { directions, SourceName } from "../shared/domain.ts";

export const SourceParams = z.object({ name: SourceName });

export const ExchangeParams = z.object({ id: z.coerce.number().int() });

export const ServiceParams = z.object({ port: z.coerce.number().int() });

export const ExchangeQuery = z.object({
  source: z.string().optional().describe("Only this source"),
  direction: z
    .enum(directions)
    .optional()
    .describe("Only inbound or outbound exchanges"),
  eventName: z.string().optional().describe("Only this event name"),
  after: z.coerce
    .number()
    .int()
    .optional()
    .describe("Only exchanges with an id above this one, oldest first"),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  wait: z.coerce
    .number()
    .int()
    .min(1)
    .max(120)
    .optional()
    .describe(
      "Seconds to wait for a matching exchange. Without after, waits for the next one"
    ),
});

export const ReplayBody = z.object({
  url: z.url().describe("Where to send the exchange again"),
});

export const SubscriptionParams = z.object({ id: z.coerce.number().int() });

export const SubscriptionQuery = z.object({
  source: z.string().optional().describe("Only this source"),
});

export const SubscriptionBody = z.object({
  source: SourceName.describe("Inbound source to forward"),
  url: z.url().describe("Where to send each new delivery, signed again"),
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .describe("Seconds until the subscription expires"),
});

export const RenameBody = z.object({ name: z.string().min(1) });
