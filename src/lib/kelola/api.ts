// Akses data dashboard /kelola dari browser.
// - Supabase: login email + sandi (Supabase Auth); keamanan dijaga Row Level Security
//   (pemilik hanya bisa melihat & mengubah acaranya sendiri).
// - Demo: jika env Supabase kosong, data contoh disimpan di memori tab ini.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import contoh from "../../../supabase/contoh-acara.json";
import type { Hadiah, Konten, NamaTema } from "../tipe";
import type { Acara, InputTamu, KelolaApi, Pengguna, TamuBaris, UbahAcara, UcapanBaris } from "./tipe";

const BUCKET = "media";
const EKSTENSI: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KUNCI_SB = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const KOLOM_ACARA = "id, slug, tema, waktu_acara, batas_rsvp, aktif_sampai, konten, hadiah, izinkan_tanpa_kode, batas_perangkat";
const KOLOM_TAMU = "id, kode, nama, kategori, telepon, maks_orang, status, jumlah_hadir, dikirim_pada, dibuka_pada, dijawab_pada, perangkat, created_at";
const KOLOM_UCAPAN = "id, guest_id, nama, kehadiran, jumlah, pesan, disembunyikan, created_at";

const PESAN: Record<string, string> = {
  "Invalid login credentials": "Email atau kata sandi salah.",
  "Email not confirmed": "Email belum dikonfirmasi. Konfirmasi dulu lewat Supabase → Authentication → Users.",
  "duplicate key value violates unique constraint \"events_slug_key\"": "Alamat (slug) itu sudah dipakai acara lain.",
};

function galat(e: { message?: string } | null | undefined, cadangan = "Terjadi kesalahan. Coba lagi."): Error {
  const m = e?.message ?? "";
  const kunci = Object.keys(PESAN).find((k) => m.includes(k));
  if (kunci) return new Error(PESAN[kunci]);
  if (m.includes("events_slug_check")) return new Error("Alamat hanya boleh huruf kecil, angka, dan tanda hubung (3–60 karakter).");
  if (m.includes("guests_event_id_kode_key")) return new Error("Kode tamu bentrok dengan tamu lain. Coba lagi.");
  if (m.includes("guests_telepon_check")) return new Error("Nomor WhatsApp tidak valid.");
  if (m.includes("guests_nama_check")) return new Error("Nama tamu wajib diisi (maks. 120 huruf).");
  if (m.includes("guests_kategori_check")) return new Error("Kategori wajib diisi (maks. 40 huruf).");
  if (m.includes("guests_maks_orang_check")) return new Error("Jumlah maksimal orang harus 1–20.");
  if (m.includes("batas_perangkat")) return new Error("Batas perangkat harus 0–20.");
  if (m.includes("row-level security") || m.includes("permission denied")) return new Error("Akses ditolak. Pastikan akun ini pemilik acara.");
  if (/jwt|refresh token/i.test(m)) return new Error("Sesi berakhir. Silakan keluar lalu masuk lagi.");
  if (/exceeded the maximum allowed size|payload too large|too large/i.test(m)) return new Error("Berkas terlalu besar (maks. 10 MB).");
  if (/mime type|invalid_mime_type/i.test(m)) return new Error("Jenis berkas tidak didukung. Gunakan JPG/PNG/WebP untuk foto, MP3/M4A untuk musik.");
  if (/bucket not found/i.test(m)) return new Error("Penyimpanan belum disiapkan. Jalankan file SQL 0002 di Supabase dulu.");
  if (m.toLowerCase().includes("fetch")) return new Error("Tidak bisa terhubung ke server. Periksa internet Anda.");
  return new Error(m || cadangan);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
function apiSupabase(): KelolaApi {
  const sb: SupabaseClient = createClient(URL_SB!, KUNCI_SB!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "momenmu-kelola" },
  });
  let uid: string | null = null;
  const pengguna = (u: { id: string; email?: string | null } | null | undefined): Pengguna | null => (u ? ((uid = u.id), { id: u.id, email: u.email ?? "" }) : null);

  return {
    demo: false,
    async sesi() {
      const { data } = await sb.auth.getSession();
      return pengguna(data.session?.user);
    },
    async masuk(email, sandi) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: sandi });
      if (error) throw galat(error);
      return pengguna(data.user)!;
    },
    async keluar() {
      await sb.auth.signOut();
      uid = null;
    },
    async gantiSandi(baru) {
      const { error } = await sb.auth.updateUser({ password: baru });
      if (error) throw galat(error, "Gagal mengganti kata sandi.");
    },
    async daftarAcara() {
      const { data, error } = await sb.from("events").select(KOLOM_ACARA).order("waktu_acara");
      if (error) throw galat(error);
      return (data ?? []) as Acara[];
    },
    async simpanAcara(id, ubah) {
      const { data, error } = await sb.from("events").update(ubah).eq("id", id).select(KOLOM_ACARA).single();
      if (error) throw galat(error);
      return data as Acara;
    },
    async daftarTamu(acaraId) {
      const semua: TamuBaris[] = [];
      for (let dari = 0; ; dari += 1000) {
        const { data, error } = await sb.from("guests").select(KOLOM_TAMU).eq("event_id", acaraId).order("created_at").order("id").range(dari, dari + 999);
        if (error) throw galat(error);
        semua.push(...((data ?? []) as TamuBaris[]));
        if (!data || data.length < 1000) break;
      }
      return semua;
    },
    async tambahTamu(acaraId, rows) {
      const hasil: TamuBaris[] = [];
      // created_at berurutan per milidetik supaya urutan impor (sesuai Excel) tetap terjaga
      const dasar = Date.now();
      for (let i = 0; i < rows.length; i += 200) {
        const potong = rows.slice(i, i + 200).map((r, j) => ({ ...r, event_id: acaraId, created_at: new Date(dasar + i + j).toISOString() }));
        const { data, error } = await sb.from("guests").insert(potong).select(KOLOM_TAMU);
        if (error) throw galat(error, "Gagal menambah tamu.");
        hasil.push(...((data ?? []) as TamuBaris[]));
      }
      return hasil;
    },
    async ubahTamu(id, ubah) {
      const { data, error } = await sb.from("guests").update(ubah).eq("id", id).select(KOLOM_TAMU).single();
      if (error) throw galat(error);
      return data as TamuBaris;
    },
    async ubahBanyakTamu(ids, ubah) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await sb.from("guests").update(ubah).in("id", ids.slice(i, i + 200));
        if (error) throw galat(error);
      }
    },
    async hapusTamu(ids) {
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await sb.from("guests").delete().in("id", ids.slice(i, i + 200));
        if (error) throw galat(error);
      }
    },
    async tandaiTerkirim(ids) {
      const sekarang = new Date().toISOString();
      for (let i = 0; i < ids.length; i += 200) {
        const potong = ids.slice(i, i + 200);
        const a = await sb.from("guests").update({ dikirim_pada: sekarang }).in("id", potong).is("dikirim_pada", null);
        if (a.error) throw galat(a.error);
        const b = await sb.from("guests").update({ status: "terkirim" }).in("id", potong).eq("status", "baru");
        if (b.error) throw galat(b.error);
      }
    },
    async daftarUcapan(acaraId) {
      const { data, error } = await sb.from("wishes").select(KOLOM_UCAPAN).eq("event_id", acaraId).order("created_at", { ascending: false }).limit(2000);
      if (error) throw galat(error);
      return (data ?? []) as UcapanBaris[];
    },
    async ubahUcapan(id, disembunyikan) {
      const { error } = await sb.from("wishes").update({ disembunyikan }).eq("id", id);
      if (error) throw galat(error);
    },
    async hapusUcapan(id) {
      const { error } = await sb.from("wishes").delete().eq("id", id);
      if (error) throw galat(error);
    },
    async unggah(berkas, jenis) {
      if (!uid) {
        const { data } = await sb.auth.getSession();
        uid = data.session?.user.id ?? null;
      }
      if (!uid) throw new Error("Sesi berakhir. Silakan masuk lagi.");
      const ext = EKSTENSI[jenis];
      if (!ext) throw new Error("Jenis berkas tidak didukung. Gunakan JPG/PNG/WebP untuk foto, MP3/M4A untuk musik.");
      const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      // Unggahan Blob dikirim sebagai form-data; jenis berkas diambil dari Blob itu sendiri,
      // jadi pastikan jenisnya benar (file musik dari sebagian HP tidak membawa jenis).
      const isi = berkas.type === jenis ? berkas : new Blob([berkas], { type: jenis });
      const { error } = await sb.storage.from(BUCKET).upload(path, isi, { contentType: jenis, upsert: false, cacheControl: "31536000" });
      if (error) throw galat(error, "Gagal mengunggah berkas.");
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}

// ---------------------------------------------------------------------------
// Demo (memori)
// ---------------------------------------------------------------------------
function apiDemo(): KelolaApi {
  const tunggu = () => new Promise((r) => setTimeout(r, 150));
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const sekarang = Date.now();
  let masukSebagai: Pengguna | null = null;
  let acara: Acara = {
    id: "demo-acara",
    slug: contoh.slug,
    tema: contoh.tema as NamaTema,
    waktu_acara: contoh.waktu_acara,
    batas_rsvp: contoh.batas_rsvp,
    aktif_sampai: contoh.aktif_sampai,
    konten: contoh.konten as Konten,
    hadiah: contoh.hadiah as Hadiah,
    izinkan_tanpa_kode: false,
    batas_perangkat: 3,
  };
  let tamu: TamuBaris[] = contoh.tamu.map((t, i) => ({
    id: id(),
    kode: t.kode,
    nama: t.nama,
    kategori: t.kategori,
    telepon: i % 2 ? "6281234567" + String(100 + i) : null,
    maks_orang: t.maks_orang,
    status: "baru",
    jumlah_hadir: null,
    dikirim_pada: null,
    dibuka_pada: null,
    dijawab_pada: null,
    perangkat: [],
    created_at: new Date(sekarang - (20 - i) * 60_000).toISOString(),
  }));
  let ucapan: UcapanBaris[] = contoh.ucapan.map((u, i) => {
    const t = tamu.find((x) => x.kode === u.kode);
    if (t) Object.assign(t, { status: u.kehadiran, jumlah_hadir: u.jumlah, dibuka_pada: new Date(sekarang - 7_200_000).toISOString(), dijawab_pada: new Date(sekarang - 3_600_000).toISOString(), perangkat: ["demo"] });
    return { id: id(), guest_id: t?.id ?? null, nama: u.nama, kehadiran: u.kehadiran as "hadir" | "tidak", jumlah: u.jumlah, pesan: u.pesan, disembunyikan: false, created_at: new Date(sekarang - (i + 1) * 10_800_000).toISOString() };
  });
  const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  return {
    demo: true,
    async sesi() {
      return masukSebagai;
    },
    async masuk(email) {
      await tunggu();
      masukSebagai = { id: "demo", email: email || "demo@momenmu.id" };
      return masukSebagai;
    },
    async keluar() {
      masukSebagai = null;
    },
    async gantiSandi() {
      await tunggu();
    },
    async daftarAcara() {
      await tunggu();
      return [salin(acara)];
    },
    async simpanAcara(_id, ubah) {
      await tunggu();
      acara = { ...acara, ...salin(ubah) };
      return salin(acara);
    },
    async daftarTamu() {
      await tunggu();
      return salin(tamu);
    },
    async tambahTamu(_a, rows) {
      await tunggu();
      const dasar = Date.now();
      const baru = rows.map((r: InputTamu & { kode: string }, i) => ({
        id: id(), ...r, status: "baru" as const, jumlah_hadir: null, dikirim_pada: null, dibuka_pada: null, dijawab_pada: null, perangkat: [], created_at: new Date(dasar + i).toISOString(),
      }));
      tamu = [...tamu, ...baru];
      return salin(baru);
    },
    async ubahTamu(idTamu, ubah) {
      await tunggu();
      const t = tamu.find((x) => x.id === idTamu);
      if (!t) throw new Error("Tamu tidak ditemukan.");
      Object.assign(t, salin(ubah));
      return salin(t);
    },
    async ubahBanyakTamu(ids, ubah) {
      await tunggu();
      const set = new Set(ids);
      for (const t of tamu) if (set.has(t.id)) Object.assign(t, salin(ubah));
    },
    async hapusTamu(ids) {
      await tunggu();
      const set = new Set(ids);
      tamu = tamu.filter((t) => !set.has(t.id));
    },
    async tandaiTerkirim(ids) {
      await tunggu();
      for (const t of tamu) {
        if (!ids.includes(t.id)) continue;
        t.dikirim_pada ??= new Date().toISOString();
        if (t.status === "baru") t.status = "terkirim";
      }
    },
    async daftarUcapan() {
      await tunggu();
      return salin(ucapan);
    },
    async ubahUcapan(idU, disembunyikan) {
      const u = ucapan.find((x) => x.id === idU);
      if (u) u.disembunyikan = disembunyikan;
    },
    async hapusUcapan(idU) {
      ucapan = ucapan.filter((x) => x.id !== idU);
    },
    async unggah(berkas) {
      await tunggu();
      return URL.createObjectURL(berkas); // hanya untuk pratinjau di mode demo (hilang saat halaman ditutup)
    },
  };
}

let api: KelolaApi | null = null;
export function kelolaApi(): KelolaApi {
  api ??= URL_SB && KUNCI_SB ? apiSupabase() : apiDemo();
  return api;
}

export type { UbahAcara };
