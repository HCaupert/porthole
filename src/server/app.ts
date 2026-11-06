import { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { apiRoutes } from "./api.ts";
import { capture } from "./capture.ts";
import { llmsText } from "./llms.ts";

export const app = new Hono()
  .route("/", capture)
  .route("/", apiRoutes)
  .get(
    "/api/openapi.json",
    openAPIRouteHandler(apiRoutes, {
      documentation: { info: { title: "Porthole", version: "0.1.0" } },
    })
  )
  .get("/llms.txt", async (c) => c.text(await llmsText()));
