// Código do service worker, servido por app/sw.js/route.ts com o id do build
// embutido: cada deploy muda os bytes de /sw.js, que é o que faz o navegador
// detectar a versão nova.
//
// Regra de ouro: este SW só guarda o que é igual para todo mundo — o shell
// estático de "/" e arquivos com hash. Nada de dados do usuário passa por
// aqui: o sync fala direto com o Supabase (outro domínio) e as rotas
// /api, /auth e /admin nunca são interceptadas.
export const SW_SOURCE = `
const VERSION = "__BUILD_ID__";
const CACHE = "doze52-" + VERSION;
const SHELL_URL = "/";
const NAVIGATION_TIMEOUT_MS = 4000;
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const STATIC_FILES = ["/icon.svg", "/manifest.webmanifest"];
const BYPASS_PREFIXES = ["/api/", "/auth/", "/admin/", "/_next/data/"];

const OFFLINE_HTML =
  '<!doctype html><html lang="pt-BR"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Doze 52</title>" +
  '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;color:#181818;background:#fcfbfa">' +
  "<main><h1 style='font-size:20px'>Sem conexão</h1>" +
  "<p style='color:#666'>Abra o Doze 52 de novo quando a internet voltar.</p></main></body></html>";

const isStaticAsset = (url) =>
  STATIC_FILES.includes(url.pathname) ||
  STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

// Só respostas completas e sem cookie entram no cache.
const isCacheable = (response) =>
  response.ok &&
  response.status === 200 &&
  !response.redirected &&
  !response.headers.has("set-cookie");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const shell = await fetch(SHELL_URL, { cache: "reload" });
      if (!isCacheable(shell)) return;
      // O HTML estático lista os arquivos que ele precisa; guardá-los agora
      // faz o app abrir offline já depois da primeira visita (os pedidos da
      // primeira carga aconteceram antes de o SW controlar a página).
      const html = await shell.clone().text();
      await cache.put(SHELL_URL, shell);
      const assets = new Set(html.match(/\\/_next\\/static\\/[^"'\\\\\\s)]+/g) || []);
      await Promise.all(
        [...assets].map((asset) =>
          cache.add(asset).catch(() => undefined)
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("doze52-") && key !== CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

const networkFirstShell = async (request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(SHELL_URL);
  try {
    const controller = new AbortController();
    const timer = cached
      ? setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS)
      : undefined;
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (isCacheable(response) && response.headers.get("content-type")?.includes("text/html")) {
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    return (
      cached ||
      new Response(OFFLINE_HTML, {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    );
  }
};

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) await cache.put(request, response.clone());
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (request.mode === "navigate") {
    // Só a tela principal tem shell; qualquer outra navegação vai direto à rede.
    if (url.pathname === SHELL_URL) event.respondWith(networkFirstShell(request));
    return;
  }

  if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});
`;
