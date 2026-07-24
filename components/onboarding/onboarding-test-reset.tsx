"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingTestReset({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div
      className="fixed left-3 z-70 sm:left-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 3.5rem)" }}
    >
      <Button
        type="button"
        data-onboarding-test-reset
        size="sm"
        variant="outline"
        className="rounded-full bg-card/95 text-xs shadow-lg backdrop-blur"
        onClick={onReset}
      >
        <RotateCcw className="size-3.5" />
        Reiniciar onboarding
      </Button>
    </div>
  );
}
