// Fungsi bantu dashboard /kelola: kode tamu, nomor WhatsApp, impor/ekspor, waktu WIB.
import type { Konten } from "../tipe";
import type { BerkasMedia, InputTamu, TamuBaris } from "./tipe";

// tanpa huruf/angka yang mirip (0/o, 1/l/i) supaya tidak salah ketik
const ABJAD = "abcdefghjkmnpqrstuvwxyz23456789";

export function buatKode(panjang = 6): string {
  const acak = new Uint32Array(panjang);
  crypto.getRandomValues(acak);
  return Array.from(acak, (n) => ABJAD[n % ABJAD.length]).join("");
}

export function kodeUnik(sudahAda: Set<string>, panjang = 6): string {
  for (;;) {
    const k = buatKode(panjang);
    if (!sudahAda.has(k)) {
      sudahAda.add(k);
      return k;
    }
  }
}

/** "0812-3456 7890" / "+62 812..." / "812..." → "6281234567890". null jika kosong/tidak valid. */
export function rapikanTelepon(teks: string | null | undefined): string | null {
  let d = String(teks ?? "").replace(/[^\d+]/g, "");
  if (!d) return null;
  d = d.replace(/^\+/, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^[0-9]{8,16}$/.test(d) ? d : null;
}

export function linkTamu(asal: string, slug: string, kode: string): string {
  return `${asal.replace(/\/$/, "")}/${slug}/${kode}`;
}

export const PESAN_WA_BAWAAN = `Assalamu'alaikum Warahmatullahi Wabarakatuh

Kepada Yth.
*{nama}*

Tanpa mengurangi rasa hormat, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk hadir di acara pernikahan kami:

*{mempelai}*
{tanggal}

Detail acara dan konfirmasi kehadiran:
{link}

Undangan ini khusus untuk {nama}, mohon tidak diteruskan.

Merupakan suatu kehormatan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.

Wassalamu'alaikum Warahmatullahi Wabarakatuh`;

export function isiPesan(template: string, data: { nama: string; link: string; mempelai: string; tanggal: string }): string {
  return template
    .replaceAll("{nama}", data.nama)
    .replaceAll("{link}", data.link)
    .replaceAll("{mempelai}", data.mempelai)
    .replaceAll("{tanggal}", data.tanggal);
}

export function linkWa(telepon: string | null, pesan: string): string {
  const t = encodeURIComponent(pesan);
  return telepon ? `https://wa.me/${telepon}?text=${t}` : `https://wa.me/?text=${t}`;
}

// ---------------------------------------------------------------------------
// Impor dari Excel / Google Sheets (tempel) atau CSV
// ---------------------------------------------------------------------------
export interface BarisImpor extends InputTamu {
  baris: number;
  /** alasan baris dilewati (tidak diimpor) */
  masalah: string | null;
  /** tetap diimpor, tapi ada yang dibetulkan */
  peringatan: string | null;
}

/** Teks hasil salin dari Excel/Google Sheets (tab) atau CSV (koma/titik koma) → tabel. Baris kosong tetap ada (supaya nomor baris cocok). */
export function pecahTeks(teks: string): string[][] {
  const barisTeks = teks.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const isi = barisTeks.filter((b) => b.trim() !== "");
  if (isi.length === 0) return [];
  const tab = isi.some((b) => b.includes("\t"));
  const pemisah = tab ? "\t" : isi[0].split(";").length > isi[0].split(",").length ? ";" : ",";
  return barisTeks.map((b) => {
    if (b.trim() === "") return [];
    if (pemisah === "\t") return b.split("\t").map((x) => x.trim());
    // CSV sederhana dengan dukungan tanda kutip
    const hasil: string[] = [];
    let cur = "";
    let kutip = false;
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c === '"') {
        if (kutip && b[i + 1] === '"') {
          cur += '"';
          i++;
        } else kutip = !kutip;
      } else if (c === pemisah && !kutip) {
        hasil.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    hasil.push(cur.trim());
    return hasil;
  });
}

const KOLOM = {
  nama: /^(nama|name|tamu|undangan)/i,
  kategori: /^(kategori|grup|group|kelompok|category|hubungan|relasi)/i,
  telepon: /^(no\.?\s*|nomor\s*)?(wa\b|whats\s?app|telepon|telp|tlp|hp\b|handphone|phone|ponsel)/i,
  maks: /^(maks|max|jumlah|pax|orang|kuota)/i,
};

/** Tabel (dari teks tempelan atau file Excel) → calon tamu + catatan masalah per baris. */
export function bacaTabel(rows: string[][], kategoriBawaan = "Teman"): BarisImpor[] {
  const iAwal = rows.findIndex((r) => r.some((x) => x.trim() !== ""));
  if (iAwal < 0) return [];
  const kepala = rows[iAwal].map((h) => h.toLowerCase().trim());
  const adaKepala = kepala.some((h) => KOLOM.nama.test(h)) && !kepala.some((h) => /\d{6,}/.test(h));
  const idx = adaKepala
    ? {
        nama: kepala.findIndex((h) => KOLOM.nama.test(h)),
        kategori: kepala.findIndex((h) => KOLOM.kategori.test(h)),
        telepon: kepala.findIndex((h) => KOLOM.telepon.test(h)),
        maks: kepala.findIndex((h) => KOLOM.maks.test(h)),
      }
    : { nama: 0, kategori: 1, telepon: 2, maks: 3 };
  const dilihat = new Set<string>();
  const hasil: BarisImpor[] = [];
  for (let i = adaKepala ? iAwal + 1 : iAwal; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some((x) => (x ?? "").trim() !== "")) continue;
    const nama = (r[idx.nama] ?? "").replace(/\s+/g, " ").trim();
    const kategori = ((idx.kategori >= 0 ? r[idx.kategori] : "") ?? "").replace(/\s+/g, " ").trim() || kategoriBawaan;
    const telMentah = idx.telepon >= 0 ? (r[idx.telepon] ?? "").trim() : "";
    const telepon = rapikanTelepon(telMentah);
    const maksMentah = idx.maks >= 0 ? parseInt(String(r[idx.maks] ?? "").replace(/\D/g, ""), 10) : NaN;
    const maks_orang = Number.isFinite(maksMentah) && maksMentah > 0 ? Math.min(20, maksMentah) : 2;
    let masalah: string | null = null;
    if (!nama) masalah = "Nama kosong";
    else if (nama.length > 120) masalah = "Nama terlalu panjang (maks. 120 huruf)";
    else if (kategori.length > 40) masalah = "Kategori terlalu panjang (maks. 40 huruf)";
    const kunci = kunciTamu(nama, telepon);
    if (!masalah && dilihat.has(kunci)) masalah = "Dobel di daftar ini";
    dilihat.add(kunci);
    const peringatan = !masalah && telMentah && !telepon ? "No. WA tidak valid, dikosongkan" : null;
    hasil.push({ baris: i + 1, nama, kategori: kategori.slice(0, 40), telepon, maks_orang, masalah, peringatan });
  }
  return hasil;
}

export const bacaImpor = (teks: string, kategoriBawaan = "Teman") => bacaTabel(pecahTeks(teks), kategoriBawaan);

/** Kunci untuk mendeteksi tamu dobel: nama (tanpa beda huruf besar/spasi) + nomor WA. */
export const kunciTamu = (nama: string, telepon: string | null) => nama.toLowerCase().replace(/\s+/g, " ").trim() + "|" + (telepon ?? "");

export const CONTOH_IMPOR = "Nama\tKategori\tNo WA\tMaks\nBapak Budi Santoso & Istri\tKeluarga\t081234567890\t2\nRina Wulandari\tTeman\t085711112222\t1";

// ---------------------------------------------------------------------------
// Ekspor
// ---------------------------------------------------------------------------
const LABEL_STATUS: Record<string, string> = { baru: "Belum dikirim", terkirim: "Terkirim", dibuka: "Sudah dibuka", hadir: "Hadir", tidak: "Tidak hadir" };
export const labelStatus = (s: string) => LABEL_STATUS[s] ?? s;

export function tabelEkspor(tamu: TamuBaris[], asal: string, slug: string): string[][] {
  const kepala = ["Nama", "Kategori", "No WA", "Maks orang", "Kode", "Link undangan", "Status", "Jumlah hadir", "Dikirim", "Dibuka", "Dijawab", "Perangkat"];
  const f = (iso: string | null) => (iso ? waktuWib(iso) : "");
  return [
    kepala,
    ...tamu.map((t) => [
      t.nama,
      t.kategori,
      t.telepon ?? "",
      String(t.maks_orang),
      t.kode,
      linkTamu(asal, slug, t.kode),
      labelStatus(t.status),
      t.jumlah_hadir === null ? "" : String(t.jumlah_hadir),
      f(t.dikirim_pada),
      f(t.dibuka_pada),
      f(t.dijawab_pada),
      String(t.perangkat?.length ?? 0),
    ]),
  ];
}

export const keTsv = (rows: string[][]) => rows.map((r) => r.map((c) => c.replace(/[\t\n]/g, " ")).join("\t")).join("\n");

export function keCsv(rows: string[][]): string {
  const sel = (c: string) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return "﻿" + rows.map((r) => r.map(sel).join(",")).join("\r\n");
}

export function unduh(namaBerkas: string, isi: string | Blob, tipe = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(typeof isi === "string" ? new Blob([isi], { type: tipe }) : isi);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Waktu WIB <-> input datetime-local
// ---------------------------------------------------------------------------
const ZONA = "Asia/Jakarta";

export function waktuWib(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA }) + " WIB";
}

/** ISO → "YYYY-MM-DDTHH:mm" dalam WIB (untuk <input type="datetime-local">). */
export function keInputWaktu(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 7 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (WIB) → ISO dengan zona +07:00. */
export function dariInputWaktu(nilai: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(nilai)) return null;
  return `${nilai}:00+07:00`;
}

// ---------------------------------------------------------------------------
// Foto: perkecil & ubah ke WebP di browser sebelum diunggah (hemat kuota & cepat dibuka)
// ---------------------------------------------------------------------------
export async function perkecilFoto(berkas: File, sisiMaks = 1600): Promise<{ blob: Blob; jenis: string }> {
  const bitmap = await createImageBitmap(berkas);
  const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * skala);
  const h = Math.round(bitmap.height * skala);
  const kanvas = document.createElement("canvas");
  kanvas.width = w;
  kanvas.height = h;
  kanvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const keBlob = (tipe: string, q: number) => new Promise<Blob | null>((ok) => kanvas.toBlob(ok, tipe, q));
  const webp = await keBlob("image/webp", 0.82);
  if (webp && webp.type === "image/webp") return { blob: webp, jenis: "image/webp" };
  const jpg = await keBlob("image/jpeg", 0.85);
  if (!jpg) throw new Error("Foto tidak bisa diproses.");
  return { blob: jpg, jenis: "image/jpeg" };
}

export const SLUG_TERLARANG = new Set(["kelola", "api", "brand", "tema", "_next", "admin", "login"]);
export const POLA_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Budi" + "Ani" → "budi-ani" (saran alamat link acara baru). */
export function slugDariNama(...nama: string[]): string {
  return nama
    .map((n) => n.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

// ---------------------------------------------------------------------------
// File foto/musik yang dipakai sebuah undangan (untuk bersih-bersih file lama)
// ---------------------------------------------------------------------------
export function mediaDariKonten(k: Partial<Konten> | null | undefined): Set<string> {
  const s = new Set<string>();
  const tambah = (u: string | null | undefined) => {
    if (u) s.add(u);
  };
  if (!k) return s;
  tambah(k.mempelai?.pria?.foto);
  tambah(k.mempelai?.wanita?.foto);
  for (const x of k.kisah ?? []) tambah(x.foto);
  for (const g of k.galeri ?? []) tambah(g.src);
  tambah(k.musik_url);
  return s;
}

/** Unggahan yang lebih baru dari ini tidak ikut dibersihkan: mungkin klien belum klik Simpan. */
export const JEDA_FILE_BARU_MS = 24 * 60 * 60 * 1000;

/** Pisahkan file folder acara yang tidak dipakai undangan mana pun: `buang` aman dihapus, `baru` dilewati dulu. */
export function pilahBerkas(berkas: BerkasMedia[], semuaAcara: { konten: Konten }[], sekarang = Date.now()) {
  const dipakai = new Set<string>();
  for (const a of semuaAcara) for (const u of mediaDariKonten(a.konten)) dipakai.add(u);
  const buang: BerkasMedia[] = [];
  const baru: BerkasMedia[] = [];
  for (const b of berkas) {
    if (dipakai.has(b.url)) continue;
    // waktu unggah tidak diketahui dianggap baru (tidak dihapus)
    if (sekarang - Date.parse(b.dibuat ?? "") >= JEDA_FILE_BARU_MS) buang.push(b);
    else baru.push(b);
  }
  return { buang, baru };
}

export function formatUkuran(byte: number): string {
  if (byte < 1024 * 1024) return `${Math.max(1, Math.round(byte / 1024))} KB`;
  return `${(byte / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}
