import type { MetadataRoute } from "next";
import { absUrl, siteUrl } from "@/lib/seo";

// Public surfaces (marketplace, Agent pages, expert stores, topic tags) are open to crawlers.
// Everything behind a session — dashboards, studio, admin, settings — is not for the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/studio",
          "/admin",
          "/enterprise",
          "/settings",
          "/council",
        ],
      },
    ],
    sitemap: absUrl("/sitemap.xml"),
    host: siteUrl(),
  };
}
