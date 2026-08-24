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
    label: "Anual",
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

export const resolveInitialProductDestination = ({
  search,
  isMobile,
}: {
  search: string;
  isMobile: boolean;
}): ProductDestinationId => {
  const requested = new URLSearchParams(search).get("surface");
  if (isProductDestinationId(requested)) return requested;
  return isMobile ? "habits" : "annual";
};

export const buildProductDestinationUrl = (
  currentUrl: string,
  destination: ProductDestinationId
) => {
  const url = new URL(currentUrl);
  url.searchParams.set("surface", destination);
  return `${url.pathname}${url.search}${url.hash}`;
};
