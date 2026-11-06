import { RiExternalLinkLine, RiServerLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Truncated } from "@/components/truncated";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { servicesQuery } from "@/lib/queries";
import type { Service } from "@/shared/domain";

function RenameForm({
  service,
  onDone,
}: {
  service: Service;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(service.name);

  const rename = useMutation({
    mutationFn: async () => await api.renameService(service.port, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(`Service renamed to ${name}`);
      onDone();
    },
  });

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        rename.mutate();
      }}
    >
      <Input
        aria-label="Name"
        className="w-48"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button disabled={rename.isPending} type="submit">
        Save
      </Button>
      <Button onClick={onDone} type="button" variant="outline">
        Cancel
      </Button>
    </form>
  );
}

function Services() {
  const services = useQuery(servicesQuery);
  const [renaming, setRenaming] = useState<number>();

  return (
    <>
      <PageHeader
        title="Services"
        description="Apps listening on local ports. Each one opens at its own hostname."
      />
      {services.data?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiServerLine />
            </EmptyMedia>
            <EmptyTitle>No service detected</EmptyTitle>
            <EmptyDescription>
              Start an app that listens on a port. It shows up here within a few
              seconds.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Directory</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.data?.map((service) => (
                <TableRow key={service.port}>
                  <TableCell>
                    {renaming === service.port ? (
                      <RenameForm
                        service={service}
                        onDone={() => setRenaming(undefined)}
                      />
                    ) : (
                      <Button
                        title="Rename"
                        variant="ghost"
                        onClick={() => setRenaming(service.port)}
                      >
                        {service.name}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{service.port}</span>
                  </TableCell>
                  <TableCell>
                    <Truncated text={service.cwd} />
                  </TableCell>
                  <TableCell>
                    <Truncated text={service.command} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <a
                        className={buttonVariants({
                          size: "sm",
                          variant: "outline",
                        })}
                        href={service.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open
                        <RiExternalLinkLine />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/services")({ component: Services });
