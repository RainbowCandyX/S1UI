import type { ReactNode } from "react";

export type StatusTone = "success" | "info" | "warning" | "danger" | "neutral" | "brand";

interface Props {
  tone: StatusTone;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
}

export default function StatusBadge({ tone, children, dot = true, pulse = false }: Props) {
  return (
    <span className={`status-badge is-${tone}`}>
      {dot && <span className={`dot${pulse ? " pulse" : ""}`} />}
      {children}
    </span>
  );
}
