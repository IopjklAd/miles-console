/**
 * Notification centre.
 *
 * Entries come from real events (connection transitions, threshold breaches,
 * command/AI failures) pushed by the state layer, plus explicit app messages.
 * Each entry keeps its origin so demo-generated events stay labelled.
 */

import { SeverityBadge } from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useMiles } from "@/state/miles";
import { Bell, CheckCheck, FlaskConical, Inbox } from "lucide-react";

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

export function NotificationsPopover() {
  const { notifications, unreadCount, markRead, markAllRead } = useMiles();
  const format = useFormat();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-8 cursor-pointer"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} non lues)`
              : "Notifications"
          }
        >
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer gap-1.5 text-xs"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="size-3.5" aria-hidden />
            Tout lire
          </Button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Inbox className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Aucune notification</p>
            <p className="text-xs text-muted-foreground">
              Les événements du système s'afficheront ici.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border/60">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => markRead(notification.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                      notification.read && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        SEVERITY_DOT[notification.severity],
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {notification.title}
                        </span>
                        {notification.origin === "demo" ? (
                          <FlaskConical
                            className="size-3 shrink-0 text-warning"
                            aria-label="Événement simulé"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <SeverityBadge
                          severity={notification.severity}
                          className="text-[10px]"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {format.relative(notification.at)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
