import { SW_SOURCE } from "@/lib/pwa/sw-source";

// Avaliado uma vez no build: o id muda a cada deploy, o que muda os bytes do
// service worker e faz o navegador instalar a versão nova.
export const dynamic = "force-static";

const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

export function GET() {
  return new Response(SW_SOURCE.replace("__BUILD_ID__", BUILD_ID), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // O navegador precisa revalidar o SW em toda checagem de atualização.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
