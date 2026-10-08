"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./kastil.css";
import type { Ringkasan, Ucapan, Undangan } from "@/lib/tipe";
import { bagianTanggal, buatLampion, linkKalender, rentangJam, tanggalSingkat, acak } from "@/lib/format";
import { IkonBawah, IkonGembok, IkonHati, IkonInstagram, IkonKado, IkonKalender, IkonKanan, IkonKiri, IkonLampion, IkonPeta, IkonRumah, IkonFoto, IkonSalin, IkonTutup } from "@/components/ikon";
import LangitDoa from "./LangitDoa";

interface Props {
  undangan: Undangan;
  ucapanAwal: Ucapan[];
  ringkasanAwal: Ringkasan;
  sudahLewat: boolean;
  rsvpDitutup: boolean;
  siteKeyTurnstile?: string;
}

type Fase = "tertutup" | "membuka" | "terbuka";

const LAMPION_SAMPUL = buatLampion(9, 3, 20, 54);
const LAMPION_PENUTUP = buatLampion(6, 11, 18, 44);
const SEMBURAN = (() => {
  const r = acak(19);
  return Array.from({ length: 10 }, () => ({ x: `${(4 + r() * 86).toFixed(1)}%`, w: Math.round(22 + r() * 30), delay: `${(r() * 0.5).toFixed(2)}s` }));
})();
// debu cahaya yang melayang di aula
const KUNANG = (() => {
  const r = acak(77);
  return Array.from({ length: 16 }, () => ({ x: `${(6 + r() * 88).toFixed(1)}%`, y: 120 + r() * 520, d: `${(-r() * 6).toFixed(1)}s`, dur: `${(5 + r() * 4).toFixed(1)}s` }));
})();
// kelopak bunga yang berjatuhan di aula
const KELOPAK = (() => {
  const r = acak(31);
  const warna = ["#F3C2AC", "#F8DCCB", "#E4A08C", "#FBEDE2"];
  return Array.from({ length: 14 }, (_, i) => ({ x: `${(2 + r() * 94).toFixed(1)}%`, w: Math.round(7 + r() * 6), d: `${(-r() * 12).toFixed(1)}s`, dur: `${(8 + r() * 6).toFixed(1)}s`, warna: warna[i % warna.length], ayun: `${Math.round(12 + r() * 26)}px` }));
})();

// Urutan pembuka (ms sejak tombol ditekan): kamera mendekat ke gerbang → pintu terbuka → masuk aula.
const DURASI_PEMBUKA = 4150;
const GAMBAR_PEMBUKA = ["/tema/kastil/gerbang-latar.webp", "/tema/kastil/pintu-kiri.webp", "/tema/kastil/pintu-kanan.webp", "/tema/kastil/aula.webp"];

function Lampion({ l }: { l: { x: string; w: number; dur: string; delay: string; op: number } }) {
  return (
    <div className="km-lan" style={{ left: l.x, width: l.w, animationDuration: l.dur, animationDelay: l.delay, opacity: l.op }}>
      <img src="/tema/bersama/lampion.svg" alt="" />
    </div>
  );
}

export default function TemaKastil({ undangan, ucapanAwal, ringkasanAwal, sudahLewat, rsvpDitutup, siteKeyTurnstile }: Props) {
  const { konten, tamu, hadiah, slug } = undangan;
  const { pria, wanita } = konten.mempelai;
  const [fase, setFase] = useState<Fase>("tertutup");
  const [teksBesar, setTeksBesar] = useState(false);
  const [musik, setMusik] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [alamatTerbuka, setAlamatTerbuka] = useState(false);
  const [hitung, setHitung] = useState<{ hari: string; jam: string; menit: string; detik: string } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tgl = bagianTanggal(undangan.waktu_acara);
  const singkat = tanggalSingkat(undangan.waktu_acara);
  const sesiPertama = konten.acara[0];
  const sesiTerakhir = konten.acara[konten.acara.length - 1];
  const kalender = useMemo(
    () => linkKalender(`Pernikahan ${pria.panggilan} & ${wanita.panggilan}`, sesiPertama?.mulai ?? undangan.waktu_acara, sesiTerakhir?.selesai ?? null, konten.lokasi_utama.alamat),
    [pria.panggilan, wanita.panggilan, sesiPertama, sesiTerakhir, undangan.waktu_acara, konten.lokasi_utama.alamat]
  );
  const galeri = konten.galeri ?? [];

  const tampilkanToast = useCallback((pesan: string) => {
    setToast(pesan);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  // hitung mundur (hanya di browser)
  useEffect(() => {
    const target = Date.parse(undangan.waktu_acara);
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const d = Math.max(0, target - Date.now());
      setHitung({ hari: pad(Math.floor(d / 86_400_000)), jam: pad(Math.floor(d / 3_600_000) % 24), menit: pad(Math.floor(d / 60_000) % 60), detik: pad(Math.floor(d / 1000) % 60) });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [undangan.waktu_acara]);

  // navigasi lightbox dengan keyboard
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % galeri.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + galeri.length) % galeri.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, galeri.length]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // siapkan (decode) gambar gerbang & aula sejak awal supaya animasi pembuka tidak tersendat
  useEffect(() => {
    GAMBAR_PEMBUKA.forEach((src) => {
      const g = new Image();
      g.src = src;
      g.decode?.().catch(() => {});
    });
  }, []);

  function bukaUndangan() {
    if (fase === "tertutup") {
      setFase("membuka");
      window.scrollTo(0, 0);
      if (tamu) {
        fetch("/api/dibuka", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, kode: tamu.kode }), keepalive: true }).catch(() => {});
      }
      if (audio.current) {
        audio.current.volume = 0;
        audio.current.play().then(() => {
          setMusik(true);
          let v = 0;
          const naik = setInterval(() => {
            v = Math.min(0.6, v + 0.05);
            if (audio.current) audio.current.volume = v;
            if (v >= 0.6) clearInterval(naik);
          }, 250);
        }).catch(() => {});
      }
      const kurangGerak = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      timer.current = setTimeout(() => setFase("terbuka"), kurangGerak ? 400 : DURASI_PEMBUKA);
    } else if (fase === "membuka") {
      if (timer.current) clearTimeout(timer.current);
      setFase("terbuka");
    }
  }

  function aturMusik() {
    const a = audio.current;
    if (!a) return;
    if (musik) {
      a.pause();
      setMusik(false);
    } else {
      a.play().then(() => setMusik(true)).catch(() => {});
    }
  }

  async function salin(teks: string) {
    try {
      await navigator.clipboard.writeText(teks);
      tampilkanToast("Nomor rekening disalin");
    } catch {
      tampilkanToast("Salin manual: " + teks);
    }
  }

  const terkunci = fase !== "terbuka";

  return (
    <div className={`km-halaman ${teksBesar ? "km-teks-besar" : ""} ${terkunci ? "km-terkunci" : ""}`}>
      {konten.musik_url && <audio ref={audio} src={konten.musik_url} loop preload="none" />}

      <main className={`km ${fase === "terbuka" ? "km-masuk" : ""}`}>
        {/* ================= HERO: aula di dalam kastil ================= */}
        <section id="beranda" className="km-hero" aria-label="Pembuka">
          <div className="km-kotak km-aula km-parallax">
            <img src="/tema/kastil/aula.webp" alt="Ilustrasi aula kastil yang diterangi lilin dan lampu gantung" />
            <div className="km-aula-pendar" />
          </div>
          {KUNANG.map((k, i) => (
            <span key={i} className="km-kunang" style={{ left: k.x, top: `calc(${k.y.toFixed(0)} * var(--u))`, animationDelay: k.d, animationDuration: k.dur }} />
          ))}
          {KELOPAK.map((k, i) => (
            <span key={i} className="km-kelopak" style={{ left: k.x, width: k.w, height: Math.round(k.w * 0.7), background: k.warna, animationDelay: k.d, animationDuration: k.dur, ["--ayun" as string]: k.ayun }} />
          ))}
          <div className="km-gradasi-bawah" />
          <div className="km-hero-teks">
            <div className="km-caps" style={{ fontSize: ".7em", color: "#F6D58E" }}>The Wedding of</div>
            <h1 className="km-script km-emas" style={{ margin: 0, fontSize: "4.2em", lineHeight: 1.15, padding: "0 6px" }}>{pria.panggilan} &amp; {wanita.panggilan}</h1>
            <img src="/tema/bersama/pembatas-emas.svg" alt="" style={{ width: 220 }} />
            <div className="km-caps" style={{ fontSize: ".8em" }}>{singkat}</div>
            {konten.tagline && <p className="km-serif" style={{ margin: "4px 0 0", fontSize: "1.1em", fontStyle: "italic", color: "#E6DDF0" }}>“{konten.tagline}”</p>}
            <div className="km-ayun km-muted" style={{ marginTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: ".72em" }}>Gulir ke bawah<IkonBawah /></div>
          </div>
        </section>

        {/* ================= PEMBUKA & AYAT ================= */}
        <section className="km-section km-malam" style={{ padding: "30px 24px 60px", textAlign: "center", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <div className="km-arab km-emas km-muncul" style={{ fontSize: "1.9em", lineHeight: 1.7 }}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</div>
          <p className="km-muted km-muncul" style={{ margin: 0, fontSize: ".9em", fontStyle: "italic" }}>Assalamu’alaikum Warahmatullahi Wabarakatuh</p>
          {konten.kutipan && (
            <div className="km-kaca km-muncul-zoom" style={{ position: "relative", padding: "40px 22px 30px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
              <img src="/tema/bersama/sudut-emas.svg" alt="" style={{ position: "absolute", top: 0, left: 0, width: 92 }} />
              <img src="/tema/bersama/sudut-emas.svg" alt="" style={{ position: "absolute", bottom: 0, right: 0, width: 92, transform: "rotate(180deg)" }} />
              {konten.kutipan.arab && <p className="km-arab" style={{ margin: "6px 0 0", fontSize: "1.3em", lineHeight: 2, color: "#F6D58E" }}>{konten.kutipan.arab}</p>}
              <p className="km-serif" style={{ margin: 0, fontSize: "1.08em", lineHeight: 1.55, fontStyle: "italic", color: "#EDE6F5" }}>“{konten.kutipan.terjemahan}”</p>
              <div className="km-caps" style={{ fontSize: ".66em", color: "#E9B95A", marginBottom: 8 }}>{konten.kutipan.sumber}</div>
            </div>
          )}
        </section>

        {/* ================= MEMPELAI ================= */}
        <section id="mempelai" className="km-section km-malam-2" style={{ padding: "60px 24px 66px", textAlign: "center", display: "flex", flexDirection: "column", gap: 26, alignItems: "center" }}>
          <img className="km-kelip" src="/tema/bersama/kilau.svg" alt="" style={{ position: "absolute", top: 60, left: 30, width: 22 }} />
          <img className="km-ayun" src="/tema/bersama/lampion.svg" alt="" style={{ position: "absolute", top: 210, right: 18, width: 40 }} />
          <div className="km-judul km-muncul">
            <div className="km-caps">Mempelai</div>
            <img src="/tema/bersama/pembatas-emas.svg" alt="" style={{ width: 200 }} />
            <p style={{ margin: 0, fontSize: ".9em", lineHeight: 1.65, color: "#E6DDF0" }}>Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami:</p>
          </div>
          {[pria, wanita].map((m, i) => (
            <div key={m.nama_lengkap} style={{ display: "contents" }}>
              {i === 1 && (
                <div className="km-muncul-zoom" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                  <div style={{ flexGrow: 1, height: 1, background: "rgba(233,185,90,.45)" }} />
                  <img src="/tema/bersama/lampion.svg" alt="" style={{ width: 44 }} />
                  <div style={{ flexGrow: 1, height: 1, background: "rgba(233,185,90,.45)" }} />
                </div>
              )}
              <div className={i === 0 ? "km-muncul-kiri" : "km-muncul-kanan"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ padding: 8, border: "1.5px solid rgba(233,185,90,.75)", borderRadius: "124px 124px 20px 20px", boxShadow: "0 0 30px rgba(242,180,80,.22)" }}>
                  {m.foto ? (
                    <img src={m.foto} alt={`Foto ${m.nama_lengkap}`} style={{ display: "block", width: 220, height: 290, objectFit: "cover", borderRadius: "116px 116px 14px 14px" }} />
                  ) : (
                    <div style={{ width: 220, height: 290, borderRadius: "116px 116px 14px 14px", background: "#252C5A" }} />
                  )}
                </div>
                <h2 className="km-script km-emas" style={{ margin: "12px 0 0", fontSize: "2.6em", fontWeight: 400, lineHeight: 1.2 }}>{m.nama_lengkap}</h2>
                <p className="km-muted" style={{ margin: 0, fontSize: ".86em", lineHeight: 1.55 }}>{m.keterangan}<br /><strong style={{ color: "#FBF1E1" }}>{m.orang_tua}</strong></p>
                {m.instagram && (
                  <a className="km-btn km-btn-garis" href={`https://instagram.com/${m.instagram}`} target="_blank" rel="noopener noreferrer" style={{ minHeight: 40, padding: "0 16px", fontSize: ".78em" }}>
                    <IkonInstagram ukuran={15} />@{m.instagram}
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* ================= SAVE THE DATE ================= */}
        <section className="km-section" style={{ padding: "76px 22px 90px", textAlign: "center" }}>
          <img src="/tema/kastil/langit-senja.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(12,16,40,.4)" }} />
          <img src="/tema/kastil/hutan.webp" alt="" style={{ position: "absolute", left: -20, bottom: -30, width: 430 }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
            {sudahLewat ? (
              <>
                <div className="km-caps" style={{ fontSize: ".72em", color: "#F6D58E" }}>Alhamdulillah</div>
                <div className="km-script km-emas" style={{ fontSize: "3em", lineHeight: 1.15 }}>Terima kasih</div>
                <p style={{ margin: 0, fontSize: ".9em", lineHeight: 1.6, color: "#EDE6F5" }}>Acara telah berlangsung dengan penuh syukur. Lampion doa Anda tetap menyala di langit kami.</p>
                <a className="km-btn km-btn-emas" href="#galeri">Lihat galeri</a>
              </>
            ) : (
              <>
                <div className="km-caps km-muncul" style={{ fontSize: ".72em", color: "#F6D58E" }}>Save the Date</div>
                <div className="km-script km-emas km-muncul" style={{ fontSize: "3.1em", lineHeight: 1.15 }}>{pria.panggilan} &amp; {wanita.panggilan}</div>
                <div className="km-caps km-muncul" style={{ fontSize: ".82em" }}>{singkat}</div>
                <div className="km-muncul-zoom" role="timer" aria-label="Hitung mundur menuju acara" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, width: "100%", marginTop: 8 }}>
                  {(["hari", "jam", "menit", "detik"] as const).map((k) => (
                    <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 64, height: 78, borderRadius: "34px 34px 22px 22px / 30px 30px 18px 18px", background: "radial-gradient(circle at 50% 70%, #FFF4C9 0%, #FFD079 40%, #F29B45 85%)", boxShadow: "0 0 22px rgba(242,170,70,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span className="km-serif" style={{ fontSize: "1.9em", fontWeight: 600, color: "#4A220C" }}>{hitung ? hitung[k] : "--"}</span>
                      </div>
                      <span style={{ fontSize: ".72em", color: "#F6E2C0", textTransform: "capitalize" }}>{k}</span>
                    </div>
                  ))}
                </div>
                <a className="km-btn km-btn-emas km-muncul" href={kalender} target="_blank" rel="noopener noreferrer"><IkonKalender />Simpan ke Kalender</a>
              </>
            )}
          </div>
        </section>

        {/* ================= ACARA ================= */}
        <section id="acara" className="km-section km-malam" style={{ display: "flex", flexDirection: "column", gap: 22, textAlign: "center" }}>
          <div className="km-judul km-muncul">
            <div className="km-caps">Rangkaian Acara</div>
            <img src="/tema/bersama/pembatas-emas.svg" alt="" style={{ width: 200 }} />
          </div>
          <div className="km-muncul-zoom" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 14 }}>
            <div className="km-caps" style={{ fontSize: ".8em", textAlign: "right", padding: "10px 0", borderTop: "1px solid rgba(233,185,90,.5)", borderBottom: "1px solid rgba(233,185,90,.5)", color: "#F6D58E" }}>{tgl.hari}</div>
            <div className="km-serif km-emas" style={{ fontSize: "4.2em", fontWeight: 600, lineHeight: 1.05 }}>{tgl.angka}</div>
            <div className="km-caps" style={{ fontSize: ".8em", textAlign: "left", padding: "10px 0", borderTop: "1px solid rgba(233,185,90,.5)", borderBottom: "1px solid rgba(233,185,90,.5)", color: "#F6D58E" }}>{tgl.bulanTahun}</div>
          </div>
          {konten.acara.map((s, i) => (
            <div key={s.nama + i} className={`km-kaca ${i % 2 ? "km-muncul-kanan" : "km-muncul-kiri"}`} style={{ position: "relative", marginTop: 30, padding: "44px 22px 24px", borderRadius: "150px 150px 20px 20px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <img className="km-ayun" src="/tema/bersama/lampion.svg" alt="" style={{ position: "absolute", top: -40, left: "50%", width: 56, marginLeft: -28, animationDelay: `${i * 0.8}s` }} />
              <div className="km-script km-emas" style={{ fontSize: "2.4em", lineHeight: 1.2 }}>{s.nama}</div>
              <div style={{ fontSize: ".98em", fontWeight: 700 }}>{rentangJam(s.mulai, s.selesai)}</div>
              <div className="km-muted" style={{ fontSize: ".86em", lineHeight: 1.5 }}>{s.tempat}<br />{s.alamat}</div>
              {s.maps_url && <a className="km-btn km-btn-garis" href={s.maps_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8, minHeight: 40, fontSize: ".78em" }}><IkonPeta ukuran={15} />Petunjuk arah</a>}
            </div>
          ))}
          {konten.catatan_acara && <div className="km-muncul" style={{ alignSelf: "center", fontSize: ".76em", padding: "6px 12px", borderRadius: 999, background: "rgba(233,185,90,.14)", color: "#F6D58E" }}>{konten.catatan_acara}</div>}
          {konten.dress_code && konten.dress_code.length > 0 && (
            <div className="km-muncul" style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <div className="km-caps" style={{ fontSize: ".66em", color: "#E9B95A" }}>Dress code</div>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                {konten.dress_code.map((d) => (
                  <div key={d.nama} className="km-muted" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: ".68em" }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: d.warna, border: "2px solid #0F1530", boxShadow: "0 0 0 1px #E9B95A" }} />
                    {d.nama}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ================= KISAH ================= */}
        {konten.kisah && konten.kisah.length > 0 && (
          <section className="km-section km-malam-2" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="km-judul km-muncul">
              <div className="km-caps">Kisah Kami</div>
              <div className="km-script km-emas">Love Story</div>
            </div>
            {konten.kisah.map((k) => (
              <div key={k.tahun + k.judul} className="km-kaca km-muncul" style={{ display: "flex", gap: 14, padding: 12, alignItems: "center" }}>
                {k.foto && <img src={k.foto} alt={k.judul} loading="lazy" style={{ width: 92, height: 116, flexShrink: 0, objectFit: "cover", borderRadius: "46px 46px 10px 10px", border: "1px solid rgba(233,185,90,.5)" }} />}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="/tema/bersama/lampion.svg" alt="" style={{ width: 16 }} /><span className="km-caps" style={{ fontSize: ".62em", color: "#E9B95A" }}>{k.tahun}</span></div>
                  <div className="km-serif" style={{ fontSize: "1.25em", fontWeight: 600, color: "#F6D58E" }}>{k.judul}</div>
                  <p style={{ margin: 0, fontSize: ".82em", lineHeight: 1.55, color: "#E6DDF0" }}>{k.teks}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ================= GALERI ================= */}
        {galeri.length > 0 && (
          <section id="galeri" className="km-section km-malam" style={{ padding: "60px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="km-judul km-muncul">
              <div className="km-caps">Galeri</div>
              <div className="km-script km-emas">Momen Kami</div>
              <span className="km-muted" style={{ fontSize: ".76em" }}>Ketuk foto untuk memperbesar</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, alignItems: "start" }}>
              {[0, 1].map((kolom) => (
                <div key={kolom} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {galeri.map((f, i) => (i % 2 !== kolom ? null : (
                    <button key={f.src + i} type="button" className="km-muncul-zoom" onClick={() => setLightbox(i)} aria-label={`Perbesar ${f.alt}`} style={{ padding: 0, border: 0, background: "none", cursor: "zoom-in", display: "block", width: "100%" }}>
                      <img src={f.src} alt={f.alt} loading="lazy" style={{ display: "block", width: "100%", height: [230, 160, 160, 230, 200, 200][i % 6], objectFit: "cover", borderRadius: 14, border: "1px solid rgba(233,185,90,.35)" }} />
                    </button>
                  )))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================= LANGIT DOA (RSVP) ================= */}
        <LangitDoa slug={slug} tamu={tamu} ucapanAwal={ucapanAwal} ringkasanAwal={ringkasanAwal} rsvpDitutup={rsvpDitutup} siteKeyTurnstile={siteKeyTurnstile} onToast={tampilkanToast} />

        {/* ================= TANDA KASIH ================= */}
        <section id="hadiah" className="km-section km-malam" style={{ display: "flex", flexDirection: "column", gap: 18, textAlign: "center" }}>
          <div className="km-judul km-muncul">
            <div className="km-caps">Wedding Gift</div>
            <div className="km-script km-emas">Tanda Kasih</div>
            <p style={{ margin: 0, fontSize: ".86em", lineHeight: 1.6, color: "#E6DDF0" }}>Doa restu Anda adalah karunia yang sangat berarti bagi kami. Namun jika ingin memberikan tanda kasih, Anda dapat melalui:</p>
          </div>
          {!hadiah ? (
            <div className="km-kaca" style={{ padding: 18, fontSize: ".86em", color: "#E6DDF0" }}>
              Detail tanda kasih tersedia di link undangan pribadi yang kami kirimkan kepada Anda.
            </div>
          ) : (
            <>
              {(hadiah.rekening ?? []).map((r) => (
                <div key={r.bank + r.nomor} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="km-muncul-zoom" style={{ position: "relative", height: 196, borderRadius: 20, padding: "20px 22px", textAlign: "left", background: "linear-gradient(135deg,#1C2452 0%,#2C2F5E 55%,#4A3456 100%)", border: "1px solid rgba(233,185,90,.55)", boxShadow: "0 14px 34px rgba(0,0,0,.45), 0 0 30px rgba(242,180,80,.15)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <img src="/tema/bersama/lampion.svg" alt="" style={{ position: "absolute", right: -10, bottom: -20, width: 140, opacity: 0.35 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <svg width="42" height="32" viewBox="0 0 42 32" aria-hidden="true"><rect x="1" y="1" width="40" height="30" rx="6" fill="#E3C08D" stroke="#C9A26B" /><path d="M1 11h12M1 21h12M29 11h12M29 21h12M13 1v30M29 1v30" stroke="#B48B55" strokeWidth="1.2" /></svg>
                      <span className="km-caps" style={{ fontSize: ".8em", color: "#F6D58E" }}>{r.bank}</span>
                    </div>
                    <div className="km-serif" style={{ fontSize: "1.85em", fontWeight: 600, letterSpacing: ".12em" }}>{r.nomor.replace(/(\d{4})(?=\d)/g, "$1 ")}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><span className="km-muted" style={{ fontSize: ".62em", letterSpacing: ".14em" }}>ATAS NAMA</span><span style={{ fontSize: ".92em", fontWeight: 700 }}>{r.atas_nama}</span></div>
                  </div>
                  <button type="button" className="km-btn km-btn-garis" onClick={() => salin(r.nomor)} style={{ alignSelf: "center" }}><IkonSalin ukuran={16} />Salin nomor rekening</button>
                </div>
              ))}
              {hadiah.alamat && (
                <div className="km-kaca km-muncul" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <IkonKado ukuran={30} style={{ color: "#E9B95A" }} />
                  <div className="km-serif" style={{ fontSize: "1.3em", fontWeight: 600, color: "#F6D58E" }}>Kirim Kado</div>
                  {alamatTerbuka ? (
                    <p style={{ margin: 0, fontSize: ".88em", lineHeight: 1.6 }}>{hadiah.alamat.penerima}<br />{hadiah.alamat.alamat}</p>
                  ) : (
                    <button type="button" className="km-btn km-btn-garis" onClick={() => setAlamatTerbuka(true)}>Tampilkan alamat</button>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ================= TURUT MENGUNDANG ================= */}
        {konten.turut_mengundang && konten.turut_mengundang.length > 0 && (
          <section className="km-section km-malam-2" style={{ padding: "50px 26px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div className="km-caps km-muncul" style={{ fontSize: ".7em", color: "#E9B95A" }}>Turut Mengundang</div>
            <p className="km-muncul" style={{ margin: 0, fontSize: ".86em", lineHeight: 1.9, color: "#E6DDF0" }}>
              {konten.turut_mengundang.map((t) => (<span key={t}>{t}<br /></span>))}
            </p>
          </section>
        )}

        {/* ================= PENUTUP ================= */}
        <section className="km-section" style={{ minHeight: 640, padding: "90px 26px 60px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
          <img src="/tema/kastil/sampul.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(15,21,48,.1) 0%, rgba(15,21,48,.5) 45%, rgba(15,21,48,.9) 100%)" }} />
          {LAMPION_PENUTUP.map((l, i) => <Lampion key={i} l={l} />)}
          <p className="km-muncul" style={{ position: "relative", margin: 0, fontSize: ".9em", lineHeight: 1.7, color: "#EDE6F5" }}>Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.</p>
          <p className="km-muncul" style={{ position: "relative", margin: 0, fontSize: ".88em", color: "#EDE6F5" }}>Wassalamu’alaikum Warahmatullahi Wabarakatuh</p>
          <div className="km-caps km-muncul" style={{ position: "relative", fontSize: ".66em", color: "#F6D58E", marginTop: 10 }}>Kami yang berbahagia</div>
          <div className="km-script km-emas km-muncul" style={{ position: "relative", fontSize: "3.3em", lineHeight: 1.2 }}>{pria.panggilan} &amp; {wanita.panggilan}</div>
          <Link href="/" style={{ position: "relative", marginTop: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span className="km-muted" style={{ fontSize: ".68em" }}>Undangan digital oleh</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "rgba(251,242,233,.94)" }}>
              <img src="/brand/monogram.png" alt="" style={{ width: 34 }} />
              <span className="km-serif" style={{ fontSize: "1.05em", fontWeight: 600, color: "#7A4632" }}>momenmu.id</span>
            </span>
          </Link>
        </section>
      </main>

      {/* ================= TOMBOL MELAYANG & NAVIGASI ================= */}
      {fase === "terbuka" && (
        <>
          <div className="km-pojok" style={{ top: 0 }}>
            <button type="button" className="km-ikon" onClick={() => setTeksBesar((v) => !v)} aria-pressed={teksBesar} aria-label="Perbesar teks" style={{ top: 16, right: 16, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 19 }}>Aa</button>
          </div>
          {konten.musik_url && (
            <div className="km-pojok" style={{ bottom: 0 }}>
              <button type="button" className={`km-ikon ${musik ? "km-musik-nyala" : ""}`} onClick={aturMusik} aria-pressed={musik} aria-label={musik ? "Matikan musik" : "Nyalakan musik"} style={{ right: 14, bottom: 92, width: 54, height: 54 }}>
                <img src="/tema/bersama/lampion.svg" alt="" style={{ width: 34, opacity: musik ? 1 : 0.55 }} />
              </button>
            </div>
          )}
          <nav className="km-nav" aria-label="Navigasi undangan">
            <a href="#beranda"><IkonRumah ukuran={20} />Beranda</a>
            <a href="#mempelai"><IkonHati ukuran={20} />Mempelai</a>
            <a href="#acara"><IkonKalender ukuran={20} />Acara</a>
            <a href={galeri.length ? "#galeri" : "#hadiah"}><IkonFoto ukuran={20} />{galeri.length ? "Galeri" : "Hadiah"}</a>
            <a href="#rsvp"><IkonLampion ukuran={20} />Doa</a>
          </nav>
        </>
      )}

      {/* ================= LIGHTBOX ================= */}
      {lightbox !== null && galeri[lightbox] && (
        <div className="km-lightbox" role="dialog" aria-modal="true" aria-label="Foto diperbesar">
          <button type="button" className="km-ikon" onClick={() => setLightbox(null)} aria-label="Tutup" style={{ position: "absolute", top: 16, right: 16, background: "transparent" }}><IkonTutup ukuran={20} /></button>
          <img src={galeri[lightbox].src} alt={galeri[lightbox].alt} style={{ maxWidth: "min(100%, 448px)", maxHeight: "70vh", borderRadius: 14, objectFit: "contain" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 22, color: "#F6D58E" }}>
            <button type="button" className="km-ikon" onClick={() => setLightbox((lightbox - 1 + galeri.length) % galeri.length)} aria-label="Foto sebelumnya" style={{ background: "transparent" }}><IkonKiri ukuran={20} /></button>
            <span style={{ fontSize: 13, minWidth: 44, textAlign: "center" }}>{lightbox + 1} / {galeri.length}</span>
            <button type="button" className="km-ikon" onClick={() => setLightbox((lightbox + 1) % galeri.length)} aria-label="Foto berikutnya" style={{ background: "transparent" }}><IkonKanan ukuran={20} /></button>
          </div>
        </div>
      )}

      {toast && <div className="km-toast" role="status">{toast}</div>}

      {/* ================= SAMPUL (COVER) ================= */}
      {fase !== "terbuka" && (
        <div className={`km-tetap km-sampul ${fase === "membuka" ? "km-membuka" : "km-tertutup"}`}>
          {/* lapis 1: aula (terlihat dari balik pintu, lalu kamera masuk) */}
          <div className="km-kotak km-buka-aula" aria-hidden="true"><img src="/tema/kastil/aula.webp" alt="" /><div className="km-gradasi-bawah km-buka-gradasi" /></div>
          {/* lapis 2: gerbang close-up dengan dua daun pintu */}
          <div className="km-kotak km-buka-gerbang" aria-hidden="true">
            <div className="km-gerbang-isi">
              <div className="km-buka-sinar" />
              <div className="km-daun km-daun-kiri"><img src="/tema/kastil/pintu-kiri.webp" alt="" /></div>
              <div className="km-daun km-daun-kanan"><img src="/tema/kastil/pintu-kanan.webp" alt="" /></div>
              <span className="km-celah" />
              <img className="km-gerbang-latar" src="/tema/kastil/gerbang-latar.webp" alt="" />
            </div>
          </div>
          {/* lapis 3: kastil dari luar (sampul) — kamera mendekat ke gerbangnya */}
          <div className="km-kotak km-kamera"><img src="/tema/kastil/sampul.webp" alt="" /></div>
          <div className="km-sampul-lampion">{LAMPION_SAMPUL.map((l, i) => <Lampion key={i} l={l} />)}</div>
          <img className="km-sudut-tl" src="/tema/bersama/sudut-emas.svg" alt="" />
          <img className="km-sudut-br" src="/tema/bersama/sudut-emas.svg" alt="" />
          <div className="km-sampul-isi">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textShadow: "0 2px 14px rgba(10,14,36,.8)" }}>
              <div className="km-caps" style={{ fontSize: 10, color: "#F6E2C0" }}>The Wedding of</div>
              <div className="km-script km-emas" style={{ fontSize: 54, lineHeight: 1.15, padding: "0 8px" }}>{pria.panggilan} <span style={{ fontSize: 34 }}>&amp;</span> {wanita.panggilan}</div>
              <img src="/tema/bersama/pembatas-emas.svg" alt="" style={{ width: 190 }} />
              <div className="km-caps" style={{ fontSize: 11, color: "#F6E2C0" }}>{singkat}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
              <div style={{ fontSize: 12, color: "#E6DDF0" }}>Kepada Yth. Bapak/Ibu/Saudara/i</div>
              <div className="km-serif" style={{ minWidth: 240, maxWidth: 320, padding: "8px 18px", borderRadius: 14, background: "rgba(10,14,36,.55)", border: "1px solid rgba(246,213,142,.6)", fontSize: 23, fontWeight: 600, color: "#FBF1E1" }}>{tamu?.nama ?? "Tamu Undangan"}</div>
              {tamu && <div className="km-muted" style={{ fontSize: 10.5 }}>Mohon maaf apabila ada kesalahan penulisan nama dan gelar</div>}
              <button type="button" className="km-btn km-btn-emas" onClick={bukaUndangan} style={{ marginTop: 8, minHeight: 52, padding: "0 24px 0 8px", fontSize: 14 }}>
                <span className="km-segel"><img src="/brand/monogram-cream.png" alt="" style={{ width: 28 }} /></span>
                Buka Undangan
              </button>
              <div className="km-muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5 }}><IkonGembok ukuran={12} />Undangan resmi momenmu.id · tanpa unduh aplikasi</div>
            </div>
          </div>
          <div className="km-kilat" />
          {fase === "membuka" && (
            <>
              {SEMBURAN.map((b, i) => (
                <div key={i} className="km-semburan" style={{ left: b.x, width: b.w, animationDelay: b.delay }}><img src="/tema/bersama/lampion.svg" alt="" style={{ display: "block", width: "100%" }} /></div>
              ))}
              <button type="button" onClick={bukaUndangan} className="km-btn" style={{ position: "absolute", top: 16, right: 16, minHeight: 44, padding: "0 16px", border: "1px solid rgba(246,213,142,.6)", background: "rgba(10,14,36,.5)", color: "#F6D58E", fontSize: 13 }}>Lewati</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
