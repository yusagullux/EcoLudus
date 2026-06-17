import { MetadataRoute } from "next";

const BASE = "https://ecoludus.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE,                          lastModified: now, changeFrequency: "monthly",  priority: 1.0 },
    { url: `${BASE}/landing`,             lastModified: now, changeFrequency: "monthly",  priority: 0.9 },
    { url: `${BASE}/signup`,              lastModified: now, changeFrequency: "yearly",   priority: 0.7 },
    { url: `${BASE}/login`,               lastModified: now, changeFrequency: "yearly",   priority: 0.6 },
    { url: `${BASE}/legal/privacy`,       lastModified: now, changeFrequency: "yearly",   priority: 0.3 },
    { url: `${BASE}/legal/terms`,         lastModified: now, changeFrequency: "yearly",   priority: 0.3 },
  ];
}
