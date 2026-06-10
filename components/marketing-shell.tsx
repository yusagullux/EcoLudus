import Link from "next/link";

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
        <nav className="hidden items-center gap-8 text-sm font-medium text-forest-900/80 md:flex">
          <Link href="/landing#about" className="hover:text-forest-700">About</Link>
          <Link href="/landing#features" className="hover:text-forest-700">Features</Link>
          <Link href="/landing#experience" className="hover:text-forest-700">Experience</Link>
          <a href="mailto:hello@ecoludus.com" className="hover:text-forest-700">Contact</a>
          <Link
            href={ctaHref}
            className="rounded-full border border-forest-900/10 bg-white/80 px-5 py-2.5 text-forest-900 shadow-[0_14px_30px_rgba(16,33,20,0.08)] backdrop-blur hover:-translate-y-0.5 hover:bg-white"
          >
            {ctaLabel}
          </Link>
        </nav>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
