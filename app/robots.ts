import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/landing", "/login", "/signup", "/legal/"],
        disallow: ["/api/", "/dashboard", "/settings", "/profile", "/team",
                   "/shop", "/collection", "/habits", "/insights", "/leaderboard",
                   "/impact", "/premium"]
      }
    ],
    sitemap: "https://ecoludus.com/sitemap.xml"
  };
}
