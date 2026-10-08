import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#0F1530",
};

const FONT =
  "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Lato:wght@400;700&family=Pinyon+Script&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT} />
      </head>
      <body>{children}</body>
    </html>
  );
}
