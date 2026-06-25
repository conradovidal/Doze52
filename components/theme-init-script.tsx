import {
  FAVICON_DARK_URL,
  FAVICON_LIGHT_URL,
  THEME_CHROME_COLOR_DARK,
  THEME_CHROME_COLOR_LIGHT,
  THEME_STORAGE_KEY,
} from "@/lib/theme-shared";

const script = `
(() => {
  try {
    const lightFavicon = "${FAVICON_LIGHT_URL}";
    const darkFavicon = "${FAVICON_DARK_URL}";
    const lightThemeColor = "${THEME_CHROME_COLOR_LIGHT}";
    const darkThemeColor = "${THEME_CHROME_COLOR_DARK}";
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
    const themeColor = mode === "dark" ? darkThemeColor : lightThemeColor;
    const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
    if (themeColorMetas.length === 0) {
      const themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      themeColorMeta.content = themeColor;
      document.head.appendChild(themeColorMeta);
    } else {
      themeColorMetas.forEach((meta) => {
        meta.setAttribute("content", themeColor);
      });
    }
  } catch (_) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
