import { permanentRedirect } from "next/navigation";

// The homepage now lives at `/` (the canonical, indexable surface). Keep this
// route as a 308 permanent redirect so existing inbound links, bookmarks, and
// the sitemap entry that pointed at `/landing` still resolve. Search engines
// pass link equity through a 308 to the canonical URL.
export default function LandingRedirectPage() {
  permanentRedirect("/");
}