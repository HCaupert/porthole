import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../lib/api.ts";
import type { Exchange } from "../shared/domain.ts";

function pretty(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function Headers({ headers }: { headers: Record<string, string> }) {
  return (
    <dl className="mono grid grid-cols-[max-content_1fr] gap-x-3">
      {Object.entries(headers).map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-neutral-500">{name}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ body }: { body: string }) {
  return (
    <pre className="mono max-h-96 overflow-auto rounded bg-neutral-100 p-2 dark:bg-neutral-900">
      {pretty(body) || "(empty)"}
    </pre>
  );
}

function ReplayForm({ id }: { id: number }) {
  const services = useQuery({ queryKey: ["services"], queryFn: api.services });
  const [port, setPort] = useState("");
  const [path, setPath] = useState("/");
  const service = services.data?.find((item) => String(item.port) === port);

  const replay = useMutation({
    mutationFn: async () =>
      await api.replay(id, `http://${service?.host}:${service?.port}${path}`),
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        replay.mutate();
      }}
    >
      <div className="flex gap-2">
        <select
          className="input"
          value={port}
          onChange={(event) => setPort(event.target.value)}
        >
          <option value="">Pick a service</option>
          {services.data?.map((item) => (
            <option key={item.port} value={item.port}>
              {item.name} :{item.port}
            </option>
          ))}
        </select>
        <input
          className="input flex-1"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
        <button className="btn-primary" disabled={!service} type="submit">
          Replay
        </button>
      </div>
      {replay.data && (
        <div>
          <p className="mono">Status {replay.data.status}</p>
          <Body body={replay.data.body} />
        </div>
      )}
      {replay.error && <p className="text-red-600">{replay.error.message}</p>}
    </form>
  );
}

export function ExchangeDetail({ exchange }: { exchange: Exchange }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="mono font-medium">
        {exchange.method} {exchange.path}
        {exchange.query}
      </h2>
      <p className="text-neutral-500">
        #{exchange.id} {exchange.direction} {exchange.source}{" "}
        {exchange.eventName} {exchange.receivedAt}
      </p>
      <h3 className="font-medium">Request headers</h3>
      <Headers headers={exchange.headers} />
      <h3 className="font-medium">Request body</h3>
      <Body body={exchange.body} />
      {exchange.direction === "inbound" ? (
        <>
          <h3 className="font-medium">Replay</h3>
          <ReplayForm id={exchange.id} />
        </>
      ) : (
        <>
          <h3 className="font-medium">
            Response {exchange.response.status} in{" "}
            {exchange.response.durationMs} ms
          </h3>
          <Headers headers={exchange.response.headers} />
          <Body body={exchange.response.body} />
        </>
      )}
    </div>
  );
}
