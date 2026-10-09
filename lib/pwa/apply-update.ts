// Aplica a versão nova do app. Se já há um service worker novo esperando,
// ele assume antes do reload (é isso que renova o shell e os chunks guardados
// para uso offline); sem ele, basta recarregar.
const FALLBACK_RELOAD_MS = 2000;

export async function applyAppUpdate() {
  const container = "serviceWorker" in navigator ? navigator.serviceWorker : undefined;
  const waiting = (await container?.getRegistration())?.waiting;
  if (!container || !waiting) {
    window.location.reload();
    return;
  }

  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  container.addEventListener("controllerchange", reload, { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
  // Se o SW não assumir a tempo, recarrega mesmo assim.
  window.setTimeout(reload, FALLBACK_RELOAD_MS);
}
