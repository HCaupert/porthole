import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { api } from "../lib/api.ts";
import type { Service } from "../shared/domain.ts";

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
      <input
        className="input"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button className="btn-primary" type="submit">
        Save
      </button>
    </form>
  );
}

function Services() {
  const services = useQuery({
    queryKey: ["services"],
    queryFn: api.services,
    refetchInterval: 2000,
  });

  const [renaming, setRenaming] = useState<number>();

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="th">Name</th>
          <th className="th">Port</th>
          <th className="th">Directory</th>
          <th className="th">Command</th>
          <th className="th">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {services.data?.map((service) => (
          <tr key={service.port}>
            <td className="td">
              {renaming === service.port ? (
                <RenameForm
                  service={service}
                  onDone={() => setRenaming(undefined)}
                />
              ) : (
                <button
                  className="hover:underline"
                  onClick={() => setRenaming(service.port)}
                  title="Rename"
                  type="button"
                >
                  {service.name}
                </button>
              )}
            </td>
            <td className="td mono">{service.port}</td>
            <td className="td mono break-all">{service.cwd}</td>
            <td className="td mono break-all">{service.command}</td>
            <td className="td text-right">
              <a
                className="btn"
                href={service.url}
                rel="noreferrer"
                target="_blank"
              >
                Open
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const Route = createFileRoute("/services")({ component: Services });
