/**
 * Capteurs — live values, validity, history and configurable thresholds.
 *
 * The page distinguishes real, stale, invalid, unavailable and simulated
 * readings: a demo value is never rendered as a measurement.
 */

import {
  EmptyState,
  ErrorState,
  InlineAlert,
  LoadingState,
} from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import {
  SensorLinkBadge,
  SimulatedBadge,
  ValueStateBadge,
} from "@/components/miles/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  HISTORY_RANGES,
  HISTORY_RANGE_LABELS,
  type HistoryRange,
} from "@/config/app";
import { useFormat } from "@/hooks/use-format";
import { describeError } from "@/miles/api";
import type { Sensor, SensorHistory } from "@/miles/types";
import { useMiles } from "@/state/miles";
import { useSettings } from "@/state/settings";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  Gauge,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

function formatValue(sensor: Sensor): string {
  const reading = sensor.reading;
  if (!reading || reading.value === null) return "—";
  if (sensor.kind === "pir") {
    return reading.value === 1 ? "Mouvement" : "Inactif";
  }
  return `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`;
}

function ThresholdDialog({
  sensor,
  open,
  onOpenChange,
}: {
  sensor: Sensor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { settings, setThreshold } = useSettings();
  const configured = sensor
    ? (settings.thresholds[sensor.id] ?? sensor.threshold ?? {
        enabled: false,
        min: null,
        max: null,
      })
    : { enabled: false, min: null, max: null };

  const [enabled, setEnabled] = useState(configured.enabled);
  const [min, setMin] = useState(configured.min?.toString() ?? "");
  const [max, setMax] = useState(configured.max?.toString() ?? "");

  const submit = () => {
    if (!sensor) return;
    const parsedMin = min.trim() === "" ? null : Number(min);
    const parsedMax = max.trim() === "" ? null : Number(max);
    if (
      (parsedMin !== null && !Number.isFinite(parsedMin)) ||
      (parsedMax !== null && !Number.isFinite(parsedMax))
    ) {
      toast.error("Les seuils doivent être numériques.");
      return;
    }
    if (
      parsedMin !== null &&
      parsedMax !== null &&
      parsedMin >= parsedMax
    ) {
      toast.error("Le seuil minimum doit être inférieur au maximum.");
      return;
    }
    setThreshold(sensor.id, { enabled, min: parsedMin, max: parsedMax });
    toast.success(`Seuils enregistrés pour « ${sensor.name} ».`);
    onOpenChange(false);
  };

  if (!sensor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seuils — {sensor.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="threshold-enabled" className="text-sm">
              Activer l'alerte
            </Label>
            <Switch
              id="threshold-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="threshold-min" className="text-xs">
                Minimum {sensor.reading?.unit ? `(${sensor.reading.unit})` : ""}
              </Label>
              <Input
                id="threshold-min"
                inputMode="decimal"
                value={min}
                onChange={(event) => setMin(event.target.value)}
                placeholder="aucun"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="threshold-max" className="text-xs">
                Maximum {sensor.reading?.unit ? `(${sensor.reading.unit})` : ""}
              </Label>
              <Input
                id="threshold-max"
                inputMode="decimal"
                value={max}
                onChange={(event) => setMax(event.target.value)}
                placeholder="aucun"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Les seuils sont évalués dans l'interface et déclenchent une
            notification ; ils ne sont pas appliqués au matériel.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button type="button" className="cursor-pointer" onClick={submit}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Sensors() {
  const { sensors, alerts, api, refresh, refreshing, mode } = useMiles();
  const { settings } = useSettings();
  const format = useFormat();

  const list = sensors.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>("30m");
  const [historyTick, setHistoryTick] = useState(0);
  const [thresholdSensorId, setThresholdSensorId] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<{
    key: string;
    history: SensorHistory | null;
    error: string | null;
  } | null>(null);

  const selected = useMemo(
    () => list.find((sensor) => sensor.id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );

  const sensorId = selected?.id ?? null;
  const historyKey = sensorId ? `${sensorId}:${range}` : null;

  useEffect(() => {
    if (!sensorId) return;
    const key = `${sensorId}:${range}`;
    let cancelled = false;
    api
      .getSensorHistory(sensorId, range)
      .then((result) => {
        if (!cancelled) setHistoryState({ key, history: result, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setHistoryState({ key, history: null, error: describeError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api, sensorId, range, historyTick]);

  // Derived: the loading state is implied by a key that has not resolved yet,
  // so the effect never sets state synchronously.
  const historyResolved = historyState?.key === historyKey;
  const history = historyResolved ? historyState?.history ?? null : null;
  const historyError = historyResolved ? historyState?.error ?? null : null;
  const historyLoading = historyKey !== null && !historyResolved;

  const chartData = useMemo(
    () =>
      (history?.points ?? []).map((point) => ({
        t: point.t,
        v: point.v,
      })),
    [history],
  );

  const thresholdSensor = list.find(
    (sensor) => sensor.id === thresholdSensorId,
  ) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        title="Capteurs"
        description="Valeurs, validité, historique et seuils. Chaque mesure porte son origine."
        actions={
          <>
            {mode === "demo" ? <SimulatedBadge /> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={() => {
                refresh();
                setHistoryTick((tick) => tick + 1);
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              Actualiser
            </Button>
          </>
        }
      />

      {alerts.length > 0 ? (
        <InlineAlert tone="warning" title="Seuils dépassés">
          <ul className="mt-1 flex flex-col gap-0.5">
            {alerts.map((alert) => (
              <li key={`${alert.sensorId}-${alert.message}`}>
                {alert.sensorName} — {alert.message}
              </li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}

      {sensors.loading && !list.length ? (
        <LoadingState label="Lecture des capteurs…" />
      ) : sensors.error && !list.length ? (
        <ErrorState message={sensors.error} onRetry={refresh} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Aucun capteur déclaré"
          description="Le backend ne renvoie aucun capteur (GET /api/sensors). La liste des capteurs reste configurable côté backend."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((sensor) => {
            const active = selected?.id === sensor.id;
            const stale = sensor.reading?.state === "stale";
            const unreadable = !sensor.reading || sensor.reading.value === null;
            return (
              <button
                key={sensor.id}
                type="button"
                onClick={() => setSelectedId(sensor.id)}
                className={`flex cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/[0.05]"
                    : "border-border/70 bg-card hover:bg-accent/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {sensor.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sensor.typeLabel}
                    </p>
                  </div>
                  {sensor.origin === "demo" ? <SimulatedBadge /> : null}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <span
                    className={`mono-value text-2xl font-semibold ${
                      unreadable || stale ? "text-muted-foreground" : ""
                    }`}
                  >
                    {formatValue(sensor)}
                  </span>
                  <SensorLinkBadge link={sensor.link} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {sensor.reading ? (
                    <ValueStateBadge state={sensor.reading.state} />
                  ) : (
                    <ValueStateBadge state="unavailable" />
                  )}
                  {sensor.reading ? (
                    <span className="text-[11px] text-muted-foreground">
                      {format.relative(sensor.reading.at)}
                    </span>
                  ) : null}
                </div>

                {sensor.lastError ? (
                  <p className="text-xs text-danger">{sensor.lastError}</p>
                ) : null}

                {sensor.threshold ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <SlidersHorizontal className="size-3" aria-hidden />
                    {settings.thresholds[sensor.id]?.enabled
                      ? `Seuils actifs (${settings.thresholds[sensor.id].min ?? "—"} → ${settings.thresholds[sensor.id].max ?? "—"})`
                      : "Seuils configurables"}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Seuils non applicables
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>
                Historique — {selected.name}
              </PanelTitle>
              <PanelDescription>
                {history
                  ? `${history.points.length} point${history.points.length > 1 ? "s" : ""} sur ${HISTORY_RANGE_LABELS[range]}`
                  : "Sélectionnez une période"}
                {history?.origin === "demo"
                  ? " · série simulée"
                  : history?.origin === "live"
                    ? " · série réelle"
                    : ""}
              </PanelDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected.threshold ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer gap-1.5 text-xs"
                  onClick={() => setThresholdSensorId(selected.id)}
                >
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Seuils
                </Button>
              ) : null}
              <div className="flex flex-wrap items-center gap-1">
                {HISTORY_RANGES.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={option === range ? "default" : "ghost"}
                    size="sm"
                    className={`h-7 cursor-pointer px-2.5 text-xs ${
                      option === range ? "" : "text-muted-foreground"
                    }`}
                    onClick={() => setRange(option)}
                  >
                    {HISTORY_RANGE_LABELS[option]}
                  </Button>
                ))}
              </div>
            </div>
          </PanelHeader>
          <PanelBody>
            {historyLoading && !history ? (
              <LoadingState label="Chargement de l'historique…" />
            ) : historyError ? (
              <ErrorState
                message={historyError}
                onRetry={() => setHistoryTick((tick) => tick + 1)}
              />
            ) : !history || history.points.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Aucune donnée historique"
                description="Le backend n'a renvoyé aucune mesure pour cette période."
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="milesSensorFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="var(--color-chart-1)"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="var(--color-chart-1)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(value: number) => format.clock(value)}
                        tickLine={false}
                        axisLine={{ stroke: "var(--color-border)" }}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        minTickGap={48}
                      />
                      <YAxis
                        width={52}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                        tickFormatter={(value: number) =>
                          selected.kind === "pir"
                            ? String(value)
                            : String(Math.round(value))
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(value: number) => format.dateTime(value)}
                        formatter={(value) => {
                          const numeric = typeof value === "number" ? value : null;
                          const shown =
                            numeric === null
                              ? "—"
                              : `${numeric}${
                                  selected.reading?.unit
                                    ? ` ${selected.reading.unit}`
                                    : ""
                                }`;
                          return [shown, selected.name] as [string, string];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        fill="url(#milesSensorFill)"
                        connectNulls={false}
                        isAnimationActive={false}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {history.origin === "demo" ? (
                    <>
                      <Bell className="size-3.5 text-warning" aria-hidden />
                      Données simulées générées localement — aucune mesure
                      matérielle n'est affichée ici.
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-3.5" aria-hidden />
                      Série fournie par le backend (GET /api/sensors/history).
                    </>
                  )}
                </p>
              </div>
            )}
          </PanelBody>
        </Panel>
      ) : null}

      <ThresholdDialog
        key={`${thresholdSensor?.id ?? "none"}-${thresholdSensorId !== null}`}
        sensor={thresholdSensor}
        open={thresholdSensorId !== null}
        onOpenChange={(open) => {
          if (!open) setThresholdSensorId(null);
        }}
      />
    </motion.div>
  );
}
