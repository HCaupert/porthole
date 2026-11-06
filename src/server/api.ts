import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { streamSSE } from "hono/streaming";

import { SourceSchema, SourceUpdateSchema } from "../shared/domain.ts";
import {
  ExchangeParams,
  ExchangeQuery,
  RenameBody,
  ReplayBody,
  ServiceParams,
  SourceParams,
} from "./api.schemas.ts";
import { config } from "./config.ts";
import { fail } from "./errors.ts";
import {
  getExchange,
  latestExchangeId,
  listExchanges,
  onExchange,
  waitForExchanges,
} from "./exchanges.ts";
import { replayExchange } from "./replay.ts";
import { getService, listServices, renameService } from "./services.ts";
import {
  createSource,
  deleteSource,
  getSource,
  listSources,
  toSourceView,
  updateSource,
} from "./sources.ts";

const api = config.localUrl;
const PING_MS = 15_000;

export const apiRoutes = new Hono()
  .basePath("/api")
  .get(
    "/sources",
    describeRoute({
      summary: "List sources",
      description: `curl ${api}/api/sources`,
    }),
    (c) => c.json(listSources().map(toSourceView))
  )
  .post(
    "/sources",
    describeRoute({
      summary:
        "Create a source. Inbound: webhook URL for a provider. Outbound: base URL for a local app",
      description: `curl -X POST ${api}/api/sources -H 'content-type: application/json' -d '{"name":"github","direction":"inbound","preset":"github","secret":"s3cret"}'
curl -X POST ${api}/api/sources -H 'content-type: application/json' -d '{"name":"github-api","direction":"outbound","upstream":"https://api.github.com"}'`,
    }),
    validator("json", SourceSchema),
    (c) => c.json(toSourceView(createSource(c.req.valid("json"))), 201)
  )
  .get(
    "/sources/:name",
    describeRoute({
      summary: "Read a source",
      description: `curl ${api}/api/sources/github`,
    }),
    validator("param", SourceParams),
    (c) => {
      const source = getSource(c.req.valid("param").name);

      if (!source) {
        throw fail(404, "SOURCE_NOT_FOUND");
      }

      return c.json(toSourceView(source));
    }
  )
  .put(
    "/sources/:name",
    describeRoute({
      summary: "Replace a source, except its name",
      description: `curl -X PUT ${api}/api/sources/github -H 'content-type: application/json' -d '{"direction":"inbound","preset":"github","secret":"new"}'`,
    }),
    validator("param", SourceParams),
    validator("json", SourceUpdateSchema),
    (c) =>
      c.json(
        toSourceView(
          updateSource({
            name: c.req.valid("param").name,
            ...c.req.valid("json"),
          })
        )
      )
  )
  .delete(
    "/sources/:name",
    describeRoute({
      summary: "Delete a source and its exchanges",
      description: `curl -X DELETE ${api}/api/sources/github`,
    }),
    validator("param", SourceParams),
    (c) => {
      deleteSource(c.req.valid("param").name);

      return c.body(null, 204);
    }
  )
  .get(
    "/exchanges",
    describeRoute({
      summary:
        "List exchanges, newest first. With after, oldest first. With wait, hold the request until a matching exchange exists",
      description: `curl '${api}/api/exchanges?source=github&eventName=push&limit=10'
curl '${api}/api/exchanges?source=github&after=42&wait=60'`,
    }),
    validator("query", ExchangeQuery),
    async (c) => {
      const { wait, ...filter } = c.req.valid("query");

      if (wait === undefined) {
        return c.json(listExchanges(filter));
      }

      return c.json(
        await waitForExchanges(
          { ...filter, after: filter.after ?? latestExchangeId() },
          wait
        )
      );
    }
  )
  .get(
    "/exchanges/stream",
    describeRoute({
      summary: "Server-sent events: one message per new exchange",
      description: `curl -N ${api}/api/exchanges/stream`,
    }),
    (c) =>
      streamSSE(c, async (stream) => {
        const unsubscribe = onExchange(
          async (exchange) =>
            await stream.writeSSE({ data: JSON.stringify(exchange) })
        );

        stream.onAbort(unsubscribe);

        while (!stream.aborted) {
          await stream.writeSSE({ event: "ping", data: "" });
          await stream.sleep(PING_MS);
        }
      })
  )
  .get(
    "/exchanges/:id",
    describeRoute({
      summary: "Read an exchange",
      description: `curl ${api}/api/exchanges/42`,
    }),
    validator("param", ExchangeParams),
    (c) => {
      const exchange = getExchange(c.req.valid("param").id);

      if (!exchange) {
        throw fail(404, "EXCHANGE_NOT_FOUND");
      }

      return c.json(exchange);
    }
  )
  .post(
    "/exchanges/:id/replay",
    describeRoute({
      summary:
        "Send an inbound exchange again to a URL, signed again with the secret of its source. Returns the status and body of the target",
      description: `curl -X POST ${api}/api/exchanges/42/replay -H 'content-type: application/json' -d '{"url":"http://127.0.0.1:3000/api/webhooks/github"}'`,
    }),
    validator("param", ExchangeParams),
    validator("json", ReplayBody),
    async (c) => {
      const exchange = getExchange(c.req.valid("param").id);

      if (!exchange) {
        throw fail(404, "EXCHANGE_NOT_FOUND");
      }

      return c.json(await replayExchange(exchange, c.req.valid("json").url));
    }
  )
  .get(
    "/services",
    describeRoute({
      summary:
        "List the local services that listen on a port. Open one at its url",
      description: `curl ${api}/api/services`,
    }),
    (c) => c.json(listServices())
  )
  .put(
    "/services/:port",
    describeRoute({
      summary: "Rename a service. The name sticks to its working directory",
      description: `curl -X PUT ${api}/api/services/3104 -H 'content-type: application/json' -d '{"name":"yapir-web"}'`,
    }),
    validator("param", ServiceParams),
    validator("json", RenameBody),
    (c) => {
      const service = getService(c.req.valid("param").port);

      if (!service) {
        throw fail(404, "SERVICE_NOT_FOUND");
      }

      const { name } = c.req.valid("json");
      renameService(service.cwd, name);

      return c.json({ ...service, name });
    }
  );
