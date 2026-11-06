import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { SourceForm } from "../components/source-form.tsx";
import { api } from "../lib/api.ts";

function Sources() {
  const queryClient = useQueryClient();
  const sources = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const [editing, setEditing] = useState<string>();

  const remove = useMutation({
    mutationFn: api.deleteSource,
    onSuccess: async () =>
      await queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      {editing === undefined ? (
        <div>
          <button
            className="btn-primary"
            onClick={() => setEditing("")}
            type="button"
          >
            New source
          </button>
        </div>
      ) : (
        editing === "" && <SourceForm onDone={() => setEditing(undefined)} />
      )}
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Name</th>
            <th className="th">Direction</th>
            <th className="th">Config</th>
            <th className="th">URL</th>
            <th className="th">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.data?.map((source) =>
            editing === source.name ? (
              <tr key={source.name}>
                <td className="td" colSpan={5}>
                  <SourceForm
                    source={source}
                    onDone={() => setEditing(undefined)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={source.name}>
                <td className="td">{source.name}</td>
                <td className="td">{source.direction}</td>
                <td className="td">
                  {source.direction === "inbound"
                    ? `${source.preset}${source.secret ? ", secret set" : ""}`
                    : source.upstream}
                </td>
                <td className="td mono break-all">{source.url}</td>
                <td className="td text-right whitespace-nowrap">
                  <button
                    className="btn mr-2"
                    onClick={() => {
                      void navigator.clipboard.writeText(source.url);
                    }}
                    type="button"
                  >
                    Copy URL
                  </button>
                  <button
                    className="btn mr-2"
                    onClick={() => setEditing(source.name)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => remove.mutate(source.name)}
                    type="button"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Route = createFileRoute("/sources")({ component: Sources });
