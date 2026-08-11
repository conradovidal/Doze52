import { redirect } from "next/navigation";
import { CalendarPacksAdmin } from "@/components/admin/calendar-packs-admin";
import { isProductAdmin } from "@/lib/calendar-catalog/repository";
import { getAuthenticatedServerUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function CalendarPacksAdminPage() {
  const user = await getAuthenticatedServerUser();
  if (!user || !(await isProductAdmin(user.id))) redirect("/");
  return <CalendarPacksAdmin />;
}
