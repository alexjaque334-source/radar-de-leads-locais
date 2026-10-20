import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/sobre", "/privacy", "/terms"], disallow: ["/api/", "/admin.html", "/account.html", "/radar.html", "/studio.html", "/library.html", "/menu-studio.html", "/crm.html", "/video-studio.html", "/login.html"] }], sitemap: "https://radar-de-leads-locais.leadsbr.workers.dev/sitemap.xml" };
}
