"use client";

import Image from "next/image";

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
      variant="outline"
      size="lg"
      disabled={disabled}
      onClick={onClick}
      className="relative w-full border-[#747775] bg-white px-3 text-[#1f1f1f] shadow-none hover:bg-[#f8faff] hover:text-[#1f1f1f] dark:border-[#747775] dark:bg-white dark:text-[#1f1f1f] dark:hover:bg-[#f8faff] dark:hover:text-[#1f1f1f]"
    >
      <span aria-hidden="true" className="absolute left-3 grid size-[18px] place-items-center">
        <Image
          data-google-logo
          src="/google-g.svg"
          alt=""
          width={18}
          height={18}
        />
      </span>
      <span>Entrar com Google</span>
    </Button>
  );
}
