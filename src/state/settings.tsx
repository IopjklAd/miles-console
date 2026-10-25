/**
 * User settings.
 *
 * Stored locally (localStorage) so the console stays usable without a backend,
 * and pushed to `PUT /api/settings` when the operator saves while a backend is
 * configured. Every value is validated on load: a corrupted store falls back
 * to defaults instead of breaking the app.
 */

import {
  DEFAULT_POLL_INTERVAL_MS,
  STORAGE_KEYS,
} from "@/config/app";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type SensorThreshold,
} from "@/miles/types";
import { liveApi } from "@/miles/api/live";
import { describeError } from "@/miles/api/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";

const thresholdSchema = z.object({
  enabled: z.boolean(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
});

const settingsSchema = z.object({
  systemName: z.string().trim().min(1).max(64),
  timeZone: z.string().min(1),
  pollIntervalMs: z.number().int().min(1_000).max(60_000),
  aiModel: z.string().min(1).max(80),
  thresholds: z.record(z.string(), thresholdSchema),
});

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...parsed.data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistLocal(settings: AppSettings): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export interface SaveResult {
  saved: boolean;
  synced: boolean;
  message: string;
}

interface SettingsContextValue {
  settings: AppSettings;
  /** Update the working copy (not persisted until `save`). */
  update: (patch: Partial<AppSettings>) => void;
  /** Persist locally, then sync to the backend when `sync` is requested. */
  save: (options?: { sync?: boolean }) => Promise<SaveResult>;
  /** Threshold changes are persisted immediately. */
  setThreshold: (sensorId: string, threshold: SensorThreshold | null) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const setThreshold = useCallback(
    (sensorId: string, threshold: SensorThreshold | null) => {
      setSettings((current) => {
        const thresholds = { ...current.thresholds };
        if (threshold === null) delete thresholds[sensorId];
        else thresholds[sensorId] = threshold;
        const next = { ...current, thresholds };
        persistLocal(next);
        return next;
      });
    },
    [],
  );

  const save = useCallback(
    async (options: { sync?: boolean } = {}): Promise<SaveResult> => {
      const stored = persistLocal(settings);
      if (!stored) {
        return {
          saved: false,
          synced: false,
          message:
            "Enregistrement local impossible (stockage du navigateur indisponible).",
        };
      }
      if (!options.sync) {
        return {
          saved: true,
          synced: false,
          message: "Paramètres enregistrés localement.",
        };
      }
      try {
        await liveApi.saveSettings(settings);
        return {
          saved: true,
          synced: true,
          message: "Paramètres enregistrés et synchronisés avec le backend.",
        };
      } catch (error) {
        return {
          saved: true,
          synced: false,
          message: `Enregistré localement — synchronisation impossible : ${describeError(error)}`,
        };
      }
    },
    [settings],
  );

  const reset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, update, save, setThreshold, reset }),
    [settings, update, save, setThreshold, reset],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export { DEFAULT_POLL_INTERVAL_MS };
