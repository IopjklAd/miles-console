/**
 * Demo data source.
 *
 * It exists so the interface can be exercised without any hardware or backend.
 * EVERY payload it returns carries `origin: "demo"`, which the UI renders as a
 * "SIMULÉ" badge — simulated data is never presented as a measurement, and this
 * engine never sends a physical command anywhere.
 *
 * Values are smooth deterministic functions of time so charts look plausible
 * and stay stable across refreshes; logs are generated incrementally from a
 * rolling buffer.
 */

import { type HistoryRange, LOG_FETCH_LIMIT } from "@/config/app";
import type { MilesApi } from "./contract";
import type {
  AppSettings,
  CommandResult,
  LogEntry,
  LogLevel,
  RobotCapability,
  RobotState,
  Sensor,
  SensorHistory,
  SystemStatus,
} from "@/miles/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const HISTORY_WINDOW: Record<HistoryRange, { span: number; step: number }> = {
  "5m": { span: 5 * MINUTE, step: 5_000 },
  "30m": { span: 30 * MINUTE, step: 20_000 },
  "1h": { span: HOUR, step: 30_000 },
  "24h": { span: 24 * HOUR, step: 10 * MINUTE },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic, smooth pseudo-signal. */
function wave(
  t: number,
  seed: number,
  base: number,
  amplitude: number,
  periodMs: number,
): number {
  return (
    base +
    amplitude * Math.sin(t / periodMs + seed) +
    amplitude * 0.35 * Math.sin(t / (periodMs / 3.3) + seed * 2.1)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Sensor signals                                                      */
/* ------------------------------------------------------------------ */

function pirValue(t: number): number {
  return Math.sin(t / 42_000 + 1.7) > 0.55 ? 1 : 0;
}

function soundValue(t: number): number {
  return Math.round(clamp(wave(t, 2.1, 47, 13, 55_000), 24, 92));
}

function distanceValue(t: number): number {
  return Math.round(clamp(wave(t, 5.3, 940, 430, 37_000), 60, 2_400));
}

const SIGNALS: Record<string, (t: number) => number> = {
  "pir-entree": pirValue,
  "sound-board": soundValue,
  "vl53l3cx": distanceValue,
};

/* ------------------------------------------------------------------ */
/* Capabilities (demo manifest — read-only + mode changes)             */
/* ------------------------------------------------------------------ */

const DEMO_CAPABILITIES: RobotCapability[] = [
  {
    id: "get_state",
    label: "Demander l'état",
    description: "Relit le mode courant et l'état des briques logicielles.",
    kind: "query",
    requiresConfirmation: false,
    enabled: true,
  },
  {
    id: "watch_enable",
    label: "Activer le mode surveillance",
    description: "Passe le robot en mode surveillance (effet physique simulé).",
    kind: "mode",
    requiresConfirmation: true,
    enabled: true,
  },
  {
    id: "watch_disable",
    label: "Désactiver le mode surveillance",
    description: "Reviennent au mode veille (effet physique simulé).",
    kind: "mode",
    requiresConfirmation: true,
    enabled: true,
  },
];

/* ------------------------------------------------------------------ */
/* Log generation                                                      */
/* ------------------------------------------------------------------ */

interface LogTemplate {
  level: LogLevel;
  source: string;
  message: string;
  weight: number;
}

const LOG_TEMPLATES: LogTemplate[] = [
  { level: "DEBUG", source: "backend", message: "Cycle de supervision terminé", weight: 10 },
  { level: "DEBUG", source: "esp32", message: "Trame UART reçue (checksum valide)", weight: 8 },
  { level: "DEBUG", source: "capteurs", message: "Échantillonnage des capteurs effectué", weight: 8 },
  { level: "INFO", source: "backend", message: "Point d'état publié vers l'interface", weight: 10 },
  { level: "INFO", source: "esp32", message: "Heartbeat ESP32-S3 reçu", weight: 8 },
  { level: "INFO", source: "services", message: "Service miles-core en fonctionnement", weight: 6 },
  { level: "INFO", source: "ia", message: "Requête de complétion traitée par la passerelle", weight: 5 },
  { level: "INFO", source: "vision", message: "Image rafraîchie (640×480)", weight: 4 },
  { level: "WARNING", source: "capteurs", message: "Niveau sonore proche du seuil configuré", weight: 4 },
  { level: "WARNING", source: "services", message: "Service miles-vision arrêté", weight: 3 },
  { level: "WARNING", source: "audio", message: "Niveau d'entrée élevé (-6 dBFS)", weight: 2 },
  { level: "ERROR", source: "esp32", message: "Port série /dev/ttyUSB0 indisponible (simulé)", weight: 2 },
  { level: "ERROR", source: "backend", message: "Requête /api/services expirée après 8000 ms", weight: 2 },
  { level: "CRITICAL", source: "esp32", message: "Perte de communication avec l'ESP32-S3 (simulé)", weight: 1 },
];

const TOTAL_WEIGHT = LOG_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);

function pickTemplate(): LogTemplate {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const template of LOG_TEMPLATES) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return LOG_TEMPLATES[0];
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class DemoEngine implements MilesApi {
  readonly mode = "demo" as const;

  private readonly startAt = Date.now();
  private logs: LogEntry[] = [];
  private logSeq = 0;
  private nextLogAt = 0;
  private commandSeq = 0;
  private robotMode = "veille";
  private lastCommand: CommandResult | null = null;

  /* ----------------------------- logs ---------------------------- */

  private pushLog(at: number): void {
    const template = pickTemplate();
    this.logs.push({
      id: `demo-log-${++this.logSeq}`,
      at,
      level: template.level,
      source: template.source,
      message: template.message,
      origin: "demo",
    });
  }

  private ensureLogs(now: number): void {
    if (this.logs.length === 0) {
      let t = now - HOUR;
      while (t < now) {
        this.pushLog(t);
        t += 3_000 + Math.random() * 14_000;
      }
      this.nextLogAt = t;
    }
    while (this.nextLogAt <= now && this.logs.length < 500) {
      this.pushLog(this.nextLogAt);
      this.nextLogAt += 4_000 + Math.random() * 22_000;
    }
    if (this.logs.length > 500) {
      this.logs.splice(0, this.logs.length - 500);
    }
  }

  getLogs(limit = LOG_FETCH_LIMIT): Promise<LogEntry[]> {
    const now = Date.now();
    this.ensureLogs(now);
    const entries = [...this.logs].sort((a, b) => b.at - a.at).slice(0, limit);
    return Promise.resolve(entries);
  }

  /* ---------------------------- status --------------------------- */

  getStatus(): Promise<SystemStatus> {
    const now = Date.now();
    this.ensureLogs(now);

    const recentCutoff = now - 15 * MINUTE;
    const recentErrorCount = this.logs.filter(
      (log) =>
        log.at >= recentCutoff &&
        (log.level === "ERROR" || log.level === "CRITICAL"),
    ).length;
    const lastActivityAt = this.logs.length
      ? this.logs[this.logs.length - 1].at
      : undefined;

    const status: SystemStatus = {
      overall: "degraded",
      backend: {
        status: "operational",
        label: "Connecté",
        detail: "Passerelle de démonstration",
        checkedAt: now,
        latencyMs: Math.round(21 + 18 * Math.abs(Math.sin(now / 9_000))),
        origin: "demo",
      },
      esp32: {
        status: "operational",
        label: "Connecté",
        detail: "ESP32-S3 — liaison simulée",
        checkedAt: now,
        origin: "demo",
      },
      sensors: {
        status: "operational",
        label: "3 / 3 capteurs",
        detail: "Sondes simulées",
        checkedAt: now,
        origin: "demo",
      },
      vision: {
        status: "operational",
        label: "Disponible",
        detail: "Webcam simulée — module hors v1",
        checkedAt: now,
        origin: "demo",
      },
      audio: {
        status: "operational",
        label: "Opérationnel",
        detail: "Périphérique simulé — module hors v1",
        checkedAt: now,
        origin: "demo",
      },
      services: {
        status: "degraded",
        label: "3 / 4 en fonctionnement",
        detail: "miles-vision arrêté (simulé)",
        checkedAt: now,
        origin: "demo",
      },
      ai: {
        status: "operational",
        label: "Opérationnel",
        detail: "État IA du backend simulé (l'assistant page utilise l'IA réelle)",
        checkedAt: now,
        origin: "demo",
      },
      host: {
        cpuPercent: Math.round(clamp(wave(now, 0.4, 26, 11, 47_000), 3, 96)),
        memoryPercent: Math.round(clamp(wave(now, 1.9, 44, 7, 310_000), 12, 95)),
        diskPercent: Math.round(clamp(wave(now, 3.2, 61, 1.5, 900_000), 1, 99)),
        uptimeSeconds: Math.floor((now - this.startAt) / 1000) + 9 * 3_600,
        activeServices: 3,
        networkOnline: true,
      },
      lastActivityAt,
      recentErrorCount,
      fetchedAt: now,
      origin: "demo",
    };

    return Promise.resolve(status);
  }

  /* ---------------------------- sensors -------------------------- */

  getSensors(): Promise<Sensor[]> {
    const now = Date.now();
    const sensors: Sensor[] = [
      {
        id: "pir-entree",
        name: "PIR — détection de mouvement",
        kind: "pir",
        typeLabel: "PIR (mouvement)",
        link: "connected",
        reading: {
          value: pirValue(now),
          unit: "",
          at: now,
          state: "simulated",
        },
        lastError: null,
        threshold: null,
        origin: "demo",
      },
      {
        id: "sound-board",
        name: "Capteur sonore",
        kind: "sound",
        typeLabel: "Micro / capteur sonore",
        link: "connected",
        reading: {
          value: soundValue(now),
          unit: "dB",
          at: now,
          state: "simulated",
        },
        lastError: null,
        threshold: { enabled: false, min: null, max: 75 },
        origin: "demo",
      },
      {
        id: "vl53l3cx",
        name: "VL53L3CX — distance",
        kind: "distance",
        typeLabel: "VL53L3CX (distance au ToF)",
        link: "connected",
        reading: {
          value: distanceValue(now),
          unit: "mm",
          at: now,
          state: "simulated",
        },
        lastError: null,
        threshold: { enabled: false, min: 80, max: 3_000 },
        origin: "demo",
      },
    ];
    return Promise.resolve(sensors);
  }

  getSensorHistory(
    sensorId: string,
    range: HistoryRange,
  ): Promise<SensorHistory> {
    const signal = SIGNALS[sensorId];
    const now = Date.now();
    const { span, step } = HISTORY_WINDOW[range];
    const start = now - span;
    const points: SensorHistory["points"] = [];

    if (signal) {
      for (let t = start; t <= now; t += step) {
        points.push({ t, v: signal(t) });
      }
    }

    return Promise.resolve({
      sensorId,
      range,
      points,
      origin: "demo",
      fetchedAt: now,
    });
  }

  /* ---------------------------- robot ---------------------------- */

  getRobotState(): Promise<RobotState> {
    return Promise.resolve({
      connection: "connected",
      mode: this.robotMode,
      lastCommand: this.lastCommand,
      checkedAt: Date.now(),
      origin: "demo",
    });
  }

  getRobotCapabilities(): Promise<RobotCapability[]> {
    return Promise.resolve(DEMO_CAPABILITIES.map((capability) => ({ ...capability })));
  }

  async sendCommand(capability: {
    id: string;
    label: string;
  }): Promise<CommandResult> {
    const sentAt = Date.now();
    const commandId = `demo-cmd-${++this.commandSeq}`;
    const definition = DEMO_CAPABILITIES.find(
      (item) => item.id === capability.id,
    );

    if (!definition || !definition.enabled) {
      const rejected: CommandResult = {
        commandId,
        capabilityId: capability.id,
        label: capability.label,
        status: "rejected",
        sentAt,
        acknowledgedAt: Date.now(),
        error: "Commande absente du manifeste de capacités.",
        origin: "demo",
      };
      this.lastCommand = rejected;
      return rejected;
    }

    // Simulated backend latency (the request never leaves this browser).
    await sleep(320 + Math.random() * 480);

    let message = "";
    if (definition.id === "get_state") {
      message = `État lu : mode ${this.robotMode}.`;
    } else if (definition.id === "watch_enable") {
      this.robotMode = "surveillance";
      message = "Mode surveillance activé.";
    } else if (definition.id === "watch_disable") {
      this.robotMode = "veille";
      message = "Mode surveillance désactivé.";
    }

    const result: CommandResult = {
      commandId,
      capabilityId: definition.id,
      label: definition.label,
      status: "accepted",
      sentAt,
      acknowledgedAt: Date.now(),
      message: `${message} (démonstration)`,
      origin: "demo",
    };
    this.lastCommand = result;
    return result;
  }

  /* --------------------------- settings -------------------------- */

  getSettings(): Promise<Partial<AppSettings>> {
    // The demo engine has no remote settings store.
    return Promise.resolve({});
  }

  saveSettings(): Promise<void> {
    // Settings are persisted locally by the settings provider; the demo
    // engine must not pretend a remote save happened.
    return Promise.resolve();
  }
}
