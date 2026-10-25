/**
 * Persistent banner describing the data source.
 *
 * Demo mode and a missing/unreachable backend are always announced here —
 * simulated values are never silently mixed with real measurements.
 */

import { Button } from "@/components/ui/button";
import { IS_BACKEND_CONFIGURED } from "@/config/app";
import { useMiles } from "@/state/miles";
import { FlaskConical, Plug, RefreshCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";

export function ModeBanner() {
  const { mode, connection, setMode, refresh, status } = useMiles();

  if (mode === "demo") {
    return (
      <div
        role="status"
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning"
      >
        <div className="flex items-center gap-2.5">
          <FlaskConical className="size-4 shrink-0" aria-hidden />
          <span className="font-semibold uppercase tracking-wide">
            Mode démonstration — données simulées
          </span>
          <span className="text-xs font-normal text-warning/80">
            Aucun matériel n'est contacté ; les valeurs sont générées localement.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 cursor-pointer border-warning/40 bg-transparent text-xs text-warning hover:bg-warning/10 hover:text-warning"
          onClick={() => setMode("live")}
        >
          Basculer en mode réel
        </Button>
      </div>
    );
  }

  if (connection === "unconfigured" || !IS_BACKEND_CONFIGURED) {
    return (
      <div
        role="status"
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning"
      >
        <div className="flex items-center gap-2.5">
          <Plug className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">
            Aucun backend MILES configuré
          </span>
          <span className="text-xs font-normal text-warning/80">
            Renseignez VITE_MILES_API_BASE_URL : les mesures réelles restent
            indisponibles tant que le backend n'est pas joignable.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 cursor-pointer border-warning/40 bg-transparent text-xs text-warning hover:bg-warning/10 hover:text-warning"
            onClick={() => setMode("demo")}
          >
            Essayer la démonstration
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 cursor-pointer text-xs"
            asChild
          >
            <Link to="/dashboard/parametres">Configurer</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (connection === "disconnected") {
    return (
      <div
        role="alert"
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger"
      >
        <div className="flex items-center gap-2.5">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">Connexion au backend perdue</span>
          <span className="max-w-md truncate text-xs font-normal text-danger/80">
            {status.error}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 cursor-pointer border-danger/40 bg-transparent text-xs text-danger hover:bg-danger/10 hover:text-danger"
          onClick={refresh}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Réessayer
        </Button>
      </div>
    );
  }

  return null;
}
