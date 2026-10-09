// Tipe data dashboard /kelola (sama dengan baris tabel Supabase).
import type { Hadiah, Konten, NamaTema } from "../tipe";

export interface Acara {
  id: string;
  slug: string;
  tema: NamaTema;
  waktu_acara: string;
  batas_rsvp: string | null;
  aktif_sampai: string | null;
  konten: Konten & { pesan_wa?: string | null };
  hadiah: Hadiah;
  izinkan_tanpa_kode: boolean;
  batas_perangkat: number;
}

export type StatusTamu = "baru" | "terkirim" | "dibuka" | "hadir" | "tidak";

export interface TamuBaris {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  telepon: string | null;
  maks_orang: number;
  status: StatusTamu;
  jumlah_hadir: number | null;
  dikirim_pada: string | null;
  dibuka_pada: string | null;
  dijawab_pada: string | null;
  perangkat: string[];
  created_at: string;
}

export interface InputTamu {
  nama: string;
  kategori: string;
  telepon: string | null;
  maks_orang: number;
}

export interface UcapanBaris {
  id: string;
  guest_id: string | null;
  nama: string;
  kehadiran: "hadir" | "tidak";
  jumlah: number;
  pesan: string;
  disembunyikan: boolean;
  created_at: string;
}

export interface Pengguna {
  id: string;
  email: string;
}

export type UbahAcara = Partial<Pick<Acara, "slug" | "waktu_acara" | "batas_rsvp" | "aktif_sampai" | "konten" | "hadiah" | "izinkan_tanpa_kode" | "batas_perangkat">>;

export type UbahTamu = Partial<InputTamu & Pick<TamuBaris, "kode" | "perangkat" | "status" | "jumlah_hadir" | "dijawab_pada">>;

export interface KelolaApi {
  demo: boolean;
  sesi(): Promise<Pengguna | null>;
  masuk(email: string, sandi: string): Promise<Pengguna>;
  keluar(): Promise<void>;
  gantiSandi(baru: string): Promise<void>;
  daftarAcara(): Promise<Acara[]>;
  simpanAcara(id: string, ubah: UbahAcara): Promise<Acara>;
  daftarTamu(acaraId: string): Promise<TamuBaris[]>;
  tambahTamu(acaraId: string, data: (InputTamu & { kode: string })[]): Promise<TamuBaris[]>;
  ubahTamu(id: string, ubah: UbahTamu): Promise<TamuBaris>;
  /** Ubah beberapa tamu sekaligus (kategori, reset perangkat, maks orang). */
  ubahBanyakTamu(ids: string[], ubah: Partial<Pick<TamuBaris, "kategori" | "perangkat" | "maks_orang">>): Promise<void>;
  hapusTamu(ids: string[]): Promise<void>;
  tandaiTerkirim(ids: string[]): Promise<void>;
  daftarUcapan(acaraId: string): Promise<UcapanBaris[]>;
  ubahUcapan(id: string, disembunyikan: boolean): Promise<void>;
  hapusUcapan(id: string): Promise<void>;
  /** Unggah foto/musik ke penyimpanan; hasilnya URL publik. */
  unggah(berkas: Blob, jenis: string): Promise<string>;
}
