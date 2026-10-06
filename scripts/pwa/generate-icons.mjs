// Gera os ícones PNG do PWA a partir de public/icon.svg.
// Uso: node scripts/pwa/generate-icons.mjs
//
// O glifo "52" do SVG não está centralizado na tela de 1500x1500, então
// recentramos mexendo só no viewBox. Os ícones "maskable" precisam do glifo
// dentro do círculo central de 80% (safe zone), por isso usam uma tela maior.
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..", "..");
const source = await readFile(path.join(root, "public", "icon.svg"), "utf8");

// Centro do glifo e raio do menor círculo que o contém, em unidades do SVG.
const GLYPH_CENTER = { x: 764, y: 807 };
const GLYPH_RADIUS = 646;

const render = async (canvas, size, file) => {
  const x = GLYPH_CENTER.x - canvas / 2;
  const y = GLYPH_CENTER.y - canvas / 2;
  const svg = source
    .replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${canvas} ${canvas}"`)
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log(`${path.relative(root, file)} (${size}x${size})`);
};

await mkdir(path.join(root, "public", "icons"), { recursive: true });

const ANY_CANVAS = 1500;
// Glifo dentro de 40% do lado a partir do centro, com folga.
const MASKABLE_CANVAS = Math.ceil((GLYPH_RADIUS / 0.4) * 1.05);

await render(ANY_CANVAS, 192, path.join(root, "public/icons/icon-192.png"));
await render(ANY_CANVAS, 512, path.join(root, "public/icons/icon-512.png"));
await render(MASKABLE_CANVAS, 512, path.join(root, "public/icons/icon-maskable-512.png"));
await render(ANY_CANVAS, 180, path.join(root, "public/icons/apple-touch-icon.png"));
