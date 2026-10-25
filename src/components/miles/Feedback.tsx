import { cn } from "@/lib/utils";
import { CircleOff, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Spinner used everywhere instead of skeleton placeholders. */
export function LoadingState({
  label = "Chargement…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Error state with a human explanation and an optional retry action. */
export function ErrorState({
  message,
  onRetry,
  retryLabel = "Réessayer",
  className,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
        <TriangleAlert className="size-5" aria-hidden />
      </span>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer gap-2"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Neutral empty state (no data yet, nothing to show). */
export function EmptyState({
  icon: Icon = CircleOff,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

/**
 * Shown when a live endpoint has nothing to give (typically: no backend
 * configured). It states the reason instead of rendering fake values.
 */
export function UnavailableNotice({
  title = "Donnée indisponible",
  description,
  action,
  className,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <CircleOff className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Inline banner (errors inside a page, degraded states…). */
export function InlineAlert({
  tone = "warning",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/30 bg-info/10 text-info",
    warning: "border-warning/35 bg-warning/10 text-warning",
    danger: "border-danger/35 bg-danger/10 text-danger",
    success: "border-success/30 bg-success/10 text-success",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          {title ? <p className="font-medium">{title}</p> : null}
          {children ? (
            <p className={cn("text-xs opacity-90", !title && "text-sm")}>
              {children}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
