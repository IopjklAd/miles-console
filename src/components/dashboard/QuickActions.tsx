/**
 * Shortcuts to the pages operators use most. Every action either navigates to
 * a real page or triggers a real refresh — nothing decorative.
 */

import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { useMiles, type ConnectionState } from "@/state/miles";
import {
  ArrowRight,
  Bot,
  Gauge,
  Plug,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";

interface ActionSpec {
  label: string;
  description: string;
  icon: LucideIcon;
  to?: string;
  refresh?: boolean;
}

const ACTIONS: ActionSpec[] = [
  {
    label: "Ouvrir une conversation",
    description: "Assistant IA",
    icon: Bot,
    to: "/dashboard/assistant",
  },
  {
    label: "Consulter les capteurs",
    description: "Valeurs, historique et seuils",
    icon: Gauge,
    to: "/dashboard/capteurs",
  },
  {
    label: "Vérifier les connexions",
    description: "Relancer l'état du backend et de l'ESP32-S3",
    icon: Plug,
    refresh: true,
  },
  {
    label: "Consulter les erreurs",
    description: "Journaux filtrés sur ERROR",
    icon: ScrollText,
    to: "/dashboard/journaux?level=ERROR",
  },
  {
    label: "Accéder aux paramètres",
    description: "Système, connexion et IA",
    icon: Settings,
    to: "/dashboard/parametres",
  },
];

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  demo: "mode démonstration",
  unconfigured: "backend non configuré",
  connecting: "connexion en cours",
  connected: "backend connecté",
  disconnected: "backend inaccessible",
};

export function QuickActions({ className }: { className?: string }) {
  const { refresh, refreshing, connection, lastUpdate } = useMiles();
  const format = useFormat();

  return (
    <Panel className={className}>
      <PanelHeader>
        <div>
          <PanelTitle>Actions rapides</PanelTitle>
          <PanelDescription>
            Dernière vérification{" "}
            {lastUpdate ? format.relative(lastUpdate) : "encore en attente"} ·{" "}
            {CONNECTION_LABELS[connection]}
          </PanelDescription>
        </div>
      </PanelHeader>
      <PanelBody className="flex flex-col gap-2 p-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </>
          );

          if (action.refresh) {
            return (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                className="h-auto w-full cursor-pointer justify-start gap-3 px-3 py-2 text-left hover:bg-accent/60"
                onClick={refresh}
                disabled={refreshing}
              >
                {content}
              </Button>
            );
          }

          return (
            <Link
              key={action.label}
              to={action.to ?? "/dashboard"}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent/60"
            >
              {content}
            </Link>
          );
        })}
      </PanelBody>
    </Panel>
  );
}
