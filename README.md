# Porthole

Porthole runs on a remote development machine. It gives you one UI for people and one local API for coding agents.

Porthole does these things:

- It receives webhooks from providers such as GitHub, GitLab and Jira, and keeps them for inspection and replay. It can forward each new webhook to a local app.
- It records the outbound HTTP calls of your local apps. Your app calls Porthole, and Porthole forwards the call to the real upstream.
- It finds the services that listen on local ports. It opens each service at its own hostname, for example `3104-porthole.example.com`. It can open a service to callers that cannot sign in, for example `3104-public.example.com`.

Porthole has no authentication. Put a tunnel and an access layer in front of it. See [Cloudflare setup](#cloudflare-setup).

## Requirements

- Linux. Porthole reads `/proc` to find services.
- [Bun](https://bun.sh) 1.4 or later.

## Install

```sh
bun install
bun run build
```

## Configure

Porthole reads its configuration from environment variables. Bun also reads a `.env` file in the project directory. Copy `.env.example` to start.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `5200` | Port of the server. |
| `BRIDGE_ADDRESS` | No |  | IPv4 address to listen on, in addition to `127.0.0.1`. Set it to the Docker bridge gateway, `172.17.0.1`, so containers can reach Porthole. Without it, the server listens on `127.0.0.1` only. |
| `PUBLIC_URL` | Yes |  | Public URL of the UI, for example `https://porthole.example.com`. Webhook URLs start with it. |
| `SERVICE_HOST` | Yes |  | Hostname template of the services. Porthole replaces `*` with the port: `*-porthole.example.com`. |
| `PUBLIC_SERVICE_HOST` | No |  | Hostname template of the public services. Porthole replaces `*` with the port: `*-public.example.com`. Without it, Porthole serves no public service. |
| `DATABASE_PATH` | No | `~/.porthole/porthole.db` | SQLite database file. |

## Run

```sh
bun run start
```

The server answers requests that have one of these `Host` headers:

- The host of `PUBLIC_URL`, `localhost` or `127.0.0.1`: the UI and the API.
- A host that matches `SERVICE_HOST`: a proxy to the service on that port.
- A host that matches `PUBLIC_SERVICE_HOST`: a proxy to the service on that port if the port is published. Otherwise `404`.
- The `BRIDGE_ADDRESS`: the UI and the API.
- Any other host: `404`.

## Cloudflare setup

Porthole expects these items in front of it:

1. A Cloudflare Tunnel with public hostnames. All point to `http://127.0.0.1:5200`:
   - The host of `PUBLIC_URL`, for example `porthole.example.com`.
   - The wildcard of `SERVICE_HOST`, for example `*-porthole.example.com`.
   - The wildcard of `PUBLIC_SERVICE_HOST`, for example `*-public.example.com`. Skip it if you do not publish ports.
2. DNS records for each hostname that point to the tunnel.
3. A Cloudflare Access application that protects every path except `/api/webhooks/*`. Providers cannot sign in, so they must reach `/api/webhooks/*` without Access.
4. A bypass policy for `*-public.example.com`. Porthole does the access control of this host: it serves only the ports you publish.

Put the service host at the first level under your domain (`3104-porthole.example.com`). Then the Universal SSL certificate of the domain covers it.

The API of agents does not go through the tunnel. Agents call `http://127.0.0.1:5200/api` on the machine.

## Inbound webhooks

1. Create an inbound source in the UI or with the API. Set a preset and a secret.
2. Give the URL of the source to the provider: `PUBLIC_URL/api/webhooks/<name>`.

Porthole answers `200` with an empty body, and stores the delivery. If the signature is not valid, Porthole answers `401` and does not store the delivery. A source without a secret skips the verification. The API and the UI never return a secret. They return `hasSecret`.

| Preset | Verification | Event name |
| --- | --- | --- |
| `github` | `X-Hub-Signature-256`: `sha256=` and the HMAC-SHA256 of the body. | `X-GitHub-Event` and `action` |
| `gitlab` | Signing token. [Standard Webhooks](https://www.standardwebhooks.com). | `object_kind` and `object_attributes.action` |
| `jira` | `X-Hub-Signature`: `sha256=` and the HMAC-SHA256 of the body. | `webhookEvent` |
| `generic` | None. | Method and path |

Porthole keeps each exchange for 7 days. It always keeps the latest exchange of each source and event name, as a sample.

## Subscriptions

A subscription sends each new delivery of an inbound source to a URL. Use it to send real webhooks to a local app that has no public address.

```sh
curl -X POST http://127.0.0.1:5200/api/subscriptions -H 'content-type: application/json' \
  -d '{"source":"github","url":"http://127.0.0.1:3000/api/webhooks/github","ttlSeconds":3600}'
```

Porthole sends the delivery signed again with the secret of the source, the same way as a replay. It sends it to the URL exactly as given. `GET /api/exchanges/:id/forwards` gives the status of each forward. A subscription ends when its TTL ends: Porthole ignores it and removes it. `DELETE /api/subscriptions/:id` ends it earlier.

## Outbound capture

1. Create an outbound source with an upstream, for example `https://api.github.com`.
2. In your app, use `http://127.0.0.1:5200/_outbound/<name>` as the base URL.

Porthole appends the path and the query to the upstream, and returns the response unchanged. Porthole stores the request and the response. It replaces the values of the headers that carry credentials with `***`. This applies to `authorization`, `cookie`, `set-cookie`, `x-api-key`, `private-token` and all headers with `token` or `secret` in their name.

## Services

Porthole lists each process of the current user that listens on a TCP port. It excludes its own port. The name of a service is the shortest trailing part of its working directory that is unique. You can rename a service. The name sticks to the working directory.

Open a service at `SERVICE_HOST` with the port. Porthole forwards the request, WebSocket upgrades included, to the service. It keeps the `Host` header unchanged. The app must accept that host. For Vite, add the domain to `server.allowedHosts`.

### Public services

The service host is behind Cloudflare Access. A caller that cannot sign in, for example a CI job, uses the public host. Publish the port first:

```sh
curl -X PUT http://127.0.0.1:5200/api/publications/3104 -H 'content-type: application/json' -d '{"ttlSeconds":3600}'
```

Porthole then serves the port at `PUBLIC_SERVICE_HOST`, for example `3104-public.example.com`, as it does for the service host. When the TTL ends, or after `DELETE /api/publications/3104`, the host answers `404`. Send the `PUT` again to renew the TTL.

### Docker containers

A container cannot reach `127.0.0.1` of the machine. Set `BRIDGE_ADDRESS=172.17.0.1`. A container then calls `http://172.17.0.1:5200/_outbound/<name>` and the API at `http://172.17.0.1:5200/api`.

## API for agents

Agents call `http://127.0.0.1:5200`. The full reference is in two places:

- `GET /llms.txt`: plain text with a `curl` example for each endpoint.
- `GET /api/openapi.json`: OpenAPI document.

| Endpoint | Description |
| --- | --- |
| `GET /api/sources` | List sources. |
| `POST /api/sources` | Create a source. |
| `GET /api/sources/:name` | Read a source. |
| `PUT /api/sources/:name` | Replace a source. Omit `secret` to keep it, send `null` to remove it. |
| `DELETE /api/sources/:name` | Delete a source and its exchanges. |
| `GET /api/exchanges` | List exchanges. Filters: `source`, `direction`, `eventName`, `after`, `limit`. |
| `GET /api/exchanges?after=N&wait=S` | Wait up to `S` seconds for an exchange with an id above `N`. |
| `GET /api/exchanges/stream` | Server-sent events, one message for each new exchange. |
| `GET /api/exchanges/:id` | Read an exchange. |
| `POST /api/exchanges/:id/replay` | Send an inbound exchange again to `{ "url": "..." }`, signed again. |
| `GET /api/exchanges/:id/forwards` | List the forwards of an exchange to subscriptions. |
| `GET /api/subscriptions` | List live subscriptions. Filter: `source`. |
| `POST /api/subscriptions` | Create a subscription with `{ "source", "url", "ttlSeconds" }`. |
| `DELETE /api/subscriptions/:id` | Delete a subscription. |
| `GET /api/services` | List services. |
| `PUT /api/services/:port` | Rename a service with `{ "name": "..." }`. |
| `GET /api/publications` | List published ports. |
| `PUT /api/publications/:port` | Publish a port, or renew it, with `{ "ttlSeconds" }`. |
| `DELETE /api/publications/:port` | Unpublish a port. |

Example: wait for the next push of a source.

```sh
curl 'http://127.0.0.1:5200/api/exchanges?source=github&eventName=push&wait=60'
```

## Develop

```sh
bun install
bun run start   # API and proxy, after bun run build
bun dev         # UI with hot reload, proxies /api to the server above
bun test        # unit tests
bun fix         # format and fix lint
bun check       # lint and type check
```

## Smoke test

The smoke script runs against a running instance. It starts a local echo server, and checks the webhooks, long-poll, replay, outbound capture, service detection and the host proxy, WebSocket included. It exits with a non-zero code if a check fails.

```sh
bun run smoke                        # http://127.0.0.1:5200
bun run smoke http://127.0.0.1:5299  # another instance
```

The smoke script creates sources named `smoke-*` and deletes them at the end. It sets the `Host` header itself, so it needs no DNS record.
