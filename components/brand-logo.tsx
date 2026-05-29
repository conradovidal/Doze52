import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  decorative?: boolean;
};

export function BrandLogo({
  alt = "Doze 52",
  className,
  decorative = false,
}: BrandLogoProps) {
  const imageAlt = decorative ? "" : alt;

  return (
    <span
      className={cn(
        "relative block h-9 w-36 overflow-visible md:h-10 md:w-40",
        className
      )}
    >
      <Image
        src="/doze52-logo-light.svg"
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        width={176}
        height={176}
        className="pointer-events-none absolute left-[-1.75rem] top-1/2 block h-40 w-40 -translate-y-1/2 object-contain dark:hidden md:left-[-1.875rem] md:h-44 md:w-44"
      />
      <Image
        src="/doze52-logo-dark.svg"
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        width={176}
        height={176}
        className="pointer-events-none absolute left-[-1.75rem] top-1/2 hidden h-40 w-40 -translate-y-1/2 object-contain dark:block md:left-[-1.875rem] md:h-44 md:w-44"
      />
    </span>
  );
}
