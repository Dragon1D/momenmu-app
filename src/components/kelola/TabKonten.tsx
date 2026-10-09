"use client";
// Tab "Isi undangan": ubah teks, jadwal, lokasi, foto, galeri, musik, dan amplop digital
// tanpa menyentuh kode. Disimpan sekaligus dengan tombol "Simpan perubahan".
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hadiah, Konten, Mempelai, SesiAcara } from "@/lib/tipe";
import type { Acara, KelolaApi, UbahAcara } from "@/lib/kelola/tipe";
import { dariInputWaktu, keInputWaktu, perkecilFoto } from "@/lib/kelola/util";
import { Isian, pesanGalat, type BeriTahu } from "./bersama";

type KontenDraf = Konten & { pesan_wa?: string | null };
interface Draf {
  konten: KontenDraf;
  hadiah: Hadiah;
}

const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const awalDraf = (a: Acara): Draf => salin({ konten: a.konten, hadiah: a.hadiah ?? { rekening: [], alamat: null } });
/** sidik jari untuk mendeteksi perubahan (template WA diurus di tab Tamu, jadi diabaikan) */
function sidik(d: Draf): string {
  const k: KontenDraf = { ...d.konten };
  delete k.pesan_wa;
  return JSON.stringify([k, d.hadiah]);
}

const linkPeta = (alamat: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(alamat)}`;
const kosongJadiNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

function rapikanInstagram(s: string | null | undefined): string | null {
  const v = (s ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return v || null;
}

function rapikan(d: Draf): Draf {
  const k = d.konten;
  const m = (x: Mempelai): Mempelai => ({
    ...x,
    panggilan: x.panggilan.trim(),
    nama_lengkap: x.nama_lengkap.trim(),
    keterangan: x.keterangan.trim(),
    orang_tua: x.orang_tua.trim(),
    instagram: rapikanInstagram(x.instagram),
    foto: x.foto || null,
  });
  const rekening = (d.hadiah.rekening ?? []).map((r) => ({ bank: r.bank.trim(), nomor: r.nomor.trim(), atas_nama: r.atas_nama.trim() })).filter((r) => r.bank || r.nomor || r.atas_nama);
  const alamat = d.hadiah.alamat && (d.hadiah.alamat.penerima.trim() || d.hadiah.alamat.alamat.trim()) ? { penerima: d.hadiah.alamat.penerima.trim(), alamat: d.hadiah.alamat.alamat.trim() } : null;
  return {
    konten: {
      ...k,
      mempelai: { pria: m(k.mempelai.pria), wanita: m(k.mempelai.wanita) },
      acara: k.acara.map((s) => ({ ...s, nama: s.nama.trim(), tempat: s.tempat.trim(), alamat: s.alamat.trim(), maps_url: kosongJadiNull(s.maps_url), selesai: s.selesai || null })),
      lokasi_utama: { nama: k.lokasi_utama.nama.trim(), alamat: k.lokasi_utama.alamat.trim(), maps_url: kosongJadiNull(k.lokasi_utama.maps_url) },
      catatan_acara: kosongJadiNull(k.catatan_acara),
      tagline: kosongJadiNull(k.tagline),
      kutipan: k.kutipan ? { arab: kosongJadiNull(k.kutipan.arab), terjemahan: k.kutipan.terjemahan.trim(), sumber: k.kutipan.sumber.trim() } : null,
      dress_code: (k.dress_code ?? []).map((x) => ({ nama: x.nama.trim(), warna: x.warna })).filter((x) => x.nama),
      kisah: (k.kisah ?? []).map((x) => ({ ...x, tahun: x.tahun.trim(), judul: x.judul.trim(), teks: x.teks.trim(), foto: x.foto || null })).filter((x) => x.tahun || x.judul || x.teks || x.foto),
      galeri: (k.galeri ?? []).map((g, i) => ({ src: g.src, alt: g.alt?.trim() || `Foto galeri ${i + 1}` })),
      turut_mengundang: (k.turut_mengundang ?? []).map((x) => x.trim()).filter(Boolean),
      musik_url: kosongJadiNull(k.musik_url),
    },
    hadiah: { rekening, alamat },
  };
}

function periksa(d: Draf): string[] {
  const g: string[] = [];
  const k = d.konten;
  for (const [s, label] of [
    ["pria", "mempelai pria"],
    ["wanita", "mempelai wanita"],
  ] as const) {
    if (!k.mempelai[s].panggilan) g.push(`Nama panggilan ${label} wajib diisi.`);
    if (!k.mempelai[s].nama_lengkap) g.push(`Nama lengkap ${label} wajib diisi.`);
  }
  if (k.acara.length === 0) g.push("Minimal ada satu sesi acara.");
  k.acara.forEach((s, i) => {
    const n = `Sesi ${i + 1}${s.nama ? ` (${s.nama})` : ""}`;
    if (!s.nama) g.push(`${n}: nama acara wajib diisi.`);
    if (!s.mulai || Number.isNaN(Date.parse(s.mulai))) g.push(`${n}: waktu mulai wajib diisi.`);
    if (s.selesai && Date.parse(s.selesai) <= Date.parse(s.mulai)) g.push(`${n}: jam selesai harus setelah jam mulai.`);
    if (!s.tempat) g.push(`${n}: nama tempat wajib diisi.`);
    if (s.maps_url && !/^https?:\/\//i.test(s.maps_url)) g.push(`${n}: link Google Maps harus diawali https://`);
  });
  if (!k.lokasi_utama.nama) g.push("Nama lokasi utama wajib diisi.");
  if (k.lokasi_utama.maps_url && !/^https?:\/\//i.test(k.lokasi_utama.maps_url)) g.push("Link Google Maps lokasi utama harus diawali https://");
  if (k.kutipan && (!k.kutipan.terjemahan || !k.kutipan.sumber)) g.push("Ayat/kutipan: isi terjemahan dan sumbernya, atau matikan bagian kutipan.");
  if (k.musik_url && !/^(https?:\/\/|\/|blob:)/i.test(k.musik_url)) g.push("Link musik tidak valid.");
  (d.hadiah.rekening ?? []).forEach((r, i) => {
    if (!r.bank || !r.nomor || !r.atas_nama) g.push(`Rekening ${i + 1}: isi bank, nomor, dan atas nama.`);
  });
  if (d.hadiah.alamat && (!d.hadiah.alamat.penerima || !d.hadiah.alamat.alamat)) g.push("Alamat kirim kado: isi nama penerima dan alamatnya.");
  return g;
}

function pindah<T>(arr: T[], i: number, arah: -1 | 1): T[] {
  const j = i + arah;
  if (j < 0 || j >= arr.length) return arr;
  const b = [...arr];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
}

const JENIS_MUSIK: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg" };

export default function TabKonten({ api, acara, perbaruiAcara, beriTahu }: { api: KelolaApi; acara: Acara; perbaruiAcara: (a: Acara) => void; beriTahu: BeriTahu }) {
  const [draf, setDraf] = useState<Draf>(() => awalDraf(acara));
  const [galat, setGalat] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [unggah, setUnggah] = useState<string | null>(null);
  const refMusik = useRef<HTMLInputElement>(null);
  const refGaleri = useRef<HTMLInputElement>(null);
  const kotor = useMemo(() => sidik(draf) !== sidik(awalDraf(acara)), [draf, acara]);

  useEffect(() => {
    if (!kotor) return;
    const cegah = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", cegah);
    return () => window.removeEventListener("beforeunload", cegah);
  }, [kotor]);

  const k = draf.konten;
  const h = draf.hadiah;
  const setK = (f: (k: KontenDraf) => KontenDraf) => setDraf((d) => ({ ...d, konten: f(d.konten) }));
  const setH = (f: (h: Hadiah) => Hadiah) => setDraf((d) => ({ ...d, hadiah: f(d.hadiah) }));
  const ubahMempelai = (s: "pria" | "wanita", u: Partial<Mempelai>) => setK((k) => ({ ...k, mempelai: { ...k.mempelai, [s]: { ...k.mempelai[s], ...u } } }));
  const ubahSesi = (i: number, u: Partial<SesiAcara>) => setK((k) => ({ ...k, acara: k.acara.map((s, j) => (j === i ? { ...s, ...u } : s)) }));

  async function unggahFoto(kunci: string, f: File, sisi = 1600): Promise<string | null> {
    if (!f.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
      beriTahu("Pilih file foto (JPG atau PNG).", "galat");
      return null;
    }
    setUnggah(kunci);
    try {
      const { blob, jenis } = await perkecilFoto(f, sisi);
      return await api.unggah(blob, jenis);
    } catch (e) {
      beriTahu(pesanGalat(e) === "Terjadi kesalahan. Coba lagi." ? "Foto tidak bisa dibaca. Coba foto lain (JPG/PNG)." : pesanGalat(e), "galat");
      return null;
    } finally {
      setUnggah(null);
    }
  }

  async function tambahGaleri(files: File[]) {
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const url = await unggahFoto(`galeri ${i + 1}/${files.length}`, files[i]);
      if (!url) continue;
      ok++;
      setK((k) => ({ ...k, galeri: [...(k.galeri ?? []), { src: url, alt: `Foto galeri ${(k.galeri?.length ?? 0) + 1}` }] }));
    }
    if (ok) beriTahu(`${ok} foto ditambahkan. Jangan lupa klik Simpan.`);
  }

  async function unggahMusik(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    let jenis = f.type || JENIS_MUSIK[ext] || "";
    if (jenis === "audio/mp3") jenis = "audio/mpeg";
    if (!jenis.startsWith("audio/")) return beriTahu("Pilih file musik MP3 atau M4A.", "galat");
    if (f.size > 10 * 1024 * 1024) return beriTahu("Ukuran musik maks. 10 MB. Gunakan MP3 128 kbps (±1 MB per menit).", "galat");
    setUnggah("musik");
    try {
      const url = await api.unggah(f, jenis);
      setK((k) => ({ ...k, musik_url: url }));
      beriTahu("Musik diunggah. Jangan lupa klik Simpan.");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setUnggah(null);
    }
  }

  async function simpan() {
    const bersih = rapikan(draf);
    const g = periksa(bersih);
    setGalat(g);
    if (g.length) {
      beriTahu("Ada isian yang perlu dilengkapi", "galat");
      return;
    }
    setSibuk(true);
    try {
      const konten: KontenDraf = { ...bersih.konten };
      if (acara.konten.pesan_wa !== undefined) konten.pesan_wa = acara.konten.pesan_wa; // template WA tetap yang terbaru
      const ubah: UbahAcara = { konten, hadiah: bersih.hadiah };
      // tanggal utama (hitung mundur & pratinjau link) = sesi paling awal
      const paling = [...bersih.konten.acara].sort((a, b) => Date.parse(a.mulai) - Date.parse(b.mulai))[0]?.mulai;
      if (paling && Date.parse(paling) !== Date.parse(acara.waktu_acara)) ubah.waktu_acara = paling;
      const a = await api.simpanAcara(acara.id, ubah);
      perbaruiAcara(a);
      setDraf(awalDraf(a));
      beriTahu("Tersimpan. Buka/muat ulang undangan untuk melihat hasilnya.");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="kl-tumpuk kl-konten">
      <p className="kl-kecil kl-redup">Ubah isian di bawah, lalu klik <b>Simpan</b> di bagian bawah layar. Perubahan langsung tampil di semua link tamu.</p>

      <Bagian judul="Mempelai" ket="nama, orang tua, foto, Instagram" terbuka>
        <div className="kl-dua-kolom">
          {(["pria", "wanita"] as const).map((s) => {
            const m = k.mempelai[s];
            return (
              <div key={s} className="kl-sub">
                <h3 className="kl-sub-judul">{s === "pria" ? "Mempelai pria" : "Mempelai wanita"}</h3>
                <PilihFoto
                  label={`Foto ${m.panggilan || s}`}
                  url={m.foto}
                  bentuk="lengkung"
                  sibuk={unggah === `foto-${s}`}
                  onPilih={async (f) => {
                    const url = await unggahFoto(`foto-${s}`, f, 1200);
                    if (url) ubahMempelai(s, { foto: url });
                  }}
                  onHapus={() => ubahMempelai(s, { foto: null })}
                />
                <Isian label="Nama panggilan" wajib bantuan="Tampil besar di sampul.">
                  <input value={m.panggilan} onChange={(e) => ubahMempelai(s, { panggilan: e.target.value })} maxLength={30} />
                </Isian>
                <Isian label="Nama lengkap & gelar" wajib>
                  <input value={m.nama_lengkap} onChange={(e) => ubahMempelai(s, { nama_lengkap: e.target.value })} maxLength={80} />
                </Isian>
                <Isian label="Keterangan" bantuan={`Contoh: “${s === "pria" ? "Putra pertama dari" : "Putri kedua dari"}”`}>
                  <input value={m.keterangan} onChange={(e) => ubahMempelai(s, { keterangan: e.target.value })} maxLength={60} />
                </Isian>
                <Isian label="Nama orang tua" bantuan="Contoh: Bapak Hendra Wijaya & Ibu Sri Lestari">
                  <input value={m.orang_tua} onChange={(e) => ubahMempelai(s, { orang_tua: e.target.value })} maxLength={140} />
                </Isian>
                <Isian label="Instagram (opsional)" bantuan="Tanpa @. Kosongkan jika tidak ingin ditampilkan.">
                  <input value={m.instagram ?? ""} onChange={(e) => ubahMempelai(s, { instagram: e.target.value })} maxLength={60} autoCapitalize="none" />
                </Isian>
              </div>
            );
          })}
        </div>
      </Bagian>

      <Bagian judul="Jadwal acara" ket={`${k.acara.length} sesi · waktu dalam WIB`}>
        {k.acara.map((s, i) => (
          <div key={i} className="kl-sub kl-sub-garis">
            <div className="kl-sub-kepala">
              <h3 className="kl-sub-judul">Sesi {i + 1}</h3>
              <div className="kl-baris-tombol">
                <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, acara: pindah(k.acara, i, -1) }))} disabled={i === 0} aria-label="Naikkan">
                  ↑
                </button>
                <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, acara: pindah(k.acara, i, 1) }))} disabled={i === k.acara.length - 1} aria-label="Turunkan">
                  ↓
                </button>
                <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setK((k) => ({ ...k, acara: k.acara.filter((_, j) => j !== i) }))} disabled={k.acara.length <= 1}>
                  Hapus sesi
                </button>
              </div>
            </div>
            <div className="kl-grid-2">
              <Isian label="Nama acara" wajib bantuan="Contoh: Akad Nikah, Resepsi">
                <input value={s.nama} onChange={(e) => ubahSesi(i, { nama: e.target.value })} maxLength={40} />
              </Isian>
              <Isian label="Nama tempat" wajib>
                <input value={s.tempat} onChange={(e) => ubahSesi(i, { tempat: e.target.value })} maxLength={80} />
              </Isian>
              <Isian label="Mulai" wajib>
                <input
                  type="datetime-local"
                  value={keInputWaktu(s.mulai)}
                  onChange={(e) => {
                    const v = dariInputWaktu(e.target.value);
                    if (v) ubahSesi(i, { mulai: v });
                  }}
                />
              </Isian>
              <div className="kl-isian">
                <span className="kl-label">Selesai</span>
                <div className="kl-gabung">
                  <input type="datetime-local" aria-label={`Selesai sesi ${i + 1}`} value={keInputWaktu(s.selesai)} onChange={(e) => ubahSesi(i, { selesai: dariInputWaktu(e.target.value) })} />
                  {s.selesai && (
                    <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => ubahSesi(i, { selesai: null })}>
                      Kosongkan
                    </button>
                  )}
                </div>
                <small className="kl-bantuan">Kosong = “sampai selesai”.</small>
              </div>
            </div>
            <Isian label="Alamat">
              <textarea rows={2} value={s.alamat} onChange={(e) => ubahSesi(i, { alamat: e.target.value })} maxLength={200} />
            </Isian>
            <div className="kl-isian">
              <span className="kl-label">Link Google Maps</span>
              <div className="kl-gabung">
                <input type="url" aria-label={`Link Google Maps sesi ${i + 1}`} value={s.maps_url ?? ""} onChange={(e) => ubahSesi(i, { maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/…" />
                <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => ubahSesi(i, { maps_url: linkPeta(`${s.tempat} ${s.alamat}`.trim()) })} disabled={!s.tempat && !s.alamat}>
                  Buat dari alamat
                </button>
              </div>
              <small className="kl-bantuan">Paling tepat: buka Google Maps → cari tempatnya → Bagikan → Salin link.</small>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="kl-btn kl-btn-garis"
          onClick={() => setK((k) => ({ ...k, acara: [...k.acara, { nama: "", mulai: k.acara[k.acara.length - 1]?.mulai ?? acara.waktu_acara, selesai: null, tempat: k.acara[0]?.tempat ?? "", alamat: k.acara[0]?.alamat ?? "", maps_url: k.acara[0]?.maps_url ?? null }] }))}
        >
          + Tambah sesi
        </button>

        <div className="kl-sub kl-sub-garis">
          <div className="kl-sub-kepala">
            <h3 className="kl-sub-judul">Lokasi utama</h3>
            <button
              type="button"
              className="kl-btn kl-btn-teks kl-btn-kecil"
              onClick={() => setK((k) => ({ ...k, lokasi_utama: { nama: k.acara[0]?.tempat ?? "", alamat: k.acara[0]?.alamat ?? "", maps_url: k.acara[0]?.maps_url ?? null } }))}
            >
              Samakan dengan sesi 1
            </button>
          </div>
          <p className="kl-kecil kl-redup">Tampil di bagian peta & pratinjau link WhatsApp.</p>
          <div className="kl-grid-2">
            <Isian label="Nama lokasi" wajib>
              <input value={k.lokasi_utama.nama} onChange={(e) => setK((k) => ({ ...k, lokasi_utama: { ...k.lokasi_utama, nama: e.target.value } }))} maxLength={80} />
            </Isian>
            <Isian label="Link Google Maps">
              <input type="url" value={k.lokasi_utama.maps_url ?? ""} onChange={(e) => setK((k) => ({ ...k, lokasi_utama: { ...k.lokasi_utama, maps_url: e.target.value } }))} placeholder="https://maps.app.goo.gl/…" />
            </Isian>
          </div>
          <Isian label="Alamat">
            <textarea rows={2} value={k.lokasi_utama.alamat} onChange={(e) => setK((k) => ({ ...k, lokasi_utama: { ...k.lokasi_utama, alamat: e.target.value } }))} maxLength={200} />
          </Isian>
          <Isian label="Catatan acara (opsional)" bantuan="Contoh: Outdoor di taman · siapkan jaket tipis">
            <input value={k.catatan_acara ?? ""} onChange={(e) => setK((k) => ({ ...k, catatan_acara: e.target.value }))} maxLength={100} />
          </Isian>
        </div>
      </Bagian>

      <Bagian judul="Kata-kata" ket="tagline & ayat/kutipan">
        <Isian label="Tagline (opsional)" bantuan="Kalimat pendek di bawah nama mempelai.">
          <input value={k.tagline ?? ""} onChange={(e) => setK((k) => ({ ...k, tagline: e.target.value }))} maxLength={140} />
        </Isian>
        <label className="kl-cek-label">
          <input type="checkbox" checked={!!k.kutipan} onChange={(e) => setK((k) => ({ ...k, kutipan: e.target.checked ? { arab: "", terjemahan: "", sumber: "" } : null }))} />
          Tampilkan ayat / kutipan
        </label>
        {k.kutipan && (
          <>
            <Isian label="Teks Arab (opsional)">
              <textarea rows={3} dir="rtl" lang="ar" className="kl-arab" value={k.kutipan.arab ?? ""} onChange={(e) => setK((k) => ({ ...k, kutipan: k.kutipan && { ...k.kutipan, arab: e.target.value } }))} />
            </Isian>
            <Isian label="Terjemahan / isi kutipan" wajib>
              <textarea rows={4} value={k.kutipan.terjemahan} onChange={(e) => setK((k) => ({ ...k, kutipan: k.kutipan && { ...k.kutipan, terjemahan: e.target.value } }))} maxLength={600} />
            </Isian>
            <Isian label="Sumber" wajib bantuan="Contoh: QS. Ar-Rum: 21">
              <input value={k.kutipan.sumber} onChange={(e) => setK((k) => ({ ...k, kutipan: k.kutipan && { ...k.kutipan, sumber: e.target.value } }))} maxLength={60} />
            </Isian>
          </>
        )}
      </Bagian>

      <Bagian judul="Kisah cinta" ket={`${k.kisah?.length ?? 0} cerita`}>
        {(k.kisah ?? []).map((x, i) => (
          <div key={i} className="kl-sub kl-sub-garis kl-kisah">
            <PilihFoto
              label={x.judul || `Kisah ${i + 1}`}
              url={x.foto}
              bentuk="lengkung"
              kecil
              sibuk={unggah === `kisah-${i}`}
              onPilih={async (f) => {
                const url = await unggahFoto(`kisah-${i}`, f, 1000);
                if (url) setK((k) => ({ ...k, kisah: (k.kisah ?? []).map((y, j) => (j === i ? { ...y, foto: url } : y)) }));
              }}
              onHapus={() => setK((k) => ({ ...k, kisah: (k.kisah ?? []).map((y, j) => (j === i ? { ...y, foto: null } : y)) }))}
            />
            <div className="kl-form">
              <div className="kl-grid-2">
                <Isian label="Tahun">
                  <input value={x.tahun} onChange={(e) => setK((k) => ({ ...k, kisah: (k.kisah ?? []).map((y, j) => (j === i ? { ...y, tahun: e.target.value } : y)) }))} maxLength={20} />
                </Isian>
                <Isian label="Judul">
                  <input value={x.judul} onChange={(e) => setK((k) => ({ ...k, kisah: (k.kisah ?? []).map((y, j) => (j === i ? { ...y, judul: e.target.value } : y)) }))} maxLength={60} />
                </Isian>
              </div>
              <Isian label="Cerita">
                <textarea rows={3} value={x.teks} onChange={(e) => setK((k) => ({ ...k, kisah: (k.kisah ?? []).map((y, j) => (j === i ? { ...y, teks: e.target.value } : y)) }))} maxLength={500} />
              </Isian>
              <div className="kl-baris-tombol">
                <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, kisah: pindah(k.kisah ?? [], i, -1) }))} disabled={i === 0} aria-label="Naikkan">
                  ↑
                </button>
                <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, kisah: pindah(k.kisah ?? [], i, 1) }))} disabled={i === (k.kisah?.length ?? 0) - 1} aria-label="Turunkan">
                  ↓
                </button>
                <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setK((k) => ({ ...k, kisah: (k.kisah ?? []).filter((_, j) => j !== i) }))}>
                  Hapus cerita
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="kl-btn kl-btn-garis" onClick={() => setK((k) => ({ ...k, kisah: [...(k.kisah ?? []), { tahun: "", judul: "", teks: "", foto: null }] }))}>
          + Tambah cerita
        </button>
        <p className="kl-kecil kl-redup">Kosongkan semua cerita jika bagian ini tidak ingin ditampilkan.</p>
      </Bagian>

      <Bagian judul="Galeri foto" ket={`${k.galeri?.length ?? 0} foto`}>
        {(k.galeri?.length ?? 0) > 0 ? (
          <div className="kl-galeri">
            {(k.galeri ?? []).map((g, i) => (
              <figure key={g.src + i} className="kl-galeri-item">
                <img src={g.src} alt={g.alt} loading="lazy" />
                <figcaption className="kl-baris-tombol">
                  <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, galeri: pindah(k.galeri ?? [], i, -1) }))} disabled={i === 0} aria-label="Geser ke kiri">
                    ←
                  </button>
                  <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, galeri: pindah(k.galeri ?? [], i, 1) }))} disabled={i === (k.galeri?.length ?? 0) - 1} aria-label="Geser ke kanan">
                    →
                  </button>
                  <button type="button" className="kl-ikon-btn kl-merah" onClick={() => setK((k) => ({ ...k, galeri: (k.galeri ?? []).filter((_, j) => j !== i) }))} aria-label={`Hapus foto ${i + 1}`}>
                    ×
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="kl-redup">Belum ada foto. Bagian galeri disembunyikan sampai ada foto.</p>
        )}
        <div className="kl-baris-tombol">
          <button type="button" className="kl-btn kl-btn-garis" onClick={() => refGaleri.current?.click()} disabled={!!unggah}>
            {unggah?.startsWith("galeri") ? `Mengunggah ${unggah.slice(7)}…` : "+ Tambah foto"}
          </button>
          <span className="kl-kecil kl-redup">Bisa pilih beberapa foto sekaligus. Foto otomatis diperkecil supaya cepat dibuka.</span>
        </div>
        <input
          ref={refGaleri}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const f = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (f.length) void tambahGaleri(f.slice(0, 30));
          }}
        />
      </Bagian>

      <Bagian judul="Dress code & turut mengundang">
        <div className="kl-label">Warna dress code</div>
        <div className="kl-tumpuk-kecil">
          {(k.dress_code ?? []).map((d, i) => (
            <div key={i} className="kl-gabung">
              <input type="color" value={d.warna} onChange={(e) => setK((k) => ({ ...k, dress_code: (k.dress_code ?? []).map((x, j) => (j === i ? { ...x, warna: e.target.value } : x)) }))} aria-label={`Warna ${i + 1}`} className="kl-warna" />
              <input value={d.nama} onChange={(e) => setK((k) => ({ ...k, dress_code: (k.dress_code ?? []).map((x, j) => (j === i ? { ...x, nama: e.target.value } : x)) }))} aria-label={`Nama warna ${i + 1}`} placeholder="Nama warna, mis. Lilac" maxLength={30} />
              <button type="button" className="kl-ikon-btn" onClick={() => setK((k) => ({ ...k, dress_code: (k.dress_code ?? []).filter((_, j) => j !== i) }))} aria-label={`Hapus warna ${i + 1}`}>
                ×
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => setK((k) => ({ ...k, dress_code: [...(k.dress_code ?? []), { nama: "", warna: "#B8A4E3" }] }))} disabled={(k.dress_code?.length ?? 0) >= 6}>
              + Tambah warna
            </button>
          </div>
        </div>
        <Isian label="Turut mengundang" bantuan="Satu nama/keluarga per baris. Kosongkan jika tidak perlu.">
          <textarea rows={5} value={(k.turut_mengundang ?? []).join("\n")} onChange={(e) => setK((k) => ({ ...k, turut_mengundang: e.target.value.split("\n") }))} />
        </Isian>
      </Bagian>

      <Bagian judul="Musik latar" ket={k.musik_url ? "ada musik" : "belum ada"}>
        {k.musik_url ? (
          <div className="kl-tumpuk-kecil">
            <audio controls preload="none" src={k.musik_url} className="kl-audio" />
            <div className="kl-baris-tombol">
              <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => refMusik.current?.click()} disabled={!!unggah}>
                {unggah === "musik" ? "Mengunggah…" : "Ganti musik"}
              </button>
              <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setK((k) => ({ ...k, musik_url: null }))}>
                Hapus musik
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="kl-btn kl-btn-garis" onClick={() => refMusik.current?.click()} disabled={!!unggah}>
            {unggah === "musik" ? "Mengunggah…" : "Unggah musik (MP3/M4A)"}
          </button>
        )}
        <input
          ref={refMusik}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,.mp3,.m4a,.aac,.ogg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void unggahMusik(f);
          }}
        />
        <p className="kl-kecil kl-redup">Maks. 10 MB (MP3 128 kbps ±1 MB per menit). Musik diputar setelah tamu menekan “Buka Undangan”. Gunakan lagu yang boleh Anda pakai (milik sendiri atau bebas royalti).</p>
      </Bagian>

      <Bagian judul="Amplop digital & kado" ket="hanya tampil untuk tamu dengan link pribadi">
        <p className="kl-kecil kl-redup">Nomor rekening hanya muncul setelah tamu membuka link pribadinya di perangkat yang terdaftar — tidak terlihat oleh orang yang hanya menerima teruskan link.</p>
        {(h.rekening ?? []).map((r, i) => (
          <div key={i} className="kl-sub kl-sub-garis">
            <div className="kl-grid-3">
              <Isian label="Bank / e-wallet">
                <input value={r.bank} onChange={(e) => setH((h) => ({ ...h, rekening: (h.rekening ?? []).map((x, j) => (j === i ? { ...x, bank: e.target.value } : x)) }))} maxLength={30} placeholder="BCA" />
              </Isian>
              <Isian label="Nomor">
                <input value={r.nomor} inputMode="numeric" onChange={(e) => setH((h) => ({ ...h, rekening: (h.rekening ?? []).map((x, j) => (j === i ? { ...x, nomor: e.target.value } : x)) }))} maxLength={40} />
              </Isian>
              <Isian label="Atas nama">
                <input value={r.atas_nama} onChange={(e) => setH((h) => ({ ...h, rekening: (h.rekening ?? []).map((x, j) => (j === i ? { ...x, atas_nama: e.target.value } : x)) }))} maxLength={60} />
              </Isian>
            </div>
            <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setH((h) => ({ ...h, rekening: (h.rekening ?? []).filter((_, j) => j !== i) }))}>
              Hapus rekening
            </button>
          </div>
        ))}
        <button type="button" className="kl-btn kl-btn-garis" onClick={() => setH((h) => ({ ...h, rekening: [...(h.rekening ?? []), { bank: "", nomor: "", atas_nama: "" }] }))} disabled={(h.rekening?.length ?? 0) >= 4}>
          + Tambah rekening
        </button>
        <label className="kl-cek-label">
          <input type="checkbox" checked={!!h.alamat} onChange={(e) => setH((h) => ({ ...h, alamat: e.target.checked ? { penerima: "", alamat: "" } : null }))} />
          Tampilkan alamat kirim kado
        </label>
        {h.alamat && (
          <div className="kl-grid-2">
            <Isian label="Nama penerima">
              <input value={h.alamat.penerima} onChange={(e) => setH((h) => ({ ...h, alamat: h.alamat && { ...h.alamat, penerima: e.target.value } }))} maxLength={60} />
            </Isian>
            <Isian label="Alamat lengkap">
              <textarea rows={3} value={h.alamat.alamat} onChange={(e) => setH((h) => ({ ...h, alamat: h.alamat && { ...h.alamat, alamat: e.target.value } }))} maxLength={300} />
            </Isian>
          </div>
        )}
        {!(h.rekening?.length || h.alamat) && <p className="kl-kecil kl-redup">Tanpa rekening & alamat, bagian amplop digital disembunyikan dari undangan.</p>}
      </Bagian>

      {galat.length > 0 && (
        <div className="kl-kartu kl-perhatian" role="alert">
          <h2 className="kl-subjudul">Lengkapi dulu:</h2>
          <ul>
            {galat.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={`kl-simpan-bar ${kotor ? "kl-simpan-bar-aktif" : ""}`}>
        <span className="kl-kecil">{unggah ? "Mengunggah…" : kotor ? "Belum disimpan" : "Semua tersimpan"}</span>
        <div className="kl-baris-tombol">
          <button
            type="button"
            className="kl-btn kl-btn-teks"
            onClick={() => {
              if (window.confirm("Batalkan semua perubahan yang belum disimpan?")) {
                setDraf(awalDraf(acara));
                setGalat([]);
              }
            }}
            disabled={!kotor || sibuk}
          >
            Batal
          </button>
          <button type="button" className="kl-btn kl-btn-utama" onClick={simpan} disabled={!kotor || sibuk || !!unggah}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Bagian({ judul, ket, terbuka, children }: { judul: string; ket?: string; terbuka?: boolean; children: ReactNode }) {
  return (
    <details className="kl-kartu kl-bagian" open={terbuka}>
      <summary>
        <span className="kl-bagian-judul">{judul}</span>
        {ket && <span className="kl-bagian-ket">{ket}</span>}
      </summary>
      <div className="kl-bagian-isi">{children}</div>
    </details>
  );
}

function PilihFoto({ url, label, bentuk = "kotak", kecil, sibuk, onPilih, onHapus }: { url?: string | null; label: string; bentuk?: "kotak" | "lengkung"; kecil?: boolean; sibuk?: boolean; onPilih: (f: File) => void; onHapus?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={`kl-foto kl-foto-${bentuk} ${kecil ? "kl-foto-kecil" : ""}`}>
      <div className="kl-foto-bingkai">
        {url ? <img src={url} alt={label} loading="lazy" /> : <span className="kl-kecil kl-redup">Belum ada foto</span>}
        {sibuk && <span className="kl-foto-sibuk">Mengunggah…</span>}
      </div>
      <div className="kl-baris-tombol">
        <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => ref.current?.click()} disabled={sibuk} aria-label={`${url ? "Ganti" : "Pilih"} ${label.toLowerCase()}`}>
          {url ? "Ganti foto" : "Pilih foto"}
        </button>
        {url && onHapus && (
          <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={onHapus} disabled={sibuk}>
            Hapus
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPilih(f);
        }}
      />
    </div>
  );
}
