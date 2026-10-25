/**
 * Contrôle du robot.
 *
 * Commands are driven by the backend capability manifest: with no manifest
 * reachable, no button is enabled. Every command shows its full lifecycle —
 * sent ≠ accepted — and commands with a physical effect require confirmation.
 */

import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnavailableNotice,
} from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import {
  DataPair,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import {
  CommandStatusBadge,
  SimulatedBadge,
  AvailabilityBadge,
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
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import type {
  CommandResult,
  RobotCapability,
} from "@/miles/types";
import { useMiles } from "@/state/miles";
import { motion } from "framer-motion";
import {
  CircleHelp,
  Gamepad2,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const KIND_LABEL: Record<RobotCapability["kind"], string> = {
  query: "Requête d'état",
  mode: "Changement de mode",
  service: "Service",
  action: "Action matérielle",
};

export default function Control() {
  const {
    robotState,
    capabilities,
    refresh,
    refreshing,
    mode,
    pushNotification,
    api,
  } = useMiles();
  const format = useFormat();

  const [pendingCapability, setPendingCapability] =
    useState<RobotCapability | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  // Wall clock maintained by an effect: render stays pure while commands still
  // get an accurate timestamp (resolution: 1 s).
  const clockRef = useRef(0);
  useEffect(() => {
    clockRef.current = Date.now();
    const id = window.setInterval(() => {
      clockRef.current = Date.now();
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  const execute = async (capability: RobotCapability) => {
    setSendingId(capability.id);
    setLastResult({
      commandId: "—",
      capabilityId: capability.id,
      label: capability.label,
      status: "sending",
      sentAt: clockRef.current,
      origin: mode === "demo" ? "demo" : "live",
    });

    try {
      const result = await api.sendCommand({
        id: capability.id,
        label: capability.label,
      });
      setLastResult(result);
      if (result.status === "accepted") {
        pushNotification({
          title: "Commande acceptée",
          message: `${capability.label} — ${result.message ?? "acquis de réception reçu"}`,
          severity: "success",
          dedupeKey: `command:${capability.id}:ok`,
          origin: result.origin,
        });
      } else if (result.status === "rejected" || result.status === "failed") {
        pushNotification({
          title: "Commande non exécutée",
          message: `${capability.label} — ${result.error ?? result.message ?? "raison non précisée"}`,
          severity: "error",
          dedupeKey: `command:${capability.id}:ko`,
          origin: result.origin,
        });
      }
    } catch (error) {
      const failed: CommandResult = {
        commandId: "—",
        capabilityId: capability.id,
        label: capability.label,
        status: "failed",
        sentAt: clockRef.current,
        error: error instanceof Error ? error.message : "Erreur inconnue",
        origin: mode === "demo" ? "demo" : "live",
      };
      setLastResult(failed);
      pushNotification({
        title: "Échec d'envoi de commande",
        message: `${capability.label} — ${failed.error}`,
        severity: "error",
        dedupeKey: `command:${capability.id}:send`,
        origin: failed.origin,
      });
    } finally {
      setSendingId(null);
      setPendingCapability(null);
    }
  };

  const state = robotState.data;
  const caps = capabilities.data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        title="Contrôle du robot"
        description="Les commandes proviennent du manifeste exposé par le backend ; aucune commande n'est inventée par l'interface."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
              aria-hidden
            />
            Actualiser
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>État du robot</PanelTitle>
              <PanelDescription>
                Relevé du backend — l'envoi d'une commande ne garantit jamais
                son exécution.
              </PanelDescription>
            </div>
            {mode === "demo" ? <SimulatedBadge /> : null}
          </PanelHeader>
          <PanelBody>
            {robotState.loading && !state ? (
              <LoadingState label="Lecture de l'état du robot…" />
            ) : robotState.error && !state ? (
              <ErrorState message={robotState.error} onRetry={refresh} />
            ) : state ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DataPair label="Connexion ESP32-S3">
                  <AvailabilityBadge
                    status={
                      state.connection === "connected"
                        ? "operational"
                        : state.connection === "disconnected"
                          ? "down"
                          : "unknown"
                    }
                    label={
                      state.connection === "connected"
                        ? "Connecté"
                        : state.connection === "disconnected"
                          ? "Déconnecté"
                          : "Inconnu"
                    }
                  />
                </DataPair>
                <DataPair label="Mode de fonctionnement">
                  <span className="mono-value">{state.mode}</span>
                </DataPair>
                <DataPair label="Dernier relevé">
                  <span>{format.dateTime(state.checkedAt)}</span>
                </DataPair>
                <DataPair label="Origine des données">
                  <span>{state.origin === "demo" ? "Simulation locale" : "Backend MILES"}</span>
                </DataPair>
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Dernière commande</PanelTitle>
              <PanelDescription>
                Envoi, accusé de réception et résultat distincts.
              </PanelDescription>
            </div>
          </PanelHeader>
          <PanelBody>
            {lastResult ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {lastResult.label}
                  </span>
                  <CommandStatusBadge status={lastResult.status} />
                </div>
                <dl className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Envoyée à</dt>
                    <dd className="mono-value">
                      {format.clock(lastResult.sentAt)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Accusé de réception</dt>
                    <dd className="mono-value">
                      {lastResult.acknowledgedAt
                        ? format.clock(lastResult.acknowledgedAt)
                        : "non reçu"}
                    </dd>
                  </div>
                  {lastResult.message ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Message</dt>
                      <dd className="text-right">{lastResult.message}</dd>
                    </div>
                  ) : null}
                  {lastResult.error ? (
                    <div className="flex justify-between gap-3 text-danger">
                      <dt>Erreur</dt>
                      <dd className="text-right">{lastResult.error}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune commande envoyée pour l'instant.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Commandes disponibles</PanelTitle>
            <PanelDescription>
              Manifeste de capacités ({caps?.length ?? 0} commande
              {(caps?.length ?? 0) > 1 ? "s" : ""} exposée
              {(caps?.length ?? 0) > 1 ? "s" : ""}).
            </PanelDescription>
          </div>
          {mode === "demo" ? <SimulatedBadge /> : null}
        </PanelHeader>
        <PanelBody>
          {capabilities.loading && !caps ? (
            <LoadingState label="Lecture du manifeste de capacités…" />
          ) : capabilities.error && !caps ? (
            <UnavailableNotice
              title="Aucune commande disponible"
              description={`${capabilities.error} L'interface n'affiche aucun bouton tant que le backend n'expose pas son manifeste (GET /api/robot/capabilities).`}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-2"
                  onClick={refresh}
                >
                  <RefreshCw className="size-4" aria-hidden />
                  Réessayer
                </Button>
              }
            />
          ) : !caps || caps.length === 0 ? (
            <EmptyState
              icon={CircleHelp}
              title="Le backend n'expose aucune commande"
              description="Aucun bouton n'est proposé : la capacité matérielle réelle n'est pas connue."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {caps.map((capability) => {
                const busy = sendingId === capability.id;
                return (
                  <li
                    key={capability.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {capability.label}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {KIND_LABEL[capability.kind]}
                        </span>
                        {capability.requiresConfirmation ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/35 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                            <ShieldCheck className="size-3" aria-hidden />
                            Confirmation requise
                          </span>
                        ) : null}
                      </div>
                      {capability.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {capability.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {capability.kind === "query" ? (
                        <Radio className="size-4 text-muted-foreground" aria-hidden />
                      ) : capability.kind === "mode" ? (
                        <SlidersHorizontal
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
                      ) : (
                        <Gamepad2 className="size-4 text-muted-foreground" aria-hidden />
                      )}
                      <Button
                        type="button"
                        variant={capability.requiresConfirmation ? "outline" : "default"}
                        size="sm"
                        className="cursor-pointer gap-1.5"
                        disabled={!capability.enabled || sendingId !== null}
                        onClick={() => {
                          if (capability.requiresConfirmation) {
                            setPendingCapability(capability);
                          } else {
                            void execute(capability);
                          }
                        }}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : null}
                        {busy ? "Envoi…" : "Exécuter"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <AlertDialog
        open={pendingCapability !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCapability(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingCapability?.label} » a un effet physique potentiel. Le
              résultat ne sera connu qu'après accusé de réception du backend.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              onClick={() => {
                if (pendingCapability) void execute(pendingCapability);
              }}
            >
              Confirmer l'envoi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mode === "live" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="size-3.5" aria-hidden />
          Les commandes sont envoyées au backend, qui valide les autorisations ;
          le navigateur ne contacte jamais le matériel directement.
        </p>
      ) : null}
    </motion.div>
  );
}
