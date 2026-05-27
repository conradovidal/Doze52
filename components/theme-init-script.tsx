import { THEME_FAVICON_URLS, THEME_STORAGE_KEY } from "@/lib/theme-shared";

const script = `
(() => {
  try {
    const favicons = ${JSON.stringify(THEME_FAVICON_URLS)};
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const mode =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
    root.style.colorScheme = mode;
    let favicon = document.querySelector('link[rel="icon"][data-doze52-theme-favicon="active"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/svg+xml";
      favicon.dataset.doze52ThemeFavicon = "active";
      document.head.appendChild(favicon);
    }
    favicon.href = favicons[mode];
  } catch (_) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
