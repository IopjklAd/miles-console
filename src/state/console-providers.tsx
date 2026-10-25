/**
 * Providers of the authenticated console (settings + system state).
 *
 * They wrap the shell so every page shares one polling loop and one
 * notification centre, while the public landing page stays free of them.
 */

import { MilesProvider } from "@/state/miles";
import { SettingsProvider } from "@/state/settings";
import type { ReactNode } from "react";

export function ConsoleProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <MilesProvider>{children}</MilesProvider>
    </SettingsProvider>
  );
}
