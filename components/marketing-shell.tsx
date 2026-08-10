"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type MarketingShellProps = {
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
};

export function MarketingShell({
  children,
  ctaHref = "/signup",
  ctaLabel = "Join EcoLudus"
}: MarketingShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/landing#about", label: "About" },
    { href: "/landing#features", label: "Features" },
    { href: "/landing#experience", label: "Experience" },
    { href: "mailto:hello@ecoludus.com", label: "Contact", isEmail: true },
  ];

  return (
    <div className="relative min-h-screen">
      {/* Decorative ambient gradient — clipped to viewport so it never causes scroll */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in srgb, var(--text-accent) 22%, transparent), transparent 26%), radial-gradient(circle at 10% 30%, color-mix(in srgb, var(--text-accent) 16%, transparent), transparent 22%)"
          }}
        />
      </div>

      {/* Sticky translucent header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{ borderColor: "color-mix(in srgb, var(--border-default) 60%, transparent)", backgroundColor: "color-mix(in srgb, var(--bg-panel) 82%, transparent)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-10">
        <Link href="/landing" className="mk-c-primary group flex items-center gap-3">
          <div className="mk-surface relative h-10 w-10 overflow-hidden rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-105">
            <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="40px" className="object-cover" priority />
          </div>
          <div className="leading-none">
            <div className="font-serif text-xl font-semibold tracking-wide">EcoLudus</div>
            <div className="mk-c-muted mt-1 text-[10px] uppercase tracking-[0.24em]">Forest Edition</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="mk-c-secondary hidden items-center gap-7 text-sm font-medium md:flex">
          {navLinks.map((link) =>
            link.isEmail ? (
              <a key={link.href} href={link.href} className="mk-c-accent relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-[var(--text-accent)] after:transition-all after:duration-300 hover:after:w-full">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="mk-c-accent relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-[var(--text-accent)] after:transition-all after:duration-300 hover:after:w-full">
                {link.label}
              </Link>
            )
          )}
          <Link
            href={ctaHref}
            className="mk-btn-ghost rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_10px_26px_rgba(0,0,0,0.07)] backdrop-blur transition-all hover:-translate-y-0.5"
          >
            {ctaLabel}
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="mk-c-primary flex flex-col gap-1.5 rounded-lg p-2 md:hidden"
          aria-label="Toggle menu"
        >
          <div className={`h-0.5 w-6 transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} style={{ background: "var(--text-primary)" }} />
          <div className={`h-0.5 w-6 transition-opacity duration-200 ease-out ${mobileMenuOpen ? "opacity-0" : ""}`} style={{ background: "var(--text-primary)" }} />
          <div className={`h-0.5 w-6 transition-transform duration-300 ease-out ${mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} style={{ background: "var(--text-primary)" }} />
        </button>
        </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fade-in border-b backdrop-blur-xl"
          style={{ borderColor: "color-mix(in srgb, var(--border-default) 60%, transparent)", backgroundColor: "color-mix(in srgb, var(--bg-panel) 95%, transparent)" }}
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
            {navLinks.map((link) =>
              link.isEmail ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="mk-c-secondary mk-bd-subtle rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-[color-mix(in_srgb,var(--text-accent)_8%,transparent)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mk-c-secondary mk-bd-subtle rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-[color-mix(in_srgb,var(--text-accent)_8%,transparent)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="mk-bd-subtle mt-2 border-t pt-3">
              <Link
                href={ctaHref}
                className="mk-btn-primary inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-[0_14px_30px_rgba(0,0,0,0.1)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {ctaLabel}
              </Link>
            </div>
          </nav>
        </div>
      )}
      </header>

      <main className="relative z-10">{children}</main>
      <footer className="mk-bd-subtle relative z-10 mx-auto mt-20 w-full max-w-7xl border-t px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:gap-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="mk-surface relative h-9 w-9 overflow-hidden rounded-xl shadow-sm">
                <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="36px" className="object-cover" />
              </div>
              <div className="mk-c-primary font-serif text-lg font-semibold">EcoLudus</div>
            </div>
            <p className="mk-c-secondary mt-3 max-w-xs text-sm leading-6">
              Turn eco-friendly habits into a rewarding daily ritual. Play, protect, and grow.
            </p>
            <p className="mk-c-muted mt-3 text-[11px] uppercase tracking-[0.2em]">Forest Edition</p>
          </div>

          <div>
            <h3 className="mk-c-muted text-xs font-bold uppercase tracking-[0.16em]">Product</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/landing#features" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Features</Link>
              <Link href="/landing#about" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">About</Link>
              <a href="mailto:hello@ecoludus.com" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Contact</a>
            </nav>
          </div>

          <div>
            <h3 className="mk-c-muted text-xs font-bold uppercase tracking-[0.16em]">Account</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/login" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Sign in</Link>
              <Link href="/signup" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Create account</Link>
            </nav>
          </div>

          <div>
            <h3 className="mk-c-muted text-xs font-bold uppercase tracking-[0.16em]">Legal</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/legal/privacy" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Privacy Policy</Link>
              <Link href="/legal/terms" className="mk-c-secondary block text-sm transition-colors hover:text-[var(--text-primary)]">Terms of Service</Link>
            </nav>
          </div>
        </div>

        <div className="mk-bd-subtle mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
          <p className="mk-c-muted text-xs">
            © 2026 EcoLudus. All rights reserved.
          </p>
          <p className="mk-c-muted text-xs">
            A calmer way to build greener habits.
          </p>
        </div>
      </footer>
    </div>
  );
}
