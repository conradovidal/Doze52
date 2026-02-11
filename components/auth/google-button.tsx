"use client";

import { Button } from "@/components/ui/button";

export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      onClick={onClick}
      className="w-full"
    >
      Entrar com Google
    </Button>
  );
}
