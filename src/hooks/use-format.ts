/**
 * Formatting helpers bound to the timezone chosen in the settings.
 */

import {
  formatClock,
  formatDate,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import { useSettings } from "@/state/settings";
import { useMemo } from "react";

export function useFormat() {
  const { settings } = useSettings();

  return useMemo(() => {
    const options = { timeZone: settings.timeZone };
    return {
      timeZone: settings.timeZone,
      clock: (timestamp: number) => formatClock(timestamp, options),
      dateTime: (timestamp: number) => formatDateTime(timestamp, options),
      date: (timestamp: number) => formatDate(timestamp, options),
      relative: (timestamp: number, now?: number) =>
        formatRelative(timestamp, now),
    };
  }, [settings.timeZone]);
}
