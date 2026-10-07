// Cadastro com confirmação de e-mail: a conta só existe "de verdade" depois que
// a pessoa abre o link. Até lá ela segue sem login, então o que ficou pendente
// precisa ser dito na tela e sobreviver a fechar o painel.

export const EMAIL_CONFIRMATION_STORAGE_KEY = "doze52:pending-email-confirmation:v1";

// Espelha "Email OTP expiration" do Supabase (Authentication → Providers →
// Email): 3600s. Se mudar lá, mude aqui.
export const EMAIL_LINK_VALIDITY_MINUTES = 60;
export const EMAIL_RESEND_COOLDOWN_SECONDS = 30;

export type PendingEmailConfirmation = { email: string; sentAt: number };

export class EmailConfirmationRequiredError extends Error {
  email: string;
  constructor(email: string) {
    super("Confirme seu email para continuar.");
    this.name = "EmailConfirmationRequiredError";
    this.email = email;
  }
}

export const readPendingEmailConfirmation = (
  storage: Pick<Storage, "getItem">
): PendingEmailConfirmation | null => {
  try {
    const raw = storage.getItem(EMAIL_CONFIRMATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingEmailConfirmation>;
    if (typeof parsed.email !== "string" || !parsed.email) return null;
    return {
      email: parsed.email,
      sentAt: typeof parsed.sentAt === "number" ? parsed.sentAt : 0,
    };
  } catch {
    return null;
  }
};

export const writePendingEmailConfirmation = (
  storage: Pick<Storage, "setItem">,
  value: PendingEmailConfirmation
) => {
  try {
    storage.setItem(EMAIL_CONFIRMATION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sem storage o cartão some ao fechar o painel; o e-mail já foi enviado.
  }
};

export const clearPendingEmailConfirmation = (
  storage: Pick<Storage, "removeItem">
) => {
  try {
    storage.removeItem(EMAIL_CONFIRMATION_STORAGE_KEY);
  } catch {
    // Nada a limpar.
  }
};

/** O Supabase recusa o login de quem ainda não confirmou o e-mail. */
export const isEmailNotConfirmedMessage = (raw: string) =>
  raw.toLowerCase().includes("email not confirmed");

/** Segundos que faltam para liberar o reenvio (0 = liberado). */
export const resendSecondsLeft = (sentAt: number, now: number) =>
  Math.max(0, Math.ceil((sentAt + EMAIL_RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000));
