"use client";

import * as React from "react";
import {
  Check,
  ChevronRight,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { AsyncButtonState } from "@/components/ui/async-state-button";
import { getCategoryColorToken } from "@/lib/category-palette";
import { cn } from "@/lib/utils";

// Linguagem visual do card do Pro aplicada às telas do menu de conta:
// cabeçalho centralizado (ícone, sobrelinha, título, descrição) e listas em
// card com ícones nas cores das categorias.

export const PANEL_EYEBROW_CLASS =
  "text-[10px] font-semibold uppercase tracking-[0.16em]";

/** Ícone redondo na cor de uma categoria; sem cor, usa o tom neutro. */
export function PanelIcon({
  icon: Icon,
  color,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  color?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const token = color ? getCategoryColorToken(color) : null;
  const large = size === "lg";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        large ? "size-11 border" : "size-8",
        !token && "border-border bg-muted text-foreground",
        className
      )}
      style={
        token
          ? { backgroundColor: token.soft, borderColor: token.border, color: token.text }
          : undefined
      }
    >
      <Icon className={large ? "size-[18px]" : "size-4"} />
    </span>
  );
}

export function PanelHero({
  media,
  eyebrow,
  title,
  description,
  className,
  children,
}: {
  media?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("px-2 text-center", className)}>
      {media ? <div className="flex justify-center">{media}</div> : null}
      {eyebrow ? (
        <p className={cn(PANEL_EYEBROW_CLASS, "mt-3.5 inline-flex items-center gap-1.5 text-primary")}>
          {eyebrow}
        </p>
      ) : null}
      <h3
        className={cn(
          "text-balance text-xl font-semibold leading-7 tracking-[-0.01em] text-foreground",
          eyebrow ? "mt-1.5" : media ? "mt-4" : undefined
        )}
      >
        {title}
      </h3>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-[26rem] text-pretty text-sm leading-[1.375rem] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Card com linhas separadas por fios; `title` vira a sobrelinha acima e
 * `hint`, uma observação curta alinhada à direita na mesma linha.
 */
export function PanelList({
  title,
  hint,
  className,
  children,
}: {
  title?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      {title ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
          <p className={cn(PANEL_EYEBROW_CLASS, "text-muted-foreground")}>{title}</p>
          {hint ? <p className="min-w-0 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-border bg-card [&>*+*]:border-t [&>*+*]:border-border/60">
        {children}
      </div>
    </section>
  );
}

const STATE_ICONS: Record<Exclude<AsyncButtonState, "idle">, LucideIcon> = {
  pending: LoaderCircle,
  success: Check,
  error: TriangleAlert,
};

type PanelRowProps = {
  icon: LucideIcon;
  color?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Padrão: seta (navegação). `false` para ações que não abrem outra tela. */
  trailing?: React.ReactNode | false;
  iconClassName?: string;
  danger?: boolean;
  /** Estado assíncrono: troca o ícone e a descrição pelo rótulo do estado. */
  state?: AsyncButtonState;
  stateLabels?: Partial<Record<Exclude<AsyncButtonState, "idle">, React.ReactNode>>;
} & (
  | ({ href: string } & Omit<React.ComponentProps<"a">, "title">)
  | ({ href?: undefined } & Omit<React.ComponentProps<"button">, "title">)
);

export function PanelRow({
  icon,
  color,
  title,
  description,
  trailing,
  iconClassName,
  danger = false,
  state = "idle",
  stateLabels,
  className,
  ...props
}: PanelRowProps) {
  const busy = state !== "idle";
  const rowIcon = busy ? STATE_ICONS[state] : icon;
  const content = (
    <>
      <PanelIcon
        icon={rowIcon}
        color={danger ? undefined : color}
        className={cn(
          danger && "bg-rose-500/10 text-rose-600 dark:text-rose-300",
          state === "pending" && "[&>svg]:animate-spin motion-reduce:[&>svg]:animate-none",
          iconClassName
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-medium leading-5 text-foreground",
            danger && "text-rose-700 dark:text-rose-200"
          )}
        >
          {title}
        </span>
        {busy || description ? (
          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground" aria-live="polite">
            {busy ? stateLabels?.[state] ?? description : description}
          </span>
        ) : null}
      </span>
      {trailing === false
        ? null
        : trailing ?? <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
    </>
  );
  const rowClass = cn(
    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-55",
    danger && "hover:bg-rose-500/8",
    className
  );

  if (props.href !== undefined) {
    return (
      <a className={rowClass} {...(props as React.ComponentProps<"a">)}>
        {content}
      </a>
    );
  }
  const { disabled, ...buttonProps } = props as React.ComponentProps<"button">;
  return (
    <button
      type="button"
      className={rowClass}
      disabled={disabled || state === "pending"}
      aria-busy={state === "pending" || undefined}
      {...buttonProps}
    >
      {content}
    </button>
  );
}
