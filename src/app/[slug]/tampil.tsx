import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TemaKastil from "@/components/kastil/TemaKastil";
import { ambilUndangan, daftarUcapan, ringkasanKehadiran } from "@/lib/data";
import { tanggalPanjang } from "@/lib/format";
import type { Undangan } from "@/lib/tipe";

// Dedupe: generateMetadata & halaman memakai data yang sama dalam satu request.
const ambil = cache((slug: string, kode: string | null) => ambilUndangan(slug, kode));

const POLA_SLUG = /^[a-z0-9-]{3,60}$/;
const POLA_KODE = /^[a-z0-9]{4,12}$/;

// Dihitung per request (server). Acara dianggap selesai 6 jam setelah sesi terakhir.
function statusWaktu(u: Undangan) {
  const sekarang = Date.now();
  const sesiTerakhir = u.konten.acara[u.konten.acara.length - 1];
  const akhirAcara = Date.parse(sesiTerakhir?.selesai ?? sesiTerakhir?.mulai ?? u.waktu_acara) + 6 * 3_600_000;
  return { sudahLewat: sekarang > akhirAcara, rsvpDitutup: !!u.batas_rsvp && sekarang > Date.parse(u.batas_rsvp) };
}

export async function metadataUndangan(slug: string, kode: string | null): Promise<Metadata> {
  if (!POLA_SLUG.test(slug) || (kode && !POLA_KODE.test(kode))) return { title: "Undangan tidak ditemukan" };
  const u = await ambil(slug, kode);
  if (!u || u === "butuh_kode") return { title: "Undangan · momenmu.id", robots: { index: false, follow: false } };
  const { pria, wanita } = u.konten.mempelai;
  const judul = `Undangan Pernikahan ${pria.panggilan} & ${wanita.panggilan}`;
  const untuk = u.tamu ? `Kepada Yth. ${u.tamu.nama} · ` : "";
  const deskripsi = `${untuk}${tanggalPanjang(u.waktu_acara)} · ${u.konten.lokasi_utama.nama}. Buka langsung, tanpa unduh aplikasi.`;
  const gambar = `/tema/${u.tema === "kastil" ? "kastil" : "kastil"}/og.jpg`;
  return {
    title: judul,
    description: deskripsi,
    robots: { index: false, follow: false, nocache: true },
    openGraph: { title: judul, description: deskripsi, type: "website", siteName: "momenmu.id", images: [{ url: gambar, width: 1200, height: 630, alt: judul }] },
    twitter: { card: "summary_large_image", title: judul, description: deskripsi, images: [gambar] },
  };
}

export async function HalamanUndangan({ slug, kode }: { slug: string; kode: string | null }) {
  if (!POLA_SLUG.test(slug) || (kode && !POLA_KODE.test(kode))) notFound();
  const u = await ambil(slug, kode);
  if (!u) notFound();
  if (u === "butuh_kode") {
    return (
      <main style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", background: "#0F1530", color: "#FBF1E1", fontFamily: "var(--ff-sans)" }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontFamily: "var(--ff-serif)", fontWeight: 600 }}>Undangan pribadi</h1>
          <p>Undangan ini hanya bisa dibuka melalui link pribadi yang dikirimkan kepada Anda.</p>
        </div>
      </main>
    );
  }
  if (kode && !u.tamu) notFound(); // kode salah → jangan tampilkan nama sembarangan

  const [ucapan, ringkasan] = await Promise.all([daftarUcapan(slug), ringkasanKehadiran(slug)]);
  const { sudahLewat, rsvpDitutup } = statusWaktu(u);

  // Tema lain (peach, lampion) menyusul; sementara semua memakai Kastil Cahaya.
  return (
    <TemaKastil
      undangan={u}
      ucapanAwal={ucapan}
      ringkasanAwal={ringkasan}
      sudahLewat={sudahLewat}
      rsvpDitutup={rsvpDitutup}
      siteKeyTurnstile={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
    />
  );
}
