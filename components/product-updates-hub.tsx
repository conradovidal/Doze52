"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChartNoAxesColumn,
  Clock3,
  ListTodo,
  Rocket,
  X,
} from "lucide-react";
import { ProfileIcon } from "@/components/profile-icon";
import { YearGrid } from "@/components/calendar/year-grid";
import {
  PRODUCT_ROADMAP_SECTIONS,
  PRODUCT_UPDATE_MILESTONES,
  type ProductRoadmapSection,
  type ProductUpdateCategory,
} from "@/lib/product-updates";
import { getTodayIsoInTimeZone } from "@/lib/date";
import { expandEventsForYear } from "@/lib/recurrence";
import { useStore } from "@/lib/store";
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

function FrozenCalendarBackdrop() {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const events = useStore((s) => s.events);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);

  const initialYear = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2025 && currentYear <= 2027 ? currentYear : 2026;
  }, []);
  const [todayIso, setTodayIso] = React.useState("");

  React.useEffect(() => {
    const browserTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTodayIso(getTodayIsoInTimeZone(browserTimeZone));
  }, []);

  const renderEvents = React.useMemo(
    () => expandEventsForYear(events, initialYear),
    [events, initialYear]
  );
  const selectedProfiles = React.useMemo(
    () => profiles.filter((profile) => selectedProfileIds.includes(profile.id)),
    [profiles, selectedProfileIds]
  );
  const visibleCategories = React.useMemo(
    () =>
      categories
        .filter(
          (category) =>
            category.visible && selectedProfileIds.includes(category.profileId)
        )
        .slice(0, 6),
    [categories, selectedProfileIds]
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-background/28 dark:bg-background/34" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.34),rgba(248,250,252,0.12))] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.18))]" />

      <div className="relative h-full w-full overflow-hidden">
        <div className="absolute inset-0 scale-[1.015] opacity-[0.52] saturate-[0.88] blur-[1.2px] dark:opacity-[0.46]">
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6">
            <div className="mb-3 space-y-1">
              <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-3 md:gap-y-0">
                <div className="justify-self-start">
                  <Image
                    src="/logo-doze52.svg"
                    alt=""
                    width={164}
                    height={36}
                    className="h-8 w-auto md:h-9"
                  />
                </div>
                <div className="min-w-0 justify-self-end md:col-start-3">
                  <div className="inline-flex h-10 items-center rounded-2xl border border-neutral-200/80 bg-white/72 px-4 text-xl font-normal text-neutral-900 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/72 dark:text-neutral-100">
                    {initialYear}
                  </div>
                </div>
                <div className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1 md:flex md:justify-center">
                  <div className="flex w-full flex-wrap justify-center gap-2 md:w-[min(56rem,calc(100vw-2rem))]">
                    {selectedProfiles.map((profile) => (
                      <span
                        key={profile.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300/90 bg-white/75 px-3 py-1 text-xs text-neutral-700 dark:border-neutral-700/90 dark:bg-neutral-900/72 dark:text-neutral-200"
                      >
                        <ProfileIcon icon={profile.icon} size={12} />
                        {profile.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mx-auto flex w-full max-w-[56rem] flex-wrap justify-center gap-2">
                {visibleCategories.map((category) => (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: category.color }}
                  >
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    {category.name}
                  </span>
                ))}
              </div>
              <div className="mx-auto h-px w-full max-w-[56rem] bg-border/60" />
            </div>

            <div className="flex-1 overflow-hidden rounded-[2rem]">
              <YearGrid
                year={initialYear}
                todayIso={todayIso}
                events={renderEvents}
                creatingRange={null}
                onEditEvent={() => {}}
                onStartCreateRange={() => {}}
                onHoverCreateRange={() => {}}
                onFinishCreateRange={() => {}}
                onMoveEventByDelta={() => {}}
                onApplyDayReorder={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductUpdatesHub() {
  const [activeSection, setActiveSection] =
    React.useState<ProductRoadmapSection["key"]>("launched");

  const currentSection =
    PRODUCT_ROADMAP_SECTIONS.find((section) => section.key === activeSection) ??
    PRODUCT_ROADMAP_SECTIONS[0];
  const CurrentIcon = SECTION_ICON[currentSection.key];

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent">
      <FrozenCalendarBackdrop />
      <div className="absolute inset-0 bg-background/22 backdrop-blur-[8px] dark:bg-background/28" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-background/76 shadow-[0_30px_120px_-60px_rgba(15,23,42,0.65)] backdrop-blur-2xl">
          <div className="flex items-start justify-end px-4 pt-4 sm:px-6 sm:pt-5">
            <Link
              href="/"
              aria-label="Fechar e voltar ao calendario"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background/78 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-6 px-5 pb-5 sm:px-8 sm:pb-8">
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
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/56 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Marco inicial
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  11 de fevereiro de 2026
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/56 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Milestones publicadas
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {PRODUCT_UPDATE_MILESTONES.length} marcos principais
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/56 px-4 py-3 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Proxima fase
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  Roadmap com backlog e votos
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
                        : "border-border/80 bg-background/72 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                );
              })}
            </div>

            <section className="rounded-[2rem] border border-border/70 bg-background/58 p-5 backdrop-blur-xl sm:p-8">
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
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/46 p-4 backdrop-blur sm:p-5">
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
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-background/42 p-6 backdrop-blur sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {currentSection.emptyStateTitle}
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {currentSection.emptyStateBody}
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
