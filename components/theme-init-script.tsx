import { THEME_STORAGE_KEY } from "@/lib/theme-shared";

const script = `
(() => {
  try {
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
  } catch (_) {}
})();
`;

export function ThemeInitScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
