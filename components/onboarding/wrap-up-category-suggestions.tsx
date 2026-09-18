"use client";

import * as React from "react";
import { CalendarDays, Check, GripVertical, Plus, X } from "lucide-react";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
import { getCalendarPackGroupId } from "@/lib/calendar-packs/import";
import {
  CATEGORY_COLOR_BASE_GRAPHITE,
  getCategoryColorToken,
} from "@/lib/category-palette";
import type { WrapUpCategorySuggestion } from "@/lib/onboarding";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const DRAG_MIME_TYPE = "application/x-doze52-category-suggestion";

const CHIP_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-[10px] border pl-1.5 pr-3 text-[0.78rem] font-semibold shadow-none transition-all duration-200 ease-out";

function SuggestionChip({
  suggestion,
  adopted,
  tapOnly,
  onDragStart,
  onDragEnd,
  onAdopt,
}: {
  suggestion: WrapUpCategorySuggestion;
  adopted: boolean;
  // Mobile: sem arrasto nativo (Safari iOS não implementa a API), então o
  // ícone de "arraste" (GripVertical) confundia — vira um "+" comum,
  // deixando claro que um toque já basta. Desktop mantém o grip: lá o
  // arrasto funciona de verdade.
  tapOnly?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  // Toque adota direto, sem passar pelo arrasto — o drag-and-drop nativo
  // (dataTransfer) não existe em touch (Safari iOS não implementa a API),
  // então sem isto a lista de sugestões simplesmente não funciona no
  // celular. Inofensivo no desktop: continua podendo arrastar também.
  onAdopt: () => void;
}) {
  const { mode: themeMode } = useTheme();
  const colorToken = getCategoryColorToken(suggestion.color, themeMode);
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <button
      type="button"
      draggable={!adopted && !tapOnly}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_MIME_TYPE, suggestion.id);
        event.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd();
      }}
      onClick={adopted ? undefined : onAdopt}
      disabled={adopted}
      style={{
        backgroundColor: colorToken.soft,
        borderColor: colorToken.border,
        color: colorToken.text,
        opacity: adopted ? 0.55 : isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(0.96)" : "scale(1)",
      }}
      className={cn(
        CHIP_CLASS,
        adopted
          ? "cursor-default"
          : tapOnly
            ? "cursor-pointer"
            : "cursor-grab active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      )}
      aria-label={
        adopted
          ? `${suggestion.name}, já adicionada`
          : `Adicionar categoria ${suggestion.name}`
      }
    >
      {adopted ? (
        <Check className="size-3.5 shrink-0" aria-hidden="true" />
      ) : tapOnly ? (
        <Plus className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <GripVertical className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      {suggestion.name}
    </button>
  );
}

// Visualmente na mesma família dos chips de sugestão (mesma altura, mesmo
// raio), mas com borda tracejada e sem cor de categoria — sinaliza que abre
// algo (o seletor de calendários prontos) em vez de adotar na hora. Um
// calendário pronto (feriados, um clube, etc.) não é "nome + cor": tem
// variante pra escolher, então não cabe no gesto de toque único das
// sugestões de categoria.
function CalendarPackChip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        CHIP_CLASS,
        "border-dashed border-border bg-background text-foreground/80 hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      )}
    >
      <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
      Calendário pronto
    </button>
  );
}

// Tempo do "encaixe": mantém o card que está saindo com a classe de eviction
// (encolher + esmaecer, ver isEvicting em category-bar.tsx) por um instante
// antes de de fato trocar os dados, para a saída se ler como uma animação e
// não como um corte seco.
const SWAP_TRANSITION_MS = 180;

export function WrapUpCategorySuggestions({
  profileId,
  suggestions,
  cap,
  onRemoveCategory,
  onRequireAuth,
  noticeSlot,
  hideExistingCategories = false,
  children,
}: {
  profileId?: string;
  suggestions: WrapUpCategorySuggestion[];
  cap: number | null;
  // Remove uma categoria existente, incluindo as vindas de um calendário
  // pronto (ex.: Feriados) — o `deleteCategory` do store recusa essas por
  // design, então quem chama precisa saber lidar com o caminho de remoção
  // de calendário. Sem isso, cai no `deleteCategory` comum (não remove
  // calendários prontos).
  onRemoveCategory?: (categoryId: string) => boolean;
  // Repassado ao seletor de calendários prontos (chip "Calendário pronto")
  // — algum pack pode exigir conta.
  onRequireAuth?: () => void;
  // Card do guia, renderizado por último — depois das categorias e das
  // sugestões, fechando a leitura em vez de interromper o meio dela.
  noticeSlot?: React.ReactNode;
  // O mobile usa isto: a fileira "Categorias" (o que já está criado) some,
  // sobrando só a ação que importa nesse passo — escolher entre as
  // sugestões — sem competir por espaço com o resto da tela (Contextos,
  // grade do ano). O check no próprio chip já confirma a escolha. Segue
  // desmarcado no desktop, onde o painel Organizar tem espaço de sobra.
  hideExistingCategories?: boolean;
  children: React.ReactNode;
}) {
  const { mode: themeMode } = useTheme();
  const categories = useStore((s) => s.categories);
  const createCategory = useStore((s) => s.createCategory);
  const deleteCategoryFallback = useStore((s) => s.deleteCategory);
  const removeCategory = React.useCallback(
    (categoryId: string) =>
      onRemoveCategory
        ? onRemoveCategory(categoryId)
        : deleteCategoryFallback({
            categoryId,
            strategy: { type: "delete-events" },
          }),
    [onRemoveCategory, deleteCategoryFallback]
  );

  // Qualquer categoria do perfil pode ser trocada agora — não só as
  // adotadas por aqui: se a 3a posição for uma categoria criada durante a
  // prática guiada (não uma sugestão), ela também sai quando uma nova
  // sugestão é arrastada para cima.
  const profileCategories = React.useMemo(
    () =>
      categories.filter(
        (category) => !profileId || category.profileId === profileId
      ),
    [categories, profileId]
  );
  const [adopted, setAdopted] = React.useState<
    { suggestionId: string; categoryId: string }[]
  >([]);
  // Categorias que já estavam lá (ex.: "Aniversários", ou "Feriados" vindo
  // de calendário pronto) e foram arrastadas pra fora: em vez de só sumir,
  // entram nesta lista e passam a aparecer junto das sugestões — a pessoa
  // pode trocar de ideia e trazer de volta, exatamente como qualquer outra
  // sugestão. Vêm antes das sugestões fixas por serem o mais recente.
  const [evictedSuggestions, setEvictedSuggestions] = React.useState<
    WrapUpCategorySuggestion[]
  >([]);
  const allSuggestions = React.useMemo(
    () => [...evictedSuggestions, ...suggestions],
    [evictedSuggestions, suggestions]
  );
  const [calendarPackOpen, setCalendarPackOpen] = React.useState(false);
  // Mobile: um calendário pronto importado também conta como "escolhido" —
  // sem isto, "Selecionadas" só refletia sugestões de categoria, deixando
  // de fora quem tinha acabado de adicionar Feriados/Jogos/etc. categoryId
  // é a categoria de verdade criada pelo import (não o id estático do
  // pack) — é o que a remoção precisa para achar e apagar a coisa certa.
  const [importedPacks, setImportedPacks] = React.useState<
    { groupId: string; categoryId?: string; name: string; color?: string }[]
  >([]);
  const [dragOverSuggestionId, setDragOverSuggestionId] = React.useState<
    string | null
  >(null);
  const [pendingEvictingCategoryId, setPendingEvictingCategoryId] =
    React.useState<string | null>(null);
  const [enteringCategoryId, setEnteringCategoryId] = React.useState<
    string | null
  >(null);
  const dragCounterRef = React.useRef(0);
  const draggingSuggestionIdRef = React.useRef<string | null>(null);
  const enteringTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (enteringTimeoutRef.current != null) {
        window.clearTimeout(enteringTimeoutRef.current);
      }
    },
    []
  );

  const atCap = cap != null && profileCategories.length >= cap;
  const lastCategoryId =
    profileCategories[profileCategories.length - 1]?.id;

  const adoptSuggestion = React.useCallback(
    (suggestionId: string) => {
      const suggestion = allSuggestions.find((item) => item.id === suggestionId);
      if (!suggestion) return;
      if (adopted.some((entry) => entry.suggestionId === suggestion.id)) return;

      const evictingCategoryId = atCap ? lastCategoryId : undefined;
      const evictingCategory = evictingCategoryId
        ? profileCategories.find((category) => category.id === evictingCategoryId)
        : undefined;

      const commitSwap = () => {
        // Se a remoção falhar (ex.: algum bloqueio do store que não
        // previmos), não cria a nova categoria por cima — senão o limite
        // vira decoração: a contagem só cresce e nunca mais tromba no cap.
        if (evictingCategoryId && !removeCategory(evictingCategoryId)) {
          setPendingEvictingCategoryId(null);
          return;
        }
        // Mesmo destino de quem é arrastada pra fora manualmente: some da
        // fileira, mas continua disponível como sugestão, não é perdida.
        // Só cria uma entrada "evicted-" quando a categoria NÃO veio de uma
        // sugestão rastreada aqui — senão, cada ciclo escolher→trocar da
        // mesma sugestão (ex.: "Pets") criava um id novo por vez e ela
        // aparecia duplicada na fileira, uma vez por ciclo.
        const evictedWasTrackedSuggestion = evictingCategoryId
          ? adopted.some((entry) => entry.categoryId === evictingCategoryId)
          : false;
        if (evictingCategory && !evictedWasTrackedSuggestion) {
          setEvictedSuggestions((current) => [
            { id: `evicted-${evictingCategory.id}`, name: evictingCategory.name, color: evictingCategory.color },
            ...current,
          ]);
        }
        const newCategoryId = createCategory({
          name: suggestion.name,
          color: suggestion.color,
          profileId: profileId ?? "",
        });
        if (!newCategoryId) return;
        setAdopted((current) => [
          ...current.filter((entry) => entry.categoryId !== evictingCategoryId),
          { suggestionId: suggestion.id, categoryId: newCategoryId },
        ]);
        setPendingEvictingCategoryId(null);
        setEnteringCategoryId(newCategoryId);
        if (enteringTimeoutRef.current != null) {
          window.clearTimeout(enteringTimeoutRef.current);
        }
        enteringTimeoutRef.current = window.setTimeout(() => {
          setEnteringCategoryId(null);
        }, SWAP_TRANSITION_MS + 220);
      };

      if (evictingCategoryId) {
        // Deixa o card em "saindo" por um instante antes de trocar os dados,
        // para a troca aparecer como uma animação em vez de um corte seco.
        setPendingEvictingCategoryId(evictingCategoryId);
        window.setTimeout(commitSwap, SWAP_TRANSITION_MS);
      } else {
        commitSwap();
      }
    },
    [
      allSuggestions,
      adopted,
      atCap,
      lastCategoryId,
      profileCategories,
      createCategory,
      removeCategory,
      profileId,
    ]
  );

  // Mobile: toque no "x" de uma já selecionada para tirá-la de propósito —
  // sem isto, a única forma de trocar era escolher uma nova e deixar o
  // "cap atingido" decidir sozinho qual sai (sempre a última), sem
  // controle sobre qual categoria específica a pessoa queria remover.
  const removeSelectedSuggestion = React.useCallback(
    (categoryId: string) => {
      if (!removeCategory(categoryId)) return;
      setAdopted((current) =>
        current.filter((entry) => entry.categoryId !== categoryId)
      );
    },
    [removeCategory]
  );

  const removeImportedPack = React.useCallback(
    (groupId: string, categoryId?: string) => {
      if (categoryId && !removeCategory(categoryId)) return;
      setImportedPacks((current) =>
        current.filter((entry) => entry.groupId !== groupId)
      );
    },
    [removeCategory]
  );

  // Arrastar uma categoria já existente pra fora (ver DRAG_OUT_THRESHOLD_PX
  // em category-bar.tsx): não é uma exclusão de verdade, é uma troca de
  // lugar — sai da fileira, entra na lista de sugestões, disponível pra
  // voltar a qualquer momento.
  const handleDragCategoryOut = React.useCallback(
    (categoryId: string) => {
      const category = profileCategories.find((item) => item.id === categoryId);
      if (!category) return;
      if (!removeCategory(categoryId)) return;
      setEvictedSuggestions((current) => [
        { id: `evicted-${category.id}`, name: category.name, color: category.color },
        ...current,
      ]);
    },
    [profileCategories, removeCategory]
  );

  const dragOverSuggestion = dragOverSuggestionId
    ? allSuggestions.find((item) => item.id === dragOverSuggestionId)
    : undefined;

  const previewGhostSuggestion = dragOverSuggestion
    ? { name: dragOverSuggestion.name, color: dragOverSuggestion.color }
    : !atCap
      ? { name: "Arraste aqui", dashed: true }
      : null;
  const previewEvictingCategoryId =
    pendingEvictingCategoryId ??
    (dragOverSuggestion && atCap ? lastCategoryId : undefined);

  const childWithPreview = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{
          previewGhostSuggestion?: {
            name: string;
            color?: string;
            dashed?: boolean;
          } | null;
          previewEvictingCategoryId?: string;
          previewEnteringCategoryId?: string;
          onDragCategoryOut?: (categoryId: string) => void;
        }>,
        {
          previewGhostSuggestion,
          previewEvictingCategoryId,
          previewEnteringCategoryId: enteringCategoryId ?? undefined,
          onDragCategoryOut: handleDragCategoryOut,
        }
      )
    : children;

  const clearDragPreview = () => {
    dragCounterRef.current = 0;
    setDragOverSuggestionId(null);
  };

  // "Leve folga" pedida: a área de categorias só CRESCE o mínimo reservado,
  // nunca encolhe — arrastar uma pra fora não faz as sugestões e o card
  // pularem pra cima atrás dela. `useLayoutEffect` sem deps: remede a cada
  // render (a lista muda de tamanho o tempo todo aqui), e o "nunca diminui"
  // do Math.max já evita loop — o estado só muda de valor quando cresce.
  const categoriesRef = React.useRef<HTMLDivElement>(null);
  const [categoriesMinHeight, setCategoriesMinHeight] = React.useState<number>();
  // Deliberadamente sem deps: precisa remedir a cada render, não só na
  // montagem (a fileira muda de tamanho toda hora aqui). O "nunca diminui"
  // do Math.max evita o loop que o lint teme — quando o valor não cresce,
  // o setState recebe o mesmo número, React não re-renderiza, e para.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const height = categoriesRef.current?.scrollHeight;
    if (height == null) return;
    setCategoriesMinHeight((current) =>
      current == null ? height : Math.max(current, height)
    );
  });

  const selectedForDisplay = hideExistingCategories
    ? [
        ...adopted
          .map((entry) => {
            const suggestion = allSuggestions.find(
              (item) => item.id === entry.suggestionId
            );
            return suggestion
              ? {
                  key: entry.categoryId,
                  name: suggestion.name,
                  color: suggestion.color as string | undefined,
                  onRemove: () => removeSelectedSuggestion(entry.categoryId),
                }
              : null;
          })
          .filter(
            (entry): entry is {
              key: string;
              name: string;
              color: string | undefined;
              onRemove: () => void;
            } => entry != null
          ),
        ...importedPacks.map((pack) => ({
          key: pack.groupId,
          name: pack.name,
          color: pack.color,
          onRemove: () => removeImportedPack(pack.groupId, pack.categoryId),
        })),
      ]
    : [];

  return (
    <div>
      {/* Mobile: em vez da fileira "Categorias" (o que já existia antes),
          mostra só o que a pessoa escolheu agora — feedback direto de
          "isto entrou", sem competir por espaço com o resto da tela. */}
      {hideExistingCategories && selectedForDisplay.length > 0 ? (
        <div className="mb-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
            Selecionadas
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedForDisplay.map(({ key, name, color, onRemove }) => {
              const token = getCategoryColorToken(
                color ?? CATEGORY_COLOR_BASE_GRAPHITE,
                themeMode
              );
              return (
                <button
                  key={key}
                  type="button"
                  onClick={onRemove}
                  style={{
                    backgroundColor: token.soft,
                    borderColor: token.border,
                    color: token.text,
                  }}
                  className={cn(
                    CHIP_CLASS,
                    "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                  )}
                  aria-label={`Remover ${name}`}
                >
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  {name}
                  <X className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hideExistingCategories ? null : (
        <>
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
            Categorias
          </p>
          <div
            ref={categoriesRef}
            style={{ minHeight: categoriesMinHeight }}
            className="mt-2 transition-[min-height] duration-300 ease-out"
            onDragEnter={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
              dragCounterRef.current += 1;
            }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (!dragOverSuggestionId) setDragOverSuggestionId(draggingSuggestionIdRef.current);
            }}
            onDragLeave={() => {
              dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
              if (dragCounterRef.current === 0) setDragOverSuggestionId(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const suggestionId = event.dataTransfer.getData(DRAG_MIME_TYPE);
              clearDragPreview();
              if (suggestionId) adoptSuggestion(suggestionId);
            }}
          >
            {childWithPreview}
          </div>
        </>
      )}

      {/* Sugestões logo abaixo do que já está definido — sem o card entre
          os dois, a relação "isto alimenta aquilo" fica direta. O subtítulo
          substitui a antiga frase de instrução: junto de "Categorias" acima,
          os dois já dizem o que cada fileira é, sem precisar de mais texto. */}
      <div className={hideExistingCategories ? undefined : "mt-4 border-t border-border/55 pt-4"}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          Sugestões
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <CalendarPackChip onOpen={() => setCalendarPackOpen(true)} />
          {(
            // Mobile: uma vez escolhida, a sugestão "muda de lugar" — some
            // daqui e passa a viver só em "Selecionadas" acima, em vez de
            // continuar cinza nesta fileira (duplicando a mesma categoria
            // em dois lugares da tela). Desktop mantém o comportamento
            // original: fica aqui, marcada.
            hideExistingCategories
              ? allSuggestions.filter(
                  (suggestion) =>
                    !adopted.some((entry) => entry.suggestionId === suggestion.id)
                )
              : allSuggestions
          ).map((suggestion) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              adopted={adopted.some((entry) => entry.suggestionId === suggestion.id)}
              tapOnly={hideExistingCategories}
              onDragStart={() => {
                draggingSuggestionIdRef.current = suggestion.id;
              }}
              onDragEnd={clearDragPreview}
              onAdopt={() => adoptSuggestion(suggestion.id)}
            />
          ))}
        </div>
      </div>

      {/* Sem gatilho próprio (hideTrigger): abre controlado pelo chip acima.
          É um <Dialog> centralizado por baixo dos panos, não um popover
          ancorado — funciona igual sem nenhum botão visível disparando. */}
      <CalendarPackLauncher
        hideTrigger
        controlledOpen={calendarPackOpen}
        onControlledOpenChange={setCalendarPackOpen}
        fixedTargetProfileId={profileId}
        onRequireAuth={onRequireAuth}
        autoCloseOnImport
        compactList={hideExistingCategories}
        onImported={(pack) => {
          const groupId = getCalendarPackGroupId(pack);
          // Lê o store direto (não a assinatura reativa `categories` deste
          // componente, que pode não ter repropagado ainda neste mesmo
          // tick) para achar a categoria de verdade que o import acabou
          // de criar.
          const createdCategory = useStore
            .getState()
            .categories.find(
              (category) => category.calendarPackGroupId === groupId
            );
          setImportedPacks((current) =>
            current.some((entry) => entry.groupId === groupId)
              ? current
              : [
                  ...current,
                  {
                    groupId,
                    categoryId: createdCategory?.id,
                    name: pack.name,
                    color: pack.categories[0]?.color,
                  },
                ]
          );
        }}
      />

      {/* Card por último: fecha a leitura categorias → sugestões → "é isso,
          finalize" em vez de interromper o meio do fluxo. */}
      {noticeSlot ? <div className="mt-4">{noticeSlot}</div> : null}
    </div>
  );
}
