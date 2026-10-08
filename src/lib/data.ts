// Lapisan data undangan (dipakai di server: page & route handler).
// - Jika NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY terisi → pakai Supabase (RPC).
// - Jika belum → MODE DEMO: data contoh dari supabase/contoh-acara.json disimpan di memori
//   (hilang saat server restart). Berguna untuk mencoba tampilan tanpa database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import contoh from "../../supabase/contoh-acara.json";
import type { Konten, Hadiah, Ringkasan, Tamu, Ucapan, Undangan, NamaTema } from "./tipe";

export class ErrorUndangan extends Error {
  constructor(public kode: string, pesan: string, public status = 400) {
    super(pesan);
  }
}

const PESAN_ERROR: Record<string, [string, number]> = {
  ACARA_TIDAK_DITEMUKAN: ["Undangan tidak ditemukan.", 404],
  RSVP_DITUTUP: ["Maaf, konfirmasi kehadiran sudah ditutup.", 409],
  KEHADIRAN_TIDAK_VALID: ["Pilih Hadir atau Tidak hadir.", 400],
  NAMA_TIDAK_VALID: ["Nama wajib diisi (maksimal 80 karakter).", 400],
  PESAN_TERLALU_PANJANG: ["Ucapan maksimal 500 karakter.", 400],
  KODE_TIDAK_VALID: ["Link undangan tidak valid.", 404],
  JUMLAH_MELEBIHI_BATAS: ["Jumlah tamu melebihi batas undangan Anda.", 400],
  BUTUH_KODE: ["Undangan ini hanya bisa dibuka lewat link pribadi.", 403],
  TERLALU_BANYAK_PERMINTAAN: ["Terlalu banyak kiriman. Coba lagi sebentar lagi.", 429],
};

function errorDari(kode: string): ErrorUndangan {
  const [pesan, status] = PESAN_ERROR[kode] ?? ["Terjadi kesalahan. Coba lagi.", 500];
  return new ErrorUndangan(kode, pesan, status);
}

export const modeDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let klien: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!klien) {
    klien = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return klien;
}

function petakanErrorRpc(pesan: string): ErrorUndangan {
  const kode = Object.keys(PESAN_ERROR).find((k) => pesan.includes(k));
  return errorDari(kode ?? "TIDAK_DIKENAL");
}

// ---------------------------------------------------------------------------
// MODE DEMO (in-memory)
// ---------------------------------------------------------------------------
interface TamuDemo {
  kode: string;
  nama: string;
  kategori: string;
  maks_orang: number;
  status: Tamu["status"];
  jumlah_hadir: number | null;
  dibuka_pada: string | null;
}
interface UcapanDemo extends Ucapan {
  kode: string | null;
  jumlah: number;
}
interface StoreDemo {
  tamu: TamuDemo[];
  ucapan: UcapanDemo[];
}

function storeDemo(): StoreDemo {
  const g = globalThis as unknown as { __momenmuDemo?: StoreDemo };
  if (!g.__momenmuDemo) {
    const sekarang = Date.now();
    g.__momenmuDemo = {
      tamu: contoh.tamu.map((t) => ({ ...t, status: "baru" as const, jumlah_hadir: null, dibuka_pada: null })),
      ucapan: contoh.ucapan.map((u, i) => ({
        id: `demo-${i}`,
        kode: u.kode,
        nama: u.nama,
        kehadiran: u.kehadiran as "hadir" | "tidak",
        jumlah: u.jumlah,
        pesan: u.pesan,
        created_at: new Date(sekarang - (i + 1) * 3_600_000 * 3).toISOString(),
      })),
    };
    for (const u of g.__momenmuDemo.ucapan) {
      const t = g.__momenmuDemo.tamu.find((x) => x.kode === u.kode);
      if (t) {
        t.status = u.kehadiran;
        t.jumlah_hadir = u.jumlah;
      }
    }
  }
  return g.__momenmuDemo;
}

function demoAmbil(slug: string, kode?: string | null): Undangan | null {
  if (slug.toLowerCase() !== contoh.slug) return null;
  const s = storeDemo();
  const t = kode ? s.tamu.find((x) => x.kode === kode.toLowerCase()) : undefined;
  const uc = t ? s.ucapan.find((u) => u.kode === t.kode) : undefined;
  return {
    slug: contoh.slug,
    tema: contoh.tema as NamaTema,
    waktu_acara: contoh.waktu_acara,
    batas_rsvp: contoh.batas_rsvp,
    aktif_sampai: contoh.aktif_sampai,
    konten: contoh.konten as Konten,
    hadiah: t ? (contoh.hadiah as Hadiah) : null,
    tamu: t
      ? {
          kode: t.kode,
          nama: t.nama,
          kategori: t.kategori,
          maks_orang: t.maks_orang,
          status: t.status,
          jumlah_hadir: t.jumlah_hadir,
          ucapan: uc ? { kehadiran: uc.kehadiran, jumlah: uc.jumlah, pesan: uc.pesan } : null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// API publik lapisan data
// ---------------------------------------------------------------------------
export async function ambilUndangan(slug: string, kode?: string | null): Promise<Undangan | "butuh_kode" | null> {
  if (modeDemo) return demoAmbil(slug, kode);
  const { data, error } = await supabase().rpc("ambil_undangan", { p_slug: slug, p_kode: kode ?? null });
  if (error) throw petakanErrorRpc(error.message);
  if (!data) return null;
  if ((data as { butuh_kode?: boolean }).butuh_kode) return "butuh_kode";
  return data as Undangan;
}

export async function tandaiDibuka(slug: string, kode: string): Promise<void> {
  if (modeDemo) {
    const t = storeDemo().tamu.find((x) => x.kode === kode.toLowerCase());
    if (t) {
      if (t.status === "baru" || t.status === "terkirim") t.status = "dibuka";
      t.dibuka_pada ??= new Date().toISOString();
    }
    return;
  }
  const { error } = await supabase().rpc("tandai_dibuka", { p_slug: slug, p_kode: kode });
  if (error) throw petakanErrorRpc(error.message);
}

export interface InputRsvp {
  slug: string;
  kode: string | null;
  nama: string;
  kehadiran: "hadir" | "tidak";
  jumlah: number;
  pesan: string;
}

export async function kirimRsvp(input: InputRsvp): Promise<Ucapan> {
  if (!modeDemo) {
    const { data, error } = await supabase().rpc("kirim_rsvp", {
      p_slug: input.slug,
      p_kode: input.kode,
      p_nama: input.nama,
      p_kehadiran: input.kehadiran,
      p_jumlah: input.jumlah,
      p_pesan: input.pesan,
    });
    if (error) throw petakanErrorRpc(error.message);
    return data as Ucapan;
  }
  // logika sama dengan fungsi SQL kirim_rsvp
  if (input.slug.toLowerCase() !== contoh.slug) throw errorDari("ACARA_TIDAK_DITEMUKAN");
  if (contoh.batas_rsvp && Date.now() > Date.parse(contoh.batas_rsvp)) throw errorDari("RSVP_DITUTUP");
  const nama = input.nama.trim();
  if (nama.length < 1 || nama.length > 80) throw errorDari("NAMA_TIDAK_VALID");
  const pesan = input.pesan.trim();
  if (pesan.length > 500) throw errorDari("PESAN_TERLALU_PANJANG");
  const jumlah = input.kehadiran === "hadir" ? Math.max(1, input.jumlah || 1) : 0;
  const s = storeDemo();
  if (input.kode) {
    const t = s.tamu.find((x) => x.kode === input.kode!.toLowerCase());
    if (!t) throw errorDari("KODE_TIDAK_VALID");
    if (jumlah > t.maks_orang) throw errorDari("JUMLAH_MELEBIHI_BATAS");
    let u = s.ucapan.find((x) => x.kode === t.kode);
    if (u) Object.assign(u, { nama, kehadiran: input.kehadiran, jumlah, pesan });
    else {
      u = { id: `demo-${Date.now()}`, kode: t.kode, nama, kehadiran: input.kehadiran, jumlah, pesan, created_at: new Date().toISOString() };
      s.ucapan.unshift(u);
    }
    t.status = input.kehadiran;
    t.jumlah_hadir = jumlah;
    t.dibuka_pada ??= new Date().toISOString();
    return { id: u.id, nama: u.nama, kehadiran: u.kehadiran, pesan: u.pesan, created_at: u.created_at };
  }
  if (jumlah > 4) throw errorDari("JUMLAH_MELEBIHI_BATAS");
  const u: UcapanDemo = { id: `demo-${Date.now()}`, kode: null, nama, kehadiran: input.kehadiran, jumlah, pesan, created_at: new Date().toISOString() };
  s.ucapan.unshift(u);
  return { id: u.id, nama: u.nama, kehadiran: u.kehadiran, pesan: u.pesan, created_at: u.created_at };
}

export async function daftarUcapan(slug: string): Promise<Ucapan[]> {
  if (modeDemo) {
    if (slug.toLowerCase() !== contoh.slug) return [];
    return storeDemo()
      .ucapan.filter((u) => u.pesan)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 60)
      .map(({ id, nama, kehadiran, pesan, created_at }) => ({ id, nama, kehadiran, pesan, created_at }));
  }
  const { data, error } = await supabase().rpc("daftar_ucapan", { p_slug: slug, p_batas: 60 });
  if (error) throw petakanErrorRpc(error.message);
  return (data ?? []) as Ucapan[];
}

export async function ringkasanKehadiran(slug: string): Promise<Ringkasan> {
  if (modeDemo) {
    const u = slug.toLowerCase() === contoh.slug ? storeDemo().ucapan : [];
    return {
      hadir: u.filter((x) => x.kehadiran === "hadir").length,
      tidak: u.filter((x) => x.kehadiran === "tidak").length,
      ucapan: u.filter((x) => x.pesan).length,
    };
  }
  const { data, error } = await supabase().rpc("ringkasan_kehadiran", { p_slug: slug });
  if (error) throw petakanErrorRpc(error.message);
  return (data ?? { hadir: 0, tidak: 0, ucapan: 0 }) as Ringkasan;
}
