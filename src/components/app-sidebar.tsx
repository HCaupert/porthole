import {
  RiAnchorLine,
  RiArrowLeftRightLine,
  RiRobot2Line,
  RiServerLine,
  RiWebhookLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { servicesQuery } from "@/lib/queries";

const links = [
  { to: "/", label: "Traffic", icon: RiArrowLeftRightLine },
  { to: "/sources", label: "Sources", icon: RiWebhookLine },
  { to: "/services", label: "Services", icon: RiServerLine },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const services = useQuery(servicesQuery);

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <RiAnchorLine className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Porthole</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    isActive={pathname === to}
                    render={<Link to={to} />}
                  >
                    <Icon />
                    {label}
                  </SidebarMenuButton>
                  {to === "/services" && services.data && (
                    <SidebarMenuBadge>{services.data.length}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <a
                  aria-label="API for agents"
                  href="/llms.txt"
                  rel="noreferrer"
                  target="_blank"
                />
              }
            >
              <RiRobot2Line />
              API for agents
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
