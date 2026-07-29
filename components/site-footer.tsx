"use client";

import * as React from "react";
import { Github, Instagram } from "lucide-react";

function BrandXIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M18.9 2h3.1l-6.78 7.75L23.2 22h-6.27l-4.91-6.4L6.4 22H3.3l7.24-8.28L.8 2h6.43l4.44 5.85L18.9 2Zm-1.1 18h1.72L6.29 3.9H4.45L17.8 20Z" />
    </svg>
  );
}

type FooterLink = {
  label: string;
  href: string;
  ariaLabel: string;
  external: boolean;
  icon: React.ComponentType<{ className?: string }>;
};

export function SiteFooter() {
  const supportEmail = "doze52cal@gmail.com";
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${encodeURIComponent(supportEmail)}`;
  const mailtoUrl = `mailto:${supportEmail}`;

  const socialLinks: FooterLink[] = [
    {
      label: "Instagram",
      href: "https://instagram.com/doze.52",
      ariaLabel: "Instagram do doze52",
      external: true,
      icon: Instagram,
    },
    {
      label: "X",
      href: "https://x.com/doze_52",
      ariaLabel: "Perfil do Doze 52 no X",
      external: true,
      icon: BrandXIcon,
    },
    {
      label: "GitHub",
      href: "https://github.com/conradovidal/Doze52",
      ariaLabel: "Repositorio do doze52 no GitHub",
      external: true,
      icon: Github,
    },
  ];

  return (
    <footer className="shrink-0 border-t border-border/70 bg-background">
      <div className="mx-auto flex w-full max-w-none items-center justify-between gap-2 px-3 py-1 text-[10px] leading-none text-muted-foreground sm:px-4 sm:py-2 sm:text-xs">
        <p className="shrink-0">© {new Date().getFullYear()} doze52</p>
        <nav
          aria-label="Redes do doze52"
          className="flex min-w-0 items-center justify-end gap-1 sm:gap-x-2"
        >
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-label={link.ariaLabel}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-out hover:border-border/65 hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:translate-y-[1px] active:scale-[0.98] sm:h-8 sm:w-8"
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
            >
              <link.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only">{link.label}</span>
            </a>
          ))}
          <a
            href={mailtoUrl}
            aria-label={`Enviar e-mail para ${supportEmail}`}
            className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-foreground"
            onClick={(event) => {
              const popup = window.open(
                gmailComposeUrl,
                "_blank",
                "noopener,noreferrer",
              );
              if (popup) {
                event.preventDefault();
              }
            }}
          >
            <span className="max-w-[9.5rem] truncate sm:max-w-none">
              {supportEmail}
            </span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
