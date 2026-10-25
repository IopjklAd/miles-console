/**
 * Vue d'ensemble — first screen of the console.
 *
 * Answers three questions immediately: is the system fine, where does the
 * data come from, and what happened recently.
 */

import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatusCards } from "@/components/dashboard/StatusCards";
import { ErrorState, LoadingState } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";
import { useMiles } from "@/state/miles";
import { useSettings } from "@/state/settings";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

export default function Dashboard() {
  const { status, refresh, refreshing, lastUpdate } = useMiles();
  const { settings } = useSettings();
  const format = useFormat();

  let body: React.ReactNode;

  if (status.data) {
    body = (
      <div className="flex flex-col gap-6">
        <StatusCards status={status.data} />
        <MetricsPanel status={status.data} />
      </div>
    );
  } else if (status.error) {
    body = (
      <ErrorState
        message={status.error}
        onRetry={refresh}
        retryLabel="Réessayer la connexion"
      />
    );
  } else {
    body = <LoadingState label="Interrogation du système…" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <PageHeader
        title="Vue d'ensemble"
        description={
          <span>
            État de{" "}
            <span className="font-medium text-foreground">
              {settings.systemName}
            </span>
            {" · "}
            {lastUpdate
              ? `mise à jour ${format.relative(lastUpdate)}`
              : "en attente de la première réponse"}
          </span>
        }
        actions={
          <>
            {lastUpdate ? (
              <span className="mono-value hidden text-xs text-muted-foreground sm:inline">
                {format.dateTime(lastUpdate)}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer gap-2"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("size-4", refreshing && "animate-spin")}
                aria-hidden
              />
              Actualiser
            </Button>
          </>
        }
      />

      {body}

      <div className="grid gap-6 lg:grid-cols-3">
        <ActivityTimeline className="lg:col-span-2" />
        <QuickActions />
      </div>
    </motion.div>
  );
}
