import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../lib/api.ts";
import {
  directions,
  PresetName,
  presetNames,
  SourceSchema,
  SourceUpdateSchema,
} from "../shared/domain.ts";
import type { Source, SourceView } from "../shared/domain.ts";

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
      onDone();
    },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <label className="flex flex-col gap-1">
        Name
        <input
          className="input"
          disabled={source !== undefined}
          required
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1">
        Direction
        <select
          className="input"
          value={draft.direction}
          onChange={(event) =>
            setDraft(
              event.target.value === "outbound"
                ? { ...draft, direction: "outbound", upstream: "" }
                : { ...draft, direction: "inbound", preset: "github" }
            )
          }
        >
          {directions.map((direction) => (
            <option key={direction}>{direction}</option>
          ))}
        </select>
      </label>
      {draft.direction === "inbound" ? (
        <>
          <label className="flex flex-col gap-1">
            Preset
            <select
              className="input"
              value={draft.preset}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  preset: PresetName.parse(event.target.value),
                })
              }
            >
              {presetNames.map((preset) => (
                <option key={preset}>{preset}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Secret
            <input
              autoComplete="new-password"
              className="input"
              disabled={removeSecret}
              placeholder={
                source?.direction === "inbound" && source.hasSecret
                  ? "Empty keeps the current secret"
                  : ""
              }
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>
          {source?.direction === "inbound" && source.hasSecret && (
            <label className="flex items-center gap-1">
              <input
                checked={removeSecret}
                type="checkbox"
                onChange={(event) => setRemoveSecret(event.target.checked)}
              />
              Remove secret
            </label>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1">
          Upstream
          <input
            className="input w-72"
            placeholder="https://api.github.com"
            required
            value={draft.upstream}
            onChange={(event) =>
              setDraft({ ...draft, upstream: event.target.value })
            }
          />
        </label>
      )}
      <button className="btn-primary" disabled={save.isPending} type="submit">
        Save
      </button>
      <button className="btn" onClick={onDone} type="button">
        Cancel
      </button>
      {save.error && (
        <p className="w-full text-red-600">{save.error.message}</p>
      )}
    </form>
  );
}
