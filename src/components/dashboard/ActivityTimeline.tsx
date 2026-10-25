/**
 * Recent activity: connection events, notifications and log entries merged
 * into one chronological timeline.
 */

import {
  ErrorState,
  EmptyState,
  LoadingState,
} from "@/components/miles/Feedback";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useMiles } from "@/state/miles";
import type { AppNotification, DataOrigin, LogEntry } from "@/miles/types";
import { Bell, FlaskConical, ScrollText } from "lucide-react";

type Tone = "info" | "success" | "warning" | "error";

interface ActivityItem {
  id: string;
  at: number;
  title: string;
  meta: string;
  origin: DataOrigin | "app";
  tone: Tone;
}

const TONE_CLASS: Record<Tone, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

function toneFromLevel(level: LogEntry["level"]): Tone {
  switch (level) {
    case "CRITICAL":
    case "ERROR":
      return "error";
    case "WARNING":
      return "warning";
    case "INFO":
      return "success";
    default:
      return "info";
  }
}

function toneFromSeverity(severity: AppNotification["severity"]): Tone {
  return severity;
}

export function ActivityTimeline({ className }: { className?: string }) {
  const { logs, notifications, refresh } = useMiles();
  const format = useFormat();

  const items: ActivityItem[] = [
    ...(logs.data ?? []).map<ActivityItem>((log) => ({
      id: `log-${log.id}`,
      at: log.at,
      title: log.message,
      meta: log.source,
      origin: log.origin,
      tone: toneFromLevel(log.level),
    })),
    ...notifications.map<ActivityItem>((notification) => ({
      id: `notif-${notification.id}`,
      at: notification.at,
      title: `${notification.title} — ${notification.message}`,
      meta: notification.origin === "app" ? "interface" : notification.origin,
      origin: notification.origin,
      tone: toneFromSeverity(notification.severity),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 14);

  let body: React.ReactNode;

  if (logs.loading && items.length === 0) {
    body = <LoadingState label="Chargement de l'activité…" />;
  } else if (logs.error && items.length === 0) {
    body = <ErrorState message={logs.error} onRetry={refresh} />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={ScrollText}
        title="Aucune activité récente"
        description="Les événements du backend s'afficheront ici dès la première connexion."
      />
    );
  } else {
    body = (
      <ol className="flex flex-col">
        {items.map((item, index) => (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {index < items.length - 1 ? (
              <span
                className="absolute left-[5px] top-5 h-full w-px bg-border"
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-card",
                TONE_CLASS[item.tone],
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <span className="mono-value shrink-0 text-[11px] text-muted-foreground">
                  {format.clock(item.at)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="mono-value uppercase">{item.meta}</span>
                <span aria-hidden>·</span>
                <span>{format.relative(item.at)}</span>
                {item.origin === "demo" ? (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <FlaskConical className="size-3" aria-hidden />
                    simulé
                  </span>
                ) : null}
                {item.origin === "app" ? (
                  <span className="inline-flex items-center gap-1">
                    <Bell className="size-3" aria-hidden />
                    interface
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <Panel className={className}>
      <PanelHeader>
        <div>
          <PanelTitle>Activité récente</PanelTitle>
          <PanelDescription>
            Connexions, événements de service, erreurs et changements de
            configuration.
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody>{body}</PanelBody>
    </Panel>
  );
}
