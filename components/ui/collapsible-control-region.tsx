"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CollapsibleControlRegion({
  id,
  expanded,
  children,
  className,
  contentClassName,
}: {
  id: string;
  expanded: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div
      id={id}
      aria-hidden={!expanded}
      inert={!expanded ? true : undefined}
      className={cn(
        "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        expanded
          ? "grid-rows-[1fr] translate-y-0 opacity-100"
          : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0",
        className
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-[padding,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
