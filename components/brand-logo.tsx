import Image from "next/image";
import { THEME_ASSET_VERSION } from "@/lib/theme-shared";
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
        "inline-flex h-9 w-[96px] items-center md:h-10 md:w-[104px]",
        className
      )}
    >
      <Image
        src={`/doze52-logo-light.svg?v=${THEME_ASSET_VERSION}`}
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        width={104}
        height={26}
        priority
        sizes="104px"
        className="pointer-events-none block h-auto w-full object-contain object-left dark:hidden"
      />
      <Image
        src={`/doze52-logo-dark.svg?v=${THEME_ASSET_VERSION}`}
        alt={imageAlt}
        aria-hidden={decorative || undefined}
        width={104}
        height={26}
        priority
        sizes="104px"
        className="pointer-events-none hidden h-auto w-full object-contain object-left dark:block"
      />
    </span>
  );
}
