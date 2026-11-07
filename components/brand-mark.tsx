import { Orbit } from "lucide-react";

type BrandMarkProps = { compact?: boolean };

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className={`brand-mark${compact ? " brand-mark-compact" : ""}`} aria-hidden="true">
      <Orbit size={compact ? 18 : 21} strokeWidth={2.25} />
    </span>
  );
}
