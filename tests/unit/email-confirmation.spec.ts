import { test, expect } from "@playwright/test";
import {
  EMAIL_CONFIRMATION_STORAGE_KEY,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  clearPendingEmailConfirmation,
  isEmailNotConfirmedMessage,
  isEmailRateLimitMessage,
  readPendingEmailConfirmation,
  resendSecondsLeft,
  writePendingEmailConfirmation,
} from "../../lib/email-confirmation";

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
};

test("a confirmação pendente sobrevive a fechar o painel e some quando limpa", () => {
  const storage = fakeStorage();
  expect(readPendingEmailConfirmation(storage)).toBeNull();
  writePendingEmailConfirmation(storage, { email: "a@b.co", sentAt: 123 });
  expect(readPendingEmailConfirmation(storage)).toEqual({ email: "a@b.co", sentAt: 123 });
  clearPendingEmailConfirmation(storage);
  expect(readPendingEmailConfirmation(storage)).toBeNull();
});

test("conteúdo inválido no storage é ignorado", () => {
  const storage = fakeStorage();
  storage.map.set(EMAIL_CONFIRMATION_STORAGE_KEY, "{nao-json");
  expect(readPendingEmailConfirmation(storage)).toBeNull();
  storage.map.set(EMAIL_CONFIRMATION_STORAGE_KEY, JSON.stringify({ email: 42 }));
  expect(readPendingEmailConfirmation(storage)).toBeNull();
});

test("reconhece a recusa de login por e-mail não confirmado", () => {
  expect(isEmailNotConfirmedMessage("Email not confirmed")).toBe(true);
  expect(isEmailNotConfirmedMessage("Invalid login credentials")).toBe(false);
});

test("o reenvio libera depois do intervalo", () => {
  const sentAt = 1_000_000;
  expect(resendSecondsLeft(sentAt, sentAt)).toBe(EMAIL_RESEND_COOLDOWN_SECONDS);
  expect(resendSecondsLeft(sentAt, sentAt + 10_000)).toBe(EMAIL_RESEND_COOLDOWN_SECONDS - 10);
  expect(resendSecondsLeft(sentAt, sentAt + EMAIL_RESEND_COOLDOWN_SECONDS * 1000)).toBe(0);
  expect(resendSecondsLeft(sentAt, sentAt + 999_999)).toBe(0);
});

test("reconhece o limite de envio de e-mails do Supabase", () => {
  expect(isEmailRateLimitMessage("email rate limit exceeded")).toBe(true);
  expect(isEmailRateLimitMessage("over_email_send_rate_limit")).toBe(true);
  expect(isEmailRateLimitMessage("Invalid login credentials")).toBe(false);
});
