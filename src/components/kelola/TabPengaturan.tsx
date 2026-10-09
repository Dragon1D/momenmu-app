"use client";
// Tab "Pengaturan": alamat link, batas RSVP, keamanan link (batas perangkat & link umum), akun.
import { useState } from "react";
import type { Acara, KelolaApi, Pengguna, UbahAcara } from "@/lib/kelola/tipe";
import { dariInputWaktu, keInputWaktu, POLA_SLUG, SLUG_TERLARANG, waktuWib } from "@/lib/kelola/util";
import { Isian, pesanGalat, type BeriTahu } from "./bersama";

export default function TabPengaturan({
  api,
  acara,
  perbaruiAcara,
  beriTahu,
  pengguna,
  onKeluar,
  asal,
}: {
  api: KelolaApi;
  acara: Acara;
  perbaruiAcara: (a: Acara) => void;
  beriTahu: BeriTahu;
  pengguna: Pengguna;
  onKeluar: () => void;
  asal: string;
}) {
  const [slug, setSlug] = useState(acara.slug);
  const [batasRsvp, setBatasRsvp] = useState(keInputWaktu(acara.batas_rsvp));
  const [batasPerangkat, setBatasPerangkat] = useState(String(acara.batas_perangkat));
  const [umum, setUmum] = useState(acara.izinkan_tanpa_kode);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const slugBersih = slug.trim().toLowerCase();
  const sama = (a: string | null, b: string | null) => (a && b ? Date.parse(a) === Date.parse(b) : a === b);
  const rsvpIso = batasRsvp ? dariInputWaktu(batasRsvp) : null;
  const nBatas = Number(batasPerangkat);
  const berubah = slugBersih !== acara.slug || !sama(rsvpIso, acara.batas_rsvp) || nBatas !== acara.batas_perangkat || umum !== acara.izinkan_tanpa_kode;

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    if (!POLA_SLUG.test(slugBersih) || slugBersih.length < 3 || slugBersih.length > 60) return setGalat("Alamat hanya boleh huruf kecil, angka, dan tanda hubung (3–60 karakter), mis. deny-carelina.");
    if (SLUG_TERLARANG.has(slugBersih)) return setGalat("Alamat itu dipakai sistem. Pilih yang lain.");
    if (!Number.isInteger(nBatas) || nBatas < 0 || nBatas > 20) return setGalat("Batas perangkat harus angka 0–20.");
    if (batasRsvp && !rsvpIso) return setGalat("Format batas konfirmasi tidak valid.");
    if (slugBersih !== acara.slug && !window.confirm(`Ganti alamat menjadi “${slugBersih}”?\n\nSEMUA link yang sudah dikirim ke tamu tidak bisa dibuka lagi dan harus dikirim ulang.`)) return;
    if (umum && !acara.izinkan_tanpa_kode && !window.confirm("Mengaktifkan link umum berarti siapa pun yang tahu alamatnya bisa melihat undangan (tanpa nama tamu & tanpa amplop digital). Lanjutkan?")) return;
    const ubah: UbahAcara = {};
    if (slugBersih !== acara.slug) ubah.slug = slugBersih;
    if (!sama(rsvpIso, acara.batas_rsvp)) ubah.batas_rsvp = rsvpIso;
    if (nBatas !== acara.batas_perangkat) ubah.batas_perangkat = nBatas;
    if (umum !== acara.izinkan_tanpa_kode) ubah.izinkan_tanpa_kode = umum;
    setSibuk(true);
    try {
      const a = await api.simpanAcara(acara.id, ubah);
      perbaruiAcara(a);
      setSlug(a.slug);
      beriTahu("Pengaturan disimpan");
    } catch (er) {
      setGalat(pesanGalat(er));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="kl-tumpuk kl-sempit-kiri">
      <form className="kl-kartu kl-form" onSubmit={simpan}>
        <h2 className="kl-subjudul">Link undangan</h2>
        <Isian label="Alamat undangan" bantuan={<>Link tamu: <code>{`${asal}/${slugBersih || "…"}/kode-tamu`}</code></>}>
          <div className="kl-gabung kl-awalan">
            <span>{asal.replace(/^https?:\/\//, "")}/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={60} />
          </div>
        </Isian>

        <h2 className="kl-subjudul">Konfirmasi kehadiran</h2>
        <Isian label="Batas konfirmasi (WIB)" bantuan="Setelah lewat, formulir kehadiran ditutup otomatis. Kosongkan jika tanpa batas.">
          <div className="kl-gabung">
            <input type="datetime-local" value={batasRsvp} onChange={(e) => setBatasRsvp(e.target.value)} />
            {batasRsvp && (
              <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setBatasRsvp("")}>
                Kosongkan
              </button>
            )}
          </div>
        </Isian>
        <p className="kl-kecil kl-redup">Tanggal acara utama: {waktuWib(acara.waktu_acara)} — otomatis mengikuti sesi paling awal di tab Isi undangan.</p>

        <h2 className="kl-subjudul">Keamanan link</h2>
        <Isian label="Batas perangkat per tamu" bantuan="Satu link hanya bisa dibuka di sekian HP/laptop. Lebih dari itu, link terkunci (bisa di-reset dari tab Tamu). 0 = tanpa batas. Disarankan 3.">
          <input type="number" inputMode="numeric" min={0} max={20} value={batasPerangkat} onChange={(e) => setBatasPerangkat(e.target.value)} />
        </Isian>
        <label className="kl-cek-label">
          <input type="checkbox" checked={umum} onChange={(e) => setUmum(e.target.checked)} />
          Izinkan link umum tanpa nama tamu ({asal.replace(/^https?:\/\//, "")}/{slugBersih})
        </label>
        <p className="kl-kecil kl-redup">Disarankan <b>mati</b>: undangan hanya bisa dibuka lewat link pribadi tiap tamu.</p>

        {galat && (
          <p className="kl-galat" role="alert">
            {galat}
          </p>
        )}
        <div className="kl-baris-tombol">
          <button type="submit" className="kl-btn kl-btn-utama" disabled={!berubah || sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan pengaturan"}
          </button>
        </div>
      </form>

      <div className="kl-kartu">
        <h2 className="kl-subjudul">Tema</h2>
        <p>
          <b>Kastil Cahaya</b> (ungu-lilac & emas) — aktif.
        </p>
        <p className="kl-kecil kl-redup">Tema lain menyusul.</p>
      </div>

      <GantiSandi api={api} beriTahu={beriTahu} />

      <div className="kl-kartu">
        <h2 className="kl-subjudul">Akun</h2>
        <p>
          Masuk sebagai <b>{pengguna.email}</b>
        </p>
        <button type="button" className="kl-btn kl-btn-garis" onClick={onKeluar}>
          Keluar
        </button>
      </div>

      <div className="kl-kartu">
        <h2 className="kl-subjudul">Cara pakai singkat</h2>
        <ol className="kl-langkah">
          <li>
            <b>Isi undangan</b>: lengkapi nama, jadwal, lokasi, foto, musik, dan rekening, lalu Simpan.
          </li>
          <li>
            <b>Tamu</b>: tambah satu per satu atau impor dari Excel. Tiap tamu otomatis punya link pribadi.
          </li>
          <li>
            <b>Kirim</b>: pakai “Kirim WA berurutan” — WhatsApp terbuka dengan pesan siap kirim untuk tiap tamu.
          </li>
          <li>
            <b>Pantau</b>: tab Ringkasan menampilkan siapa yang sudah membuka & menjawab.
          </li>
          <li>
            Tamu ganti HP dan link terkunci? Buka tamunya → <b>Reset perangkat</b>. Link bocor? → <b>Buat link baru</b>.
          </li>
        </ol>
      </div>
    </div>
  );
}

function GantiSandi({ api, beriTahu }: { api: KelolaApi; beriTahu: BeriTahu }) {
  const [buka, setBuka] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  if (api.demo) return null;
  return (
    <div className="kl-kartu">
      <h2 className="kl-subjudul">Kata sandi</h2>
      {!buka ? (
        <button type="button" className="kl-btn kl-btn-garis" onClick={() => setBuka(true)}>
          Ganti kata sandi
        </button>
      ) : (
        <form
          className="kl-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setGalat("");
            if (a.length < 8) return setGalat("Minimal 8 karakter.");
            if (a !== b) return setGalat("Kedua isian belum sama.");
            setSibuk(true);
            try {
              await api.gantiSandi(a);
              beriTahu("Kata sandi diganti");
              setBuka(false);
              setA("");
              setB("");
            } catch (er) {
              setGalat(pesanGalat(er));
            } finally {
              setSibuk(false);
            }
          }}
        >
          <Isian label="Kata sandi baru">
            <input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
          </Isian>
          <Isian label="Ulangi kata sandi baru">
            <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
          </Isian>
          {galat && <p className="kl-galat">{galat}</p>}
          <div className="kl-baris-tombol">
            <button type="button" className="kl-btn kl-btn-teks" onClick={() => setBuka(false)}>
              Batal
            </button>
            <button type="submit" className="kl-btn kl-btn-utama" disabled={sibuk}>
              Simpan sandi
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
