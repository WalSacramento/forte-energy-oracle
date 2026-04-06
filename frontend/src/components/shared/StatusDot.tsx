import { cn } from "@/lib/utils";

type StatusVariant = "emerald" | "amber" | "red" | "cyan";

const COLOR_MAP: Record<StatusVariant, string> = {
  emerald: "bg-market-up",
  amber:   "bg-primary",
  red:     "bg-destructive",
  cyan:    "bg-secondary",
};

interface StatusDotProps {
  variant?: StatusVariant;
  pulse?: boolean;
  size?: number;
  label?: string;
}

export function StatusDot({
  variant = "emerald",
  pulse = true,
  size = 8,
  label,
}: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-block rounded-full",
          COLOR_MAP[variant],
          pulse && "dot-pulse"
        )}
        style={{ width: size, height: size }}
      />
      {label ? (
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
      ) : null}
    </span>
  );
}
