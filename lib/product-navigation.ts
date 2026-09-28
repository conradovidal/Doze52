export type ProductDestinationId = "annual" | "habits";

export type ProductDestination = {
  id: ProductDestinationId;
  label: string;
  icon: "calendar-days" | "circle-check";
  href: string;
};

export const PRODUCT_DESTINATIONS: readonly ProductDestination[] = [
  {
    id: "annual",
    label: "Eventos",
    icon: "calendar-days",
    href: "/?surface=annual",
  },
  {
    id: "habits",
    label: "Hábitos",
    icon: "circle-check",
    href: "/?surface=habits",
  },
] as const;

export const isProductDestinationId = (
  value: string | null
): value is ProductDestinationId => value === "annual" || value === "habits";

const LAST_DESTINATION_STORAGE_KEY = "doze52:last-surface:v1";

// Última tela usada neste navegador. É o que traz a pessoa de volta para onde
// parou quando o app abre sem `?surface` — o app instalado sempre abre em
// "/", então sem isso toda abertura cairia no padrão, não na última tela.
export const readLastProductDestination = (): ProductDestinationId | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LAST_DESTINATION_STORAGE_KEY);
    return isProductDestinationId(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const writeLastProductDestination = (
  destination: ProductDestinationId
) => {
  try {
    window.localStorage.setItem(LAST_DESTINATION_STORAGE_KEY, destination);
  } catch {
    // Sem storage a abertura só volta ao padrão (Eventos) — nada se perde.
  }
};

// Ordem: o endereço pedido explicitamente, depois a última tela usada, e só
// então Eventos. Mobile e desktop seguem a mesma regra: os dois compartilham
// o mesmo ano, e a entrada em Hábitos só é imposta pela jornada mobile
// enquanto ela está em andamento (ver app/page.tsx).
export const resolveInitialProductDestination = ({
  search,
  lastDestination = null,
}: {
  search: string;
  lastDestination?: ProductDestinationId | null;
}): ProductDestinationId => {
  const requested = new URLSearchParams(search).get("surface");
  if (isProductDestinationId(requested)) return requested;
  return lastDestination ?? "annual";
};

export const buildProductDestinationUrl = (
  currentUrl: string,
  destination: ProductDestinationId
) => {
  const url = new URL(currentUrl);
  url.searchParams.set("surface", destination);
  return `${url.pathname}${url.search}${url.hash}`;
};
