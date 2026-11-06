import type { z } from "zod";

export function parseJson<Schema extends z.ZodType>(
  schema: Schema,
  text: string
): z.infer<Schema> {
  return schema.parse(JSON.parse(text));
}
