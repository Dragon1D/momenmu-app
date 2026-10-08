// Tipe data undangan. Bentuk `Konten` & `Hadiah` sama dengan kolom jsonb
// `events.konten` dan `events.hadiah` di database.

export type NamaTema = "peach" | "lampion" | "kastil";

export interface Mempelai {
  panggilan: string;
  nama_lengkap: string;
  keterangan: string; // contoh: "Putra pertama dari"
  orang_tua: string; // contoh: "Bapak Hendra Wijaya & Ibu Sri Lestari"
  instagram?: string | null; // tanpa "@"
  foto?: string | null;
}

export interface SesiAcara {
  nama: string; // "Akad Nikah", "Resepsi Taman"
  mulai: string; // ISO 8601, contoh "2027-04-03T19:00:00+07:00"
  selesai?: string | null;
  tempat: string;
  alamat: string;
  maps_url?: string | null;
}

export interface Konten {
  mempelai: { pria: Mempelai; wanita: Mempelai };
  acara: SesiAcara[];
  lokasi_utama: { nama: string; alamat: string; maps_url?: string | null };
  catatan_acara?: string | null;
  dress_code?: { nama: string; warna: string }[];
  kutipan?: { arab?: string | null; terjemahan: string; sumber: string } | null;
  tagline?: string | null;
  kisah?: { tahun: string; judul: string; teks: string; foto?: string | null }[];
  galeri?: { src: string; alt: string }[];
  turut_mengundang?: string[];
  musik_url?: string | null;
}

export interface Hadiah {
  rekening?: { bank: string; nomor: string; atas_nama: string }[];
  alamat?: { penerima: string; alamat: string } | null;
}

export interface UcapanTamu {
  kehadiran: "hadir" | "tidak";
  jumlah: number;
  pesan: string;
}

export interface Tamu {
  kode: string;
  nama: string;
  kategori: string;
  maks_orang: number;
  status: "baru" | "terkirim" | "dibuka" | "hadir" | "tidak";
  jumlah_hadir: number | null;
  ucapan: UcapanTamu | null;
}

export interface Undangan {
  slug: string;
  tema: NamaTema;
  waktu_acara: string;
  batas_rsvp: string | null;
  aktif_sampai: string | null;
  konten: Konten;
  hadiah: Hadiah | null; // null jika dibuka tanpa kode tamu yang valid
  tamu: Tamu | null;
}

export interface Ucapan {
  id: string;
  nama: string;
  kehadiran: "hadir" | "tidak";
  pesan: string;
  created_at: string;
}

export interface Ringkasan {
  hadir: number;
  tidak: number;
  ucapan: number;
}
