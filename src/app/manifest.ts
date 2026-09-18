import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PRMS - Procurement Receiving Management System",
    short_name: "PRMS",
    description: "Digitalisasi proses penerimaan barang dari Supplier ke Gudang berbasis QR Code",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e40af",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/prms.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
