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
      disabled={disabled}
      onClick={onClick}
      className="relative w-full border-[#747775] bg-white px-3 text-[#1f1f1f] shadow-none hover:bg-[#f8faff] hover:text-[#1f1f1f] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f2023] dark:hover:text-[#e3e3e3]"
    >
      <span
        aria-hidden="true"
        className="absolute left-3 grid size-[18px] place-items-center rounded-[2px] bg-white"
      >
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
