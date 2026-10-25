/**
 * Paramètres — general, display, connection, AI and session.
 *
 * Values are persisted locally; saving also pushes them to
 * `PUT /api/settings` when a backend is configured, and the result states
 * exactly what happened (saved locally vs synchronised).
 */

import { useAiStatus } from "@/hooks/use-conversations";
import { InlineAlert } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import {
  DataPair,
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import { ConnectionBadge } from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MILES_API_BASE_URL,
  POLL_INTERVAL_OPTIONS,
} from "@/config/app";
import { useAuth } from "@/hooks/use-auth";
import { useFormat } from "@/hooks/use-format";
import { describeError } from "@/miles/api";
import { cn } from "@/lib/utils";
import { useMiles } from "@/state/miles";
import { useSettings } from "@/state/settings";
import { motion } from "framer-motion";
import {
  Bot,
  Loader2,
  LogOut,
  Plug,
  Save,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const BROWSER_TZ =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const TIME_ZONES = Array.from(
  new Set([
    BROWSER_TZ,
    "Europe/Paris",
    "Europe/Brussels",
    "Europe/London",
    "UTC",
    "America/Montreal",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Australia/Sydney",
  ]),
);

export default function Settings() {
  const { settings, update, save } = useSettings();
  const { mode, setMode, connection, backendConfigured, api, lastUpdate, refresh } =
    useMiles();
  const { status: aiStatus, probe, probing } = useAiStatus();
  const { user, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const format = useFormat();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await save({
        sync: mode === "live" && backendConfigured,
      });
      if (result.saved && result.synced) toast.success(result.message);
      else if (result.saved) toast.info(result.message);
      else toast.error(result.message);
    } finally {
      setSaving(false);
    }
  };

  const testBackend = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const started = Date.now();
      await api.getSettings();
      const message = `Connexion réussie en ${Date.now() - started} ms — GET /api/settings a répondu.`;
      setTestResult(message);
      toast.success(message);
      refresh();
    } catch (error) {
      const message = describeError(error);
      setTestResult(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        title="Paramètres"
        description={
          lastUpdate
            ? `Dernière synchronisation ${format.relative(lastUpdate)}`
            : "Les modifications sont enregistrées localement."
        }
        actions={
          <Button
            type="button"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Enregistrer
          </Button>
        }
      />

      {/* General */}
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Général</PanelTitle>
            <PanelDescription>
              Identité d'affichage et préférences de la console.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="system-name" className="text-sm">
              Nom du système
            </Label>
            <Input
              id="system-name"
              value={settings.systemName}
              onChange={(event) => update({ systemName: event.target.value })}
              maxLength={64}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone" className="text-sm">
              Fuseau horaire
            </Label>
            <Select
              value={settings.timeZone}
              onValueChange={(value) => update({ timeZone: value })}
            >
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Horodatages affichés dans ce fuseau.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="language" className="text-sm">
              Langue
            </Label>
            <Input id="language" value="Français" disabled />
            <p className="text-xs text-muted-foreground">
              Une traduction anglaise est prévue après la version 1.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Thème</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={resolvedTheme !== "light" ? "default" : "outline"}
                size="sm"
                className="flex-1 cursor-pointer"
                onClick={() => setTheme("dark")}
              >
                Sombre
              </Button>
              <Button
                type="button"
                variant={resolvedTheme === "light" ? "default" : "outline"}
                size="sm"
                className="flex-1 cursor-pointer"
                onClick={() => setTheme("light")}
              >
                Clair
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>

      {/* Data source */}
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Source de données</PanelTitle>
            <PanelDescription>
              Le mode démonstration génère des valeurs locales clairement
              étiquetées ; le mode réel interroge le backend MILES.
            </PanelDescription>
          </div>
          <ConnectionBadge connection={connection} />
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Mode</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "demo" ? "default" : "outline"}
                size="sm"
                className="flex-1 cursor-pointer"
                onClick={() => setMode("demo")}
              >
                Démonstration
              </Button>
              <Button
                type="button"
                variant={mode === "live" ? "default" : "outline"}
                size="sm"
                className="flex-1 cursor-pointer"
                onClick={() => setMode("live")}
              >
                Réel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mode actuel :{" "}
              {mode === "demo"
                ? "démonstration — aucune donnée matérielle réelle."
                : "réel — données du backend uniquement."}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poll-interval" className="text-sm">
              Intervalle d'interrogage
            </Label>
            <Select
              value={String(settings.pollIntervalMs)}
              onValueChange={(value) => update({ pollIntervalMs: Number(value) })}
            >
              <SelectTrigger id="poll-interval" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLL_INTERVAL_OPTIONS.map((interval) => (
                  <SelectItem key={interval} value={String(interval)}>
                    {interval / 1_000} s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Les données sont actualisées par interrogation périodique, pas en
              temps réel continu.
            </p>
          </div>
        </PanelBody>
      </Panel>

      {/* Network */}
      <Panel id="reseau">
        <PanelHeader>
          <div>
            <PanelTitle>Connexion réseau</PanelTitle>
            <PanelDescription>
              Adresse du backend et état de la communication.
            </PanelDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => void testBackend()}
            disabled={testing || mode !== "live"}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Plug className="size-4" aria-hidden />
            )}
            Tester la connexion
          </Button>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <DataPair label="Adresse du backend">
            <span className="mono-value break-all">
              {MILES_API_BASE_URL || "non configurée"}
            </span>
          </DataPair>
          <DataPair label="Variable d'environnement">
            <span className="mono-value">VITE_MILES_API_BASE_URL</span>
          </DataPair>
          <DataPair label="État de la connexion">
            <ConnectionBadge connection={connection} />
          </DataPair>
          <DataPair label="Dernière lecture">
            <span>{lastUpdate ? format.dateTime(lastUpdate) : "aucune"}</span>
          </DataPair>

          {mode !== "live" ? (
            <div className="sm:col-span-2">
              <InlineAlert tone="info" title="Test désactivé en mode démonstration">
                Passez en mode réel pour interroger le backend.
              </InlineAlert>
            </div>
          ) : null}

          {testResult ? (
            <div className="sm:col-span-2">
              <InlineAlert
                tone={testResult.startsWith("Connexion réussie") ? "success" : "danger"}
                title="Résultat du test"
              >
                {testResult}
              </InlineAlert>
            </div>
          ) : null}

          {!backendConfigured ? (
            <div className="sm:col-span-2">
              <InlineAlert
                tone="warning"
                title="Aucun backend configuré"
              >
                Renseignez VITE_MILES_API_BASE_URL puis redéployez l'interface
                pour superviser le matériel réel.
              </InlineAlert>
            </div>
          ) : null}
        </PanelBody>
      </Panel>

      {/* AI */}
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Assistant IA</PanelTitle>
            <PanelDescription>
              Le fournisseur est choisi côté serveur ; aucune clé n'est stockée
              dans le navigateur.
            </PanelDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => void probe()}
            disabled={probing}
          >
            {probing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Bot className="size-4" aria-hidden />
            )}
            Tester le fournisseur
          </Button>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <DataPair label="Fournisseur">
            <span>{aiStatus?.provider ?? "Consultation…"}</span>
          </DataPair>
          <DataPair label="État">
            <span
              className={cn(
                aiStatus?.configured ? "text-success" : "text-warning",
              )}
            >
              {aiStatus
                ? aiStatus.configured
                  ? "Configuré"
                  : "Non configuré"
                : "Inconnu"}
            </span>
          </DataPair>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model" className="text-sm">
              Modèle
            </Label>
            <Select
              value={settings.aiModel}
              onValueChange={(value) => update({ aiModel: value })}
            >
              <SelectTrigger id="ai-model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(aiStatus?.models ?? [settings.aiModel]).map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {aiStatus
                ? `Modèle par défaut du backend : ${aiStatus.defaultModel}`
                : "Liste des modèles : consultation du backend…"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">État de la génération</Label>
            <p className="text-xs text-muted-foreground">
              Les quotas et coûts ne sont pas exposés par le fournisseur : ils
              ne sont donc pas affichés.
            </p>
          </div>
        </PanelBody>
      </Panel>

      {/* Session */}
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Sécurité et session</PanelTitle>
            <PanelDescription>
              Session opérateur de la console.
            </PanelDescription>
          </div>
          <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <DataPair label="Utilisateur connecté">
            <span className="break-all">
              {user?.name || user?.email || "Session anonyme"}
            </span>
          </DataPair>
          <DataPair label="Rôle">
            <span className="mono-value">{user?.role ?? "—"}</span>
          </DataPair>
          <div className="sm:col-span-2">
            <InlineAlert tone="info" title="État de l'authentification backend">
              La console est protégée par l'authentification de la plateforme
              (e-mail + code). Le backend MILES, lui, n'expose pas encore de
              mécanisme d'authentification documenté : c'est une limite connue,
              pas une garantie de sécurité.
            </InlineAlert>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => void signOut().then(() => navigate("/"))}
            >
              <LogOut className="size-4" aria-hidden />
              Se déconnecter
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => navigate("/dashboard/capteurs")}
            >
              <Wifi className="size-4" aria-hidden />
              Configurer les seuils des capteurs
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </motion.div>
  );
}
