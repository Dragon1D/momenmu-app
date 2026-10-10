// Akses data dashboard /kelola dari browser.
// - Supabase: login email + sandi (Supabase Auth); keamanan dijaga Row Level Security
//   (pemilik hanya bisa melihat & mengubah acaranya sendiri, admin agensi bisa semua).
// - File foto/musik disimpan per acara: media/<id-acara>/foto|musik/...
// - Demo: jika env Supabase kosong, data contoh disimpan di memori tab ini.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import contoh from "../../../supabase/contoh-acara.json";
import type { Hadiah, Konten, NamaTema } from "../tipe";
import type { Acara, BerkasMedia, InputTamu, KelolaApi, KlienBaris, Pengguna, TamuBaris, UbahAcara, UcapanBaris } from "./tipe";

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
const PRATINJAU = "Pratinjau";

/** media/<id-acara>/foto/... untuk foto, media/<id-acara>/musik/... untuk musik */
const subFolder = (jenis: string) => (jenis.startsWith("audio/") ? "musik" : "foto");
const namaBerkas = (ext: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

const KOLOM_ACARA = "id, slug, tema, waktu_acara, batas_rsvp, aktif_sampai, konten, hadiah, izinkan_tanpa_kode, batas_perangkat";
const KOLOM_TAMU = "id, kode, nama, kategori, telepon, maks_orang, status, jumlah_hadir, dikirim_pada, dibuka_pada, dijawab_pada, perangkat, created_at";
const KOLOM_UCAPAN = "id, guest_id, nama, kehadiran, jumlah, pesan, disembunyikan, created_at";

const PESAN: Record<string, string> = {
  "Invalid login credentials": "Email atau kata sandi salah.",
  "Email not confirmed": "Email belum dikonfirmasi. Konfirmasi dulu lewat Supabase → Authentication → Users.",
  "duplicate key value violates unique constraint \"events_slug_key\"": "Alamat (slug) itu sudah dipakai acara lain.",
  akun_tidak_ditemukan: "Email itu belum punya akun. Buat dulu di Supabase → Authentication → Users → Add user (centang Auto Confirm User).",
  acara_tidak_ditemukan: "Acara tidak ditemukan (mungkin sudah dihapus). Muat ulang halaman.",
  khusus_admin: "Hanya admin Momenmu yang bisa melakukan ini.",
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
  async function idAkun(): Promise<string | null> {
    if (!uid) {
      const { data } = await sb.auth.getSession();
      uid = data.session?.user.id ?? null;
    }
    return uid;
  }
  const AWALAN_PUBLIK = `${URL_SB!.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/`;
  const keJalur = (url: string): string | null => {
    if (!url.startsWith(AWALAN_PUBLIK)) return null;
    try {
      return decodeURIComponent(url.slice(AWALAN_PUBLIK.length).split(/[?#]/)[0]);
    } catch {
      return null;
    }
  };

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
    async unggah(berkas, jenis, acaraId) {
      if (!(await idAkun())) throw new Error("Sesi berakhir. Silakan masuk lagi.");
      const ext = EKSTENSI[jenis];
      if (!ext) throw new Error("Jenis berkas tidak didukung. Gunakan JPG/PNG/WebP untuk foto, MP3/M4A untuk musik.");
      const path = `${acaraId}/${subFolder(jenis)}/${namaBerkas(ext)}`;
      // Unggahan Blob dikirim sebagai form-data; jenis berkas diambil dari Blob itu sendiri,
      // jadi pastikan jenisnya benar (file musik dari sebagian HP tidak membawa jenis).
      const isi = berkas.type === jenis ? berkas : new Blob([berkas], { type: jenis });
      const { error } = await sb.storage.from(BUCKET).upload(path, isi, { contentType: jenis, upsert: false, cacheControl: "31536000" });
      if (error) throw galat(error, "Gagal mengunggah berkas.");
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async hapusBerkas(acaraId, urls) {
      const akun = await idAkun();
      // hanya file di folder acara ini (atau folder lama milik akun sendiri); foto contoh & file acara lain tidak disentuh
      const paths = [...new Set(urls.map(keJalur).filter((x): x is string => !!x && (x.startsWith(`${acaraId}/`) || (!!akun && x.startsWith(`${akun}/`)))))];
      let n = 0;
      for (let i = 0; i < paths.length; i += 100) {
        const { data, error } = await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (error) throw galat(error, "Gagal menghapus file.");
        n += data?.length ?? 0;
      }
      return n;
    },
    async daftarBerkas(acaraId) {
      const semua: BerkasMedia[] = [];
      for (const sub of ["foto", "musik"]) {
        for (let dari = 0; ; dari += 1000) {
          const { data, error } = await sb.storage.from(BUCKET).list(`${acaraId}/${sub}`, { limit: 1000, offset: dari, sortBy: { column: "name", order: "asc" } });
          if (error) throw galat(error, "Gagal membaca daftar file.");
          for (const f of data ?? []) {
            if (!f.id) continue; // folder
            const path = `${acaraId}/${sub}/${f.name}`;
            semua.push({ path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, ukuran: Number(f.metadata?.size ?? 0) });
          }
          if (!data || data.length < 1000) break;
        }
      }
      return semua;
    },
    async peran() {
      const { data, error } = await sb.rpc("is_staf");
      if (error) {
        // SQL 0003 belum dijalankan → anggap akun biasa
        if (error.code === "PGRST202" || /is_staf/.test(error.message)) return "klien";
        throw galat(error);
      }
      return data ? "staf" : "klien";
    },
    async daftarKlien() {
      const { data, error } = await sb.rpc("daftar_klien");
      if (error) throw galat(error);
      return ((data ?? []) as KlienBaris[]).map((r) => ({ ...r, jumlah_tamu: Number(r.jumlah_tamu), sudah_jawab: Number(r.sudah_jawab), hadir: Number(r.hadir) }));
    },
    async buatAcara(d) {
      const { data, error } = await sb
        .from("events")
        .insert({ ...d, tema: "kastil", izinkan_tanpa_kode: false, batas_perangkat: 3 })
        .select(KOLOM_ACARA)
        .single();
      if (error) throw galat(error, "Gagal membuat acara.");
      return data as Acara;
    },
    async sambungkanPemilik(acaraId, email) {
      const { data, error } = await sb.rpc("sambungkan_pemilik", { p_acara: acaraId, p_email: email?.trim() || null });
      if (error) throw galat(error);
      return (data as string | null) ?? null;
    },
    async hapusAcara(acaraId) {
      const berkas = await this.daftarBerkas(acaraId);
      if (berkas.length) await this.hapusBerkas(acaraId, berkas.map((b) => b.url));
      const { data, error } = await sb.from("events").delete().eq("id", acaraId).select("id");
      if (error) throw galat(error, "Gagal menghapus acara.");
      if (!data?.length) throw new Error("Acara tidak terhapus. Hanya admin Momenmu yang bisa menghapus acara.");
    },
  };
}

// ---------------------------------------------------------------------------
// Demo (memori). Masuk dengan email berawalan "admin" untuk mencoba tab Klien.
// ---------------------------------------------------------------------------
function apiDemo(): KelolaApi {
  const tunggu = () => new Promise((r) => setTimeout(r, 150));
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
  const sekarang = Date.now();
  const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  let masukSebagai: Pengguna | null = null;
  const pertama: Acara = {
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
  let semua: Acara[] = [pertama];
  const pemilik = new Map<string, string | null>([[pertama.id, null]]);
  const dibuat = new Map<string, string>([[pertama.id, new Date(sekarang - 86_400_000).toISOString()]]);
  const tamuPer = new Map<string, TamuBaris[]>();
  const ucapanPer = new Map<string, UcapanBaris[]>();
  const berkasPer = new Map<string, BerkasMedia[]>();

  const tamuAwal: TamuBaris[] = contoh.tamu.map((t, i) => ({
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
  const ucapanAwal: UcapanBaris[] = contoh.ucapan.map((u, i) => {
    const t = tamuAwal.find((x) => x.kode === u.kode);
    if (t) Object.assign(t, { status: u.kehadiran, jumlah_hadir: u.jumlah, dibuka_pada: new Date(sekarang - 7_200_000).toISOString(), dijawab_pada: new Date(sekarang - 3_600_000).toISOString(), perangkat: ["demo"] });
    return { id: id(), guest_id: t?.id ?? null, nama: u.nama, kehadiran: u.kehadiran as "hadir" | "tidak", jumlah: u.jumlah, pesan: u.pesan, disembunyikan: false, created_at: new Date(sekarang - (i + 1) * 10_800_000).toISOString() };
  });
  tamuPer.set(pertama.id, tamuAwal);
  ucapanPer.set(pertama.id, ucapanAwal);

  const staf = () => !!masukSebagai?.email.toLowerCase().startsWith("admin");
  const terlihat = () => (staf() ? semua : semua.filter((a, i) => i === 0 || pemilik.get(a.id) === masukSebagai?.email.toLowerCase()));
  const semuaTamu = () => [...tamuPer.values()].flat();
  const tamuDari = (a: string) => {
    if (!tamuPer.has(a)) tamuPer.set(a, []);
    return tamuPer.get(a)!;
  };

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
      return salin(terlihat());
    },
    async simpanAcara(idA, ubah) {
      await tunggu();
      const a = semua.find((x) => x.id === idA);
      if (!a) throw new Error("Acara tidak ditemukan.");
      Object.assign(a, salin(ubah));
      return salin(a);
    },
    async daftarTamu(a) {
      await tunggu();
      return salin(tamuDari(a));
    },
    async tambahTamu(a, rows) {
      await tunggu();
      const dasar = Date.now();
      const baru = rows.map((r: InputTamu & { kode: string }, i) => ({
        id: id(), ...r, status: "baru" as const, jumlah_hadir: null, dikirim_pada: null, dibuka_pada: null, dijawab_pada: null, perangkat: [], created_at: new Date(dasar + i).toISOString(),
      }));
      tamuDari(a).push(...baru);
      return salin(baru);
    },
    async ubahTamu(idTamu, ubah) {
      await tunggu();
      const t = semuaTamu().find((x) => x.id === idTamu);
      if (!t) throw new Error("Tamu tidak ditemukan.");
      Object.assign(t, salin(ubah));
      return salin(t);
    },
    async ubahBanyakTamu(ids, ubah) {
      await tunggu();
      const set = new Set(ids);
      for (const t of semuaTamu()) if (set.has(t.id)) Object.assign(t, salin(ubah));
    },
    async hapusTamu(ids) {
      await tunggu();
      const set = new Set(ids);
      for (const [a, daftar] of tamuPer) tamuPer.set(a, daftar.filter((t) => !set.has(t.id)));
    },
    async tandaiTerkirim(ids) {
      await tunggu();
      for (const t of semuaTamu()) {
        if (!ids.includes(t.id)) continue;
        t.dikirim_pada ??= new Date().toISOString();
        if (t.status === "baru") t.status = "terkirim";
      }
    },
    async daftarUcapan(a) {
      await tunggu();
      return salin(ucapanPer.get(a) ?? []);
    },
    async ubahUcapan(idU, disembunyikan) {
      for (const daftar of ucapanPer.values()) {
        const u = daftar.find((x) => x.id === idU);
        if (u) u.disembunyikan = disembunyikan;
      }
    },
    async hapusUcapan(idU) {
      for (const [a, daftar] of ucapanPer) ucapanPer.set(a, daftar.filter((x) => x.id !== idU));
    },
    async unggah(berkas, jenis, a) {
      await tunggu();
      const url = URL.createObjectURL(berkas); // hanya untuk pratinjau di mode demo (hilang saat halaman ditutup)
      const daftar = berkasPer.get(a) ?? [];
      daftar.push({ path: `${a}/${subFolder(jenis)}/${namaBerkas(EKSTENSI[jenis] ?? "bin")}`, url, ukuran: berkas.size });
      berkasPer.set(a, daftar);
      return url;
    },
    async hapusBerkas(a, urls) {
      const buang = new Set(urls);
      const daftar = berkasPer.get(a) ?? [];
      const sisa = daftar.filter((b) => !buang.has(b.url));
      for (const b of daftar) if (buang.has(b.url)) URL.revokeObjectURL(b.url);
      berkasPer.set(a, sisa);
      return daftar.length - sisa.length;
    },
    async daftarBerkas(a) {
      await tunggu();
      return salin(berkasPer.get(a) ?? []);
    },
    async peran() {
      return staf() ? "staf" : "klien";
    },
    async daftarKlien() {
      await tunggu();
      return semua.map((a) => {
        const t = tamuDari(a.id).filter((x) => x.kategori !== PRATINJAU);
        return {
          id: a.id,
          slug: a.slug,
          nama: `${a.konten.mempelai.pria.panggilan} & ${a.konten.mempelai.wanita.panggilan}`,
          waktu_acara: a.waktu_acara,
          aktif_sampai: a.aktif_sampai,
          owner_email: pemilik.get(a.id) ?? null,
          jumlah_tamu: t.length,
          sudah_jawab: t.filter((x) => x.status === "hadir" || x.status === "tidak").length,
          hadir: t.reduce((n, x) => n + (x.status === "hadir" ? (x.jumlah_hadir ?? 0) : 0), 0),
          dibuat: dibuat.get(a.id) ?? new Date().toISOString(),
        };
      });
    },
    async buatAcara(d) {
      await tunggu();
      if (semua.some((a) => a.slug === d.slug)) throw new Error("Alamat (slug) itu sudah dipakai acara lain.");
      const a: Acara = { ...salin(d), id: id(), tema: "kastil", izinkan_tanpa_kode: false, batas_perangkat: 3 };
      semua = [...semua, a];
      pemilik.set(a.id, null);
      dibuat.set(a.id, new Date().toISOString());
      return salin(a);
    },
    async sambungkanPemilik(a, email) {
      await tunggu();
      const e = email?.trim().toLowerCase() || null;
      pemilik.set(a, e);
      return e;
    },
    async hapusAcara(a) {
      await tunggu();
      semua = semua.filter((x) => x.id !== a);
      for (const m of [pemilik, dibuat, tamuPer, ucapanPer, berkasPer]) m.delete(a);
    },
  };
}

let api: KelolaApi | null = null;
export function kelolaApi(): KelolaApi {
  api ??= URL_SB && KUNCI_SB ? apiSupabase() : apiDemo();
  return api;
}

export type { UbahAcara };
