/**
 * Journaux — diagnostic console.
 *
 * Search, level/source/period filters, copy and export of the entries
 * currently loaded. No secret is ever rendered: messages come from the
 * backend contract, which is documented as secret-free.
 */

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
} from "@/components/miles/Panel";
import { SimulatedBadge } from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { LOG_LEVELS, type LogEntry, type LogLevel } from "@/miles/types";
import { useMiles } from "@/state/miles";
import { useSettings } from "@/state/settings";
import { motion } from "framer-motion";
import {
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

const LEVEL_STYLE: Record<LogLevel, string> = {
  DEBUG: "border-border bg-muted/60 text-muted-foreground",
  INFO: "border-info/30 bg-info/10 text-info",
  WARNING: "border-warning/35 bg-warning/10 text-warning",
  ERROR: "border-danger/35 bg-danger/10 text-danger",
  CRITICAL: "border-danger bg-danger/20 text-danger",
};

const LEVEL_TEXT: Record<LogLevel, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-info",
  WARNING: "text-warning",
  ERROR: "text-danger",
  CRITICAL: "text-danger font-semibold",
};

const PERIODS: { value: string; label: string; minutes: number | null }[] = [
  { value: "15", label: "15 minutes", minutes: 15 },
  { value: "60", label: "1 heure", minutes: 60 },
  { value: "360", label: "6 heures", minutes: 360 },
  { value: "1440", label: "24 heures", minutes: 1_440 },
  { value: "all", label: "Tout l'historique chargé", minutes: null },
];

function formatExport(entries: LogEntry[]): string {
  return entries
    .map(
      (entry) =>
        `${new Date(entry.at).toISOString()}\t${entry.level}\t${entry.source}\t${entry.message}`,
    )
    .join("\n");
}

export default function Logs() {
  const { logs, refresh, refreshing, mode, lastUpdate } = useMiles();
  const { settings } = useSettings();
  const format = useFormat();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(() => {
    const requested = searchParams.get("level");
    if (requested && LOG_LEVELS.includes(requested as LogLevel)) {
      return new Set<LogLevel>([requested as LogLevel]);
    }
    return new Set<LogLevel>(LOG_LEVELS);
  });
  const [source, setSource] = useState("all");
  const [period, setPeriod] = useState("60");

  const entries = logs.data ?? [];

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) set.add(entry.source);
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const periodConfig = PERIODS.find((item) => item.value === period);
    // "Now" is the last successful read (data-derived, keeps render pure).
    const reference = logs.updatedAt ?? 0;
    const cutoff =
      periodConfig?.minutes != null
        ? reference - periodConfig.minutes * 60_000
        : null;

    return entries.filter((entry) => {
      if (!activeLevels.has(entry.level)) return false;
      if (source !== "all" && entry.source !== source) return false;
      if (cutoff !== null && entry.at < cutoff) return false;
      if (
        query &&
        !entry.message.toLowerCase().includes(query) &&
        !entry.source.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [entries, activeLevels, source, period, search, logs.updatedAt]);

  const toggleLevel = (level: LogLevel) => {
    setActiveLevels((current) => {
      const next = new Set(current);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next.size === 0 ? new Set(LOG_LEVELS) : next;
    });
  };

  const payload = () => formatExport(filtered);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(payload());
      toast.success(`${filtered.length} entrée(s) copiée(s).`);
    } catch {
      toast.error("Copie impossible depuis ce navigateur.");
    }
  };

  const exportAll = () => {
    try {
      const blob = new Blob([payload()], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `miles-journaux-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${filtered.length} entrée(s) exportée(s).`);
    } catch {
      toast.error("Export impossible.");
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
        title="Journaux"
        description={
          lastUpdate
            ? `${entries.length} entrée(s) en mémoire · dernière lecture ${format.relative(lastUpdate)}`
            : "Console de diagnostic"
        }
        actions={
          <>
            {mode === "demo" ? <SimulatedBadge /> : null}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => void copyAll()}
              disabled={filtered.length === 0}
            >
              <Copy className="size-4" aria-hidden />
              Copier
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={exportAll}
              disabled={filtered.length === 0}
            >
              <Download className="size-4" aria-hidden />
              Exporter
            </Button>
          </>
        }
      />

      <Panel>
        <PanelHeader className="gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher dans les messages…"
              aria-label="Rechercher dans les journaux"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {LOG_LEVELS.map((level) => {
              const active = activeLevels.has(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  aria-pressed={active}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-opacity",
                    LEVEL_STYLE[level],
                    !active && "opacity-35",
                  )}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-40" aria-label="Filtrer par source">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les sources</SelectItem>
                {sources.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-44" aria-label="Filtrer par période">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PanelHeader>

        <PanelHeader className="border-t-0 py-2">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <PanelDescription>
              {filtered.length} entrée(s) affichée(s) sur {entries.length}
            </PanelDescription>
            <PanelDescription className="mono-value">
              heure · niveau · source · message
            </PanelDescription>
          </div>
        </PanelHeader>

        <PanelBody className="p-0">
          {logs.loading && entries.length === 0 ? (
            <LoadingState label="Chargement des journaux…" />
          ) : logs.error && entries.length === 0 ? (
            <ErrorState message={logs.error} onRetry={refresh} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Terminal}
              title="Aucune entrée pour ces filtres"
              description={
                entries.length === 0
                  ? "Le backend n'a encore renvoyé aucun événement."
                  : "Modifiez la recherche, le niveau ou la période."
              }
            />
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                  <tr className="border-b border-border/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Heure</th>
                    <th className="px-2 py-2 font-medium">Niveau</th>
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border/40 last:border-0 hover:bg-accent/40"
                    >
                      <td className="mono-value whitespace-nowrap px-4 py-1.5 text-xs text-muted-foreground">
                        {format.clock(entry.at)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={cn(
                            "mono-value rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                            LEVEL_STYLE[entry.level],
                          )}
                        >
                          {entry.level}
                        </span>
                      </td>
                      <td className="mono-value px-2 py-1.5 text-xs text-muted-foreground">
                        {entry.source}
                        {entry.origin === "demo" ? " ·sim" : ""}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1.5 font-mono text-xs",
                          LEVEL_TEXT[entry.level],
                        )}
                      >
                        {entry.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5" aria-hidden />
        Actualisation automatique toutes les {settings.pollIntervalMs / 1_000} s
        (intervalle configurable dans les paramètres) ; l'export couvre les
        entrées actuellement chargées ({entries.length} max par lecture).
      </p>
    </motion.div>
  );
}
