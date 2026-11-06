import { generateSpecs } from "hono-openapi";

import { apiRoutes } from "./api.ts";
import { config } from "./config.ts";

const METHODS = ["get", "post", "put", "delete"] as const;

const intro = `# Porthole

Porthole runs on this machine. It records webhooks, records outbound HTTP calls of local apps, and opens local services by hostname.
Base URL for agents: ${config.localUrl}
No authentication on this address. Do not expose it.

## Inbound webhooks
Create an inbound source, then give its url (${config.publicUrl.origin}/api/webhooks/<name>) to the provider. Presets: github, gitlab, jira, generic. With a secret, deliveries with a wrong signature get 401 and are not stored.

## Outbound capture
Create an outbound source with an upstream, then use ${config.localUrl}/_outbound/<name> as the base URL in your app. Path and query are appended to the upstream. Values of auth headers are stored as ***.

## Services
Each service that listens on a local port opens at ${config.serviceHost.replace("*", "<port>")}.

API reference as OpenAPI: GET ${config.localUrl}/api/openapi.json

## Endpoints
`;

export async function llmsText() {
  const { paths } = await generateSpecs(apiRoutes, {
    documentation: { info: { title: "Porthole", version: "0.1.0" } },
  });

  const endpoints = Object.entries(paths ?? {}).flatMap(([path, operations]) =>
    METHODS.flatMap((method) => {
      const operation = operations?.[method];

      return operation
        ? [
            `### ${method.toUpperCase()} ${path}\n${operation.summary}\n\n${operation.description}\n`,
          ]
        : [];
    })
  );

  return `${intro}\n${endpoints.join("\n")}`;
}
