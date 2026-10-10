"use client";
// Tab "Klien" (khusus admin agensi): semua acara klien di satu tempat.
// Buat acara baru (isi awal dari contoh), undang/sambungkan akun klien, cek & bersihkan file, hapus acara.
// Tiap acara punya folder file sendiri: media/<id-acara>/foto|musik/...
import { useEffect, useState } from "react";
import contoh from "../../../supabase/contoh-acara.json";
import type { Konten } from "@/lib/tipe";
import type { Acara, BerkasMedia, HasilUndang, KelolaApi, KlienBaris } from "@/lib/kelola/tipe";
import { dariInputWaktu, formatUkuran, pilahBerkas, POLA_SLUG, slugDariNama, SLUG_TERLARANG, waktuWib } from "@/lib/kelola/util";
import { Isian, Modal, pesanGalat, salinTeks, type BeriTahu } from "./bersama";

type Jendela = { jenis: "baru" } | { jenis: "akun" | "file" | "hapus"; r: KlienBaris };

export default function TabKlien({
  api,
  daftar,
  acaraId,
  versi,
  asal,
  beriTahu,
  onDibuat,
  onDihapus,
  onKelola,
}: {
  api: KelolaApi;
  daftar: Acara[];
  acaraId: string | null;
  versi: number;
  asal: string;
  beriTahu: BeriTahu;
  onDibuat: (a: Acara) => void;
  onDihapus: (id: string) => void;
  onKelola: (id: string) => void;
}) {
  const [baris, setBaris] = useState<KlienBaris[] | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [jendela, setJendela] = useState<Jendela | null>(null);
  const [muat, setMuat] = useState(0);

  useEffect(() => {
    let batal = false;
    api.daftarKlien().then(
      (d) => {
        if (batal) return;
        setBaris(d);
        setGalat("");
      },
      (e) => !batal && setGalat(pesanGalat(e)),
    );
    return () => {
      batal = true;
    };
  }, [api, versi, muat, daftar.length]);

  const q = cari.trim().toLowerCase();
  const tampil = (baris ?? []).filter((r) => !q || `${r.nama} ${r.slug} ${r.owner_email ?? ""}`.toLowerCase().includes(q));
  const host = asal.replace(/^https?:\/\//, "");

  return (
    <div className="kl-tumpuk">
      <div className="kl-kartu kl-tumpuk-kecil">
        <div className="kl-daftar-kepala">
          <div>
            <h2 className="kl-judul">Klien &amp; acara</h2>
            <p className="kl-kecil kl-redup">{baris ? `${baris.length} acara · tiap acara punya folder file sendiri` : "Memuat…"}</p>
          </div>
          <button type="button" className="kl-btn kl-btn-utama" onClick={() => setJendela({ jenis: "baru" })}>
            + Buat acara baru
          </button>
        </div>
        {(baris?.length ?? 0) > 5 && <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, alamat link, atau email klien" aria-label="Cari acara" />}
      </div>

      {galat && (
        <p className="kl-galat" role="alert">
          {galat}
        </p>
      )}
      {baris && tampil.length === 0 && <p className="kl-kosong">{q ? "Tidak ada acara yang cocok." : "Belum ada acara. Klik “Buat acara baru”."}</p>}

      {tampil.map((r) => (
        <article key={r.id} className={`kl-kartu kl-klien ${r.id === acaraId ? "kl-klien-aktif" : ""}`} aria-label={`Acara ${r.nama}`}>
          <div className="kl-klien-kepala">
            <div>
              <h3>{r.nama}</h3>
              <a className="kl-tautan kl-kecil" href={`${asal}/${r.slug}`} target="_blank" rel="noopener noreferrer">
                {host}/{r.slug}
              </a>
            </div>
            {r.id === acaraId && <span className="kl-lencana">Sedang dibuka</span>}
          </div>
          <dl className="kl-klien-info">
            <div>
              <dt>Tanggal</dt>
              <dd>{waktuWib(r.waktu_acara)}</dd>
            </div>
            <div>
              <dt>Akun klien</dt>
              <dd>{r.owner_email ?? <span className="kl-redup">Belum disambungkan</span>}</dd>
            </div>
            <div>
              <dt>Tamu</dt>
              <dd>
                {r.jumlah_tamu} tamu · {r.sudah_jawab} menjawab · {r.hadir} orang hadir
              </dd>
            </div>
          </dl>
          <div className="kl-baris-tombol">
            <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => onKelola(r.id)}>
              Kelola
            </button>
            <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => setJendela({ jenis: "akun", r })}>
              {r.owner_email ? "Atur akun" : "Undang klien"}
            </button>
            <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setJendela({ jenis: "file", r })}>
              Cek file
            </button>
            <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil kl-merah" onClick={() => setJendela({ jenis: "hapus", r })}>
              Hapus
            </button>
          </div>
        </article>
      ))}

      {jendela?.jenis === "baru" && (
        <BuatAcara
          api={api}
          slugTerpakai={new Set((baris ?? []).map((r) => r.slug).concat(daftar.map((a) => a.slug)))}
          onTutup={() => setJendela(null)}
          onDibuat={(a) => {
            setJendela(null);
            onDibuat(a);
            beriTahu("Acara dibuat. Berikutnya: isi undangan, lalu undang klien.");
          }}
        />
      )}
      {jendela?.jenis === "akun" && (
        <AkunKlien
          api={api}
          r={jendela.r}
          asal={asal}
          beriTahu={beriTahu}
          onTutup={() => setJendela(null)}
          onBerubah={() => setMuat((m) => m + 1)}
        />
      )}
      {jendela?.jenis === "file" && <CekFile api={api} r={jendela.r} beriTahu={beriTahu} onTutup={() => setJendela(null)} />}
      {jendela?.jenis === "hapus" && (
        <HapusAcara
          api={api}
          r={jendela.r}
          onTutup={() => setJendela(null)}
          onDihapus={() => {
            setJendela(null);
            onDihapus(jendela.r.id);
            beriTahu(`Acara ${jendela.r.nama} dihapus beserta tamu, ucapan, dan filenya.`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buat acara baru: isi awal dari contoh Kastil Cahaya (rekening dikosongkan)
// ---------------------------------------------------------------------------
const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function kontenAwal(pria: string, wanita: string, waktu: string) {
  const geser = Date.parse(waktu) - Date.parse(contoh.waktu_acara);
  const pindah = (iso: string | null) => (iso ? new Date(Date.parse(iso) + geser).toISOString() : null);
  const k = salin(contoh.konten) as Konten;
  k.mempelai.pria = { ...k.mempelai.pria, panggilan: pria, nama_lengkap: pria, orang_tua: "Bapak … & Ibu …", instagram: null };
  k.mempelai.wanita = { ...k.mempelai.wanita, panggilan: wanita, nama_lengkap: wanita, orang_tua: "Bapak … & Ibu …", instagram: null };
  k.acara = k.acara.map((s) => ({ ...s, mulai: pindah(s.mulai)!, selesai: pindah(s.selesai ?? null) }));
  k.turut_mengundang = [];
  return { konten: k, batas_rsvp: pindah(contoh.batas_rsvp), aktif_sampai: pindah(contoh.aktif_sampai) };
}

function BuatAcara({ api, slugTerpakai, onTutup, onDibuat }: { api: KelolaApi; slugTerpakai: Set<string>; onTutup: () => void; onDibuat: (a: Acara) => void }) {
  const [pria, setPria] = useState("");
  const [wanita, setWanita] = useState("");
  const [waktu, setWaktu] = useState("");
  const [slugManual, setSlugManual] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const slug = slugManual ?? slugDariNama(pria, wanita);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const p = pria.trim();
    const w = wanita.trim();
    const iso = dariInputWaktu(waktu);
    if (!p || !w) return setGalat("Isi nama panggilan kedua mempelai.");
    if (!iso) return setGalat("Isi tanggal & jam acara.");
    if (!POLA_SLUG.test(slug) || slug.length < 3 || slug.length > 60) return setGalat("Alamat link hanya boleh huruf kecil, angka, dan tanda hubung (3–60 karakter), mis. budi-ani.");
    if (SLUG_TERLARANG.has(slug)) return setGalat("Alamat itu dipakai sistem. Pilih yang lain.");
    if (slugTerpakai.has(slug)) return setGalat("Alamat link itu sudah dipakai acara lain.");
    setGalat("");
    setSibuk(true);
    try {
      const awal = kontenAwal(p, w, iso);
      onDibuat(await api.buatAcara({ slug, waktu_acara: iso, batas_rsvp: awal.batas_rsvp, aktif_sampai: awal.aktif_sampai, konten: awal.konten, hadiah: { rekening: [], alamat: null } }));
    } catch (er) {
      setGalat(pesanGalat(er));
      setSibuk(false);
    }
  }

  return (
    <Modal
      judul="Buat acara baru"
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          <button type="submit" form="kl-form-acara" className="kl-btn kl-btn-utama" disabled={sibuk}>
            {sibuk ? "Membuat…" : "Buat acara"}
          </button>
        </>
      }
    >
      <form id="kl-form-acara" className="kl-tumpuk-kecil" onSubmit={kirim}>
        <div className="kl-grid-2">
          <Isian label="Panggilan mempelai pria" wajib>
            <input value={pria} onChange={(e) => setPria(e.target.value)} maxLength={40} data-fokus />
          </Isian>
          <Isian label="Panggilan mempelai wanita" wajib>
            <input value={wanita} onChange={(e) => setWanita(e.target.value)} maxLength={40} />
          </Isian>
        </div>
        <Isian label="Tanggal & jam acara (WIB)" wajib>
          <input type="datetime-local" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
        </Isian>
        <Isian label="Alamat link" bantuan={`Undangan tamu: …/${slug || "budi-ani"}/kode-tamu`}>
          <input value={slug} onChange={(e) => setSlugManual(e.target.value.toLowerCase().replace(/\s+/g, "-"))} maxLength={60} placeholder="budi-ani" />
        </Isian>
        <p className="kl-catatan kl-kecil">Isi awal memakai contoh tema Kastil Cahaya (foto, kisah, dan jadwal contoh) supaya undangan langsung terlihat utuh. Ganti lewat tab Isi undangan. Rekening dikosongkan.</p>
        {galat && (
          <p className="kl-galat" role="alert">
            {galat}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Akun klien: kirim undangan lewat email (akun dibuat otomatis, acara langsung tersambung)
// atau sambungkan akun yang sudah ada tanpa email.
// ---------------------------------------------------------------------------
type HasilAkun = { cara: "undang"; email: string; status: HasilUndang["status"] } | { cara: "sambung"; email: string };

function AkunKlien({ api, r, asal, beriTahu, onTutup, onBerubah }: { api: KelolaApi; r: KlienBaris; asal: string; beriTahu: BeriTahu; onTutup: () => void; onBerubah: () => void }) {
  const [email, setEmail] = useState(r.owner_email ?? "");
  const [hasil, setHasil] = useState<HasilAkun | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState<"" | "undang" | "sambung" | "lepas">("");
  const [tersalin, setTersalin] = useState(false);
  const alamat = email.trim().toLowerCase();

  function emailBenar() {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alamat)) return true;
    setGalat("Tulis email klien yang benar.");
    return false;
  }

  async function undang(e: React.FormEvent) {
    e.preventDefault();
    if (!emailBenar()) return;
    setGalat("");
    setSibuk("undang");
    try {
      const h = await api.undangKlien(r.id, alamat);
      setHasil({ cara: "undang", ...h });
      onBerubah();
      beriTahu(h.status === "diundang" ? "Undangan terkirim ke email klien" : "Akun klien tersambung");
    } catch (er) {
      setGalat(pesanGalat(er));
    } finally {
      setSibuk("");
    }
  }

  async function sambungkan() {
    if (!emailBenar()) return;
    setGalat("");
    setSibuk("sambung");
    try {
      const h = await api.sambungkanPemilik(r.id, alamat);
      setHasil({ cara: "sambung", email: h ?? alamat });
      onBerubah();
      beriTahu("Akun klien tersambung");
    } catch (er) {
      setGalat(pesanGalat(er));
    } finally {
      setSibuk("");
    }
  }

  async function lepaskan() {
    if (!window.confirm(`Lepaskan ${r.owner_email} dari acara ${r.nama}? Akun itu tidak bisa membuka dashboard acara ini lagi.`)) return;
    setSibuk("lepas");
    try {
      await api.sambungkanPemilik(r.id, null);
      onBerubah();
      beriTahu("Akun klien dilepas");
      onTutup();
    } catch (er) {
      setGalat(pesanGalat(er));
      setSibuk("");
    }
  }

  const pesan = !hasil
    ? ""
    : hasil.cara === "undang" && hasil.status === "diundang"
      ? `Halo, undangan untuk mengelola dashboard undangan ${r.nama} sudah kami kirim ke email ${hasil.email}.\n\nBuka email dari Momenmu (cek juga folder Spam atau Promosi), klik tautannya, lalu buat kata sandi. Setelah itu dashboard bisa dibuka kapan saja di ${asal}/kelola`
      : hasil.cara === "undang"
        ? `Halo, dashboard undangan ${r.nama} sudah bisa dibuka di ${asal}/kelola\n\nMasuk dengan email ${hasil.email} dan kata sandi Anda. Lupa kata sandi? Klik “Lupa kata sandi?” di halaman masuk.`
        : `Halo, dashboard undangan ${r.nama} sudah siap diisi.\n\nBuka: ${asal}/kelola\nEmail: ${hasil.email}\nKata sandi: dikirim terpisah\n\nSetelah masuk, mohon ganti kata sandi di menu Pengaturan.`;

  return (
    <Modal
      judul={`Akun klien — ${r.nama}`}
      onTutup={onTutup}
      kaki={
        hasil ? (
          <button type="button" className="kl-btn kl-btn-utama" onClick={onTutup}>
            Selesai
          </button>
        ) : (
          <>
            {r.owner_email && (
              <button type="button" className="kl-btn kl-btn-teks kl-merah" onClick={lepaskan} disabled={!!sibuk}>
                Lepaskan akun
              </button>
            )}
            <button type="button" className="kl-btn kl-btn-garis" onClick={sambungkan} disabled={!!sibuk}>
              {sibuk === "sambung" ? "Menyambungkan…" : "Sambungkan saja"}
            </button>
            <button type="submit" form="kl-form-akun" className="kl-btn kl-btn-utama" disabled={!!sibuk}>
              {sibuk === "undang" ? "Mengirim…" : "Kirim undangan"}
            </button>
          </>
        )
      }
    >
      {hasil ? (
        <div className="kl-tumpuk-kecil">
          {hasil.cara === "undang" && hasil.status === "diundang" ? (
            <>
              <p className="kl-berhasil" role="status">
                ✓ Undangan terkirim ke <b>{hasil.email}</b>
              </p>
              <p>Acara ini sudah tersambung ke email itu. Klien tinggal membuka email dari Momenmu, klik tautannya, lalu membuat kata sandi. Dashboard acaranya langsung terbuka.</p>
              <p className="kl-kecil kl-redup">Link di email berlaku terbatas. Kalau klien terlambat membukanya, buka menu ini lagi lalu klik Kirim undangan.</p>
            </>
          ) : hasil.cara === "undang" ? (
            <p>
              <b>{hasil.email}</b> sudah punya akun, jadi acara ini langsung disambungkan tanpa email undangan. Klien cukup masuk seperti biasa.
            </p>
          ) : (
            <p>
              <b>{hasil.email}</b> sekarang memegang acara ini. Kirim pesan ini ke klien, lalu kirim kata sandinya terpisah:
            </p>
          )}
          {hasil.cara === "undang" && <p className="kl-kecil">Kabari klien lewat WhatsApp (opsional):</p>}
          <pre className="kl-kode-blok kl-pesan-blok">{pesan}</pre>
          <div className="kl-baris-tombol">
            <button type="button" className="kl-btn kl-btn-garis" onClick={async () => setTersalin(await salinTeks(pesan))}>
              {tersalin ? "Tersalin ✓" : "Salin pesan"}
            </button>
          </div>
        </div>
      ) : (
        <form id="kl-form-akun" className="kl-tumpuk-kecil" onSubmit={undang} noValidate>
          <p>
            Ketik email klien, lalu klik <b>Kirim undangan</b>. Akunnya dibuat otomatis, klien menerima email untuk membuat kata sandi, dan acara ini langsung tersambung.
          </p>
          <Isian label="Email klien" wajib>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setGalat("");
              }}
              placeholder="klien@email.com"
              data-fokus
            />
          </Isian>
          <p className="kl-kecil kl-redup">
            Mau tanpa email? Klik <b>Sambungkan saja</b> (akunnya harus sudah ada). Klien hanya bisa melihat & mengubah acaranya sendiri; satu akun boleh memegang lebih dari satu acara.
          </p>
          {galat && (
            <p className="kl-galat" role="alert">
              {galat}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cek file di folder acara & hapus yang tidak dipakai lagi
// ---------------------------------------------------------------------------
function CekFile({ api, r, beriTahu, onTutup }: { api: KelolaApi; r: KlienBaris; beriTahu: BeriTahu; onTutup: () => void }) {
  // file folder acara + isi terbaru semua undangan (dibaca dari database, bukan data saat dashboard dibuka)
  const [data, setData] = useState<{ berkas: BerkasMedia[]; acara: Acara[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [muat, setMuat] = useState(0);

  useEffect(() => {
    let batal = false;
    Promise.all([api.daftarBerkas(r.id), api.daftarAcara()]).then(
      ([berkas, acara]) => !batal && setData({ berkas, acara }),
      (e) => !batal && setGalat(pesanGalat(e)),
    );
    return () => {
      batal = true;
    };
  }, [api, r.id, muat]);

  const berkas = data?.berkas ?? null;
  const { buang: tidakDipakai, baru } = pilahBerkas(berkas ?? [], data?.acara ?? []);
  const total = (berkas ?? []).reduce((n, b) => n + b.ukuran, 0);
  const totalBuang = tidakDipakai.reduce((n, b) => n + b.ukuran, 0);

  async function bersihkan() {
    setSibuk(true);
    try {
      // Baca ulang tepat sebelum menghapus: foto yang baru disimpan klien sejak jendela ini dibuka tidak ikut terhapus.
      // Yang dihapus hanya file yang tadi ditampilkan dan sampai sekarang masih tidak dipakai.
      const [berkasKini, acaraKini] = await Promise.all([api.daftarBerkas(r.id), api.daftarAcara()]);
      const disetujui = new Set(tidakDipakai.map((b) => b.url));
      const buang = pilahBerkas(berkasKini, acaraKini).buang.filter((b) => disetujui.has(b.url));
      const n = buang.length ? await api.hapusBerkas(r.id, buang.map((b) => b.url)) : 0;
      beriTahu(`${n} file tidak terpakai dihapus`);
      setMuat((m) => m + 1);
    } catch (e) {
      setGalat(pesanGalat(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <Modal
      judul={`File — ${r.nama}`}
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Tutup
          </button>
          <button type="button" className="kl-btn kl-btn-utama" onClick={bersihkan} disabled={sibuk || tidakDipakai.length === 0}>
            {sibuk ? "Menghapus…" : `Hapus ${tidakDipakai.length} file tidak terpakai`}
          </button>
        </>
      }
    >
      {!berkas && !galat && <p className="kl-redup">Memeriksa folder…</p>}
      {berkas && (
        <div className="kl-tumpuk-kecil">
          <p>
            <b>{berkas.length} file</b> · {formatUkuran(total)} di folder acara ini.
          </p>
          <p>{tidakDipakai.length ? `${tidakDipakai.length} file (${formatUkuran(totalBuang)}) tidak dipakai di undangan — biasanya foto yang diunggah lalu tidak jadi dipakai.` : baru.length ? "Belum ada file yang aman dihapus." : "Semua file dipakai di undangan."}</p>
          {baru.length > 0 && <p className="kl-kecil kl-redup">{baru.length} file tidak dipakai tapi diunggah kurang dari 24 jam lalu, jadi dilewati dulu (mungkin klien belum klik Simpan).</p>}
          <p className="kl-kecil kl-redup">File yang diunggah sebelum fitur folder per acara ada tidak ikut terhitung di sini.</p>
        </div>
      )}
      {galat && (
        <p className="kl-galat" role="alert">
          {galat}
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Hapus acara (permanen) — konfirmasi dengan mengetik alamat link
// ---------------------------------------------------------------------------
function HapusAcara({ api, r, onTutup, onDihapus }: { api: KelolaApi; r: KlienBaris; onTutup: () => void; onDihapus: () => void }) {
  const [ketik, setKetik] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const cocok = ketik.trim().toLowerCase() === r.slug;

  async function hapus() {
    setSibuk(true);
    try {
      await api.hapusAcara(r.id);
      onDihapus();
    } catch (e) {
      setGalat(pesanGalat(e));
      setSibuk(false);
    }
  }

  return (
    <Modal
      judul={`Hapus acara ${r.nama}?`}
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          <button type="button" className="kl-btn kl-btn-bahaya" onClick={hapus} disabled={!cocok || sibuk}>
            {sibuk ? "Menghapus…" : "Hapus permanen"}
          </button>
        </>
      }
    >
      <div className="kl-tumpuk-kecil">
        <p>
          Semua link tamu ({r.jumlah_tamu} tamu), ucapan, dan file foto/musik acara ini ikut terhapus dan <b>tidak bisa dikembalikan</b>. Kalau masih perlu, unduh dulu Excel tamu & ucapan dari tab masing-masing.
        </p>
        <Isian label={`Ketik ${r.slug} untuk konfirmasi`}>
          <input value={ketik} onChange={(e) => setKetik(e.target.value)} autoComplete="off" data-fokus />
        </Isian>
        {galat && (
          <p className="kl-galat" role="alert">
            {galat}
          </p>
        )}
      </div>
    </Modal>
  );
}
