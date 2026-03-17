"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesColumn, Clock3, ListTodo, Rocket } from "lucide-react";
import {
  PRODUCT_ROADMAP_SECTIONS,
  PRODUCT_UPDATE_MILESTONES,
  type ProductRoadmapSection,
  type ProductUpdateCategory,
} from "@/lib/product-updates";
import { cn } from "@/lib/utils";

const SECTION_ICON = {
  launched: Rocket,
  "in-progress": Clock3,
  backlog: ListTodo,
  "top-voted": ChartNoAxesColumn,
} as const;

const CATEGORY_STYLES: Record<ProductUpdateCategory, string> = {
  Calendario:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  Perfis:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  Interface:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  Sincronizacao:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
};

export function ProductUpdatesHub() {
  const [activeSection, setActiveSection] =
    React.useState<ProductRoadmapSection["key"]>("launched");

  const currentSection =
    PRODUCT_ROADMAP_SECTIONS.find((section) => section.key === activeSection) ??
    PRODUCT_ROADMAP_SECTIONS[0];
  const CurrentIcon = SECTION_ICON[currentSection.key];

  return (
    <main className="min-h-[calc(100vh-3rem)] bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.05),_transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.12),_transparent_40%),linear-gradient(180deg,rgba(10,10,10,0.98),rgba(18,18,18,0.96))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-6 rounded-[2rem] border border-border/70 bg-background/90 px-5 py-6 shadow-[0_20px_80px_-48px_rgba(15,23,42,0.55)] backdrop-blur sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Evolucao do produto
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Melhorias &amp; Prioridades
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Acompanhe o que ja melhoramos no doze52 e o que queremos priorizar
                  em seguida. Tudo em uma leitura rapida, pensada para quem usa o
                  produto no dia a dia.
                </p>
              </div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-2 self-start rounded-full border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Voltar ao calendario
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Marco inicial
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                11 de fevereiro de 2026
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Milestones publicadas
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {PRODUCT_UPDATE_MILESTONES.length} marcos principais
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Proxima fase
              </div>
              <div className="mt-1 text-sm font-medium text-foreground">
                Roadmap com backlog e votos
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRODUCT_ROADMAP_SECTIONS.map((section) => {
            const isActive = section.key === activeSection;
            const Icon = SECTION_ICON[section.key];
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-neutral-50 shadow-sm dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-border/80 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        <section className="rounded-[2rem] border border-border/70 bg-background/92 p-5 shadow-[0_22px_80px_-52px_rgba(15,23,42,0.55)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-2 border-b border-border/70 pb-5">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              <CurrentIcon className="h-3.5 w-3.5" />
              {currentSection.eyebrow}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {currentSection.title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {currentSection.description}
            </p>
          </div>

          {activeSection === "launched" ? (
            <div className="relative mt-6 space-y-5 pl-5 sm:pl-8">
              <div className="absolute bottom-3 left-[7px] top-1 w-px bg-border sm:left-[11px]" />
              {PRODUCT_UPDATE_MILESTONES.map((milestone) => (
                <article key={milestone.dateLabel} className="relative">
                  <div className="absolute -left-5 top-2.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-neutral-900 dark:bg-neutral-100 sm:-left-8" />
                  <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {milestone.dateLabel}
                        </p>
                        <h3 className="text-lg font-semibold text-foreground">
                          {milestone.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {milestone.categories.map((category) => (
                          <span
                            key={category}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                              CATEGORY_STYLES[category]
                            )}
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                      {milestone.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-muted/20 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {currentSection.emptyStateTitle}
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                {currentSection.emptyStateBody}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
