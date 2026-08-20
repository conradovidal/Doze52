import { NextResponse } from "next/server";
import {
  isFeedbackKind,
  isValidFeedbackMessage,
  normalizeFeedbackContext,
  normalizeFeedbackMessage,
} from "@/lib/product-feedback";
import { isSameOriginMutation } from "@/lib/feedback-server";
import {
  InvalidJsonPayloadError,
  PayloadTooLargeError,
  readLimitedJsonObject,
} from "@/lib/http-json";
import {
  getAuthenticatedServerUser,
  getSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }
  const user = await getAuthenticatedServerUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (!hasSupabaseAdminEnv) {
    return NextResponse.json({ error: "Feedback indisponível." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await readLimitedJsonObject(request, 8192);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
    }
    if (!(error instanceof InvalidJsonPayloadError)) throw error;
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const message = normalizeFeedbackMessage(body.message);
  if (!isFeedbackKind(body.kind) || !isValidFeedbackMessage(message)) {
    return NextResponse.json(
      { error: "Escolha um tipo e escreva entre 10 e 2.000 caracteres." },
      { status: 400 }
    );
  }
  if (typeof body.contactConsent !== "boolean") {
    return NextResponse.json({ error: "Consentimento inválido." }, { status: 400 });
  }

  const context = normalizeFeedbackContext(
    body.context,
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "unknown"
  );
  const contactEmail = body.contactConsent ? user.email ?? null : null;
  if (body.contactConsent && !contactEmail) {
    return NextResponse.json(
      { error: "Sua conta não possui e-mail disponível para contato." },
      { status: 400 }
    );
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "submit_product_feedback",
    {
      p_user_id: user.id,
      p_kind: body.kind,
      p_message: message,
      p_technical_context: context,
      p_contact_consent: body.contactConsent,
      p_contact_email: contactEmail,
    }
  );
  if (error) {
    if (error.message.includes("feedback_rate_limit")) {
      return NextResponse.json(
        { error: "Você atingiu o limite de cinco envios em 24 horas." },
        { status: 429 }
      );
    }
    console.error("[feedback.submit]", { code: error.code, message: error.message });
    return NextResponse.json(
      { error: "Não foi possível enviar agora. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data }, { status: 201 });
}
