import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ระบบประเมิน 360 องศา",
    short_name: "ประเมิน 360",
    description: "ระบบประเมินบุคลากรภายในแผนก",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F8FF",
    theme_color: "#2F5BFF",
    lang: "th",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
