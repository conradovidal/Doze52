import { test, expect } from "@playwright/test";
import {
  INSTALL_INVITE_COOLDOWN_MS,
  getInstallOption,
  isIosDevice,
  isStandaloneDisplay,
  shouldShowInvite,
} from "../../lib/pwa/install";

const base = {
  standalone: false,
  installed: false,
  hasPromptEvent: false,
  isIos: false,
  accountSynced: false,
};

test("Chrome/Android: oferece quando o navegador entregou o prompt", () => {
  expect(getInstallOption({ ...base, hasPromptEvent: true })).toBe("prompt");
});

test("já instalado ou em modo app: não oferece nada", () => {
  expect(getInstallOption({ ...base, hasPromptEvent: true, standalone: true })).toBeNull();
  expect(getInstallOption({ ...base, hasPromptEvent: true, installed: true })).toBeNull();
  expect(getInstallOption({ ...base, isIos: true, accountSynced: true, standalone: true })).toBeNull();
});

test("iOS só recebe o guia com conta logada e sincronizada", () => {
  expect(getInstallOption({ ...base, isIos: true })).toBeNull();
  expect(getInstallOption({ ...base, isIos: true, accountSynced: true })).toBe("ios-guide");
});

test("sem prompt e fora do iOS não há o que oferecer", () => {
  expect(getInstallOption({ ...base, accountSynced: true })).toBeNull();
});

test("detecta modo app pelo display-mode, pelo iOS e pelo TWA", () => {
  const media = (matches: boolean) => () => ({ matches });
  expect(isStandaloneDisplay({ matchMedia: media(true) })).toBe(true);
  expect(isStandaloneDisplay({ matchMedia: media(false), navigator: { standalone: true } })).toBe(true);
  expect(
    isStandaloneDisplay({
      matchMedia: media(false),
      document: { referrer: "android-app://br.com.doze52.twa" },
    })
  ).toBe(true);
  expect(
    isStandaloneDisplay({ matchMedia: media(false), document: { referrer: "https://google.com/" } })
  ).toBe(false);
});

test("detecta iPhone, iPad e o iPadOS que se apresenta como Mac", () => {
  expect(isIosDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" })).toBe(true);
  expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  expect(isIosDevice({ userAgent: "Mozilla/5.0 (Linux; Android 14)" })).toBe(false);
});

test("o convite respeita o intervalo de 30 dias", () => {
  const now = Date.now();
  expect(shouldShowInvite(null, now)).toBe(true);
  expect(shouldShowInvite(now - 1000, now)).toBe(false);
  expect(shouldShowInvite(now - INSTALL_INVITE_COOLDOWN_MS + 1000, now)).toBe(false);
  expect(shouldShowInvite(now - INSTALL_INVITE_COOLDOWN_MS, now)).toBe(true);
});
