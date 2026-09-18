import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "PRMS - Procurement Receiving Management System",
  description: "Digitalisasi proses penerimaan barang dari Supplier ke Gudang berbasis QR Code",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PRMS",
  },
  icons: {
    icon: "/icon-192.png",
    shortcut: "/prms.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full bg-slate-50 text-slate-900">
      <head>
        <link
          href="https://fonts.googleapis.com/css?family=Rubik:400,400i,500,500i,700,700i&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css?family=Roboto:300,300i,400,400i,500,500i,700,700i,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full min-h-screen font-sans antialiased bg-slate-50 text-slate-900">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
