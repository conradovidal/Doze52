import {
  FAVICON_DARK_URL,
  FAVICON_LIGHT_URL,
  THEME_STORAGE_KEY,
} from "@/lib/theme-shared";

const script = `
(() => {
  try {
    const lightFavicon = "${FAVICON_LIGHT_URL}";
    const darkFavicon = "${FAVICON_DARK_URL}";
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
    let favicon = document.querySelector('link[data-doze52-favicon="active"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("data-doze52-favicon", "active");
      document.head.appendChild(favicon);
    }
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = mode === "dark" ? darkFavicon : lightFavicon;
  } catch (_) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
