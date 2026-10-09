import type { Metadata, Viewport } from "next";
import Kelola from "@/components/kelola/Kelola";

// Dashboard pengantin. Halaman statis; data diambil di browser setelah login.
export const metadata: Metadata = {
  title: "Kelola Undangan · momenmu.id",
  description: "Dashboard untuk mengatur isi undangan, daftar tamu, dan ucapan.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F3",
};

export default function HalamanKelola() {
  return <Kelola />;
}
