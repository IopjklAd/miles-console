/**
 * Vision — webcam fournie par le backend MILES (§9).
 *
 * The browser never touches the USB camera itself: it renders whatever
 * `GET /api/vision` declares (stream state, resolution, last frame). No image
 * is ever fabricated — without a backend snapshot the page says so. The AI
 * detection feature is displayed as unavailable until it actually exists.
 */

import { LoadingState, UnavailableNotice } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import { DataPair, Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/miles/Panel";
import { AvailabilityBadge, CommandStatusBadge, SimulatedBadge } from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import { useDomain } from "@/hooks/use-domain";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import type { CommandResult, StreamState, VisionState } from "@/miles/types";
import { useMiles } from "@/state/miles";
import { motion } from "framer-motion";
import { Camera, ImageOff, Loader2, RefreshCw, Square, Video } from "lucide-react";
import { useState } from "react";

const STREAM_LABEL: Record<StreamState, string> = {
  idle: "Flux arrêté",
  starting: "Démarrage…",
  live: "En direct",
  error: "Flux en erreur",
};

const STREAM_TONE: Record<StreamState, string> = {
  idle: "border-border bg-muted/60 text-muted-foreground",
  starting: "border-info/30 bg-info/10 text-info",
  live: "border-success/30 bg-success/10 text-success",
  error: "border-danger/35 bg-danger/10 text-danger",
};

export default function Vision() {
  const { api, pushNotification, mode } = useMiles();
  const format = useFormat();

  const vision = useDomain<VisionState>(() => api.getVision(), { deps: [api] });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);

  const send = async (action: "start" | "stop") => {
    setSending(true);
    try {
      const command = await api.visionCommand(action);
      setResult(command);
      if (command.status === "rejected" || command.status === "failed" || command.status === "timeout") {
        pushNotification({
          title: "Commande de flux refusée",
          message: command.error ?? "Le backend a refusé la commande.",
          severity: "error",
          dedupeKey: `vision:${action}:${command.status}`,
          origin: mode === "demo" ? "demo" : "live",
        });
      }
      vision.refresh();
    } catch (error) {
      pushNotification({
        title: "Commande de flux impossible",
        message: error instanceof Error ? error.message : "Erreur inconnue.",
        severity: "error",
        dedupeKey: "vision:exception",
        origin: mode === "demo" ? "demo" : "live",
      });
    } finally {
      setSending(false);
    }
  };

  let body: React.ReactNode;

  if (vision.loading) {
    body = <LoadingState label="Interrogation du flux vidéo…" />;
  } else if (vision.error && !vision.data) {
    body = (
      <UnavailableNotice
        title="Vision indisponible"
        description={`${vision.error} — l'API GET /api/vision n'est pas joignable. Sans elle, aucun état de webcam n'est affiché.`}
        action={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={vision.refresh}>
            Réessayer
          </Button>
        }
      />
    );
  } else if (vision.data) {
    const data = vision.data;
    const live = data.stream === "live";
    body = (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataPair label="Webcam">
            <AvailabilityBadge
              status={data.webcam.status}
              label={data.webcam.label}
            />
          </DataPair>
          <DataPair label="Flux">
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                STREAM_TONE[data.stream],
              )}
            >
              <Video className="size-3.5" aria-hidden />
              {STREAM_LABEL[data.stream]}
            </span>
          </DataPair>
          <DataPair label="Résolution">
            <span className="mono-value">
              {data.width && data.height ? `${data.width}×${data.height}` : "Indisponible"}
            </span>
          </DataPair>
          <DataPair label="Images par seconde">
            <span className="mono-value">{data.fps ? `${data.fps} fps` : "Indisponible"}</span>
          </DataPair>
          <DataPair label="Dernière image reçue">
            <span>{data.lastFrameAt ? format.relative(data.lastFrameAt) : "Indisponible"}</span>
          </DataPair>
          <DataPair label="Dernier relevé">
            <span>{format.dateTime(data.fetchedAt)}</span>
          </DataPair>
          <DataPair label="Origine des données">
            <span>{data.origin === "demo" ? "Simulation locale" : "Backend MILES"}</span>
          </DataPair>
          <DataPair label="Dernière erreur">
            <span className={cn(data.lastError ? "text-danger" : "text-muted-foreground")}>
              {data.lastError ?? "aucune"}
            </span>
          </DataPair>
        </div>

        {/* Frame area — never a fabricated image. */}
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30">
          {data.snapshotUrl && live ? (
            <img
              src={data.snapshotUrl}
              alt="Dernière image reçue du backend"
              className="max-h-full rounded-md object-contain"
            />
          ) : (
            <>
              <ImageOff className="size-6 text-muted-foreground" aria-hidden />
              <p className="max-w-md text-center text-sm text-muted-foreground">
                {live
                  ? "Flux actif côté backend mais aucune image n'est encore publiée vers le navigateur (GET /api/vision → snapshotUrl)."
                  : data.origin === "demo"
                    ? "Le mode démonstration ne fabrique aucune image : seule la capture réelle du backend s'affichera ici."
                    : "Aucune image : le flux n'est pas démarré ou le backend ne publie pas de vignette."}
              </p>
            </>
          )}
        </div>

        {result ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <CommandStatusBadge status={result.status} />
            <span className="text-muted-foreground">{result.label}</span>
            <span className="mono-value text-muted-foreground">{format.clock(result.sentAt)}</span>
            {result.message ? <span>{result.message}</span> : null}
            {result.error ? <span className="text-danger">{result.error}</span> : null}
          </div>
        ) : null}
      </div>
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
        title="Vision"
        description={
          <span>
            Webcam supervisée par le backend MILES — le navigateur n'accède
            jamais directement au périphérique USB.
            {vision.updatedAt ? ` · mise à jour ${format.relative(vision.updatedAt)}` : ""}
          </span>
        }
        actions={
          <>
            {vision.data?.controllable ? (
              vision.data.stream === "live" || vision.data.stream === "starting" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-2"
                  disabled={sending}
                  onClick={() => void send("stop")}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Square className="size-4" aria-hidden />}
                  {sending ? "Envoi…" : "Arrêter le flux"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer gap-2"
                  disabled={sending}
                  onClick={() => void send("start")}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
                  {sending ? "Envoi…" : "Démarrer le flux"}
                </Button>
              )
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={vision.refresh}
              disabled={vision.refreshing}
            >
              <RefreshCw className={cn("size-4", vision.refreshing && "animate-spin")} aria-hidden />
              Actualiser
            </Button>
          </>
        }
      />

      {vision.data?.controllable === false ? (
        <UnavailableNotice
          title="Contrôle du flux non pris en charge"
          description="Ce backend n'expose pas POST /api/vision/command : la lecture de l'état reste possible, le démarrage/arrêt l'est côté serveur uniquement."
        />
      ) : null}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Flux vidéo</PanelTitle>
            <PanelDescription>
              Résolution, cadence et dernière image reçues du backend.
            </PanelDescription>
          </div>
          {mode === "demo" ? <SimulatedBadge /> : null}
        </PanelHeader>
        <PanelBody>{body}</PanelBody>
      </Panel>

      <UnavailableNotice
        title="Détection par IA — indisponible"
        description="La détection d'objets/visages n'est pas implémentée : elle apparaîtra uniquement lorsque le backend l'exposera réellement. Aucun résultat fictif n'est affiché."
      />
    </motion.div>
  );
}
