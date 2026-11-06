import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  DirectionName,
  directions,
  PresetName,
  presetNames,
  SourceSchema,
  SourceUpdateSchema,
} from "@/shared/domain";
import type { Source, SourceView } from "@/shared/domain";

const blank: Source = {
  name: "",
  direction: "inbound",
  preset: "github",
};

export function SourceForm({
  source,
  onDone,
}: {
  source?: SourceView;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Source>(source ?? blank);
  const [secret, setSecret] = useState("");
  const [removeSecret, setRemoveSecret] = useState(false);

  const save = useMutation({
    mutationFn: async () =>
      source === undefined
        ? await api.createSource(
            SourceSchema.parse({ ...draft, secret: secret || undefined })
          )
        : await api.updateSource(
            source.name,
            SourceUpdateSchema.parse({
              ...draft,
              secret: removeSecret ? null : secret || undefined,
            })
          ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(
        source === undefined
          ? `Source ${draft.name} created`
          : `Source ${draft.name} updated`
      );
      onDone();
    },
  });

  const storedSecret = source?.direction === "inbound" && source.hasSecret;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {source === undefined ? "New source" : `Edit ${source.name}`}
        </DialogTitle>
        <DialogDescription>
          An inbound source receives webhooks. An outbound source records the
          calls of your apps to an upstream.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="source-name">Name</FieldLabel>
          <Input
            disabled={source !== undefined}
            id="source-name"
            placeholder="github"
            required
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <FieldDescription>
            Lowercase letters, digits and dashes. It is part of the URL.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Direction</FieldLabel>
          <Select
            value={draft.direction}
            onValueChange={(direction) =>
              setDraft(
                DirectionName.parse(direction) === "outbound"
                  ? { name: draft.name, direction: "outbound", upstream: "" }
                  : { name: draft.name, direction: "inbound", preset: "github" }
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {directions.map((direction) => (
                <SelectItem key={direction} value={direction}>
                  {direction}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {draft.direction === "inbound" ? (
          <>
            <Field>
              <FieldLabel>Preset</FieldLabel>
              <Select
                value={draft.preset}
                onValueChange={(preset) =>
                  setDraft({ ...draft, preset: PresetName.parse(preset) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetNames.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {preset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="source-secret">Secret</FieldLabel>
              <Input
                autoComplete="new-password"
                disabled={removeSecret}
                id="source-secret"
                placeholder={
                  storedSecret ? "Empty keeps the current secret" : ""
                }
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
              <FieldDescription>
                Porthole verifies the signature of each delivery with it. It
                never shows the secret again.
              </FieldDescription>
            </Field>
            {storedSecret && (
              <Field orientation="horizontal">
                <Checkbox
                  checked={removeSecret}
                  id="source-remove-secret"
                  onCheckedChange={setRemoveSecret}
                />
                <FieldLabel htmlFor="source-remove-secret">
                  Remove the secret
                </FieldLabel>
              </Field>
            )}
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="source-upstream">Upstream</FieldLabel>
            <Input
              id="source-upstream"
              placeholder="https://api.github.com"
              required
              value={draft.upstream}
              onChange={(event) =>
                setDraft({ ...draft, upstream: event.target.value })
              }
            />
          </Field>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button onClick={onDone} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={save.isPending} type="submit">
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
