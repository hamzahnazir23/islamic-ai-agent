import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest by Next's metadata route.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aalim — Qur'an & Sunnah AI",
    short_name: "Aalim",
    description:
      "An AI companion for Muslims, grounded in the Qur'an and authentic Hadith.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f1e8",
    theme_color: "#065f46",
    categories: ["education", "books", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
