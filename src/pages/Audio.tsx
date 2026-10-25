/**
 * Audio — périphériques déclarés par le backend MILES (§10).
 *
 * Input/output state, input level and volume come from `GET /api/audio`;
 * the volume control appears only when the backend exposes one. Speech
 * recognition / synthesis are listed as unavailable until a backend actually
 * implements them, and no capture ever passes through this page.
 */

import { LoadingState, UnavailableNotice } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import { DataPair, Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/miles/Panel";
import { AvailabilityBadge, SimulatedBadge } from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useDomain } from "@/hooks/use-domain";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import type { AudioState } from "@/miles/types";
import { useMiles } from "@/state/miles";
import { motion } from "framer-motion";
import { Mic, MicOff, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

/** Map a dBFS level (-60..0) to a 0..100 bar width. */
function levelWidth(dbfs: number): number {
  const clamped = Math.min(0, Math.max(-60, dbfs));
  return Math.round(((clamped + 60) / 60) * 100);
}

export default function Audio() {
  const { api, pushNotification, mode } = useMiles();
  const format = useFormat();

  const audio = useDomain<AudioState>(() => api.getAudio(), { deps: [api] });

  // Draft only exists once the operator moves the slider: before that the
  // displayed value is simply the backend's, no effect needed.
  const [draftVolume, setDraftVolume] = useState<number | null>(null);
  const [savingVolume, setSavingVolume] = useState(false);
  const [volumeMessage, setVolumeMessage] = useState<string | null>(null);

  const volume = draftVolume ?? audio.data?.volume ?? null;

  const applyVolume = async (value: number) => {
    setSavingVolume(true);
    setVolumeMessage(null);
    try {
      await api.setVolume(value);
      // The draft stays authoritative for the slider: clearing it here would
      // snap back to the not-yet-refreshed backend value.
      audio.refresh();
      setVolumeMessage(
        mode === "demo"
          ? `Volume appliqué à ${value} % (démonstration, aucun périphérique touché).`
          : `Volume appliqué à ${value} %.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      setVolumeMessage(`Échec : ${message}`);
      pushNotification({
        title: "Échec du réglage du volume",
        message,
        severity: "error",
        dedupeKey: "audio:volume:failed",
        origin: mode === "demo" ? "demo" : "live",
      });
    } finally {
      setSavingVolume(false);
    }
  };

  let body: React.ReactNode;

  if (audio.loading) {
    body = <LoadingState label="Interrogation des périphériques audio…" />;
  } else if (audio.error && !audio.data) {
    body = (
      <UnavailableNotice
        title="Audio indisponible"
        description={`${audio.error} — l'API GET /api/audio n'est pas joignable. Sans elle, aucun état audio n'est affiché.`}
        action={
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={audio.refresh}>
            Réessayer
          </Button>
        }
      />
    );
  } else if (audio.data) {
    const data = audio.data;
    body = (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DataPair label="Entrée (capture)">
            <span className="flex items-center gap-2">
              {data.capturing ? (
                <Mic className="size-4 text-success" aria-hidden />
              ) : (
                <MicOff className="size-4 text-muted-foreground" aria-hidden />
              )}
              <AvailabilityBadge status={data.input.status} label={data.input.label} />
            </span>
          </DataPair>
          <DataPair label="Sortie (lecture)">
            <span className="flex items-center gap-2">
              {data.playing ? (
                <Volume2 className="size-4 text-success" aria-hidden />
              ) : (
                <VolumeX className="size-4 text-muted-foreground" aria-hidden />
              )}
              <AvailabilityBadge status={data.output.status} label={data.output.label} />
            </span>
          </DataPair>
          <DataPair label="État de la capture">
            <span>{data.capturing ? "Capture active" : "Capture inactive"}</span>
          </DataPair>
          <DataPair label="État de la lecture">
            <span>{data.playing ? "Lecture en cours" : "Aucune lecture"}</span>
          </DataPair>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Niveau d'entrée</p>
              <span className="mono-value text-xs text-muted-foreground">
                {data.levelDbfs != null ? `${data.levelDbfs} dBFS` : "Indisponible"}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  data.levelDbfs == null
                    ? "w-0"
                    : data.levelDbfs > -6
                      ? "bg-danger"
                      : data.levelDbfs > -18
                        ? "bg-warning"
                        : "bg-success",
                )}
                style={{ width: `${data.levelDbfs == null ? 0 : levelWidth(data.levelDbfs)}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.levelDbfs == null
                ? "Le backend ne mesure pas le niveau : la donnée reste vide plutôt que simulée."
                : "Mesure issue du backend ; en mode démonstration elle est simulée."}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Volume de sortie</p>
              <span className="mono-value text-xs text-muted-foreground">
                {volume != null ? `${volume} %` : "Indisponible"}
              </span>
            </div>
            {data.volumeControllable ? (
              <>
                <Slider
                  value={[volume ?? 0]}
                  min={0}
                  max={100}
                  step={5}
                  disabled={savingVolume}
                  onValueChange={(values) => setDraftVolume(values[0])}
                  onValueCommit={(values) => void applyVolume(values[0])}
                  className="mt-4"
                  aria-label="Volume de sortie"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {volumeMessage ?? "Le régler envoie POST /api/audio/volume au backend."}
                </p>
              </>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                {volumeMessage ??
                  "Ce backend n'expose aucun contrôle de volume : le réglage est désactivé plutôt que décoratif."}
              </p>
            )}
          </div>
        </div>

        {data.input.detail || data.output.detail || data.lastError ? (
          <UnavailableNotice
            title="Détail / dernière erreur"
            description={
              data.lastError ??
              [data.input.detail, data.output.detail].filter(Boolean).join(" ")
            }
          />
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
        title="Audio"
        description={
          <span>
            Périphériques déclarés par le backend MILES — aucune capture audio
            ne transite par le navigateur.
            {audio.updatedAt ? ` · mise à jour ${format.relative(audio.updatedAt)}` : ""}
          </span>
        }
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={audio.refresh}
            disabled={audio.refreshing}
          >
            <RefreshCw className={cn("size-4", audio.refreshing && "animate-spin")} aria-hidden />
            Actualiser
          </Button>
        }
      />

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Périphériques</PanelTitle>
            <PanelDescription>
              Entrées, sorties, niveau et volume — chaque champ absent affiche
              « Indisponible ».
            </PanelDescription>
          </div>
          {mode === "demo" ? <SimulatedBadge /> : null}
        </PanelHeader>
        <PanelBody>{body}</PanelBody>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <UnavailableNotice
          title="Reconnaissance vocale — indisponible"
          description="Aucune reconnaissance vocale n'est intégrée : elle apparaîtra uniquement si le backend la fournit réellement."
        />
        <UnavailableNotice
          title="Synthèse vocale — indisponible"
          description="Aucune synthèse vocale n'est intégrée : pas de bouton simulé, pas de sortie fictive."
        />
      </div>
    </motion.div>
  );
}
