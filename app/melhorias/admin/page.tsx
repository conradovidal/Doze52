import type { Metadata } from "next";
import { ProductFeedbackAdmin } from "@/components/product-feedback-admin";

export const metadata: Metadata = {
  title: "Moderacao | Melhorias & Prioridades | doze52",
  description: "Area administrativa do hub de melhorias do doze52.",
};

export const dynamic = "force-dynamic";

export default function MelhoriasAdminPage() {
  return <ProductFeedbackAdmin />;
}
