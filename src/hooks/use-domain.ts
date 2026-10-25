/**
 * On-demand domain loader for pages that must NOT join the global polling
 * loop (services, vision, audio): the dashboard stays at three requests per
 * cycle, while these pages fetch when they are actually opened.
 *
 * Behaviour: fetch on mount, auto-refresh every `intervalMs` while the tab is
 * visible, refresh immediately when the tab comes back, manual `refresh()`.
 * Errors never throw to React: they surface as `error` so the page can render
 * an `ErrorState` with a retry.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface DomainView<T> {
  data: T | null;
  error: string | null;
  /** No data yet and nothing in flight — render a spinner. */
  loading: boolean;
  /** A request is in flight (initial load or refresh). */
  refreshing: boolean;
  updatedAt: number | null;
  refresh: () => void;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erreur inconnue.";
}

export function useDomain<T>(
  fetcher: () => Promise<T>,
  options: { intervalMs?: number; deps?: readonly unknown[] } = {},
): DomainView<T> {
  const { intervalMs = 15_000, deps = [] } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const fetcherRef = useRef(fetcher);

  // Always call the latest fetcher (mode switches, settings changes) without
  // re-running the effect cycle on every render.
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const value = await fetcherRef.current();
      setData(value);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const loadIfVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    const interval = window.setInterval(loadIfVisible, intervalMs);
    document.addEventListener("visibilitychange", loadIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", loadIfVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's identity (api, settings…)
  }, [load, intervalMs, ...deps]);

  return {
    data,
    error,
    loading: refreshing && data === null && error === null,
    refreshing,
    updatedAt,
    refresh: () => void load(),
  };
}
