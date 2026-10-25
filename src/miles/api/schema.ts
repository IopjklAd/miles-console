/**
 * Wire contracts of the MILES backend.
 *
 * These zod schemas ARE the documented API contract (see README §API). A
 * payload that does not match is rejected as `parse`, never rendered: the UI
 * must not guess when the backend changes shape.
 *
 * Nothing here pretends the backend exists — the live client simply fails with
 * `not_configured` until `VITE_MILES_API_BASE_URL` points at a real server.
 */

import { z } from "zod";
import type { HistoryRange } from "@/config/app";
import { STALE_AFTER_MS } from "@/config/app";
import type {
  AppSettings,
  Availability,
  CommandResult,
  DataOrigin,
  LogEntry,
  LogLevel,
  RobotCapability,
  RobotState,
  Sensor,
  SensorHistory,
  SystemStatus,
} from "@/miles/types";

const availabilityEnum = z.enum([
  "operational",
  "degraded",
  "down",
  "unavailable",
  "unknown",
]);

const STATUS_LABEL_FR: Record<Availability, string> = {
  operational: "Opérationnel",
  degraded: "Dégradé",
  down: "Arrêté",
  unavailable: "Indisponible",
  unknown: "Inconnu",
};

export function statusLabel(status: Availability): string {
  return STATUS_LABEL_FR[status];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function asArray(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  throw new Error(`champ « ${key} » absent de la réponse`);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

const componentStateWire = z.object({
  status: availabilityEnum,
  label: z.string().optional(),
  detail: z.string().optional(),
  checkedAt: z.number().optional(),
  latencyMs: z.number().optional(),
});

const statusWire = z.object({
  overall: availabilityEnum,
  backend: componentStateWire.optional(),
  esp32: componentStateWire.optional(),
  sensors: componentStateWire.optional(),
  vision: componentStateWire.optional(),
  audio: componentStateWire.optional(),
  services: componentStateWire.optional(),
  ai: componentStateWire.optional(),
  host: z
    .object({
      cpuPercent: z.number().optional(),
      memoryPercent: z.number().optional(),
      diskPercent: z.number().optional(),
      uptimeSeconds: z.number().optional(),
      activeServices: z.number().optional(),
      networkOnline: z.boolean().optional(),
    })
    .optional(),
  lastActivityAt: z.number().optional(),
  recentErrorCount: z.number().optional(),
});

function mapComponent(
  wire: z.infer<typeof componentStateWire> | undefined,
  origin: DataOrigin,
  now: number,
): SystemStatus["backend"] {
  if (!wire) {
    return {
      status: "unknown",
      label: "Non exposé",
      detail: "Ce composant n'est pas renvoyé par le backend.",
      checkedAt: now,
      origin,
    };
  }
  return {
    status: wire.status,
    label: wire.label ?? statusLabel(wire.status),
    detail: optionalString(wire.detail),
    checkedAt: wire.checkedAt ?? now,
    latencyMs: wire.latencyMs,
    origin,
  };
}

export function parseStatus(
  payload: unknown,
  origin: DataOrigin,
): SystemStatus {
  const wire = statusWire.parse(payload);
  const now = Date.now();
  return {
    overall: wire.overall,
    backend: mapComponent(wire.backend, origin, now),
    esp32: mapComponent(wire.esp32, origin, now),
    sensors: mapComponent(wire.sensors, origin, now),
    vision: mapComponent(wire.vision, origin, now),
    audio: mapComponent(wire.audio, origin, now),
    services: mapComponent(wire.services, origin, now),
    ai: mapComponent(wire.ai, origin, now),
    host: wire.host,
    lastActivityAt: wire.lastActivityAt,
    recentErrorCount: wire.recentErrorCount ?? 0,
    fetchedAt: now,
    origin,
  };
}

/* ------------------------------------------------------------------ */
/* Sensors                                                             */
/* ------------------------------------------------------------------ */

const valueStateEnum = z.enum([
  "valid",
  "simulated",
  "stale",
  "invalid",
  "unavailable",
]);

const thresholdWire = z.object({
  enabled: z.boolean().default(false),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
});

const sensorWire = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["pir", "sound", "distance", "custom"]).default("custom"),
  typeLabel: z.string().optional(),
  link: z.enum(["connected", "disconnected", "error", "unknown"]).default("unknown"),
  value: z.number().nullable().optional(),
  unit: z.string().optional(),
  at: z.number().optional(),
  valueState: valueStateEnum.optional(),
  lastError: z.string().nullable().optional(),
  threshold: thresholdWire.nullable().optional(),
});

export function parseSensors(
  payload: unknown,
  origin: DataOrigin,
): Sensor[] {
  const now = Date.now();
  const wires = z.array(sensorWire).parse(asArray(payload, "sensors"));

  return wires.map((wire) => {
    const at = wire.at ?? now;
    const age = now - at;
    const state =
      wire.valueState ??
      (origin === "demo"
        ? "simulated"
        : age > STALE_AFTER_MS
          ? "stale"
          : "valid");

    return {
      id: wire.id,
      name: wire.name,
      kind: wire.kind,
      typeLabel: wire.typeLabel ?? wire.name,
      link: wire.link,
      reading:
        wire.value === undefined
          ? null
          : { value: wire.value, unit: wire.unit ?? "", at, state },
      lastError: wire.lastError ?? null,
      threshold:
        wire.threshold == null
          ? null
          : {
              enabled: wire.threshold.enabled,
              min: wire.threshold.min ?? null,
              max: wire.threshold.max ?? null,
            },
      origin,
    } satisfies Sensor;
  });
}

const historyPointWire = z.object({
  t: z.number(),
  v: z.number().nullable(),
});

export function parseSensorHistory(
  payload: unknown,
  sensorId: string,
  range: HistoryRange,
  origin: DataOrigin,
): SensorHistory {
  const points = z
    .array(historyPointWire)
    .parse(asArray(payload, "points"))
    .map((point) => ({ t: point.t, v: point.v }));

  return {
    sensorId,
    range,
    points: points.sort((a, b) => a.t - b.t),
    origin,
    fetchedAt: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

const logLevelEnum = z.enum([
  "DEBUG",
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
]);

const logWire = z.object({
  id: z.string().optional(),
  at: z.number(),
  level: logLevelEnum,
  source: z.string(),
  message: z.string(),
});

export function parseLogs(payload: unknown, origin: DataOrigin): LogEntry[] {
  const wires = z.array(logWire).parse(asArray(payload, "logs"));
  return wires
    .map((wire, index) => ({
      id: wire.id ?? `log-${wire.at}-${index}`,
      at: wire.at,
      level: wire.level as LogLevel,
      source: wire.source,
      message: wire.message,
      origin,
    }))
    .sort((a, b) => b.at - a.at);
}

/* ------------------------------------------------------------------ */
/* Robot control                                                       */
/* ------------------------------------------------------------------ */

const commandWire = z.object({
  commandId: z.string().optional(),
  status: z
    .enum(["sending", "sent", "accepted", "rejected", "failed", "timeout"])
    .optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  acknowledgedAt: z.number().optional(),
});

const robotStateWire = z.object({
  connection: z.enum(["connected", "disconnected", "unknown"]),
  mode: z.string(),
  lastCommand: commandWire.nullable().optional(),
  checkedAt: z.number().optional(),
});

export function parseRobotState(
  payload: unknown,
  origin: DataOrigin,
): RobotState {
  const wire = robotStateWire.parse(payload);
  const now = Date.now();
  return {
    connection: wire.connection,
    mode: wire.mode,
    checkedAt: wire.checkedAt ?? now,
    origin,
    lastCommand: wire.lastCommand
      ? {
          commandId: wire.lastCommand.commandId ?? "unknown",
          capabilityId: "unknown",
          label: "Dernière commande",
          status: wire.lastCommand.status ?? "sent",
          sentAt: wire.lastCommand.acknowledgedAt ?? now,
          acknowledgedAt: wire.lastCommand.acknowledgedAt,
          message: optionalString(wire.lastCommand.message),
          error: optionalString(wire.lastCommand.error),
          origin,
        }
      : null,
  };
}

const capabilityWire = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  kind: z.enum(["query", "mode", "service", "action"]).default("action"),
  requiresConfirmation: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export function parseCapabilities(payload: unknown): RobotCapability[] {
  return z
    .array(capabilityWire)
    .parse(asArray(payload, "capabilities"))
    .map((wire) => ({
      id: wire.id,
      label: wire.label,
      description: wire.description ?? "",
      kind: wire.kind,
      requiresConfirmation: wire.requiresConfirmation,
      enabled: wire.enabled,
    }));
}

/**
 * Map a `POST /api/robot/commands` response.
 *
 * A response without an explicit status is reported as `sent` (transmitted)
 * and NOT as `accepted`: sending a command never implies success.
 */
export function parseCommandResponse(
  payload: unknown,
  context: {
    commandId: string;
    capabilityId: string;
    label: string;
    sentAt: number;
    origin: DataOrigin;
  },
): CommandResult {
  const wire = commandWire.parse(payload);
  return {
    commandId: wire.commandId ?? context.commandId,
    capabilityId: context.capabilityId,
    label: context.label,
    status: wire.status ?? "sent",
    sentAt: context.sentAt,
    acknowledgedAt: wire.acknowledgedAt,
    message: optionalString(wire.message),
    error: optionalString(wire.error),
    origin: context.origin,
  };
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const settingsWire = z.object({
  systemName: z.string().optional(),
  timeZone: z.string().optional(),
  pollIntervalMs: z.number().optional(),
  aiModel: z.string().optional(),
  thresholds: z
    .record(
      z.string(),
      z.object({
        enabled: z.boolean(),
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
      }),
    )
    .optional(),
});

export function parseSettings(payload: unknown): Partial<AppSettings> {
  const wire = settingsWire.parse(payload);
  return {
    systemName: wire.systemName,
    timeZone: wire.timeZone,
    pollIntervalMs: wire.pollIntervalMs,
    aiModel: wire.aiModel,
    thresholds: wire.thresholds,
  };
}
