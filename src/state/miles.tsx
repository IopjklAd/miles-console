/**
 * System state of the console: data source mode, connection state, polled
 * domains and the notification centre.
 *
 * Design rules:
 * - ONE polling loop for the whole app (no per-page duplicate connections).
 * - Each domain keeps its own loading/error state so a failing endpoint never
 *   blocks the rest of the interface.
 * - Switching mode discards the other source's data: live and demo values are
 *   never mixed.
 * - Notifications come from real transitions (connection lost, threshold
 *   breach, command/AI failure) and are deduplicated per incident.
 */

import {
  IS_BACKEND_CONFIGURED,
  STORAGE_KEYS,
  type HistoryRange,
} from "@/config/app";
import { createMilesApi, describeError, type MilesApi } from "@/miles/api";
import type {
  ApiMode,
  AppNotification,
  Availability,
  DataOrigin,
  LogEntry,
  RobotCapability,
  RobotState,
  Sensor,
  SensorHistory,
  Severity,
  SystemStatus,
  ThresholdAlert,
} from "@/miles/types";
import { useSettings } from "@/state/settings";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type ConnectionState =
  | "demo"
  | "unconfigured"
  | "connecting"
  | "connected"
  | "disconnected";

export interface DomainState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  updatedAt: number | null;
}

function emptyDomain<T>(): DomainState<T> {
  return { data: null, error: null, loading: true, updatedAt: null };
}

export interface NotificationInput {
  title: string;
  message: string;
  severity: Severity;
  dedupeKey: string;
  origin?: DataOrigin | "app";
  at?: number;
}

interface MilesContextValue {
  mode: ApiMode;
  setMode: (mode: ApiMode) => void;
  api: MilesApi;
  backendConfigured: boolean;
  connection: ConnectionState;
  refreshing: boolean;
  lastUpdate: number | null;
  refresh: () => void;

  status: DomainState<SystemStatus>;
  sensors: DomainState<Sensor[]>;
  logs: DomainState<LogEntry[]>;
  robotState: DomainState<RobotState>;
  capabilities: DomainState<RobotCapability[]>;

  notifications: AppNotification[];
  unreadCount: number;
  pushNotification: (input: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;

  alerts: ThresholdAlert[];
}

const MilesContext = createContext<MilesContextValue | null>(null);

function readInitialMode(): ApiMode {
  if (typeof window === "undefined") {
    return IS_BACKEND_CONFIGURED ? "live" : "demo";
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.mode);
    if (stored === "live" || stored === "demo") return stored;
  } catch {
    /* storage unavailable: fall through to the default */
  }
  return IS_BACKEND_CONFIGURED ? "live" : "demo";
}

const DEDUPE_WINDOW_MS = 10 * 60_000;

/** The capability manifest changes rarely: refresh it at most every minute. */
const CAPS_REFRESH_MS = 60_000;

/** Push a notification outside the render/effect commit (state-in-effect rule). */
function deferNotification(task: () => void): void {
  window.setTimeout(task, 0);
}

export function MilesProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [mode, setModeState] = useState<ApiMode>(readInitialMode);
  const api = useMemo(() => createMilesApi(mode), [mode]);

  const [status, setStatus] = useState<DomainState<SystemStatus>>(emptyDomain);
  const [sensors, setSensors] = useState<DomainState<Sensor[]>>(emptyDomain);
  const [logs, setLogs] = useState<DomainState<LogEntry[]>>(emptyDomain);
  const [robotState, setRobotState] = useState<DomainState<RobotState>>(
    emptyDomain,
  );
  const [capabilities, setCapabilities] = useState<
    DomainState<RobotCapability[]>
  >(emptyDomain);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [manualTick, setManualTick] = useState(0);
  const inFlight = useRef(false);
  const lastLogsFetchAt = useRef(0);
  const lastCapsFetchAt = useRef(0);
  const tickRef = useRef<(() => void) | null>(null);

  const pushNotification = useCallback((input: NotificationInput) => {
    setNotifications((previous) => {
      const now = input.at ?? Date.now();
      const existing = previous.find(
        (item) => item.dedupeKey === input.dedupeKey,
      );
      if (existing && now - existing.at < DEDUPE_WINDOW_MS) {
        if (existing.read || existing.message !== input.message) {
          return previous.map((item) =>
            item.id === existing.id
              ? { ...item, read: false, at: now, message: input.message }
              : item,
          );
        }
        return previous;
      }
      const entry: AppNotification = {
        id: `notif-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title,
        message: input.message,
        severity: input.severity,
        at: now,
        read: false,
        origin: input.origin ?? "app",
        dedupeKey: input.dedupeKey,
      };
      return [entry, ...previous].slice(0, 120);
    });
  }, []);

  const setMode = useCallback((next: ApiMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEYS.mode, next);
    } catch {
      /* ignore: mode simply won't persist */
    }
    // Drop the previous source's data so two origins are never blended.
    setStatus(emptyDomain());
    setSensors(emptyDomain());
    setLogs(emptyDomain());
    setRobotState(emptyDomain());
    setCapabilities(emptyDomain());
    setLastUpdate(null);
  }, []);

  const refresh = useCallback(() => setManualTick((tick) => tick + 1), []);

  /* ---------------------------- polling --------------------------- */

  useEffect(() => {
    let cancelled = false;

    // Each effect cycle (mount, mode change, interval change, manual refresh)
    // performs a full read; lighter domains are throttled between cycles.
    lastLogsFetchAt.current = 0;
    lastCapsFetchAt.current = 0;

    const applyResult = <T,>(
      result: PromiseSettledResult<T>,
      setter: Dispatch<SetStateAction<DomainState<T>>>,
    ) => {
      if (result.status === "fulfilled") {
        setter({
          data: result.value,
          error: null,
          loading: false,
          updatedAt: Date.now(),
        });
      } else {
        setter((previous) => ({
          ...previous,
          error: describeError(result.reason),
          loading: false,
        }));
      }
    };

    const tick = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setRefreshing(true);
      const startedAt = Date.now();

      // Status, sensors and robot state drive freshness-critical UI: read every
      // cycle. Logs change slower (2 cycles) and the capability manifest very
      // rarely (60 s) — fewer parallel requests means a shorter tick and less
      // load on a future real backend.
      const wantLogs =
        startedAt - lastLogsFetchAt.current >= settings.pollIntervalMs * 2;
      const wantCaps = startedAt - lastCapsFetchAt.current >= CAPS_REFRESH_MS;

      try {
        const [
          statusResult,
          sensorsResult,
          robotResult,
          logsResult,
          capsResult,
        ] = await Promise.allSettled([
          api.getStatus(),
          api.getSensors(),
          api.getRobotState(),
          wantLogs ? api.getLogs() : Promise.resolve(null),
          wantCaps ? api.getRobotCapabilities() : Promise.resolve(null),
        ]);
        if (cancelled) return;

        applyResult(statusResult, setStatus);
        applyResult(sensorsResult, setSensors);
        applyResult(robotResult, setRobotState);

        if (logsResult.status === "fulfilled") {
          lastLogsFetchAt.current = startedAt;
          if (logsResult.value) {
            setLogs({
              data: logsResult.value,
              error: null,
              loading: false,
              updatedAt: Date.now(),
            });
          }
        } else {
          lastLogsFetchAt.current = startedAt;
          setLogs((previous) => ({
            ...previous,
            error: describeError(logsResult.reason),
            loading: false,
          }));
        }

        if (capsResult.status === "fulfilled") {
          lastCapsFetchAt.current = startedAt;
          if (capsResult.value) {
            setCapabilities({
              data: capsResult.value,
              error: null,
              loading: false,
              updatedAt: Date.now(),
            });
          }
        } else {
          lastCapsFetchAt.current = startedAt;
          setCapabilities((previous) => ({
            ...previous,
            error: describeError(capsResult.reason),
            loading: false,
          }));
        }

        // "Last update" only advances on a successful status read, so a failing
        // backend never looks like a fresh measurement.
        if (statusResult.status === "fulfilled") setLastUpdate(Date.now());
      } finally {
        inFlight.current = false;
        if (!cancelled) setRefreshing(false);
      }
    };

    const runTick = () => void tick();
    tickRef.current = runTick;
    runTick();

    const interval = window.setInterval(runTick, settings.pollIntervalMs);

    // Coming back to the tab refreshes at once instead of waiting for the next
    // cycle (staleness after a tab switch: up to one interval → ~0).
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tickRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (tickRef.current === runTick) tickRef.current = null;
    };
  }, [api, settings.pollIntervalMs, manualTick]);

  /* -------------------------- connection -------------------------- */

  const connection = useMemo<ConnectionState>(() => {
    if (mode === "demo") return "demo";
    if (!IS_BACKEND_CONFIGURED) return "unconfigured";
    if (status.error) return "disconnected";
    if (status.data) return "connected";
    return "connecting";
  }, [mode, status.data, status.error]);

  const prevConnection = useRef<ConnectionState | null>(null);
  useEffect(() => {
    const previous = prevConnection.current;
    prevConnection.current = connection;
    if (previous === null || previous === connection) return;

    let candidate: NotificationInput | null = null;

    if (
      connection === "connected" &&
      (previous === "connecting" || previous === "disconnected")
    ) {
      candidate = {
        title:
          previous === "connecting" ? "Backend joignable" : "Connexion rétablie",
        message:
          previous === "connecting"
            ? "Connexion au backend MILES établie."
            : "Le backend MILES répond de nouveau.",
        severity: "success",
        dedupeKey: "backend:connected",
        origin: "live",
      };
    } else if (connection === "disconnected") {
      candidate = {
        title: "Connexion perdue",
        message: status.error ?? "Le backend MILES ne répond plus.",
        severity: "error",
        dedupeKey: "backend:disconnected",
        origin: "live",
      };
    } else if (connection === "unconfigured") {
      candidate = {
        title: "Backend non configuré",
        message:
          "Renseignez VITE_MILES_API_BASE_URL pour superviser le matériel réel.",
        severity: "warning",
        dedupeKey: "backend:unconfigured",
        origin: "app",
      };
    }

    if (candidate) {
      const notification = candidate;
      deferNotification(() => pushNotification(notification));
    }
  }, [connection, pushNotification, status.error]);

  /* ---------------- component transitions ---------------- */

  const prevComponents = useRef<Record<string, Availability> | null>(null);

  useEffect(() => {
    const current = status.data;
    if (!current) return;

    const entries = [
      ["esp32", current.esp32],
      ["vision", current.vision],
      ["audio", current.audio],
      ["services", current.services],
      ["sensors", current.sensors],
      ["ai", current.ai],
    ] as const;

    const snapshot: Record<string, Availability> = {};
    for (const [key, component] of entries) snapshot[key] = component.status;

    const previous = prevComponents.current;
    prevComponents.current = snapshot;
    if (!previous) return; // first payload only establishes the baseline

    const DOWN_COPY: Record<string, { title: string; fallback: string }> = {
      esp32: {
        title: "Matériel injoignable",
        fallback: "L'ESP32-S3 ne répond plus.",
      },
      vision: {
        title: "Webcam inaccessible",
        fallback: "Le service de vision ne répond plus.",
      },
      audio: {
        title: "Audio indisponible",
        fallback: "Le service audio ne répond plus.",
      },
      services: {
        title: "Service arrêté",
        fallback: "Un service logiciel de la pile MILES est arrêté.",
      },
      sensors: {
        title: "Capteurs indisponibles",
        fallback: "Les capteurs ne répondent plus.",
      },
      ai: {
        title: "Fournisseur IA indisponible",
        fallback: "Le fournisseur IA ne répond plus.",
      },
    };

    for (const [key, component] of entries) {
      const before = previous[key];
      const after = snapshot[key];
      const brokeDown =
        (after === "down" || after === "unavailable") &&
        before !== "down" &&
        before !== "unavailable";
      if (!brokeDown) continue;
      const copy = DOWN_COPY[key];
      pushNotification({
        title: copy.title,
        message: component.detail ?? copy.fallback,
        severity: "error",
        dedupeKey: `component:${key}:down`,
        origin: component.origin,
      });
    }
  }, [status.data, pushNotification]);

  /* -------------------------- thresholds -------------------------- */

  const alerts = useMemo<ThresholdAlert[]>(() => {
    const readings = sensors.data;
    if (!readings) return [];
    // Reference time comes from the payload so render stays pure.
    const referenceAt = sensors.updatedAt ?? 0;
    const result: ThresholdAlert[] = [];
    for (const sensor of readings) {
      const configured = settings.thresholds[sensor.id];
      const threshold = configured ?? sensor.threshold;
      if (!threshold?.enabled) continue;
      const value = sensor.reading?.value;
      if (value === null || value === undefined) continue;
      if (threshold.max != null && value > threshold.max) {
        result.push({
          sensorId: sensor.id,
          sensorName: sensor.name,
          message: `valeur ${value}${sensor.reading?.unit ? ` ${sensor.reading.unit}` : ""} supérieure au seuil maximum (${threshold.max})`,
          at: sensor.reading?.at ?? referenceAt,
        });
      } else if (threshold.min != null && value < threshold.min) {
        result.push({
          sensorId: sensor.id,
          sensorName: sensor.name,
          message: `valeur ${value}${sensor.reading?.unit ? ` ${sensor.reading.unit}` : ""} inférieure au seuil minimum (${threshold.min})`,
          at: sensor.reading?.at ?? referenceAt,
        });
      }
    }
    return result;
  }, [sensors.data, settings.thresholds]);

  const activeAlertKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    const nextKeys = new Set(
      alerts.map((alert) => `${alert.sensorId}:${alert.message}`),
    );
    const fresh: NotificationInput[] = [];
    for (const alert of alerts) {
      const key = `${alert.sensorId}:${alert.message}`;
      if (activeAlertKeys.current.has(key)) continue;
      const origin: NotificationInput["origin"] =
        sensors.data?.find((item) => item.id === alert.sensorId)?.origin ??
        "app";
      fresh.push({
        title: "Seuil de capteur dépassé",
        message: `${alert.sensorName} — ${alert.message}`,
        severity: "warning",
        dedupeKey: `threshold:${alert.sensorId}:${alert.message}`,
        origin,
        at: alert.at,
      });
    }
    activeAlertKeys.current = nextKeys;
    if (fresh.length > 0) {
      deferNotification(() => {
        for (const notification of fresh) pushNotification(notification);
      });
    }
  }, [alerts, pushNotification, sensors.data]);

  /* ------------------------ notifications ------------------------- */

  const markRead = useCallback((id: string) => {
    setNotifications((previous) =>
      previous.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((previous) =>
      previous.map((item) => ({ ...item, read: true })),
    );
  }, []);

  const unreadCount = notifications.reduce(
    (count, item) => (item.read ? count : count + 1),
    0,
  );

  const value = useMemo<MilesContextValue>(
    () => ({
      mode,
      setMode,
      api,
      backendConfigured: IS_BACKEND_CONFIGURED,
      connection,
      refreshing,
      lastUpdate,
      refresh,
      status,
      sensors,
      logs,
      robotState,
      capabilities,
      notifications,
      unreadCount,
      pushNotification,
      markRead,
      markAllRead,
      alerts,
    }),
    [
      mode,
      setMode,
      api,
      connection,
      refreshing,
      lastUpdate,
      refresh,
      status,
      sensors,
      logs,
      robotState,
      capabilities,
      notifications,
      unreadCount,
      pushNotification,
      markRead,
      markAllRead,
      alerts,
    ],
  );

  return <MilesContext.Provider value={value}>{children}</MilesContext.Provider>;
}

export function useMiles(): MilesContextValue {
  const context = useContext(MilesContext);
  if (!context) {
    throw new Error("useMiles must be used within a MilesProvider");
  }
  return context;
}

/** Fetch a sensor history series (used by the sensors page). */
export async function fetchSensorHistory(
  api: MilesApi,
  sensorId: string,
  range: HistoryRange,
): Promise<SensorHistory> {
  return api.getSensorHistory(sensorId, range);
}
