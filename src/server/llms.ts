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

## Inbound subscriptions
A subscription sends each new delivery of an inbound source to a URL, signed again with the secret of the source, until its TTL ends. Use it to send real webhooks to a local app. POST /api/subscriptions creates one. GET /api/exchanges/<id>/forwards gives the status of each forward. Expired subscriptions are ignored and removed.

## Services
Each service that listens on a local port opens at ${config.serviceHost.replace("*", "<port>")}. Cloudflare Access protects this address.

## Public services
${
  config.publicServiceHost
    ? `A published port also opens at ${config.publicServiceHost.replace("*", "<port>")}, without Access. Use it for callers that cannot sign in, such as CI jobs. PUT /api/publications/<port> publishes a port until its TTL ends. A port that is not published, or whose TTL ended, gives 404.`
    : "Not configured: set PUBLIC_SERVICE_HOST."
}

## Docker containers
${
  config.listenAddresses.length > 1
    ? `Porthole also listens on ${config.listenAddresses[1]}. A container uses http://${config.listenAddresses[1]}:${config.port} instead of ${config.localUrl}.`
    : "Porthole listens on 127.0.0.1 only. Set BRIDGE_ADDRESS to the Docker bridge gateway (172.17.0.1) to reach it from containers."
}

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
