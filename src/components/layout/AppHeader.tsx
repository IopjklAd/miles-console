/**
 * Top bar: product name, live system state, backend/ESP32 connection, clock,
 * notifications, theme and account.
 *
 * The chips read the polled state directly, so they always reflect what the
 * backend actually reported (or explicitly "indisponible").
 */

import { LogoMark } from "@/components/miles/LogoMark";
import { NotificationsPopover } from "@/components/layout/NotificationsPopover";
import {
  AvailabilityBadge,
  ConnectionBadge,
} from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { statusLabel } from "@/miles/api/schema";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useFormat } from "@/hooks/use-format";
import { useMiles } from "@/state/miles";
import { Loader2, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

function FallbackChip({ label, spinning }: { label: string; spinning?: boolean }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <Loader2
        className={cn("size-3.5", spinning && "animate-spin")}
        aria-hidden
      />
      {label}
    </span>
  );
}

function SystemChip() {
  const { status } = useMiles();
  if (status.data) {
    return (
      <AvailabilityBadge
        status={status.data.overall}
        label={`Système · ${statusLabel(status.data.overall)}`}
      />
    );
  }
  return (
    <FallbackChip
      label={status.error ? "Système · indisponible" : "Système…"}
      spinning={!status.error}
    />
  );
}

function Esp32Chip() {
  const { status } = useMiles();
  if (status.data) {
    const esp32 = status.data.esp32;
    return (
      <AvailabilityBadge
        status={esp32.status}
        label={`ESP32-S3 · ${esp32.label}`}
      />
    );
  }
  return (
    <FallbackChip
      label={status.error ? "ESP32-S3 · indisponible" : "ESP32-S3…"}
      spinning={!status.error}
    />
  );
}

function Clock() {
  const format = useFormat();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span
      className="mono-value hidden text-xs text-muted-foreground md:inline"
      aria-label="Heure locale"
    >
      {format.clock(now)}
    </span>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 cursor-pointer"
      aria-label={
        isDark ? "Passer au thème clair" : "Passer au thème sombre"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const identity = user?.name || user?.email || "Opérateur";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-8 cursor-pointer gap-2 px-2 text-xs"
        >
          <User className="size-4" aria-hidden />
          <span className="hidden max-w-32 truncate sm:inline">
            {identity}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium">
            {identity}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            Session opérateur
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => navigate("/dashboard/parametres")}
        >
          <Settings className="size-4" aria-hidden />
          Paramètres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-danger focus:text-danger"
          onSelect={() => {
            void signOut().then(() => navigate("/"));
          }}
        >
          <LogOut className="size-4" aria-hidden />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader() {
  const { connection } = useMiles();

  const statusChips: ReactNode = (
    <>
      <SystemChip />
      <ConnectionBadge connection={connection} />
      <Esp32Chip />
    </>
  );

  return (
    <header className="shrink-0 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <SidebarTrigger className="shrink-0" />
        <div className="flex shrink-0 items-center gap-2">
          <LogoMark size="sm" />
          <span className="text-sm font-bold tracking-tight">MILES</span>
        </div>

        <div className="hidden items-center gap-2 pl-2 lg:flex">
          {statusChips}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Clock />
          <NotificationsPopover />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>

      {/* Connection state stays visible on small screens too. */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-border/50 bg-muted/20 px-3 py-2 lg:hidden">
        {statusChips}
      </div>
    </header>
  );
}
