import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Architecture Simulator",
    short_name: "Architecture Sim",
    description: "Drill system architecture, then defend what you build.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    icons: [
      {
        src: "/manifest-icon/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/manifest-icon/512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
