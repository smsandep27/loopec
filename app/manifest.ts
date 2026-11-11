import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "LOOPEC — NITC Campus Marketplace",
    short_name: "LOOPEC",
    description:
      "A private peer-to-peer marketplace exclusively for the NIT Calicut campus community.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    lang: "en-IN",
    dir: "ltr",
    categories: ["shopping", "education", "social"],
    background_color: "#f7f6f4",
    theme_color: "#302546",
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Browse Marketplace",
        short_name: "Marketplace",
        description: "Find textbooks, cycles and tech on campus",
        url: "/marketplace",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Sell an Item",
        short_name: "Sell",
        description: "List an item for campus pickup",
        url: "/listings/new",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "My Orders",
        short_name: "Orders",
        description: "Track campus purchases, sales and handover PINs",
        url: "/orders",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
