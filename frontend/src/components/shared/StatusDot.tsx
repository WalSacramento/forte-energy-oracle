type StatusVariant = "emerald" | "amber" | "red" | "cyan";

const COLOR_MAP: Record<StatusVariant, string> = {
  emerald: "var(--emerald)",
  amber:   "var(--amber)",
  red:     "var(--red)",
  cyan:    "var(--cyan)",
};

interface StatusDotProps {
  variant?: StatusVariant;
  pulse?: boolean;
  size?: number;
  label?: string;
}

export function StatusDot({ variant = "emerald", pulse = true, size = 8, label }: StatusDotProps) {
  const color = COLOR_MAP[variant];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={pulse ? "dot-pulse" : ""}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          flexShrink: 0,
        }}
      />
      {label && (
        <span className="font-data text-xs" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
    </span>
  );
}
