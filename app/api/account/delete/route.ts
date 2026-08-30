import { NextResponse } from "next/server";

import { cancelActiveSubscriptionsForUser } from "@/lib/billing";
import {
  getAuthenticatedServerUser,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST() {
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseAdminEnv) {
    return NextResponse.json(
      { error: "Exclusão de conta indisponível neste ambiente." },
      { status: 500 }
    );
  }

  try {
    await cancelActiveSubscriptionsForUser(user.id);
  } catch (error) {
    console.error("[account.delete] cancel subscription failed", error);
    return NextResponse.json(
      {
        error:
          "Não foi possível cancelar sua assinatura ativa. Tente novamente ou fale com o suporte.",
      },
      { status: 500 }
    );
  }

  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (error) {
    console.error("[account.delete] delete user failed", error);
    return NextResponse.json(
      { error: "Não foi possível excluir sua conta agora." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
