/**
 * Status cards of the overview: one card per subsystem plus activity and
 * recent-error counters. Each card shows the state reported by the backend
 * (or the demo engine) and keeps the origin label visible.
 */

import { Panel } from "@/components/miles/Panel";
import {
  AvailabilityBadge,
  SimulatedBadge,
} from "@/components/miles/StatusBadge";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/miles/api/schema";
import type {
  Availability,
  SystemStatus,
} from "@/miles/types";
import {
  Activity,
  Bot,
  Camera,
  Gauge,
  Plug,
  ScrollText,
  Server,
  TriangleAlert,
  Volume2,
  Wifi,
  type LucideIcon,
} from "lucide-react";

interface CardSpec {
  key: string;
  label: string;
  icon: LucideIcon;
  status: Availability;
  detail?: string;
  accent?: boolean;
}

function StatusCard({
  spec,
  simulated,
}: {
  spec: CardSpec;
  simulated: boolean;
}) {
  const Icon = spec.icon;
  return (
    <Panel
      className={cn(
        "flex flex-col gap-3 p-4",
        spec.accent && "border-primary/25 bg-primary/[0.04]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        {simulated ? <SimulatedBadge /> : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {spec.label}
        </p>
        <AvailabilityBadge status={spec.status} label={statusLabel(spec.status)} />
        {spec.detail ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {spec.detail}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function CounterCard({
  label,
  icon: Icon,
  value,
  hint,
  status,
  simulated,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  hint?: string;
  status: Availability;
  simulated: boolean;
}) {
  return (
    <Panel className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        {simulated ? <SimulatedBadge /> : null}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mono-value text-lg font-semibold">{value}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
        <AvailabilityBadge status={status} />
      </div>
    </Panel>
  );
}

export function StatusCards({ status }: { status: SystemStatus }) {
  const format = useFormat();
  const simulated = status.origin === "demo";

  const specs: CardSpec[] = [
    {
      key: "overall",
      label: "État général",
      icon: Activity,
      status: status.overall,
      detail: status.backend.label,
      accent: true,
    },
    {
      key: "backend",
      label: "Backend",
      icon: Plug,
      status: status.backend.status,
      detail: status.backend.detail ?? status.backend.label,
    },
    {
      key: "esp32",
      label: "ESP32-S3",
      icon: Wifi,
      status: status.esp32.status,
      detail: status.esp32.detail ?? status.esp32.label,
    },
    {
      key: "sensors",
      label: "Capteurs",
      icon: Gauge,
      status: status.sensors.status,
      detail: status.sensors.detail ?? status.sensors.label,
    },
    {
      key: "vision",
      label: "Webcam",
      icon: Camera,
      status: status.vision.status,
      detail: status.vision.detail ?? status.vision.label,
    },
    {
      key: "audio",
      label: "Audio",
      icon: Volume2,
      status: status.audio.status,
      detail: status.audio.detail ?? status.audio.label,
    },
    {
      key: "services",
      label: "Services",
      icon: Server,
      status: status.services.status,
      detail: status.services.detail ?? status.services.label,
    },
    {
      key: "ai",
      label: "IA",
      icon: Bot,
      status: status.ai.status,
      detail: status.ai.detail ?? status.ai.label,
    },
  ];

  const errorStatus: Availability =
    status.recentErrorCount === 0
      ? "operational"
      : status.recentErrorCount < 5
        ? "degraded"
        : "down";

  const activityStatus: Availability =
    status.lastActivityAt &&
    status.lastActivityAt >= status.fetchedAt - 120_000
      ? "operational"
      : "unknown";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {specs.map((spec) => (
          <StatusCard key={spec.key} spec={spec} simulated={simulated} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CounterCard
          label="Dernière activité"
          icon={ScrollText}
          value={
            status.lastActivityAt
              ? format.relative(status.lastActivityAt)
              : "Aucune activité"
          }
          hint={
            status.lastActivityAt
              ? format.dateTime(status.lastActivityAt)
              : "Le backend n'a signalé aucun événement."
          }
          status={activityStatus}
          simulated={simulated}
        />
        <CounterCard
          label="Erreurs récentes (15 min)"
          icon={TriangleAlert}
          value={String(status.recentErrorCount)}
          hint={
            status.recentErrorCount === 0
              ? "Aucune erreur signalée sur la période."
              : "Voir la page Journaux pour le détail."
          }
          status={errorStatus}
          simulated={simulated}
        />
      </div>
    </div>
  );
}

/** Compact metric cell reused by the indicators panel. */
export function MetricValue({
  label,
  value,
  unavailable,
}: {
  label: string;
  value: string;
  unavailable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "mono-value text-sm font-semibold",
          unavailable && "font-normal text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
