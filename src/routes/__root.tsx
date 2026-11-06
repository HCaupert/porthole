import { QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import { queryClient } from "../lib/query-client.ts";

import appCss from "../styles.css?url";

const links = [
  { to: "/", label: "Traffic" },
  { to: "/sources", label: "Sources" },
  { to: "/services", label: "Services" },
] as const;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Porthole" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  component: () => (
    <QueryClientProvider client={queryClient}>
      <header className="flex items-center gap-4 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <strong>Porthole</strong>
        <nav className="flex gap-3">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-neutral-500 hover:text-inherit"
              activeProps={{ className: "font-medium text-inherit" }}
              activeOptions={{ exact: true }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </QueryClientProvider>
  ),
});
