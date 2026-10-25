/**
 * Central configuration of the MILES console.
 *
 * Every backend URL lives here: components must never hardcode an address.
 *
 * The MILES backend is optional. When `VITE_MILES_API_BASE_URL` is empty the
 * console starts in demo mode and the live API answers `not_configured`
 * instead of pretending a server exists.
 */

const rawBaseUrl = (import.meta.env.VITE_MILES_API_BASE_URL ?? "").trim();

/** Absolute or relative base URL of the MILES backend ("" = not configured). */
export const MILES_API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

/** Whether a backend address was provided at build/runtime. */
export const IS_BACKEND_CONFIGURED = MILES_API_BASE_URL.length > 0;

/** Documented REST contract of the MILES backend (see README §API). */
export const API_ENDPOINTS = {
  status: "/api/status",
  sensors: "/api/sensors",
  sensorHistory: "/api/sensors/history",
  logs: "/api/logs",
  robotState: "/api/robot/state",
  robotCapabilities: "/api/robot/capabilities",
  robotCommands: "/api/robot/commands",
  settings: "/api/settings",
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];

/** Timeout applied to every backend request. */
export const REQUEST_TIMEOUT_MS = 8_000;

/** Default polling period; adjustable in the settings page. */
export const DEFAULT_POLL_INTERVAL_MS = 5_000;
export const POLL_INTERVAL_OPTIONS = [2_000, 5_000, 10_000, 30_000] as const;

/** Number of log entries fetched per request. */
export const LOG_FETCH_LIMIT = 200;

/** Age after which a value is considered stale. */
export const STALE_AFTER_MS = 15_000;

export const APP_NAME = "MILES";
export const APP_TAGLINE = "Console de supervision robotique";

/** Sensor history windows offered by the UI. */
export const HISTORY_RANGES = ["5m", "30m", "1h", "24h"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
  "5m": "5 minutes",
  "30m": "30 minutes",
  "1h": "1 heure",
  "24h": "24 heures",
};

/** localStorage keys (kept namespaced for future migrations). */
export const STORAGE_KEYS = {
  settings: "miles.settings.v1",
  mode: "miles.mode.v1",
  theme: "miles.theme",
} as const;
