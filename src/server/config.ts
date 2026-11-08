import { homedir } from "node:os";
import path from "node:path";

import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().default(5200),
  PUBLIC_URL: z.url(),
  SERVICE_HOST: z.string().includes("*"),
  BRIDGE_ADDRESS: z.ipv4().optional(),
  PUBLIC_SERVICE_HOST: z.string().includes("*").optional(),
  DATABASE_PATH: z
    .string()
    .default(path.join(homedir(), ".porthole", "porthole.db")),
});

const env = Env.parse(process.env);

const publicUrl = new URL(env.PUBLIC_URL);

export const config = {
  port: env.PORT,
  publicUrl,
  localUrl: `http://127.0.0.1:${env.PORT}`,
  listenAddresses: [
    "127.0.0.1",
    ...(env.BRIDGE_ADDRESS ? [env.BRIDGE_ADDRESS] : []),
  ],
  serviceHost: env.SERVICE_HOST,
  publicServiceHost: env.PUBLIC_SERVICE_HOST,
  databasePath: env.DATABASE_PATH,
};
