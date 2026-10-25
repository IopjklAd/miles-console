import { cn } from "@/lib/utils";
import type {
  Availability,
  CommandStatus,
  SensorLink,
  Severity,
  ValueState,
} from "@/miles/types";
import type { ConnectionState } from "@/state/miles";
import {
  CircleCheck,
  CircleCheckBig,
  CircleHelp,
  CircleOff,
  CircleX,
  FlaskConical,
  Loader2,
  TriangleAlert,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

interface Style {
  className: string;
  icon: LucideIcon;
  label: string;
}

const AVAILABILITY_STYLES: Record<Availability, Style> = {
  operational: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CircleCheck,
    label: "Opérationnel",
  },
  degraded: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: TriangleAlert,
    label: "Dégradé",
  },
  down: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "Arrêté",
  },
  unavailable: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleOff,
    label: "Indisponible",
  },
  unknown: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleHelp,
    label: "Inconnu",
  },
};

/** Status chip of a system component (never colour-only: icon + text). */
export function AvailabilityBadge({
  status,
  label,
  className,
}: {
  status: Availability;
  label?: string;
  className?: string;
}) {
  const style = AVAILABILITY_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label ?? style.label}
    </span>
  );
}

const CONNECTION_STYLES: Record<ConnectionState, Style> = {
  demo: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: FlaskConical,
    label: "Mode démonstration",
  },
  unconfigured: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: CircleOff,
    label: "Backend non configuré",
  },
  connecting: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: Loader2,
    label: "Connexion…",
  },
  connected: {
    className: "border-success/30 bg-success/10 text-success",
    icon: Wifi,
    label: "Backend connecté",
  },
  disconnected: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: WifiOff,
    label: "Backend inaccessible",
  },
};

export function ConnectionBadge({
  connection,
  className,
}: {
  connection: ConnectionState;
  className?: string;
}) {
  const style = CONNECTION_STYLES[connection];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", connection === "connecting" && "animate-spin")}
        aria-hidden
      />
      {style.label}
    </span>
  );
}

/** Badge labelling where a value comes from (real vs simulated). */
export function SimulatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      Simulé
    </span>
  );
}

const VALUE_STATE_STYLES: Record<ValueState, Style> = {
  valid: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CircleCheck,
    label: "Mesure réelle",
  },
  simulated: {
    className: "border-warning/40 bg-warning/10 text-warning",
    icon: FlaskConical,
    label: "Valeur simulée",
  },
  stale: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: TriangleAlert,
    label: "Donnée ancienne",
  },
  invalid: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "Valeur invalide",
  },
  unavailable: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleOff,
    label: "Donnée indisponible",
  },
};

export function ValueStateBadge({
  state,
  className,
}: {
  state: ValueState;
  className?: string;
}) {
  const style = VALUE_STATE_STYLES[state];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {style.label}
    </span>
  );
}

const LINK_STYLES: Record<SensorLink, Style> = {
  connected: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CircleCheck,
    label: "Connecté",
  },
  disconnected: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleOff,
    label: "Déconnecté",
  },
  error: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "En erreur",
  },
  unknown: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: CircleHelp,
    label: "État inconnu",
  },
};

export function SensorLinkBadge({
  link,
  className,
}: {
  link: SensorLink;
  className?: string;
}) {
  const style = LINK_STYLES[link];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {style.label}
    </span>
  );
}

const SEVERITY_STYLES: Record<Severity, Style> = {
  info: {
    className: "border-info/30 bg-info/10 text-info",
    icon: CircleHelp,
    label: "Information",
  },
  success: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CircleCheckBig,
    label: "Succès",
  },
  warning: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: TriangleAlert,
    label: "Avertissement",
  },
  error: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "Erreur",
  },
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  const style = SEVERITY_STYLES[severity];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {style.label}
    </span>
  );
}

const COMMAND_STATUS_STYLES: Record<CommandStatus, Style> = {
  sending: {
    className: "border-border bg-muted/60 text-muted-foreground",
    icon: Loader2,
    label: "Envoi en cours",
  },
  sent: {
    className: "border-info/30 bg-info/10 text-info",
    icon: CircleHelp,
    label: "Envoyée (accusé non reçu)",
  },
  accepted: {
    className: "border-success/30 bg-success/10 text-success",
    icon: CircleCheck,
    label: "Acceptée",
  },
  rejected: {
    className: "border-warning/35 bg-warning/10 text-warning",
    icon: TriangleAlert,
    label: "Refusée",
  },
  failed: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "Échec",
  },
  timeout: {
    className: "border-danger/35 bg-danger/10 text-danger",
    icon: CircleX,
    label: "Délai dépassé",
  },
};

export function CommandStatusBadge({
  status,
  className,
}: {
  status: CommandStatus;
  className?: string;
}) {
  const style = COMMAND_STATUS_STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.className,
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", status === "sending" && "animate-spin")}
        aria-hidden
      />
      {style.label}
    </span>
  );
}
