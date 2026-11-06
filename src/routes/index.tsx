import { RiArrowLeftRightLine } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DirectionBadge,
  ExchangeDetail,
  StatusBadge,
} from "@/components/exchange-detail";
import { PageHeader } from "@/components/page-header";
import { RelativeTime } from "@/components/relative-time";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, DirectionFilter } from "@/lib/api";
import type { ExchangeFilter } from "@/lib/api";
import { sourcesQuery } from "@/lib/queries";
import { directions } from "@/shared/domain";

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

function Filters({
  filter,
  onChange,
}: {
  filter: ExchangeFilter;
  onChange: (filter: ExchangeFilter) => void;
}) {
  const sources = useQuery(sourcesQuery);

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        items={[
          { value: "", label: "All sources" },
          ...(sources.data ?? []).map(({ name }) => ({
            value: name,
            label: name,
          })),
        ]}
        value={filter.source}
        onValueChange={(source) =>
          onChange({ ...filter, source: source ?? "" })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All sources</SelectItem>
          {sources.data?.map(({ name }) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: "", label: "Both directions" },
          ...directions.map((direction) => ({
            value: direction,
            label: direction,
          })),
        ]}
        value={filter.direction}
        onValueChange={(direction) =>
          onChange({ ...filter, direction: DirectionFilter.parse(direction) })
        }
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Both directions</SelectItem>
          {directions.map((direction) => (
            <SelectItem key={direction} value={direction}>
              {direction}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="w-56"
        placeholder="Event name"
        value={filter.eventName}
        onChange={(event) =>
          onChange({ ...filter, eventName: event.target.value })
        }
      />
    </div>
  );
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

  const selected = exchanges.data?.find(({ id }) => id === selectedId);

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Webhooks received and outbound calls recorded."
      />
      <Filters filter={filter} onChange={setFilter} />
      {exchanges.data?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiArrowLeftRightLine />
            </EmptyMedia>
            <EmptyTitle>No traffic</EmptyTitle>
            <EmptyDescription>
              Deliveries and outbound calls appear here when they match the
              filters.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exchanges.data?.map((exchange) => (
                <TableRow
                  key={exchange.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(exchange.id)}
                >
                  <TableCell>
                    <DirectionBadge direction={exchange.direction} />
                  </TableCell>
                  <TableCell>{exchange.source}</TableCell>
                  <TableCell>{exchange.eventName}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {exchange.method} {exchange.path}
                    </span>
                  </TableCell>
                  <TableCell>
                    {exchange.response && (
                      <StatusBadge status={exchange.response.status} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">
                      <RelativeTime iso={exchange.receivedAt} />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Sheet
        open={selected !== undefined}
        onOpenChange={() => setSelectedId(undefined)}
      >
        <SheetContent className="data-[side=right]:sm:max-w-2xl">
          {selected && <ExchangeDetail exchange={selected} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

export const Route = createFileRoute("/")({ component: Traffic });
