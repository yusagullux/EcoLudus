"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BotanicalLabel } from "@/components/landing/primitives";

type MarketingShellProps = {
  children: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
};

// Solid surface, one hairline, zero glass — the field-guide paper look.
const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#missions", label: "Missions" },
  { href: "/#garden", label: "Garden" },
  { href: "/#impact", label: "Impact" },
  { href: "/#community", label: "Community" },
  { href: "mailto:hello@ecoludus.com", label: "Contact", isEmail: true }
];

export function MarketingShell({
  children,
  ctaHref = "/signup",
  ctaLabel = "Start growing"
}: MarketingShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const linkClass =
    "relative py-1 text-accent transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all after:duration-300 hover:after:w-full";

  return (
    <div className="relative min-h-screen">
      {/* Decorative ambient gradient — clipped to viewport so it never causes scroll */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at top right, color-mix(in srgb, var(--text-accent) 14%, transparent), transparent 24%), radial-gradient(circle at 10% 30%, color-mix(in srgb, var(--text-accent) 10%, transparent), transparent 20%)"
          }}
        />
      </div>

      {/* Sticky solid header — a clean paper edge, no glass */}
      <header
        className="border-line sticky top-0 z-50 border-b"
        style={{ backgroundColor: "var(--bg-panel)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3 text-ink">
            <div className="border-line bg-surface-alt shadow-elev-1 relative h-10 w-10 overflow-hidden rounded-input border transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-105">
              <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="40px" className="object-cover" priority />
            </div>
            <div className="leading-none">
              <div className="font-serif text-xl font-semibold tracking-wide">EcoLudus</div>
              <BotanicalLabel className="mt-1 block">Play. Protect. Grow.</BotanicalLabel>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-soft md:flex">
            {NAV_LINKS.map((link) =>
              link.isEmail ? (
                <a key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              )
            )}
            <Link
              href={ctaHref}
              className="mk-btn-primary inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-elev-1 transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              {ctaLabel}
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-ink border-line bg-surface-alt hover:bg-surface rounded-input border p-2 transition-transform active:scale-95 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation — solid sheet, same paper edge */}
        {mobileMenuOpen && (
          <div
            className="border-line border-t md:hidden"
            style={{ backgroundColor: "var(--bg-panel)" }}
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
              {NAV_LINKS.map((link) =>
                link.isEmail ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-ink-soft hover:text-ink border-line-soft rounded-lg px-2 py-2.5 text-sm font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-ink-soft hover:text-ink border-line-soft rounded-lg px-2 py-2.5 text-sm font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              )}
              <div className="border-line-soft mt-2 border-t pt-3">
                <Link
                  href={ctaHref}
                  className="mk-btn-primary inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-elev-2 transition-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
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

      <footer className="border-line-soft relative z-10 mx-auto mt-24 w-full max-w-7xl border-t px-5 py-14 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:gap-10">
          {/* Brand column — the field-guide cover, given room to breathe */}
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="border-line bg-surface-alt shadow-elev-1 relative h-11 w-11 overflow-hidden rounded-card border">
                <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="44px" className="object-cover" />
              </div>
              <div className="text-ink font-serif text-2xl font-semibold tracking-wide">EcoLudus</div>
            </div>
            <BotanicalLabel className="mt-3 block">Play. Protect. Grow.</BotanicalLabel>
            <p className="text-ink-soft mt-3 text-sm leading-6">
              Daily eco missions with photo-verified proof. Your garden grows
              in the game — your impact is counted in kilograms of CO₂.
            </p>
          </div>

          <div>
            <BotanicalLabel>Explore</BotanicalLabel>
            <nav className="mt-4 space-y-2">
              <Link href="/#how-it-works" className="text-ink-soft block text-sm transition-colors hover:text-ink">How it works</Link>
              <Link href="/#missions" className="text-ink-soft block text-sm transition-colors hover:text-ink">Missions</Link>
              <Link href="/#garden" className="text-ink-soft block text-sm transition-colors hover:text-ink">Garden</Link>
              <Link href="/#impact" className="text-ink-soft block text-sm transition-colors hover:text-ink">Impact</Link>
              <a href="mailto:hello@ecoludus.com" className="text-ink-soft block text-sm transition-colors hover:text-ink">Contact</a>
            </nav>
          </div>

          <div>
            <BotanicalLabel>Account</BotanicalLabel>
            <nav className="mt-4 space-y-2">
              <Link href="/login" className="text-ink-soft block text-sm transition-colors hover:text-ink">Sign in</Link>
              <Link href="/signup" className="text-ink-soft block text-sm transition-colors hover:text-ink">Create account</Link>
            </nav>
          </div>

          <div>
            <BotanicalLabel>Legal</BotanicalLabel>
            <nav className="mt-4 space-y-2">
              <Link href="/legal/privacy" className="text-ink-soft block text-sm transition-colors hover:text-ink">Privacy Policy</Link>
              <Link href="/legal/terms" className="text-ink-soft block text-sm transition-colors hover:text-ink">Terms of Service</Link>
            </nav>
          </div>
        </div>

        <div className="border-line-soft mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
          <p className="text-ink-muted text-xs" suppressHydrationWarning>
            © {new Date().getFullYear()} EcoLudus. All rights reserved.
          </p>
          <p className="text-ink-muted text-xs">
            A calmer way to build greener habits.
          </p>
        </div>
      </footer>
    </div>
  );
}