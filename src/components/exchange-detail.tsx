import { RiArrowDownLine, RiArrowUpLine, RiPlayLine } from "@remixicon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CodeBlock } from "@/components/code-block";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { servicesQuery } from "@/lib/queries";
import type { Exchange } from "@/shared/domain";

export function DirectionBadge({
  direction,
}: {
  direction: Exchange["direction"];
}) {
  return direction === "inbound" ? (
    <Badge variant="secondary">
      <RiArrowDownLine data-icon="inline-start" />
      inbound
    </Badge>
  ) : (
    <Badge variant="outline">
      <RiArrowUpLine data-icon="inline-start" />
      outbound
    </Badge>
  );
}

export function StatusBadge({ status }: { status: number }) {
  if (status >= 500) {
    return <Badge variant="destructive">{status}</Badge>;
  }

  if (status >= 400) {
    return <Badge variant="warning">{status}</Badge>;
  }

  return <Badge variant="success">{status}</Badge>;
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">No headers.</p>;
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([name, value]) => (
            <TableRow key={name}>
              <TableCell className="align-top whitespace-nowrap">
                <span className="text-muted-foreground font-mono text-xs">
                  {name}
                </span>
              </TableCell>
              <TableCell className="whitespace-normal">
                <span className="font-mono text-xs break-all">{value}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReplayForm({ id }: { id: number }) {
  const services = useQuery(servicesQuery);
  const [port, setPort] = useState<string | null>(null);
  const [path, setPath] = useState("/");
  const service = services.data?.find((item) => String(item.port) === port);

  const replay = useMutation({
    mutationFn: async () =>
      await api.replay(id, `http://${service?.host}:${service?.port}${path}`),
    onSuccess: ({ status }) =>
      status < 400
        ? toast.success(`The target answered ${status}`)
        : toast.error(`The target answered ${status}`),
  });

  if (services.data?.length === 0) {
    return (
      <Empty>
        <EmptyTitle>No service detected</EmptyTitle>
        <EmptyDescription>
          Start an app that listens on a port. Then replay the delivery to it.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        replay.mutate();
      }}
    >
      <p className="text-muted-foreground text-sm">
        Porthole signs the delivery again with the secret of its source.
      </p>
      <div className="flex items-end gap-2">
        <Field className="w-52 shrink-0">
          <FieldLabel>Service</FieldLabel>
          <Select
            items={services.data?.map((item) => ({
              value: String(item.port),
              label: `${item.name} :${item.port}`,
            }))}
            value={port}
            onValueChange={setPort}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a service" />
            </SelectTrigger>
            <SelectContent>
              {services.data?.map((item) => (
                <SelectItem key={item.port} value={String(item.port)}>
                  {item.name} :{item.port}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="replay-path">Path</FieldLabel>
          <Input
            id="replay-path"
            value={path}
            onChange={(event) => setPath(event.target.value)}
          />
        </Field>
        <Button disabled={!service || replay.isPending} type="submit">
          <RiPlayLine data-icon="inline-start" />
          Replay
        </Button>
      </div>
      {replay.data && (
        <Section title="Target response">
          <div>
            <StatusBadge status={replay.data.status} />
          </div>
          <CodeBlock body={replay.data.body} />
        </Section>
      )}
    </form>
  );
}

export function ExchangeDetail({ exchange }: { exchange: Exchange }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          <span className="block pr-8 font-mono text-sm break-all">
            {exchange.method} {exchange.path}
            {exchange.query}
          </span>
        </SheetTitle>
        <div className="flex flex-wrap items-center gap-2">
          <DirectionBadge direction={exchange.direction} />
          <Badge variant="outline">{exchange.source}</Badge>
          {exchange.eventName && (
            <Badge variant="outline">{exchange.eventName}</Badge>
          )}
        </div>
        <SheetDescription>
          #{exchange.id} · <RelativeTime iso={exchange.receivedAt} />
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col px-4">
        <Tabs className="min-h-0 flex-1" defaultValue="request">
          <TabsList>
            <TabsTrigger value="request">Request</TabsTrigger>
            {exchange.direction === "outbound" ? (
              <TabsTrigger value="response">Response</TabsTrigger>
            ) : (
              <TabsTrigger value="replay">Replay</TabsTrigger>
            )}
          </TabsList>
          <div className="flex-1 overflow-y-auto pb-4">
            <TabsContent value="request">
              <Stack>
                <Section title="Headers">
                  <HeadersTable headers={exchange.headers} />
                </Section>
                <Section title="Body">
                  <CodeBlock body={exchange.body} />
                </Section>
              </Stack>
            </TabsContent>
            {exchange.direction === "outbound" ? (
              <TabsContent value="response">
                <Stack>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={exchange.response.status} />
                    <span className="text-muted-foreground text-sm">
                      {Math.round(exchange.response.durationMs)} ms
                    </span>
                  </div>
                  <Section title="Headers">
                    <HeadersTable headers={exchange.response.headers} />
                  </Section>
                  <Section title="Body">
                    <CodeBlock body={exchange.response.body} />
                  </Section>
                </Stack>
              </TabsContent>
            ) : (
              <TabsContent value="replay">
                <ReplayForm id={exchange.id} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </>
  );
}
