import type { Metadata } from "next";
import { ProductUpdatesHub } from "@/components/product-updates-hub";
import { loadServerViewerFeedbackSnapshot } from "@/lib/product-feedback-server";

export const metadata: Metadata = {
  title: "Melhorias & Prioridades | doze52",
  description:
    "Acompanhe o histórico do produto, participe da priorização da comunidade e veja o que vem depois no doze52.",
};

export const dynamic = "force-dynamic";

export default async function MelhoriasPage() {
  const initialSnapshot = await loadServerViewerFeedbackSnapshot();

  return <ProductUpdatesHub initialSnapshot={initialSnapshot} />;
}
