import { RiDeleteBinLine, RiEditLine, RiWebhookLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { SourceForm } from "@/components/source-form";
import { Truncated } from "@/components/truncated";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { sourcesQuery } from "@/lib/queries";
import type { SourceView } from "@/shared/domain";

function DeleteSourceButton({ name }: { name: string }) {
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: async () => await api.deleteSource(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(`Source ${name} deleted`);
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            aria-label={`Delete ${name}`}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <RiDeleteBinLine />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Porthole stops receiving and recording for this source. The traffic
            already recorded stays.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => remove.mutate()}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SourceConfig({ source }: { source: SourceView }) {
  if (source.direction === "outbound") {
    return <Truncated text={source.upstream} />;
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">{source.preset}</Badge>
      <Badge variant={source.hasSecret ? "success" : "outline"}>
        {source.hasSecret ? "signed" : "unsigned"}
      </Badge>
    </div>
  );
}

function Sources() {
  const sources = useQuery(sourcesQuery);
  const [editing, setEditing] = useState<{ source?: SourceView }>();

  return (
    <>
      <PageHeader
        title="Sources"
        description="Where webhooks come from and where your apps send calls."
      >
        <Button onClick={() => setEditing({})}>New source</Button>
      </PageHeader>
      {sources.data?.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiWebhookLine />
            </EmptyMedia>
            <EmptyTitle>No source</EmptyTitle>
            <EmptyDescription>
              Declare a source to receive webhooks or to record outbound calls.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Config</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.data?.map((source) => (
                <TableRow key={source.name}>
                  <TableCell>{source.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        source.direction === "inbound" ? "default" : "outline"
                      }
                    >
                      {source.direction}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SourceConfig source={source} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Truncated text={source.url} />
                      <CopyButton label="Copy URL" text={source.url} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        aria-label={`Edit ${source.name}`}
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditing({ source })}
                      >
                        <RiEditLine />
                      </Button>
                      <DeleteSourceButton name={source.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={() => setEditing(undefined)}
      >
        <DialogContent>
          <SourceForm
            source={editing?.source}
            onDone={() => setEditing(undefined)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export const Route = createFileRoute("/sources")({ component: Sources });
