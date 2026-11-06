import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api";

export const sourcesQuery = queryOptions({
  queryKey: ["sources"],
  queryFn: api.sources,
});

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: api.services,
  refetchInterval: 2000,
});
