/**
 * Host / backend indicators.
 *
 * A metric missing from the backend payload is rendered as "Indisponible" —
 * the panel never invents a value. In demo mode the whole panel is labelled
 * as simulated.
 */

import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import { SimulatedBadge } from "@/components/miles/StatusBadge";
import { UnavailableNotice } from "@/components/miles/Feedback";
import { MetricValue } from "@/components/dashboard/StatusCards";
import { formatDuration, formatLatency, formatPercent } from "@/lib/format";
import type { SystemStatus } from "@/miles/types";

export function MetricsPanel({ status }: { status: SystemStatus }) {
  const host = status.host;
  const simulated = status.origin === "demo";
  const hasAnyMetric =
    !!host &&
    (host.cpuPercent !== undefined ||
      host.memoryPercent !== undefined ||
      host.diskPercent !== undefined ||
      host.uptimeSeconds !== undefined ||
      host.activeServices !== undefined ||
      host.networkOnline !== undefined);

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Indicateurs techniques</PanelTitle>
          <PanelDescription>
            Mesures exposées par le backend — aucune valeur n'est extrapolée.
          </PanelDescription>
        </div>
        {simulated ? <SimulatedBadge /> : null}
      </PanelHeader>
      <PanelBody className="flex flex-col gap-3">
        {!hasAnyMetric ? (
          <UnavailableNotice
            title="Métriques hôte indisponibles"
            description={
              simulated
                ? "Le moteur de démonstration n'expose aucune métrique hôte."
                : "Le backend n'expose pas de métriques hôte (GET /api/status → champ « host » absent)."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricValue
              label="Processeur"
              value={formatPercent(host?.cpuPercent)}
              unavailable={host?.cpuPercent === undefined}
            />
            <MetricValue
              label="Mémoire vive"
              value={formatPercent(host?.memoryPercent)}
              unavailable={host?.memoryPercent === undefined}
            />
            <MetricValue
              label="Espace disque"
              value={formatPercent(host?.diskPercent)}
              unavailable={host?.diskPercent === undefined}
            />
            <MetricValue
              label="Temps de fonctionnement"
              value={
                host?.uptimeSeconds !== undefined
                  ? formatDuration(host.uptimeSeconds)
                  : "Indisponible"
              }
              unavailable={host?.uptimeSeconds === undefined}
            />
            <MetricValue
              label="Services actifs"
              value={
                host?.activeServices !== undefined
                  ? String(host.activeServices)
                  : "Indisponible"
              }
              unavailable={host?.activeServices === undefined}
            />
            <MetricValue
              label="Réponse backend"
              value={formatLatency(status.backend.latencyMs)}
              unavailable={status.backend.latencyMs === undefined}
            />
            <MetricValue
              label="Réseau"
              value={
                host?.networkOnline === undefined
                  ? "Indisponible"
                  : host.networkOnline
                    ? "En ligne"
                    : "Hors ligne"
              }
              unavailable={host?.networkOnline === undefined}
            />
            <MetricValue
              label="Erreurs récentes"
              value={String(status.recentErrorCount)}
            />
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
