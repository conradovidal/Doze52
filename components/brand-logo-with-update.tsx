"use client";

import { BrandLogo } from "@/components/brand-logo";
import { useAppUpdateAvailable } from "@/lib/use-app-update";
import { applyAppUpdate } from "@/lib/pwa/apply-update";

/**
 * Logo do cabeçalho. Quando há versão nova no ar, um selo discreto "Atualizar"
 * aparece junto do logo e, ao clicar, o service worker novo assume e a página recarrega na versão nova.
 */
export function BrandLogoWithUpdate() {
  const updateAvailable = useAppUpdateAvailable();

  return (
    <>
      <BrandLogo />
      {updateAvailable ? (
        <button
          type="button"
          data-app-update-badge
          onClick={() => void applyAppUpdate()}
          title="Há uma versão nova do Doze 52. Clique para atualizar."
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
        >
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          Atualizar
        </button>
      ) : null}
    </>
  );
}
