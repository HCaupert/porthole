import { z } from "zod";

export const presetNames = ["github", "gitlab", "jira", "generic"] as const;
export const directions = ["inbound", "outbound"] as const;

export const PresetName = z.enum(presetNames);
export const DirectionName = z.enum(directions);

const outboundFields = {
  direction: z.literal("outbound"),
  upstream: z
    .url()
    .transform((url) => url.replace(/\/$/u, ""))
    .describe("Base URL that receives the forwarded calls"),
};

const Secret = z.string().min(1);

const sourceVariants = <
  Extra extends Record<string, z.ZodType>,
  Inbound extends Record<string, z.ZodType>,
>(
  extra: Extra,
  inbound: Inbound
) =>
  z.discriminatedUnion("direction", [
    z.object({
      ...extra,
      direction: z.literal("inbound"),
      preset: PresetName.describe("Provider that signs the deliveries"),
      ...inbound,
    }),
    z.object({ ...extra, ...outboundFields }),
  ]);

export const SourceName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/u)
  .describe("Slug used in the URL of the source");

export const SourceSchema = sourceVariants(
  { name: SourceName },
  {
    secret: Secret.optional().describe(
      "Signing secret. Without it, deliveries are not verified. Never returned"
    ),
  }
);

export type Source = z.infer<typeof SourceSchema>;

export const SourceUpdateSchema = sourceVariants(
  {},
  {
    secret: Secret.nullable()
      .optional()
      .describe(
        "Signing secret. Omit to keep the stored secret, null to remove it. Never returned"
      ),
  }
);

export type SourceUpdate = z.infer<typeof SourceUpdateSchema>;

export const SourceViewSchema = sourceVariants(
  {
    name: SourceName,
    url: z.string().describe("URL to give to the provider or app"),
  },
  { hasSecret: z.boolean().describe("Whether deliveries are verified") }
);

export type SourceView = z.infer<typeof SourceViewSchema>;

export const HeadersSchema = z.record(z.string(), z.string());

const ExchangeBase = z.object({
  id: z.number().int(),
  source: z.string(),
  receivedAt: z.iso.datetime(),
  method: z.string(),
  path: z.string(),
  query: z.string(),
  headers: HeadersSchema,
  body: z.string(),
  eventName: z.string(),
});

export const ResponseSchema = z.object({
  status: z.number().int(),
  headers: HeadersSchema,
  body: z.string(),
  durationMs: z.number(),
});

export const ExchangeSchema = z.discriminatedUnion("direction", [
  ExchangeBase.extend({
    direction: z.literal("inbound"),
    response: z.null(),
  }),
  ExchangeBase.extend({
    direction: z.literal("outbound"),
    response: ResponseSchema,
  }),
]);

export type Exchange = z.infer<typeof ExchangeSchema>;

export const ServiceSchema = z.object({
  port: z.number().int(),
  host: z.string(),
  pid: z.number().int(),
  cwd: z.string(),
  command: z.string(),
  name: z.string(),
  url: z.string(),
});

export type Service = z.infer<typeof ServiceSchema>;

export const ReplayResultSchema = z.object({
  status: z.number().int(),
  body: z.string(),
});

export const SubscriptionSchema = z.object({
  id: z.number().int(),
  source: SourceName,
  url: z.url().describe("Where each new delivery of the source is sent"),
  expiresAt: z.iso.datetime(),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

export const ForwardSchema = z.object({
  url: z.string(),
  forwardedAt: z.iso.datetime(),
  status: z.number().int().nullable().describe("Null when the call failed"),
  error: z.string().nullable(),
});

export type Forward = z.infer<typeof ForwardSchema>;
