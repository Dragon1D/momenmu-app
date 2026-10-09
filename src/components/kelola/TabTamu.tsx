"use client";
// Tab "Tamu": daftar ±500 tamu, cari & saring, tambah/ubah/hapus, impor dari Excel,
// ekspor, kirim WhatsApp (satu-satu atau berurutan), reset perangkat, ganti kode link.
import { memo, useCallback, useId, useMemo, useRef, useState } from "react";
import type { Acara, KelolaApi, TamuBaris, UbahTamu } from "@/lib/kelola/tipe";
import { bacaImpor, bacaTabel, isiPesan, keCsv, keTsv, kodeUnik, kunciTamu, linkTamu, linkWa, PESAN_WA_BAWAAN, rapikanTelepon, tabelEkspor, unduh, waktuWib } from "@/lib/kelola/util";
import { bacaXlsx, tulisXlsx } from "@/lib/kelola/xlsx";
import { tanggalPanjang } from "@/lib/format";
import { formatTelepon, Isian, KATEGORI_BAWAAN, Modal, pesanGalat, PRATINJAU, salinTeks, type BeriTahu } from "./bersama";

export type FilterTamu = "" | "belum-kirim" | "terkirim" | "dibuka" | "hadir" | "tidak" | "belum-jawab" | "tanpa-wa" | "terkunci";

const FILTER: { id: FilterTamu; label: string }[] = [
  { id: "", label: "Semua status" },
  { id: "belum-kirim", label: "Belum dikirim" },
  { id: "terkirim", label: "Terkirim, belum dibuka" },
  { id: "dibuka", label: "Sudah dibuka" },
  { id: "hadir", label: "Akan hadir" },
  { id: "tidak", label: "Berhalangan" },
  { id: "belum-jawab", label: "Belum menjawab" },
  { id: "tanpa-wa", label: "Tanpa nomor WA" },
  { id: "terkunci", label: "Link terkunci (HP penuh)" },
];

type Urut = "input" | "nama" | "terbaru" | "aktivitas";

type ModalTamu =
  | null
  | { jenis: "tambah" }
  | { jenis: "ubah"; id: string }
  | { jenis: "impor" }
  | { jenis: "kirim"; antrian: TamuBaris[] }
  | { jenis: "template" }
  | { jenis: "ekspor" }
  | { jenis: "kategori" };

const sudahDikirim = (t: TamuBaris) => !!t.dikirim_pada || t.status !== "baru";
const aktivitasTerakhir = (t: TamuBaris) => t.dijawab_pada ?? t.dibuka_pada ?? t.dikirim_pada ?? "";

function cocokFilter(t: TamuBaris, f: FilterTamu, batas: number): boolean {
  switch (f) {
    case "":
      return true;
    case "belum-kirim":
      return !sudahDikirim(t);
    case "terkirim":
      return sudahDikirim(t) && !t.dibuka_pada;
    case "dibuka":
      return !!t.dibuka_pada;
    case "hadir":
      return t.status === "hadir";
    case "tidak":
      return t.status === "tidak";
    case "belum-jawab":
      return t.status !== "hadir" && t.status !== "tidak";
    case "tanpa-wa":
      return !t.telepon;
    case "terkunci":
      return batas > 0 && t.perangkat.length >= batas;
  }
}

function labelTamu(t: TamuBaris): string {
  if (t.status === "hadir") return `Hadir · ${t.jumlah_hadir ?? 1} org`;
  if (t.status === "tidak") return "Berhalangan";
  if (t.status === "dibuka" || t.dibuka_pada) return "Sudah dibuka";
  if (sudahDikirim(t)) return "Terkirim";
  return "Belum dikirim";
}

const kelasStatus = (t: TamuBaris) => (t.status === "hadir" ? "hadir" : t.status === "tidak" ? "tidak" : t.dibuka_pada ? "dibuka" : sudahDikirim(t) ? "terkirim" : "baru");

interface Props {
  api: KelolaApi;
  acara: Acara;
  tamu: TamuBaris[];
  ubahTamu: (f: (t: TamuBaris[]) => TamuBaris[]) => void;
  perbaruiAcara: (a: Acara) => void;
  beriTahu: BeriTahu;
  filter: FilterTamu;
  setFilter: (f: FilterTamu) => void;
  asal: string;
}

export default function TabTamu({ api, acara, tamu, ubahTamu, perbaruiAcara, beriTahu, filter, setFilter, asal }: Props) {
  const [cari, setCari] = useState("");
  const [kategori, setKategori] = useState("");
  const [urut, setUrut] = useState<Urut>("input");
  const [batasTampil, setBatasTampil] = useState(50);
  const [pilih, setPilih] = useState<Set<string>>(() => new Set());
  const [modal, setModal] = useState<ModalTamu>(null);
  const [sibuk, setSibuk] = useState(false);

  const batas = acara.batas_perangkat;
  const kategoriList = useMemo(() => {
    const s = new Set(KATEGORI_BAWAAN);
    for (const t of tamu) if (t.kategori !== PRATINJAU) s.add(t.kategori);
    return [...s];
  }, [tamu]);
  const kategoriAda = useMemo(() => [...new Set(tamu.map((t) => t.kategori))].sort((a, b) => a.localeCompare(b, "id")), [tamu]);
  const kodeAda = useMemo(() => tamu.map((t) => t.kode), [tamu]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const digit = q.replace(/\D/g, "");
    const tel = digit.startsWith("0") ? "62" + digit.slice(1) : digit;
    let d = tamu.filter((t) => {
      if (kategori && t.kategori !== kategori) return false;
      if (!cocokFilter(t, filter, batas)) return false;
      if (!q) return true;
      return t.nama.toLowerCase().includes(q) || t.kode === q || t.kategori.toLowerCase().includes(q) || (tel.length >= 4 && !!t.telepon?.includes(tel));
    });
    if (urut === "nama") d = [...d].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
    else if (urut === "terbaru") d = [...d].reverse();
    else if (urut === "aktivitas") d = [...d].sort((a, b) => aktivitasTerakhir(b).localeCompare(aktivitasTerakhir(a)));
    return d;
  }, [tamu, cari, kategori, filter, urut, batas]);

  const terpilih = useMemo(() => tamu.filter((t) => pilih.has(t.id)), [tamu, pilih]);
  const semuaTerpilih = tersaring.length > 0 && tersaring.every((t) => pilih.has(t.id));

  // ---------- pesan WhatsApp ----------
  const mempelai = `${acara.konten.mempelai.pria.panggilan} & ${acara.konten.mempelai.wanita.panggilan}`;
  const tanggal = tanggalPanjang(acara.waktu_acara);
  const template = acara.konten.pesan_wa || PESAN_WA_BAWAAN;
  const buatPesan = useCallback(
    (tpl: string, t: TamuBaris | undefined) => isiPesan(tpl, { nama: t?.nama ?? "Bapak/Ibu/Saudara/i", link: t ? linkTamu(asal, acara.slug, t.kode) : `${asal}/${acara.slug}/kode-tamu`, mempelai, tanggal }),
    [asal, acara.slug, mempelai, tanggal],
  );
  const pesanUntuk = useCallback((t: TamuBaris) => buatPesan(template, t), [buatPesan, template]);

  // ---------- aksi ----------
  const tandai = useCallback(
    async (ids: string[]) => {
      const set = new Set(ids);
      const waktu = new Date().toISOString();
      try {
        await api.tandaiTerkirim(ids);
        ubahTamu((d) => d.map((t): TamuBaris => (set.has(t.id) ? { ...t, dikirim_pada: t.dikirim_pada ?? waktu, status: t.status === "baru" ? "terkirim" : t.status } : t)));
        return true;
      } catch (e) {
        beriTahu(pesanGalat(e), "galat");
        return false;
      }
    },
    [api, ubahTamu, beriTahu],
  );

  const kirimWa = useCallback(
    (t: TamuBaris) => {
      window.open(linkWa(t.telepon, pesanUntuk(t)), "_blank", "noopener");
      void tandai([t.id]);
    },
    [pesanUntuk, tandai],
  );

  const salinLink = useCallback(
    async (t: TamuBaris) => {
      const ok = await salinTeks(linkTamu(asal, acara.slug, t.kode));
      beriTahu(ok ? `Link untuk ${t.nama} disalin` : "Gagal menyalin link.", ok ? "ok" : "galat");
    },
    [asal, acara.slug, beriTahu],
  );

  const togglePilih = useCallback((id: string) => {
    setPilih((p) => {
      const b = new Set(p);
      if (b.has(id)) b.delete(id);
      else b.add(id);
      return b;
    });
  }, []);
  const bukaUbah = useCallback((id: string) => setModal({ jenis: "ubah", id }), []);

  async function muatUlangTamu() {
    try {
      const d = await api.daftarTamu(acara.id);
      ubahTamu(() => d);
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    }
  }

  function bukaKirim() {
    const antrian = terpilih.length ? terpilih : tersaring.filter((t) => !sudahDikirim(t) && t.kategori !== PRATINJAU);
    if (!antrian.length) {
      beriTahu("Semua tamu di daftar ini sudah dikirimi. Pilih tamu tertentu untuk kirim ulang.", "galat");
      return;
    }
    setModal({ jenis: "kirim", antrian });
  }

  async function aksiBanyak(aksi: "terkirim" | "reset" | "hapus") {
    const ids = terpilih.map((t) => t.id);
    if (!ids.length) return;
    if (aksi === "hapus" && !window.confirm(`Hapus ${ids.length} tamu? Link mereka tidak bisa dibuka lagi. Ucapan yang sudah masuk tetap tersimpan.`)) return;
    if (aksi === "reset" && !window.confirm(`Reset perangkat ${ids.length} tamu? Link mereka bisa dibuka lagi di HP mana pun (sampai batas ${batas || "—"} HP).`)) return;
    setSibuk(true);
    const set = new Set(ids);
    try {
      if (aksi === "terkirim") {
        if (await tandai(ids)) beriTahu(`${ids.length} tamu ditandai terkirim`);
      } else if (aksi === "reset") {
        await api.ubahBanyakTamu(ids, { perangkat: [] });
        ubahTamu((d) => d.map((t) => (set.has(t.id) ? { ...t, perangkat: [] } : t)));
        beriTahu(`Perangkat ${ids.length} tamu sudah di-reset`);
      } else {
        await api.hapusTamu(ids);
        ubahTamu((d) => d.filter((t) => !set.has(t.id)));
        setPilih(new Set());
        beriTahu(`${ids.length} tamu dihapus`);
      }
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setSibuk(false);
    }
  }

  async function salinTerpilih() {
    const teks = terpilih.map((t) => `${t.nama}\t${linkTamu(asal, acara.slug, t.kode)}`).join("\n");
    const ok = await salinTeks(teks);
    beriTahu(ok ? `${terpilih.length} link disalin (nama + link, bisa ditempel ke Excel)` : "Gagal menyalin.", ok ? "ok" : "galat");
  }

  async function ubahKategoriBanyak(k: string) {
    const ids = terpilih.map((t) => t.id);
    const set = new Set(ids);
    await api.ubahBanyakTamu(ids, { kategori: k });
    ubahTamu((d) => d.map((t) => (set.has(t.id) ? { ...t, kategori: k } : t)));
    beriTahu(`Kategori ${ids.length} tamu diubah menjadi "${k}"`);
    setModal(null);
  }

  function setelahSimpan(t: TamuBaris, baru: boolean, lanjut = false) {
    ubahTamu((d) => (baru ? [...d, t] : d.map((x) => (x.id === t.id ? t : x))));
    beriTahu(baru ? `${t.nama} ditambahkan` : `Data ${t.nama} disimpan`);
    if (!lanjut) setModal(null);
  }

  const tampil = tersaring.slice(0, batasTampil);
  const tamuDiubah = modal?.jenis === "ubah" ? tamu.find((t) => t.id === modal.id) ?? null : null;

  return (
    <div className="kl-tumpuk">
      <div className="kl-kartu kl-alat">
        <div className="kl-baris-tombol">
          <button type="button" className="kl-btn kl-btn-utama" onClick={() => setModal({ jenis: "tambah" })}>
            + Tambah tamu
          </button>
          <button type="button" className="kl-btn kl-btn-garis" onClick={() => setModal({ jenis: "impor" })}>
            Impor dari Excel
          </button>
          <button type="button" className="kl-btn kl-btn-wa" onClick={bukaKirim}>
            Kirim WA berurutan
          </button>
          <button type="button" className="kl-btn kl-btn-teks" onClick={() => setModal({ jenis: "template" })}>
            Atur pesan WA
          </button>
          <button type="button" className="kl-btn kl-btn-teks" onClick={() => setModal({ jenis: "ekspor" })}>
            Unduh daftar
          </button>
        </div>
        <div className="kl-saring">
          <input
            type="search"
            placeholder="Cari nama, nomor WA, atau kode…"
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setBatasTampil(50);
            }}
            aria-label="Cari tamu"
          />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as FilterTamu);
              setBatasTampil(50);
            }}
            aria-label="Saring status"
          >
            {FILTER.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={kategori}
            onChange={(e) => {
              setKategori(e.target.value);
              setBatasTampil(50);
            }}
            aria-label="Saring kategori"
          >
            <option value="">Semua kategori</option>
            {kategoriAda.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select value={urut} onChange={(e) => setUrut(e.target.value as Urut)} aria-label="Urutkan">
            <option value="input">Urutan input</option>
            <option value="nama">Nama A–Z</option>
            <option value="terbaru">Terakhir ditambah</option>
            <option value="aktivitas">Aktivitas terbaru</option>
          </select>
        </div>
      </div>

      {terpilih.length > 0 && (
        <div className="kl-bulk" role="region" aria-label="Aksi untuk tamu terpilih">
          <strong>{terpilih.length} dipilih</strong>
          <button type="button" className="kl-btn kl-btn-wa kl-btn-kecil" onClick={bukaKirim} disabled={sibuk}>
            Kirim WA
          </button>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => aksiBanyak("terkirim")} disabled={sibuk}>
            Tandai terkirim
          </button>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={salinTerpilih} disabled={sibuk}>
            Salin link
          </button>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => setModal({ jenis: "kategori" })} disabled={sibuk}>
            Ubah kategori
          </button>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => aksiBanyak("reset")} disabled={sibuk}>
            Reset perangkat
          </button>
          <button type="button" className="kl-btn kl-btn-bahaya kl-btn-kecil" onClick={() => aksiBanyak("hapus")} disabled={sibuk}>
            Hapus
          </button>
          <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => setPilih(new Set())}>
            Batal pilih
          </button>
        </div>
      )}

      <div className="kl-kartu kl-daftar-kartu">
        <div className="kl-daftar-kepala">
          <label className="kl-cek-label">
            <input type="checkbox" checked={semuaTerpilih} onChange={() => setPilih(semuaTerpilih ? new Set() : new Set(tersaring.map((t) => t.id)))} disabled={!tersaring.length} />
            Pilih semua hasil ({tersaring.length})
          </label>
          <span className="kl-redup kl-kecil">
            {tersaring.length === tamu.length ? `${tamu.length} tamu` : `${tersaring.length} dari ${tamu.length} tamu`}
          </span>
        </div>
        {tersaring.length === 0 ? (
          <p className="kl-kosong-kecil">{tamu.length ? "Tidak ada tamu yang cocok dengan pencarian/saringan." : "Belum ada tamu. Klik “+ Tambah tamu” atau “Impor dari Excel”."}</p>
        ) : (
          <div className="kl-daftar">
            {tampil.map((t) => (
              <BarisTamu key={t.id} t={t} dipilih={pilih.has(t.id)} batas={batas} onPilih={togglePilih} onWa={kirimWa} onSalin={salinLink} onUbah={bukaUbah} />
            ))}
          </div>
        )}
        {tersaring.length > batasTampil && (
          <button type="button" className="kl-btn kl-btn-garis kl-btn-penuh" onClick={() => setBatasTampil((b) => b + 100)}>
            Tampilkan lebih banyak ({tersaring.length - batasTampil} lagi)
          </button>
        )}
      </div>

      {(modal?.jenis === "tambah" || (modal?.jenis === "ubah" && tamuDiubah)) && (
        <FormTamu
          key={modal.jenis === "ubah" ? modal.id : "baru"}
          api={api}
          acara={acara}
          awal={tamuDiubah}
          kategoriList={kategoriList}
          kodeAda={kodeAda}
          asal={asal}
          onSimpan={setelahSimpan}
          onPerbarui={(t) => ubahTamu((d) => d.map((x) => (x.id === t.id ? t : x)))}
          onHapus={(t) => {
            ubahTamu((d) => d.filter((x) => x.id !== t.id));
            beriTahu(`${t.nama} dihapus`);
            setModal(null);
          }}
          onKirimWa={kirimWa}
          onTutup={() => setModal(null)}
          beriTahu={beriTahu}
        />
      )}
      {modal?.jenis === "impor" && (
        <ImporTamu
          api={api}
          acara={acara}
          tamu={tamu}
          kategoriList={kategoriList}
          onSelesai={(baru) => {
            ubahTamu((d) => [...d, ...baru]);
            beriTahu(`${baru.length} tamu berhasil diimpor`);
            setModal(null);
          }}
          onGagal={muatUlangTamu}
          onTutup={() => setModal(null)}
        />
      )}
      {modal?.jenis === "kirim" && <KirimBerurutan antrian={modal.antrian} pesanUntuk={pesanUntuk} onKirim={kirimWa} onTutup={() => setModal(null)} />}
      {modal?.jenis === "template" && (
        <TemplateWa api={api} acara={acara} contoh={tersaring.find((t) => t.kategori !== PRATINJAU) ?? tamu[0]} buatPesan={buatPesan} perbaruiAcara={perbaruiAcara} beriTahu={beriTahu} onTutup={() => setModal(null)} />
      )}
      {modal?.jenis === "ekspor" && <EksporTamu semua={tamu} tersaring={tersaring} acara={acara} asal={asal} beriTahu={beriTahu} onTutup={() => setModal(null)} />}
      {modal?.jenis === "kategori" && <UbahKategori jumlah={terpilih.length} kategoriList={kategoriList} onSimpan={ubahKategoriBanyak} onTutup={() => setModal(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Satu baris tamu
// ---------------------------------------------------------------------------
const BarisTamu = memo(function BarisTamu({
  t,
  dipilih,
  batas,
  onPilih,
  onWa,
  onSalin,
  onUbah,
}: {
  t: TamuBaris;
  dipilih: boolean;
  batas: number;
  onPilih: (id: string) => void;
  onWa: (t: TamuBaris) => void;
  onSalin: (t: TamuBaris) => void;
  onUbah: (id: string) => void;
}) {
  const terkunci = batas > 0 && t.perangkat.length >= batas;
  return (
    <div className={`kl-tamu ${dipilih ? "kl-tamu-dipilih" : ""}`}>
      <input type="checkbox" className="kl-cek" checked={dipilih} onChange={() => onPilih(t.id)} aria-label={`Pilih ${t.nama}`} />
      <div className="kl-tamu-info">
        <button type="button" className="kl-tamu-nama" onClick={() => onUbah(t.id)}>
          {t.nama}
        </button>
        <div className="kl-tamu-meta">
          <span className={t.kategori === PRATINJAU ? "kl-lencana" : ""}>{t.kategori}</span>
          <span>{t.telepon ? formatTelepon(t.telepon) : <em>tanpa WA</em>}</span>
          <span>maks {t.maks_orang} org</span>
          {batas > 0 && (
            <span className={terkunci ? "kl-merah" : ""} title="Jumlah HP/laptop yang sudah membuka link ini">
              {t.perangkat.length}/{batas} HP{terkunci ? " · terkunci" : ""}
            </span>
          )}
        </div>
      </div>
      <span className={`kl-status kl-status-${kelasStatus(t)}`}>{labelTamu(t)}</span>
      <div className="kl-tamu-aksi">
        <button type="button" className="kl-btn kl-btn-wa kl-btn-kecil" onClick={() => onWa(t)} aria-label={`Kirim WhatsApp ke ${t.nama}`}>
          WA
        </button>
        <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => onSalin(t)} aria-label={`Salin link ${t.nama}`}>
          Salin link
        </button>
        <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => onUbah(t.id)} aria-label={`Ubah ${t.nama}`}>
          Ubah
        </button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Tambah / ubah tamu
// ---------------------------------------------------------------------------
function FormTamu({
  api,
  acara,
  awal,
  kategoriList,
  kodeAda,
  asal,
  onSimpan,
  onPerbarui,
  onHapus,
  onKirimWa,
  onTutup,
  beriTahu,
}: {
  api: KelolaApi;
  acara: Acara;
  awal: TamuBaris | null;
  kategoriList: string[];
  kodeAda: string[];
  asal: string;
  onSimpan: (t: TamuBaris, baru: boolean, lanjut?: boolean) => void;
  onPerbarui: (t: TamuBaris) => void;
  onHapus: (t: TamuBaris) => void;
  onKirimWa: (t: TamuBaris) => void;
  onTutup: () => void;
  beriTahu: BeriTahu;
}) {
  const idForm = useId();
  const idDaftar = useId();
  const refNama = useRef<HTMLInputElement>(null);
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [kategori, setKategori] = useState(awal?.kategori ?? "Teman");
  const [telepon, setTelepon] = useState(formatTelepon(awal?.telepon));
  const [maks, setMaks] = useState(String(awal?.maks_orang ?? 2));
  const jawabAwal = awal?.status === "hadir" || awal?.status === "tidak" ? awal.status : "";
  const [jawab, setJawab] = useState<"" | "hadir" | "tidak">(jawabAwal);
  const [jumlah, setJumlah] = useState(String(awal?.jumlah_hadir || 1));
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const batas = acara.batas_perangkat;
  const link = awal ? linkTamu(asal, acara.slug, awal.kode) : "";

  async function simpan(lanjut: boolean) {
    setGalat("");
    const n = nama.replace(/\s+/g, " ").trim();
    const k = kategori.replace(/\s+/g, " ").trim();
    if (!n) return setGalat("Nama tamu wajib diisi.");
    if (n.length > 120) return setGalat("Nama maksimal 120 huruf.");
    if (!k) return setGalat("Kategori wajib diisi.");
    if (k.length > 40) return setGalat("Kategori maksimal 40 huruf.");
    const tel = telepon.trim() ? rapikanTelepon(telepon) : null;
    if (telepon.trim() && !tel) return setGalat("Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890");
    const m = Math.min(20, Math.max(1, parseInt(maks, 10) || 1));
    setSibuk(true);
    try {
      if (!awal) {
        const [t] = await api.tambahTamu(acara.id, [{ nama: n, kategori: k, telepon: tel, maks_orang: m, kode: kodeUnik(new Set(kodeAda)) }]);
        onSimpan(t, true, lanjut);
        if (lanjut) {
          setNama("");
          setTelepon("");
          setSibuk(false);
          refNama.current?.focus();
        }
        return;
      }
      const ubah: UbahTamu = { nama: n, kategori: k, telepon: tel, maks_orang: m };
      const j = Math.min(m, Math.max(1, parseInt(jumlah, 10) || 1));
      if (jawab !== jawabAwal || (jawab === "hadir" && j !== awal.jumlah_hadir)) {
        if (jawab === "") {
          ubah.status = awal.dibuka_pada ? "dibuka" : awal.dikirim_pada ? "terkirim" : "baru";
          ubah.jumlah_hadir = null;
          ubah.dijawab_pada = null;
        } else {
          ubah.status = jawab;
          ubah.jumlah_hadir = jawab === "hadir" ? j : 0;
          ubah.dijawab_pada = new Date().toISOString();
        }
      }
      onSimpan(await api.ubahTamu(awal.id, ubah), false);
    } catch (e) {
      setGalat(pesanGalat(e));
      setSibuk(false);
    }
  }

  async function aksi(jenis: "reset" | "kode" | "hapus") {
    if (!awal) return;
    const tanya = {
      reset: `Reset perangkat untuk ${awal.nama}? Link-nya bisa dibuka lagi di HP baru (maks. ${batas} HP).`,
      kode: `Buat link baru untuk ${awal.nama}? Link lama langsung tidak bisa dibuka. Kirim ulang link barunya ke tamu.`,
      hapus: `Hapus ${awal.nama} dari daftar tamu? Link-nya tidak bisa dibuka lagi.`,
    }[jenis];
    if (!window.confirm(tanya)) return;
    setSibuk(true);
    setGalat("");
    try {
      if (jenis === "hapus") {
        await api.hapusTamu([awal.id]);
        onHapus(awal);
        return;
      }
      const t = await api.ubahTamu(awal.id, jenis === "reset" ? { perangkat: [] } : { kode: kodeUnik(new Set(kodeAda)), perangkat: [] });
      onPerbarui(t);
      beriTahu(jenis === "reset" ? "Perangkat di-reset" : "Link baru dibuat — jangan lupa kirim ulang");
    } catch (e) {
      setGalat(pesanGalat(e));
    }
    setSibuk(false);
  }

  return (
    <Modal
      judul={awal ? "Ubah data tamu" : "Tambah tamu"}
      onTutup={onTutup}
      kaki={
        <>
          {awal && (
            <button type="button" className="kl-btn kl-btn-bahaya kl-kiri" onClick={() => aksi("hapus")} disabled={sibuk}>
              Hapus
            </button>
          )}
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          {!awal && (
            <button type="button" className="kl-btn kl-btn-garis" onClick={() => simpan(true)} disabled={sibuk}>
              Simpan & tambah lagi
            </button>
          )}
          <button type="submit" form={idForm} className="kl-btn kl-btn-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </>
      }
    >
      <form
        id={idForm}
        className="kl-form"
        onSubmit={(e) => {
          e.preventDefault();
          void simpan(false);
        }}
      >
        <Isian label="Nama tamu (tampil di undangan)" wajib bantuan="Tulis lengkap dengan sapaan, mis. “Bapak Budi Santoso & Istri”.">
          <input ref={refNama} value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} autoComplete="off" data-fokus />
        </Isian>
        <div className="kl-grid-2">
          <Isian label="Kategori" wajib>
            <input value={kategori} onChange={(e) => setKategori(e.target.value)} list={idDaftar} maxLength={40} autoComplete="off" />
            <datalist id={idDaftar}>
              {kategoriList.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Isian>
          <Isian label="Maks. orang" bantuan="Termasuk tamu itu sendiri.">
            <input type="number" inputMode="numeric" min={1} max={20} value={maks} onChange={(e) => setMaks(e.target.value)} />
          </Isian>
        </div>
        <Isian label="Nomor WhatsApp" bantuan="Boleh 08…, +62…, atau dikosongkan.">
          <input type="tel" inputMode="tel" value={telepon} onChange={(e) => setTelepon(e.target.value)} placeholder="0812 3456 7890" autoComplete="off" />
        </Isian>

        {awal && (
          <>
            <fieldset className="kl-fieldset">
              <legend>Konfirmasi kehadiran</legend>
              <p className="kl-kecil kl-redup">Biasanya diisi tamu sendiri lewat undangan. Ubah di sini jika tamu menjawab lewat telepon/chat.</p>
              <div className="kl-pilihan">
                {(
                  [
                    ["", "Belum menjawab"],
                    ["hadir", "Hadir"],
                    ["tidak", "Berhalangan"],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="kl-radio">
                    <input type="radio" name="jawab" value={v} checked={jawab === v} onChange={() => setJawab(v)} />
                    {l}
                  </label>
                ))}
              </div>
              {jawab === "hadir" && (
                <Isian label="Jumlah yang hadir">
                  <input type="number" inputMode="numeric" min={1} max={Math.max(1, parseInt(maks, 10) || 1)} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
                </Isian>
              )}
            </fieldset>

            <div className="kl-info-tamu">
              <div className="kl-label">Link pribadi</div>
              <code className="kl-link">{link}</code>
              <div className="kl-baris-tombol">
                <button type="button" className="kl-btn kl-btn-wa kl-btn-kecil" onClick={() => onKirimWa(awal)}>
                  Kirim WA
                </button>
                <button
                  type="button"
                  className="kl-btn kl-btn-garis kl-btn-kecil"
                  onClick={async () => {
                    const ok = await salinTeks(link);
                    beriTahu(ok ? "Link disalin" : "Gagal menyalin", ok ? "ok" : "galat");
                  }}
                >
                  Salin link
                </button>
                <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => aksi("kode")} disabled={sibuk}>
                  Buat link baru
                </button>
              </div>
              <div className="kl-label">Perangkat</div>
              <p className="kl-kecil">
                {batas > 0 ? (
                  <>
                    Sudah dibuka di <b>{awal.perangkat.length}</b> dari maks. {batas} HP/laptop.
                    {awal.perangkat.length >= batas && <span className="kl-merah"> Terkunci untuk HP baru.</span>}
                  </>
                ) : (
                  <>Tanpa batas perangkat ({awal.perangkat.length} perangkat tercatat).</>
                )}{" "}
                {awal.perangkat.length > 0 && (
                  <button type="button" className="kl-tautan" onClick={() => aksi("reset")} disabled={sibuk}>
                    Reset perangkat
                  </button>
                )}
              </p>
              <div className="kl-label">Riwayat</div>
              <ul className="kl-riwayat kl-kecil">
                <li>Ditambahkan: {waktuWib(awal.created_at)}</li>
                <li>Dikirim: {awal.dikirim_pada ? waktuWib(awal.dikirim_pada) : "—"}</li>
                <li>Dibuka: {awal.dibuka_pada ? waktuWib(awal.dibuka_pada) : "—"}</li>
                <li>Menjawab: {awal.dijawab_pada ? waktuWib(awal.dijawab_pada) : "—"}</li>
              </ul>
            </div>
          </>
        )}
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
// Impor dari Excel / Google Sheets / CSV
// ---------------------------------------------------------------------------
function ImporTamu({
  api,
  acara,
  tamu,
  kategoriList,
  onSelesai,
  onGagal,
  onTutup,
}: {
  api: KelolaApi;
  acara: Acara;
  tamu: TamuBaris[];
  kategoriList: string[];
  onSelesai: (baru: TamuBaris[]) => void;
  onGagal: () => void;
  onTutup: () => void;
}) {
  const [teks, setTeks] = useState("");
  const [berkas, setBerkas] = useState<{ nama: string; rows: string[][] } | null>(null);
  const [kategoriBawaan, setKategoriBawaan] = useState("Teman");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const refBerkas = useRef<HTMLInputElement>(null);

  const hasil = useMemo(() => {
    const mentah = berkas ? bacaTabel(berkas.rows, kategoriBawaan) : bacaImpor(teks, kategoriBawaan);
    const ada = new Set(tamu.map((t) => kunciTamu(t.nama, t.telepon)));
    const peta = new Map(kategoriList.map((k) => [k.toLowerCase(), k]));
    return mentah.map((b) => ({
      ...b,
      kategori: peta.get(b.kategori.toLowerCase()) ?? b.kategori.charAt(0).toUpperCase() + b.kategori.slice(1),
      masalah: b.masalah ?? (ada.has(kunciTamu(b.nama, b.telepon)) ? "Sudah ada di daftar tamu" : null),
    }));
  }, [teks, berkas, kategoriBawaan, tamu, kategoriList]);
  const siap = hasil.filter((b) => !b.masalah);

  async function pilihBerkas(f: File) {
    setGalat("");
    try {
      if (/\.xlsx$/i.test(f.name) || f.type.includes("spreadsheetml")) setBerkas({ nama: f.name, rows: await bacaXlsx(f) });
      else if (/\.xls$/i.test(f.name)) setGalat("File .xls (Excel lama) belum didukung. Buka di Excel → Simpan Sebagai .xlsx, atau salin-tempel isinya.");
      else if (/\.(csv|tsv|txt)$/i.test(f.name) || f.type.startsWith("text/")) {
        setBerkas(null);
        setTeks(await f.text());
      } else setGalat("Pilih file Excel (.xlsx) atau CSV.");
    } catch (e) {
      setGalat(pesanGalat(e));
    }
  }

  function unduhContoh() {
    const contoh = [
      ["Nama", "Kategori", "No WA", "Maks orang"],
      ["Bapak Budi Santoso & Istri", "Keluarga", "081234567890", "2"],
      ["Rina Wulandari", "Teman", "085711112222", "1"],
      ["Keluarga Bapak Hendra", "Keluarga", "", "4"],
    ];
    unduh("contoh-daftar-tamu.xlsx", tulisXlsx(contoh, { namaSheet: "Tamu", kolomAngka: [3], lebar: [36, 16, 18, 12] }));
  }

  async function impor() {
    if (!siap.length) return;
    setSibuk(true);
    setGalat("");
    try {
      const kode = new Set(tamu.map((t) => t.kode));
      const baru = await api.tambahTamu(
        acara.id,
        siap.map((b) => ({ nama: b.nama, kategori: b.kategori, telepon: b.telepon, maks_orang: b.maks_orang, kode: kodeUnik(kode) })),
      );
      onSelesai(baru);
    } catch (e) {
      setGalat(`${pesanGalat(e)} Sebagian tamu mungkin sudah masuk — daftar dimuat ulang, cek sebelum mengimpor lagi.`);
      setSibuk(false);
      onGagal();
    }
  }

  return (
    <Modal
      judul="Impor daftar tamu"
      onTutup={onTutup}
      lebar
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          <button type="button" className="kl-btn kl-btn-utama" onClick={impor} disabled={sibuk || siap.length === 0}>
            {sibuk ? "Mengimpor…" : `Impor ${siap.length} tamu`}
          </button>
        </>
      }
    >
      <ol className="kl-langkah kl-kecil">
        <li>
          Siapkan kolom <b>Nama</b>, <b>Kategori</b>, <b>No WA</b>, <b>Maks orang</b> (hanya Nama yang wajib).{" "}
          <button type="button" className="kl-tautan" onClick={unduhContoh}>
            Unduh contoh Excel
          </button>
        </li>
        <li>Pilih file Excel (.xlsx)/CSV, <b>atau</b> blok tabelnya di Excel/Google Sheets → salin → tempel di kotak bawah.</li>
        <li>Periksa pratinjau, lalu klik Impor. Setiap tamu otomatis mendapat link pribadi.</li>
      </ol>
      <div className="kl-baris-tombol">
        <button type="button" className="kl-btn kl-btn-garis" onClick={() => refBerkas.current?.click()}>
          Pilih file Excel / CSV
        </button>
        <input
          ref={refBerkas}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pilihBerkas(f);
          }}
        />
        {berkas && (
          <span className="kl-lencana-berkas">
            {berkas.nama}{" "}
            <button type="button" className="kl-tautan" onClick={() => setBerkas(null)}>
              hapus
            </button>
          </span>
        )}
      </div>
      {!berkas && (
        <Isian label="…atau tempel dari Excel / Google Sheets">
          <textarea rows={6} value={teks} onChange={(e) => setTeks(e.target.value)} placeholder={"Nama\tKategori\tNo WA\tMaks orang\nBapak Budi Santoso & Istri\tKeluarga\t081234567890\t2"} data-fokus />
        </Isian>
      )}
      <Isian label="Kategori untuk baris yang kategorinya kosong">
        <select value={kategoriBawaan} onChange={(e) => setKategoriBawaan(e.target.value)}>
          {kategoriList.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Isian>
      {galat && (
        <p className="kl-galat" role="alert">
          {galat}
        </p>
      )}

      {hasil.length > 0 && (
        <>
          <p className="kl-ringkas-impor">
            <b>{siap.length}</b> siap diimpor
            {hasil.length - siap.length > 0 && (
              <>
                {" "}
                · <span className="kl-merah">{hasil.length - siap.length} dilewati</span>
              </>
            )}
            {hasil.some((b) => b.peringatan && !b.masalah) && <> · {hasil.filter((b) => b.peringatan && !b.masalah).length} nomor WA dikosongkan</>}
          </p>
          <div className="kl-tabel-gulir kl-tabel-tinggi">
            <table className="kl-tabel">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>No WA</th>
                  <th>Maks</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {hasil.slice(0, 300).map((b) => (
                  <tr key={b.baris} className={b.masalah ? "kl-baris-lewat" : ""}>
                    <td>{b.baris}</td>
                    <td>{b.nama || <em>(kosong)</em>}</td>
                    <td>{b.kategori}</td>
                    <td>{formatTelepon(b.telepon)}</td>
                    <td>{b.maks_orang}</td>
                    <td className={b.masalah ? "kl-merah" : "kl-redup"}>{b.masalah ? `Dilewati: ${b.masalah}` : (b.peringatan ?? "OK")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasil.length > 300 && <p className="kl-kecil kl-redup">Menampilkan 300 baris pertama dari {hasil.length}.</p>}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Kirim WhatsApp berurutan (satu tamu demi satu tamu)
// ---------------------------------------------------------------------------
function KirimBerurutan({ antrian, pesanUntuk, onKirim, onTutup }: { antrian: TamuBaris[]; pesanUntuk: (t: TamuBaris) => string; onKirim: (t: TamuBaris) => void; onTutup: () => void }) {
  const [i, setI] = useState(0);
  const [terkirim, setTerkirim] = useState(0);
  const t = antrian[i];
  return (
    <Modal
      judul="Kirim undangan lewat WhatsApp"
      onTutup={onTutup}
      kaki={
        t ? (
          <>
            <button type="button" className="kl-btn kl-btn-teks kl-kiri" onClick={onTutup}>
              Berhenti
            </button>
            <button type="button" className="kl-btn kl-btn-garis" onClick={() => setI(i + 1)}>
              Lewati
            </button>
            <button
              type="button"
              className="kl-btn kl-btn-wa"
              data-fokus
              onClick={() => {
                onKirim(t);
                setTerkirim((n) => n + 1);
                setI(i + 1);
              }}
            >
              Buka WhatsApp & kirim
            </button>
          </>
        ) : (
          <button type="button" className="kl-btn kl-btn-utama" onClick={onTutup} data-fokus>
            Selesai
          </button>
        )
      }
    >
      {t ? (
        <>
          <div className="kl-batang">
            <div className="kl-batang-label">
              <span>
                Tamu {i + 1} dari {antrian.length}
              </span>
              <span className="kl-redup">{terkirim} dibuka di WhatsApp</span>
            </div>
            <div className="kl-batang-jalur">
              <div style={{ width: `${(i / antrian.length) * 100}%` }} />
            </div>
          </div>
          <div className="kl-penerima">
            <strong>{t.nama}</strong>
            <span className="kl-redup">
              {t.kategori} · {t.telepon ? formatTelepon(t.telepon) : "tanpa nomor — pilih kontaknya sendiri di WhatsApp"}
            </span>
          </div>
          <pre className="kl-pesan">{pesanUntuk(t)}</pre>
          <p className="kl-kecil kl-redup">WhatsApp terbuka di tab/aplikasi baru. Tekan kirim di WhatsApp, lalu kembali ke halaman ini untuk tamu berikutnya. Tamu otomatis ditandai “Terkirim”.</p>
        </>
      ) : (
        <div className="kl-kosong">
          <h3>Antrean selesai</h3>
          <p className="kl-redup">
            {terkirim} dari {antrian.length} tamu sudah dibukakan WhatsApp-nya.
          </p>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Template pesan WhatsApp
// ---------------------------------------------------------------------------
function TemplateWa({
  api,
  acara,
  contoh,
  buatPesan,
  perbaruiAcara,
  beriTahu,
  onTutup,
}: {
  api: KelolaApi;
  acara: Acara;
  contoh: TamuBaris | undefined;
  buatPesan: (tpl: string, t: TamuBaris | undefined) => string;
  perbaruiAcara: (a: Acara) => void;
  beriTahu: BeriTahu;
  onTutup: () => void;
}) {
  const [teks, setTeks] = useState(acara.konten.pesan_wa || PESAN_WA_BAWAAN);
  const [sibuk, setSibuk] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const kurang = ["{nama}", "{link}"].filter((x) => !teks.includes(x));

  function sisip(tanda: string) {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    setTeks(teks.slice(0, a) + tanda + teks.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + tanda.length, a + tanda.length);
    });
  }

  async function simpan() {
    setSibuk(true);
    try {
      const nilai = teks.trim() === PESAN_WA_BAWAAN.trim() ? null : teks;
      perbaruiAcara(await api.simpanAcara(acara.id, { konten: { ...acara.konten, pesan_wa: nilai } }));
      beriTahu("Template pesan WhatsApp disimpan");
      onTutup();
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
      setSibuk(false);
    }
  }

  return (
    <Modal
      judul="Template pesan WhatsApp"
      onTutup={onTutup}
      lebar
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks kl-kiri" onClick={() => setTeks(PESAN_WA_BAWAAN)}>
            Kembalikan bawaan
          </button>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          <button type="button" className="kl-btn kl-btn-utama" onClick={simpan} disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan template"}
          </button>
        </>
      }
    >
      <div className="kl-dua-kolom">
        <div className="kl-form">
          <div className="kl-chip-baris">
            <span className="kl-kecil kl-redup">Sisipkan:</span>
            {["{nama}", "{link}", "{mempelai}", "{tanggal}"].map((x) => (
              <button key={x} type="button" className="kl-chip" onClick={() => sisip(x)}>
                {x}
              </button>
            ))}
          </div>
          <textarea ref={ref} rows={16} value={teks} onChange={(e) => setTeks(e.target.value)} aria-label="Isi template pesan" data-fokus />
          {kurang.length > 0 && <p className="kl-galat">Template belum memuat {kurang.join(" dan ")}. Tanpa {"{link}"} tamu tidak menerima link undangannya.</p>}
          <p className="kl-kecil kl-redup">
            {"{nama}"} = nama tamu, {"{link}"} = link pribadi, {"{mempelai}"} = {acara.konten.mempelai.pria.panggilan} & {acara.konten.mempelai.wanita.panggilan}, {"{tanggal}"} = tanggal acara. Di WhatsApp, *teks* jadi tebal dan _teks_ jadi miring.
          </p>
        </div>
        <div>
          <div className="kl-label">Pratinjau{contoh ? ` untuk ${contoh.nama}` : ""}</div>
          <pre className="kl-pesan">{buatPesan(teks, contoh)}</pre>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Unduh / salin daftar tamu
// ---------------------------------------------------------------------------
function EksporTamu({ semua, tersaring, acara, asal, beriTahu, onTutup }: { semua: TamuBaris[]; tersaring: TamuBaris[]; acara: Acara; asal: string; beriTahu: BeriTahu; onTutup: () => void }) {
  const [lingkup, setLingkup] = useState<"semua" | "saring">("semua");
  const data = (lingkup === "semua" ? semua : tersaring).filter((t) => t.kategori !== PRATINJAU);
  const tabel = () => tabelEkspor(data, asal, acara.slug);
  const namaBerkas = (ext: string) => `tamu-${acara.slug}-${new Date().toISOString().slice(0, 10)}.${ext}`;

  return (
    <Modal
      judul="Unduh daftar tamu"
      onTutup={onTutup}
      kaki={
        <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
          Tutup
        </button>
      }
    >
      <div className="kl-pilihan kl-pilihan-tumpuk">
        <label className="kl-radio">
          <input type="radio" name="lingkup" checked={lingkup === "semua"} onChange={() => setLingkup("semua")} />
          Semua tamu ({semua.filter((t) => t.kategori !== PRATINJAU).length})
        </label>
        <label className="kl-radio">
          <input type="radio" name="lingkup" checked={lingkup === "saring"} onChange={() => setLingkup("saring")} />
          Hanya hasil pencarian/saringan saat ini ({tersaring.filter((t) => t.kategori !== PRATINJAU).length})
        </label>
      </div>
      <p className="kl-kecil kl-redup">Berisi nama, kategori, nomor WA, kode, link pribadi, status, jumlah hadir, dan waktu dikirim/dibuka/dijawab.</p>
      <div className="kl-tumpuk-kecil">
        <button
          type="button"
          className="kl-btn kl-btn-utama kl-btn-penuh"
          data-fokus
          onClick={() => {
            unduh(namaBerkas("xlsx"), tulisXlsx(tabel(), { namaSheet: "Tamu", kolomAngka: [3, 7, 11], lebar: [34, 14, 16, 10, 10, 46, 16, 12, 20, 20, 20, 10] }));
            beriTahu("File Excel diunduh");
          }}
        >
          Unduh Excel (.xlsx)
        </button>
        <button
          type="button"
          className="kl-btn kl-btn-garis kl-btn-penuh"
          onClick={async () => {
            const ok = await salinTeks(keTsv(tabel()));
            beriTahu(ok ? "Disalin. Buka Google Sheets, klik sel A1, lalu tempel." : "Gagal menyalin.", ok ? "ok" : "galat");
          }}
        >
          Salin untuk Google Sheets
        </button>
        <button
          type="button"
          className="kl-btn kl-btn-teks kl-btn-penuh"
          onClick={() => {
            unduh(namaBerkas("csv"), keCsv(tabel()));
            beriTahu("File CSV diunduh");
          }}
        >
          Unduh CSV
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ubah kategori beberapa tamu
// ---------------------------------------------------------------------------
function UbahKategori({ jumlah, kategoriList, onSimpan, onTutup }: { jumlah: number; kategoriList: string[]; onSimpan: (k: string) => Promise<void>; onTutup: () => void }) {
  const [k, setK] = useState("");
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const idDaftar = useId();
  const idForm = useId();
  return (
    <Modal
      judul={`Ubah kategori ${jumlah} tamu`}
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onTutup}>
            Batal
          </button>
          <button type="submit" form={idForm} className="kl-btn kl-btn-utama" disabled={sibuk}>
            Simpan
          </button>
        </>
      }
    >
      <form
        id={idForm}
        onSubmit={async (e) => {
          e.preventDefault();
          const v = k.replace(/\s+/g, " ").trim();
          if (!v || v.length > 40) return setGalat("Isi kategori (maks. 40 huruf).");
          setSibuk(true);
          try {
            await onSimpan(v);
          } catch (er) {
            setGalat(pesanGalat(er));
            setSibuk(false);
          }
        }}
      >
        <Isian label="Kategori baru" bantuan="Pilih yang ada atau ketik kategori baru, mis. “Teman Kantor”, “Keluarga Pria”.">
          <input value={k} onChange={(e) => setK(e.target.value)} list={idDaftar} maxLength={40} data-fokus />
          <datalist id={idDaftar}>
            {kategoriList.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Isian>
        {galat && <p className="kl-galat">{galat}</p>}
      </form>
    </Modal>
  );
}
