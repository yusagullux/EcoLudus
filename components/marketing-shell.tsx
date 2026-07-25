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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(95,155,103,0.18),transparent_26%),radial-gradient(circle_at_10%_30%,rgba(155,118,83,0.14),transparent_22%)]" />
      </div>

      {/* Sticky translucent header */}
      <header className="sticky top-0 z-50 border-b border-forest-900/8 bg-[#f5f7ef]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#f5f7ef]/72">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8 lg:px-10">
        <Link href="/landing" className="group flex items-center gap-3 text-forest-900">
          <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white shadow-[0_12px_28px_rgba(16,33,20,0.16)] ring-1 ring-forest-900/10 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-105">
            <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="40px" className="object-cover" priority />
          </div>
          <div className="leading-none">
            <div className="font-serif text-xl font-semibold tracking-wide">EcoLudus</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-forest-700/70">Forest Edition</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-forest-900/80 md:flex">
          {navLinks.map((link) =>
            link.isEmail ? (
              <a key={link.href} href={link.href} className="relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-forest-700 after:transition-all after:duration-300 hover:text-forest-700 hover:after:w-full">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-forest-700 after:transition-all after:duration-300 hover:text-forest-700 hover:after:w-full">
                {link.label}
              </Link>
            )
          )}
          <Link
            href={ctaHref}
            className="rounded-full border border-forest-900/10 bg-white/80 px-5 py-2.5 text-sm font-semibold text-forest-900 shadow-[0_10px_26px_rgba(16,33,20,0.07)] backdrop-blur transition-all hover:-translate-y-0.5 hover:border-forest-900/20 hover:bg-white"
          >
            {ctaLabel}
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-col gap-1.5 rounded-lg p-2 md:hidden"
          aria-label="Toggle menu"
        >
          <div className={`h-0.5 w-6 bg-forest-900 transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
          <div className={`h-0.5 w-6 bg-forest-900 transition-opacity duration-200 ease-out ${mobileMenuOpen ? "opacity-0" : ""}`} />
          <div className={`h-0.5 w-6 bg-forest-900 transition-transform duration-300 ease-out ${mobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
        </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-forest-900/10 bg-[#f5f7ef]/95 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
            {navLinks.map((link) =>
              link.isEmail ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-forest-900/80 hover:bg-forest-900/5 hover:text-forest-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-forest-900/80 hover:bg-forest-900/5 hover:text-forest-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="mt-2 border-t border-forest-900/10 pt-3">
              <Link
                href={ctaHref}
                className="inline-flex w-full items-center justify-center rounded-full bg-forest-900 px-5 py-3 text-sm font-semibold text-cream-100 shadow-[0_14px_30px_rgba(16,33,20,0.1)] hover:bg-forest-800"
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
      <footer className="relative z-10 mx-auto mt-20 w-full max-w-7xl border-t border-forest-900/8 px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:gap-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-forest-900/10">
                <Image src="/images/logo.png" alt="EcoLudus logo" fill sizes="36px" className="object-cover" />
              </div>
              <div className="font-serif text-lg font-semibold text-forest-900">EcoLudus</div>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-forest-900/70">
              Turn eco-friendly habits into a rewarding daily ritual. Play, protect, and grow.
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-forest-700/55">Forest Edition</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-forest-900/60">Product</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/landing#features" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Features</Link>
              <Link href="/landing#about" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">About</Link>
              <a href="mailto:hello@ecoludus.com" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Contact</a>
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-forest-900/60">Account</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/login" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Sign in</Link>
              <Link href="/signup" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Create account</Link>
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-forest-900/60">Legal</h3>
            <nav className="mt-4 space-y-2.5">
              <Link href="/legal/privacy" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Privacy Policy</Link>
              <Link href="/legal/terms" className="block text-sm text-forest-900/70 transition-colors hover:text-forest-900">Terms of Service</Link>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-forest-900/8 pt-6 sm:flex-row">
          <p className="text-xs text-forest-900/55">
            © 2026 EcoLudus. All rights reserved.
          </p>
          <p className="text-xs text-forest-900/55">
            A calmer way to build greener habits.
          </p>
        </div>
      </footer>
    </div>
  );
}
