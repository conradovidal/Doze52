import { expect, test } from "@playwright/test";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

test("manifest cumpre o contrato de instalação (TWA incluso)", { tag: "@desktop" }, async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();

  // `id` fixo: é a identidade do app instalado e do futuro TWA.
  expect(manifest).toMatchObject({
    id: "/",
    name: "Doze 52",
    short_name: "Doze 52",
    lang: "pt-BR",
    scope: "/",
    display: "standalone",
    start_url: "/?source=pwa",
  });
  expect(manifest.categories).toEqual(expect.arrayContaining(["productivity"]));

  const icons: ManifestIcon[] = manifest.icons;
  const has = (sizes: string, purpose: string) =>
    icons.some(
      (icon) =>
        icon.sizes === sizes &&
        icon.type === "image/png" &&
        (icon.purpose ?? "any") === purpose
    );
  expect(has("192x192", "any")).toBe(true);
  expect(has("512x512", "any")).toBe(true);
  expect(has("512x512", "maskable")).toBe(true);

  // Cada ícone declarado tem que existir e ter o tamanho anunciado.
  for (const icon of icons.filter((item) => item.type === "image/png")) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok(), icon.src).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
    const body = await iconResponse.body();
    // Cabeçalho PNG: largura e altura nos bytes 16-23.
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
  }
});

test("iOS recebe apple-touch-icon em PNG de 180px", { tag: "@mobile" }, async ({
  page,
  request,
}) => {
  await page.goto("/");
  const link = page.locator('link[rel="apple-touch-icon"]');
  await expect(link).toHaveCount(1);
  const href = await link.getAttribute("href");
  expect(href).toBe("/icons/apple-touch-icon.png");

  const response = await request.get(href!);
  expect(response.headers()["content-type"]).toContain("image/png");
  const body = await response.body();
  expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`).toBe("180x180");

  const capable = await page
    .locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]')
    .count();
  expect(capable).toBeGreaterThan(0);
});
