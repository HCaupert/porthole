import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ExchangeDetail } from "../components/exchange-detail.tsx";
import { api, DirectionFilter } from "../lib/api.ts";
import type { ExchangeFilter } from "../lib/api.ts";
import { directions } from "../shared/domain.ts";

function useExchangeStream() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const events = new EventSource("/api/exchanges/stream");
    events.addEventListener("message", () => {
      void queryClient.invalidateQueries({ queryKey: ["exchanges"] });
    });

    return () => events.close();
  }, [queryClient]);
}

function Traffic() {
  useExchangeStream();

  const [filter, setFilter] = useState<ExchangeFilter>({
    source: "",
    direction: "",
    eventName: "",
  });

  const [selectedId, setSelectedId] = useState<number>();

  const exchanges = useQuery({
    queryKey: ["exchanges", filter],
    queryFn: async () => await api.exchanges(filter),
  });

  const sources = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const selected = exchanges.data?.find(({ id }) => id === selectedId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select
            className="input"
            value={filter.source}
            onChange={(event) =>
              setFilter({ ...filter, source: event.target.value })
            }
          >
            <option value="">All sources</option>
            {sources.data?.map(({ name }) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            className="input"
            value={filter.direction}
            onChange={(event) =>
              setFilter({
                ...filter,
                direction: DirectionFilter.parse(event.target.value),
              })
            }
          >
            <option value="">Both directions</option>
            {directions.map((direction) => (
              <option key={direction}>{direction}</option>
            ))}
          </select>
          <input
            className="input flex-1"
            placeholder="Event name"
            value={filter.eventName}
            onChange={(event) =>
              setFilter({ ...filter, eventName: event.target.value })
            }
          />
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Time</th>
              <th className="th">Source</th>
              <th className="th">Event</th>
              <th className="th">Request</th>
              <th className="th">Status</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.data?.map((exchange) => (
              <tr
                key={exchange.id}
                className={`cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 ${exchange.id === selectedId ? "bg-neutral-100 dark:bg-neutral-900" : ""}`}
                onClick={() => setSelectedId(exchange.id)}
              >
                <td className="td mono">{exchange.receivedAt.slice(11, 19)}</td>
                <td className="td">
                  {exchange.direction === "inbound" ? "in" : "out"}{" "}
                  {exchange.source}
                </td>
                <td className="td">{exchange.eventName}</td>
                <td className="td mono">
                  {exchange.method} {exchange.path}
                </td>
                <td className="td mono">{exchange.response?.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>{selected && <ExchangeDetail exchange={selected} />}</section>
    </div>
  );
}

export const Route = createFileRoute("/")({ component: Traffic });
