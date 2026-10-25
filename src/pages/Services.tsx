/**
 * Supervision des services logiciels (§12).
 *
 * Every row comes from `GET /api/services` (or the demo engine, clearly
 * labelled). Start/stop/restart buttons appear ONLY when the backend declares
 * the service `controllable`; each action goes through the backend and the
 * result (sent / accepted / rejected / failed) is displayed separately from
 * the request — an "envoyée" command is never presented as a success.
 */

import { LoadingState, UnavailableNotice } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/miles/Panel";
import {
  AvailabilityBadge,
  CommandStatusBadge,
  SimulatedBadge,
} from "@/components/miles/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDomain } from "@/hooks/use-domain";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import type { CommandResult, ServiceAction, ServiceInfo } from "@/miles/types";
import { useMiles } from "@/state/miles";
import { motion } from "framer-motion";
import { Loader2, Play, RefreshCw, RotateCcw, Square } from "lucide-react";
import { useState } from "react";

const ACTION_LABEL: Record<ServiceAction, string> = {
  start: "Démarrer",
  stop: "Arrêter",
  restart: "Redémarrer",
};

export default function Services() {
  const { api, pushNotification, mode } = useMiles();
  const format = useFormat();

  const services = useDomain<ServiceInfo[]>(() => api.getServices(), {
    deps: [api],
  });

  const [pending, setPending] = useState<{
    service: ServiceInfo;
    action: ServiceAction;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, CommandResult>>({});

  const execute = async (service: ServiceInfo, action: ServiceAction) => {
    setBusyId(service.id);
    try {
      const result = await api.serviceCommand({
        serviceId: service.id,
        action,
        label: `${ACTION_LABEL[action]} ${service.name}`,
      });
      setResults((previous) => ({ ...previous, [service.id]: result }));
      if (result.status === "rejected" || result.status === "failed" || result.status === "timeout") {
        pushNotification({
          title: "Échec de la commande",
          message: `${ACTION_LABEL[action]} ${service.name} : ${result.error ?? result.status}`,
          severity: "error",
          dedupeKey: `service:${service.id}:${result.status}`,
          origin: mode === "demo" ? "demo" : "live",
        });
      }
      services.refresh();
    } catch (error) {
      pushNotification({
        title: "Commande impossible",
        message: error instanceof Error ? error.message : "Erreur inconnue.",
        severity: "error",
        dedupeKey: `service:${service.id}:exception`,
        origin: mode === "demo" ? "demo" : "live",
      });
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  let body: React.ReactNode;

  if (services.loading) {
    body = <LoadingState label="Lecture des services…" />;
  } else if (services.error && !services.data) {
    body = (
      <UnavailableNotice
        title="Services indisponibles"
        description={`${services.error} — l'API GET /api/services n'est pas joignable. Sans elle, aucun service n'est affiché (l'invention d'états est interdite).`}
        action={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={services.refresh}>
            Réessayer
          </Button>
        }
      />
    );
  } else if (services.data && services.data.length === 0) {
    body = (
      <UnavailableNotice
        title="Aucun service déclaré"
        description="Le backend répond mais n'expose aucun service : vérifiez sa configuration."
      />
    );
  } else if (services.data) {
    body = (
      <ul className="flex flex-col gap-3">
        {services.data.map((service) => {
          const result = results[service.id];
          const busy = busyId === service.id;
          return (
            <li
              key={service.id}
              className="rounded-lg border border-border/60 bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mono-value text-sm font-semibold">{service.name}</span>
                    <AvailabilityBadge status={service.status} label={service.statusLabel} />
                    {service.origin === "demo" ? <SimulatedBadge /> : null}
                  </div>
                  {service.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
                  ) : null}
                </div>

                {service.controllable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      disabled={busy || service.status === "operational"}
                      onClick={() => void execute(service, "start")}
                    >
                      <Play className="size-3.5" aria-hidden />
                      Démarrer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      disabled={busy || service.status === "down"}
                      onClick={() => setPending({ service, action: "stop" })}
                    >
                      <Square className="size-3.5" aria-hidden />
                      Arrêter
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer gap-1.5"
                      disabled={busy}
                      onClick={() => void execute(service, "restart")}
                    >
                      <RotateCcw className={cn("size-3.5", busy && "animate-spin")} aria-hidden />
                      Redémarrer
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Contrôle non pris en charge par le backend.
                  </p>
                )}
              </div>

              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Dernière activité</dt>
                  <dd>{service.lastActivityAt ? format.relative(service.lastActivityAt) : "Indisponible"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="mono-value">{service.version ?? "Indisponible"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dernière erreur</dt>
                  <dd className={cn(service.lastError ? "text-danger" : "text-muted-foreground")}>
                    {service.lastError ?? "aucune"}
                  </dd>
                </div>
              </dl>

              {busy ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Commande envoyée — en attente de l'accusé de réception…
                </p>
              ) : result ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <CommandStatusBadge status={result.status} />
                  <span className="mono-value text-muted-foreground">
                    {format.clock(result.sentAt)}
                  </span>
                  {result.message ? <span>{result.message}</span> : null}
                  {result.error ? <span className="text-danger">{result.error}</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <PageHeader
        title="Services logiciels"
        description={
          <span>
            État des processus de la pile MILES — les commandes ne sont
            proposées que si le backend les autorise.
            {services.updatedAt ? ` · mise à jour ${format.relative(services.updatedAt)}` : ""}
          </span>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={services.refresh}
            disabled={services.refreshing}
          >
            <RefreshCw className={cn("size-4", services.refreshing && "animate-spin")} aria-hidden />
            Actualiser
          </Button>
        }
      />

      {services.error && services.data ? (
        <UnavailableNotice
          title="Actualisation échouée"
          description={services.error}
          action={
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={services.refresh}>
              Réessayer
            </Button>
          }
        />
      ) : null}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Services déclarés</PanelTitle>
            <PanelDescription>
              Aucune commande système n'est exécutée depuis le navigateur :
              tout passe par le backend et son contrôle d'accès.
            </PanelDescription>
          </div>
          {mode === "demo" ? <SimulatedBadge /> : null}
        </PanelHeader>
        <PanelBody>{body}</PanelBody>
      </Panel>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arrêter ce service ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pending?.service.name} » sera arrêté par le backend. Les
              fonctions qu'il porte (flux, audio…) cesseront jusqu'au
              redémarrage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => {
                if (pending) void execute(pending.service, pending.action);
              }}
            >
              Confirmer l'arrêt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
