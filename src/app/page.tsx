import Link from "next/link";
import { modeDemo } from "@/lib/data";
import TerusKeKelola from "@/components/TerusKeKelola";

// Halaman depan sementara. Landing page agensi menyusul.
export default function Beranda() {
  return (
    <main style={{ minHeight: "100svh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center", background: "#FBF7F3", color: "#4A2C20" }}>
      <TerusKeKelola />
      <img src="/brand/logo.png" alt="momenmu.id — Untuk Setiap Momen Berharga" style={{ width: 260 }} />
      <p style={{ maxWidth: 380, margin: 0, lineHeight: 1.6 }}>Undangan digital yang elegan, personal, dan aman dibuka tanpa unduh aplikasi. Segera hadir.</p>
      {modeDemo && (
        <Link href="/arya-nadia/dn7s" style={{ padding: "12px 22px", borderRadius: 999, background: "#7A4632", color: "#FFF8F2", textDecoration: "none", fontWeight: 700 }}>
          Lihat contoh undangan
        </Link>
      )}
    </main>
  );
}
