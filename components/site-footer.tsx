const socialLinks = [
  {
    label: "Instagram",
    href: "https://instagram.com/doze.52",
    ariaLabel: "Instagram do doze52",
    external: true,
  },
  {
    label: "X",
    href: "https://x.com/doze_52",
    ariaLabel: "Perfil do doze52 no X",
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/conradovidal/Doze52",
    ariaLabel: "Repositorio do doze52 no GitHub",
    external: true,
  },
  {
    label: "Contato",
    href: "mailto:doze52cal@gmail.com",
    ariaLabel: "Contato por email do doze52",
    external: false,
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-none flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} doze52</p>
        <nav aria-label="Redes do doze52" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {socialLinks.map((link, index) => (
            <span key={link.label} className="inline-flex items-center gap-2">
              <a
                href={link.href}
                aria-label={link.ariaLabel}
                className="transition-colors hover:text-foreground"
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
              >
                {link.label}
              </a>
              {index < socialLinks.length - 1 ? (
                <span className="hidden text-muted-foreground/60 sm:inline">|</span>
              ) : null}
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
