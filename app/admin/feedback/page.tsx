import { notFound } from "next/navigation";
import { AdminFeedbackPanel } from "@/components/feedback/admin-feedback-panel";
import { getFeedbackAdminUser } from "@/lib/feedback-server";

export const dynamic = "force-dynamic";

export default async function FeedbackAdminPage() {
  if (!(await getFeedbackAdminUser())) notFound();
  return <AdminFeedbackPanel />;
}
