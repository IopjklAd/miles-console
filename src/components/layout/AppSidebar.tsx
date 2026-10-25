/**
 * Persistent navigation of the console.
 *
 * Groups are stable for version 1: supervision (dashboard, sensors, logs),
 * piloting (assistant, conversations, MILES control) and system (settings).
 * Pages that are not implemented yet are simply not listed — no dead links.
 */

import { LogoMark } from "@/components/miles/LogoMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { prefetchRoute, routeKeyForPath } from "@/lib/route-loaders";
import { useMiles } from "@/state/miles";
import {
  Bot,
  Camera,
  Gamepad2,
  Gauge,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Server,
  Settings,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Supervision",
    items: [
      { to: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, end: true },
      { to: "/dashboard/capteurs", label: "Capteurs", icon: Gauge },
      { to: "/dashboard/vision", label: "Vision", icon: Camera },
      { to: "/dashboard/audio", label: "Audio", icon: Volume2 },
      { to: "/dashboard/journaux", label: "Journaux", icon: ScrollText },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { to: "/dashboard/assistant", label: "Assistant IA", icon: Bot },
      { to: "/dashboard/conversations", label: "Conversations", icon: MessagesSquare },
      { to: "/dashboard/controle", label: "Contrôle de MILES", icon: Gamepad2 },
    ],
  },
  {
    label: "Système",
    items: [
      { to: "/dashboard/services", label: "Services", icon: Server },
      { to: "/dashboard/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

function StatusFooter() {
  const { connection } = useMiles();
  const tone =
    connection === "connected"
      ? "bg-success"
      : connection === "disconnected"
        ? "bg-danger"
        : connection === "demo" || connection === "unconfigured"
          ? "bg-warning"
          : "bg-muted-foreground";

  const label =
    connection === "connected"
      ? "Backend connecté"
      : connection === "disconnected"
        ? "Backend inaccessible"
        : connection === "demo"
          ? "Données simulées"
          : connection === "unconfigured"
            ? "Backend non configuré"
            : "Connexion…";

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-2">
      <span
        className={cn("size-2 shrink-0 rounded-full", tone)}
        aria-hidden
      />
      <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function prefetchRouteByKey(pathname: string) {
  const key = routeKeyForPath(pathname);
  if (key) prefetchRoute(key);
}

export function AppSidebar() {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1">
          <LogoMark />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold tracking-tight">MILES</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Console de supervision
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.end
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <NavLink
                          to={item.to}
                          end={item.end}
                          // Warm the target chunk on intent (hover, focus,
                          // touch) so the click swaps pages synchronously.
                          onPointerEnter={() => prefetchRouteByKey(item.to)}
                          onPointerDown={() => prefetchRouteByKey(item.to)}
                          onFocus={() => prefetchRouteByKey(item.to)}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <Icon aria-hidden />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <StatusFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
