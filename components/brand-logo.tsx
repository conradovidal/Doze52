import Image from "next/image";
import { THEME_ASSET_VERSION } from "@/lib/theme-shared";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  alt?: string;
  className?: string;
  decorative?: boolean;
};

export function BrandLogo({
  alt = "Doze52",
  className,
  decorative = false,
}: BrandLogoProps) {
  const imageAlt = decorative ? "" : alt;

  return (
    <span
      className={cn(
        "relative block h-9 w-[7.5rem] overflow-visible md:h-10 md:w-32",
        className
      )}
    >
      <Image
        src={`/doze52-logo-light.svg?v=${THEME_ASSET_VERSION}`}
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        priority
        width={176}
        height={176}
        priority
        className="pointer-events-none absolute left-[-1.65rem] top-1/2 block h-44 w-44 -translate-y-1/2 object-contain dark:hidden md:left-[-1.75rem] md:h-48 md:w-48"
      />
      <Image
        src={`/doze52-logo-dark.svg?v=${THEME_ASSET_VERSION}`}
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        priority
        width={176}
        height={176}
        priority
        className="pointer-events-none absolute left-[-1.65rem] top-1/2 hidden h-44 w-44 -translate-y-1/2 object-contain dark:block md:left-[-1.75rem] md:h-48 md:w-48"
      />
    </span>
  );
}
