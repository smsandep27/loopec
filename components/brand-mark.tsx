import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
  className?: string;
};

export function BrandMark({ compact = false, className = "" }: BrandMarkProps) {
  const height = compact ? 22 : 30;
  const width = Math.round(height * (676 / 316));

  return (
    <span
      className={`brand-mark${compact ? " brand-mark-compact" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <Image
        src="/logo.png"
        alt="LOOPEC Logo"
        width={width}
        height={height}
        priority
        className="h-full w-auto object-contain"
      />
    </span>
  );
}
