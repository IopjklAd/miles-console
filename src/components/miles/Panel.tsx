import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";

/**
 * The standard framed section of the console: one thin border, no shadow,
 * no nested card. Pages compose Panels instead of inventing their own boxes.
 */
export function Panel({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/70 bg-card text-card-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelTitle({
  className,
  children,
  ...props
}: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-sm font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function PanelDescription({
  className,
  children,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function PanelBody({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

/** Small label/value row used across technical readouts. */
export function DataPair({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}
