import type { Metadata, Viewport } from "next";
import "./globals.css";
import { kelasFont } from "./fonts";

// Alamat website untuk pratinjau link (gambar WhatsApp). Urutan: isian manual → domain produksi Vercel → URL deploy → lokal.
const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const situs = process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(situs),
  title: "momenmu.id · Untuk Setiap Momen Berharga",
  description: "Undangan digital yang elegan, personal, dan aman dibuka tanpa unduh aplikasi.",
  icons: { icon: "/brand/monogram.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B1240",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={kelasFont}>
      <body>{children}</body>
    </html>
  );
}
