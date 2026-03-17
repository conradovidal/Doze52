import type { Metadata } from "next";
import { ProductUpdatesHub } from "@/components/product-updates-hub";

export const metadata: Metadata = {
  title: "Melhorias & Prioridades | doze52",
  description:
    "Acompanhe o historico de melhorias do doze52 e o espaco que vai evoluir para roadmap e priorizacao.",
};

export default function MelhoriasPage() {
  return <ProductUpdatesHub />;
}
