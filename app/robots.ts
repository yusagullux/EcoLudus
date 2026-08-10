import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // `/landing` is a 308 redirect to `/`; allowing it is harmless but the
        // canonical page is `/`, so only the real content routes are listed.
        allow: ["/", "/login", "/signup", "/legal/"],
        disallow: ["/api/", "/dashboard", "/settings", "/profile", "/team",
                   "/shop", "/collection", "/habits", "/insights", "/leaderboard",
                   "/impact", "/premium", "/garden", "/pets", "/friends"]
      }
    ],
    sitemap: "https://ecoludus.com/sitemap.xml"
  };
}
