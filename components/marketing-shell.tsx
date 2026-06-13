"use client";

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
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(95,155,103,0.18),transparent_26%),radial-gradient(circle_at_10%_30%,rgba(155,118,83,0.14),transparent_22%)]" />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/landing" className="flex items-center gap-3 text-forest-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-forest-900 text-lg font-semibold text-cream-100 shadow-[0_20px_40px_rgba(16,33,20,0.18)]">
            E
          </div>
          <div>
            <div className="font-serif text-2xl font-semibold tracking-wide">EcoLudus</div>
            <div className="text-xs uppercase tracking-[0.24em] text-forest-700/70">Forest Edition</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-forest-900/80 md:flex">
          {navLinks.map((link) =>
            link.isEmail ? (
              <a key={link.href} href={link.href} className="hover:text-forest-700">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="hover:text-forest-700">
                {link.label}
              </Link>
            )
          )}
          <Link
            href={ctaHref}
            className="rounded-full border border-forest-900/10 bg-white/80 px-5 py-2.5 text-forest-900 shadow-[0_14px_30px_rgba(16,33,20,0.08)] backdrop-blur hover:-translate-y-0.5 hover:bg-white"
          >
            {ctaLabel}
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Toggle menu"
        >
          <div className={`h-0.5 w-6 bg-forest-900 transition-transform ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <div className={`h-0.5 w-6 bg-forest-900 transition-opacity ${mobileMenuOpen ? "opacity-0" : ""}`} />
          <div className={`h-0.5 w-6 bg-forest-900 transition-transform ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden relative z-10 border-b border-forest-900/10 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8">
            {navLinks.map((link) =>
              link.isEmail ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="py-2 text-sm font-medium text-forest-900/80 hover:text-forest-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-2 text-sm font-medium text-forest-900/80 hover:text-forest-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            <div className="pt-2 border-t border-forest-900/10">
              <Link
                href={ctaHref}
                className="inline-flex w-full items-center justify-center rounded-full border border-forest-900/10 bg-forest-900 px-5 py-2.5 text-sm font-semibold text-cream-100 shadow-[0_14px_30px_rgba(16,33,20,0.08)] hover:bg-forest-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                {ctaLabel}
              </Link>
            </div>
          </nav>
        </div>
      )}
      
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 mx-auto mt-16 w-full max-w-7xl border-t border-forest-900/8 px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-12">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-forest-900 text-sm font-semibold text-cream-100">
                E
              </div>
              <div className="font-serif text-lg font-semibold text-forest-900">EcoLudus</div>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-forest-700/60">Forest Edition</p>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-forest-900">Product</h3>
            <nav className="mt-3 space-y-2">
              <Link href="/landing#features" className="block text-xs text-forest-900/70 hover:text-forest-900">Features</Link>
              <Link href="/landing#about" className="block text-xs text-forest-900/70 hover:text-forest-900">About</Link>
              <a href="mailto:hello@ecoludus.com" className="block text-xs text-forest-900/70 hover:text-forest-900">Contact</a>
            </nav>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-forest-900">Legal</h3>
            <nav className="mt-3 space-y-2">
              <Link href="/legal/privacy" className="block text-xs text-forest-900/70 hover:text-forest-900">Privacy Policy</Link>
              <Link href="/legal/terms" className="block text-xs text-forest-900/70 hover:text-forest-900">Terms of Service</Link>
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-forest-900/8 pt-6">
          <p className="text-center text-xs text-forest-900/60">
            © 2026 EcoLudus. All rights reserved. We're committed to real environmental impact.
          </p>
        </div>
      </footer>
    </div>
  );
}
