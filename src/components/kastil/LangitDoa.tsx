"use client";

import Script from "next/script";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Ringkasan, Tamu, Ucapan } from "@/lib/tipe";
import { namaDepan, waktuRelatif } from "@/lib/format";

const SLOT = [
  { x: "8%", y: 40 }, { x: "38%", y: 18 }, { x: "68%", y: 52 }, { x: "20%", y: 138 },
  { x: "54%", y: 118 }, { x: "78%", y: 160 }, { x: "4%", y: 226 }, { x: "40%", y: 214 },
];

interface Props {
  slug: string;
  tamu: Tamu | null;
  ucapanAwal: Ucapan[];
  ringkasanAwal: Ringkasan;
  rsvpDitutup: boolean;
  siteKeyTurnstile?: string;
  onToast: (pesan: string) => void;
}

export default function LangitDoa({ slug, tamu, ucapanAwal, ringkasanAwal, rsvpDitutup, siteKeyTurnstile, onToast }: Props) {
  const [ucapan, setUcapan] = useState<Ucapan[]>(ucapanAwal);
  const [ringkasan, setRingkasan] = useState<Ringkasan>(ringkasanAwal);
  const [pilihId, setPilihId] = useState<string | null>(ucapanAwal[0]?.id ?? null);
  const [baruId, setBaruId] = useState<string | null>(null);
  const [sekarang, setSekarang] = useState<number | null>(null);

  const sudahJawab = !!tamu?.ucapan;
  const [terkirim, setTerkirim] = useState(sudahJawab);
  const [nama, setNama] = useState(tamu?.nama ?? "");
  const [kehadiran, setKehadiran] = useState<"hadir" | "tidak" | null>(tamu?.ucapan?.kehadiran ?? null);
  const [jumlah, setJumlah] = useState(tamu?.ucapan?.jumlah || 1);
  const [pesan, setPesan] = useState(tamu?.ucapan?.pesan ?? "");
  const [error, setError] = useState("");
  const [mengirim, setMengirim] = useState(false);
  const maks = tamu?.maks_orang ?? 4;

  // waktu relatif hanya dihitung di browser (hindari beda render server/klien)
  useEffect(() => {
    const awal = setTimeout(() => setSekarang(Date.now()), 0);
    const t = setInterval(() => setSekarang(Date.now()), 60_000);
    return () => {
      clearTimeout(awal);
      clearInterval(t);
    };
  }, []);

  // segarkan ucapan berkala saat halaman terlihat
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/ucapan?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ucapan: Ucapan[]; ringkasan: Ringkasan };
        setUcapan(data.ucapan);
        setRingkasan(data.ringkasan);
      } catch {
        /* abaikan, coba lagi nanti */
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [slug]);

  const langit = useMemo(() => ucapan.slice(0, SLOT.length), [ucapan]);
  const dipilih = ucapan.find((u) => u.id === pilihId) ?? ucapan[0] ?? null;

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!nama.trim()) return setError("Nama belum diisi.");
    if (!kehadiran) return setError("Pilih Hadir atau Tidak hadir terlebih dahulu.");
    const token = siteKeyTurnstile ? String(new FormData(e.currentTarget).get("cf-turnstile-response") ?? "") : undefined;
    setMengirim(true);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kode: tamu?.kode ?? null,
          nama: nama.trim(),
          kehadiran,
          jumlah: kehadiran === "hadir" ? jumlah : 0,
          pesan: pesan.trim() || (kehadiran === "hadir" ? "Insya Allah hadir. Selamat untuk kalian berdua!" : "Mohon maaf belum bisa hadir. Doa terbaik untuk kalian!"),
          turnstile: token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengirim. Coba lagi.");
      const u = data.ucapan as Ucapan;
      setUcapan((lama) => [u, ...lama.filter((x) => x.id !== u.id)]);
      setRingkasan(data.ringkasan as Ringkasan);
      setPilihId(u.id);
      setBaruId(u.id);
      setTerkirim(true);
      onToast("Lampion doa Anda sudah terbang");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim. Coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  const pilihanKehadiran = (nilai: "hadir" | "tidak", label: string) => {
    const aktif = kehadiran === nilai;
    return (
      <button
        type="button"
        className="km-btn"
        aria-pressed={aktif}
        onClick={() => setKehadiran(nilai)}
        style={{ border: "1.5px solid rgba(233,185,90,.7)", background: aktif ? "linear-gradient(180deg,#F8D88C,#E2A94B)" : "transparent", color: aktif ? "#2A1A08" : "#F6D58E" }}
      >
        {label}
      </button>
    );
  };

  return (
    <section id="rsvp" className="km-section km-malam-2" style={{ padding: "60px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="km-judul km-muncul">
        <div className="km-caps">RSVP &amp; Ucapan</div>
        <div className="km-script km-emas">Langit Doa</div>
        <p className="km-muted" style={{ margin: 0, fontSize: ".84em", lineHeight: 1.55 }}>
          Setiap ucapan menjadi satu lampion. Ketuk lampion untuk membaca doa dari tamu lain.
        </p>
      </div>

      <div style={{ position: "relative", height: 330, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(233,185,90,.3)", background: "linear-gradient(180deg,#0B1028 0%,#1D2350 70%,#4A3354 100%)" }}>
        <img src="/tema/bersama/tekstur-bintang.png" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
        <img src="/tema/bersama/siluet-bukit.svg" alt="" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 70 }} />
        {langit.map((u, i) => {
          const aktif = u.id === dipilih?.id;
          return (
            <button
              key={u.id}
              type="button"
              className={`km-lampion-doa ${u.id === baruId ? "km-terbang" : "km-ayun"}`}
              onClick={() => setPilihId(u.id)}
              aria-label={`Baca ucapan dari ${u.nama}`}
              aria-pressed={aktif}
              style={{ left: SLOT[i].x, top: SLOT[i].y, animationDelay: `${(i * 0.45).toFixed(2)}s` }}
            >
              <img src="/tema/bersama/lampion.svg" alt="" style={{ width: aktif ? 50 : 40, filter: aktif ? "drop-shadow(0 0 12px rgba(255,200,110,.95))" : "none" }} />
              <span>{namaDepan(u.nama)}</span>
            </button>
          );
        })}
        {langit.length === 0 && (
          <p className="km-muted" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", margin: 0, fontSize: ".9em" }}>
            Jadilah yang pertama menerbangkan lampion doa.
          </p>
        )}
      </div>

      {dipilih && (
        <div className="km-kaca" style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }} aria-live="polite">
          <img src="/tema/bersama/lampion.svg" alt="" style={{ width: 34, flexShrink: 0 }} />
          <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong style={{ fontSize: ".9em", color: "#F6D58E" }}>Lampion dari {dipilih.nama}</strong>
              <span style={{ flexShrink: 0, fontSize: ".68em", fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: dipilih.kehadiran === "hadir" ? "rgba(168,216,160,.18)" : "rgba(242,169,154,.18)", color: dipilih.kehadiran === "hadir" ? "#BFE6B8" : "#F6BDB1" }}>
                {dipilih.kehadiran === "hadir" ? "Hadir" : "Tidak hadir"}
              </span>
            </div>
            <p className="km-serif" style={{ margin: 0, fontSize: "1.05em", lineHeight: 1.5, fontStyle: "italic", color: "#EDE6F5" }}>“{dipilih.pesan}”</p>
            <span style={{ fontSize: ".7em", color: "#A9A3C0" }}>{sekarang ? waktuRelatif(dipilih.created_at, sekarang) : " "}</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[
          [ringkasan.ucapan, "Lampion doa", "#F6D58E"],
          [ringkasan.hadir, "Hadir", "#A8D8A0"],
          [ringkasan.tidak, "Tidak hadir", "#F2A99A"],
        ].map(([n, label, warna]) => (
          <div key={String(label)} className="km-kaca" style={{ padding: 10, textAlign: "center" }}>
            <div className="km-serif" style={{ fontSize: "1.7em", fontWeight: 600, color: String(warna) }}>{n}</div>
            <div className="km-muted" style={{ fontSize: ".7em" }}>{label}</div>
          </div>
        ))}
      </div>

      {rsvpDitutup ? (
        <div className="km-kaca" style={{ padding: 20, textAlign: "center" }}>
          <p style={{ margin: 0, color: "#E6DDF0" }}>Konfirmasi kehadiran sudah ditutup. Terima kasih atas doa Anda.</p>
        </div>
      ) : terkirim ? (
        <div className="km-kaca" style={{ padding: 22, textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <p className="km-serif" style={{ margin: 0, fontSize: "1.35em", fontWeight: 600, color: "#F6D58E" }}>Terima kasih, {nama || tamu?.nama}!</p>
          <p style={{ margin: 0, fontSize: ".86em", color: "#E6DDF0" }}>
            {kehadiran === "hadir" ? `Konfirmasi hadir ${jumlah} orang sudah kami terima.` : "Konfirmasi dan doa Anda sudah kami terima."}
          </p>
          <button type="button" className="km-btn km-btn-garis" onClick={() => setTerkirim(false)}>Ubah jawaban</button>
        </div>
      ) : (
        <form className="km-kaca" onSubmit={kirim} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="km-serif" style={{ fontSize: "1.3em", fontWeight: 600, color: "#F6D58E" }}>Terbangkan lampion doamu</div>
          <label className="km-label">
            Nama
            <input className="km-field" value={nama} onChange={(e) => setNama(e.target.value)} maxLength={80} autoComplete="name" required />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: ".84em", fontWeight: 700, color: "#E6DDF0" }}>Apakah Anda akan hadir?</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {pilihanKehadiran("hadir", "Hadir")}
              {pilihanKehadiran("tidak", "Tidak hadir")}
            </div>
          </div>
          {kehadiran === "hadir" && (
            <label className="km-label">
              Jumlah orang
              <select className="km-field" value={jumlah} onChange={(e) => setJumlah(Number(e.target.value))}>
                {Array.from({ length: maks }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} orang</option>
                ))}
              </select>
            </label>
          )}
          <label className="km-label">
            Doa &amp; ucapan
            <textarea className="km-field" rows={3} value={pesan} onChange={(e) => setPesan(e.target.value)} maxLength={500} placeholder="Tulis doa untuk kedua mempelai" style={{ resize: "none", minHeight: 90 }} />
          </label>
          {siteKeyTurnstile && (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
              <div className="cf-turnstile" data-sitekey={siteKeyTurnstile} data-theme="dark" />
            </>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: ".82em", color: "#F2A99A" }}>{error}</p>}
          <button type="submit" className="km-btn km-btn-emas" disabled={mengirim}>
            <img src="/tema/bersama/lampion.svg" alt="" style={{ width: 20 }} />
            {mengirim ? "Menerbangkan…" : "Terbangkan Lampion"}
          </button>
        </form>
      )}
    </section>
  );
}
