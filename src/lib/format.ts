/**
 * Pure formatting helpers. No React, no globals: components bind them to the
 * active timezone through `useFormat()`.
 */

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export interface TimeOptions {
  timeZone?: string;
}

export function formatClock(
  timestamp: number,
  { timeZone }: TimeOptions = {},
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(new Date(timestamp));
}

export function formatDateTime(
  timestamp: number,
  { timeZone }: TimeOptions = {},
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(new Date(timestamp));
}

export function formatDate(
  timestamp: number,
  { timeZone }: TimeOptions = {},
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(timestamp));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative label: "à l'instant", "il y a 4 min", "il y a 2 h". */
export function formatRelative(timestamp: number, now = Date.now()): string {
  const delta = timestamp - now;
  const abs = Math.abs(delta);
  if (abs < 45_000) return "à l'instant";
  if (abs < HOUR) return rtf.format(Math.round(delta / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(delta / HOUR), "hour");
  return rtf.format(Math.round(delta / DAY), "day");
}

/** "1 j 04 h 12 min" style duration. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Indisponible";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days} j ${String(hours).padStart(2, "0")} h`;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  return `${minutes} min`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "Indisponible";
  }
  return `${Math.round(value)} %`;
}

export function formatLatency(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) {
    return "Indisponible";
  }
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${(ms / 1_000).toFixed(1)} s`;
}

/** ISO 8601 with the active timezone — used in exports. */
export function toIso(timestamp: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone,
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}
