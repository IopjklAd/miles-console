/**
 * Domain types of the MILES console.
 *
 * These types describe what the UI renders, whatever the data source:
 * the real backend (`origin: "live"`) or the demo engine (`origin: "demo"`).
 * Every payload carries its origin so the interface can label simulated
 * values explicitly and never mix them with real measurements.
 */

import type { HistoryRange } from "@/config/app";

export type ApiMode = "live" | "demo";
export type DataOrigin = "live" | "demo";

/** Generic lifecycle of a component of the system. */
export type Availability =
  | "operational"
  | "degraded"
  | "down"
  | "unavailable"
  | "unknown";

/** State of one part of the system (backend, ESP32, webcam, audio...). */
export interface ComponentState {
  status: Availability;
  /** Short human label, e.g. "Connecté". */
  label: string;
  /** Optional detail (reason, HTTP code, device name). */
  detail?: string;
  checkedAt: number;
  origin: DataOrigin;
  /** Round-trip time of the last successful exchange, when measured. */
  latencyMs?: number;
}

export interface HostMetrics {
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  uptimeSeconds?: number;
  activeServices?: number;
  networkOnline?: boolean;
}

/** GET /api/status */
export interface SystemStatus {
  overall: Availability;
  backend: ComponentState;
  esp32: ComponentState;
  sensors: ComponentState;
  vision: ComponentState;
  audio: ComponentState;
  services: ComponentState;
  ai: ComponentState;
  /** Missing entirely when the backend exposes no host metrics. */
  host?: HostMetrics;
  lastActivityAt?: number;
  recentErrorCount: number;
  fetchedAt: number;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Sensors                                                             */
/* ------------------------------------------------------------------ */

export type SensorKind = "pir" | "sound" | "distance" | "custom";

export type SensorLink = "connected" | "disconnected" | "error" | "unknown";

/**
 * Validity of the current value:
 * - valid:       fresh, real measurement
 * - simulated:   produced by the demo engine
 * - stale:       real but older than STALE_AFTER_MS
 * - invalid:     backend flags the value as unusable
 * - unavailable: no value (sensor off, backend absent)
 */
export type ValueState =
  | "valid"
  | "simulated"
  | "stale"
  | "invalid"
  | "unavailable";

export interface SensorThreshold {
  enabled: boolean;
  min?: number | null;
  max?: number | null;
}

export interface SensorReading {
  value: number | null;
  unit: string;
  at: number;
  state: ValueState;
}

export interface Sensor {
  id: string;
  name: string;
  kind: SensorKind;
  /** Displayed type, e.g. "VL53L3CX (distance)". */
  typeLabel: string;
  link: SensorLink;
  reading: SensorReading | null;
  lastError?: string | null;
  /** `null` when the sensor cannot be thresholded. */
  threshold: SensorThreshold | null;
  origin: DataOrigin;
}

export interface SensorHistoryPoint {
  t: number;
  v: number | null;
}

export interface SensorHistory {
  sensorId: string;
  range: HistoryRange;
  points: SensorHistoryPoint[];
  origin: DataOrigin;
  fetchedAt: number;
}

/** Threshold breach derived by the UI (never sent to hardware). */
export interface ThresholdAlert {
  sensorId: string;
  sensorName: string;
  message: string;
  at: number;
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

export type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export const LOG_LEVELS: LogLevel[] = [
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
];

export interface LogEntry {
  id: string;
  at: number;
  level: LogLevel;
  /** Emitting component: backend, esp32, capteurs, ia... */
  source: string;
  message: string;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Robot control                                                       */
/* ------------------------------------------------------------------ */

export type CommandKind = "query" | "mode" | "service" | "action";

/**
 * A command exposed by the backend capability manifest. The UI never invents
 * commands: with no manifest, no button is enabled.
 */
export interface RobotCapability {
  id: string;
  label: string;
  description: string;
  kind: CommandKind;
  /** Commands with a physical effect require an explicit confirmation. */
  requiresConfirmation: boolean;
  enabled: boolean;
}

export interface RobotState {
  connection: "connected" | "disconnected" | "unknown";
  mode: string;
  lastCommand?: CommandResult | null;
  checkedAt: number;
  origin: DataOrigin;
}

/**
 * Command lifecycle. `sent` only means the request left the browser —
 * `accepted` means the backend acknowledged the effect.
 */
export type CommandStatus =
  | "sending"
  | "sent"
  | "accepted"
  | "rejected"
  | "failed"
  | "timeout";

export interface CommandResult {
  commandId: string;
  capabilityId: string;
  label: string;
  status: CommandStatus;
  sentAt: number;
  acknowledgedAt?: number;
  message?: string;
  error?: string;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Software services                                                   */
/* ------------------------------------------------------------------ */

/** Control action offered by the backend, when it offers one at all. */
export type ServiceAction = "start" | "stop" | "restart";

/**
 * One software process of the MILES stack. `controllable` mirrors what the
 * backend declares: when it is false the UI never shows start/stop buttons.
 */
export interface ServiceInfo {
  id: string;
  name: string;
  description?: string | null;
  status: Availability;
  statusLabel: string;
  lastActivityAt?: number | null;
  lastError?: string | null;
  version?: string | null;
  controllable: boolean;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Vision (webcam served by the backend)                               */
/* ------------------------------------------------------------------ */

export type StreamState = "idle" | "starting" | "live" | "error";

/**
 * Stream provided by the MILES backend — the browser never reads the USB
 * webcam itself. Every field is optional because a backend may expose only
 * part of them: absent means "Indisponible", never a guess.
 */
export interface VisionState {
  webcam: ComponentState;
  stream: StreamState;
  width?: number | null;
  height?: number | null;
  fps?: number | null;
  lastFrameAt?: number | null;
  /** Last frame image URL, when the backend serves snapshots. */
  snapshotUrl?: string | null;
  lastError?: string | null;
  /** Backend declares start/stop endpoints for the stream. */
  controllable: boolean;
  fetchedAt: number;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

export interface AudioEndpoint {
  status: Availability;
  label: string;
  detail?: string | null;
}

export interface AudioState {
  input: AudioEndpoint;
  output: AudioEndpoint;
  capturing: boolean;
  playing: boolean;
  /** Input level in dBFS when the backend measures it. */
  levelDbfs?: number | null;
  /** Output volume 0–100 when the backend exposes a control. */
  volume?: number | null;
  volumeControllable: boolean;
  lastError?: string | null;
  fetchedAt: number;
  origin: DataOrigin;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type Severity = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  at: number;
  read: boolean;
  /** Where the event came from: the live backend, the demo engine or the app. */
  origin: DataOrigin | "app";
  /** Repeated events with the same key are collapsed. */
  dedupeKey: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  systemName: string;
  timeZone: string;
  pollIntervalMs: number;
  aiModel: string;
  /** Per-sensor thresholds configured from the sensors page. */
  thresholds: Record<string, SensorThreshold>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  systemName: "MILES",
  timeZone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  pollIntervalMs: 5_000,
  aiModel: "gpt-4o-mini",
  thresholds: {},
};
