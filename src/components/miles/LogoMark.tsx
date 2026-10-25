import { cn } from "@/lib/utils";

/**
 * Logo slot.
 *
 * No official MILES logo has been provided, so the interface uses a neutral
 * placeholder mark. Replace this component with the official asset when it
 * exists — every header/sidebar occurrence imports it from here.
 */
export function LogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-7 text-xs",
    md: "size-8 text-sm",
    lg: "size-11 text-base",
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono font-bold text-primary",
        sizes[size],
        className,
      )}
    >
      M
    </span>
  );
}
