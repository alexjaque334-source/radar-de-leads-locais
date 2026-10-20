import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = "https://radar-de-leads-locais.leadsbr.workers.dev";
  return ["/sobre", "/privacy", "/terms"].map(path => ({ url: site + path, changeFrequency: "monthly" as const, priority: path === "/sobre" ? 0.9 : 0.3 }));
}
