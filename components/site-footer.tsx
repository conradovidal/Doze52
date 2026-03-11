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
  showLabel?: boolean;
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
      showLabel: true,
      icon: Instagram,
    },
    {
      label: "X",
      href: "https://x.com/doze_52",
      ariaLabel: "Perfil do doze52 no X",
      external: true,
      showLabel: false,
      icon: BrandXIcon,
    },
    {
      label: "GitHub",
      href: "https://github.com/conradovidal/Doze52",
      ariaLabel: "Repositorio do doze52 no GitHub",
      external: true,
      showLabel: true,
      icon: Github,
    },
  ];

  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-none flex-col gap-1.5 px-4 py-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} doze52</p>
        <nav
          aria-label="Redes do doze52"
          className="flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          {socialLinks.map((link, index) => (
            <span key={link.label} className="inline-flex items-center gap-2">
              <a
                href={link.href}
                aria-label={link.ariaLabel}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.showLabel ? (
                  <span>{link.label}</span>
                ) : (
                  <span className="sr-only">{link.label}</span>
                )}
              </a>
              {index < socialLinks.length - 1 ? (
                <span className="hidden text-muted-foreground/60 sm:inline">|</span>
              ) : null}
            </span>
          ))}
          <span className="hidden text-muted-foreground/60 sm:inline">|</span>
          <a
            href={mailtoUrl}
            aria-label={`Enviar e-mail para ${supportEmail}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
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
            <span>{supportEmail}</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
