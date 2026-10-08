// Membuat supabase/seed.sql dari supabase/contoh-acara.json.
// Jalankan: node scripts/buat-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../supabase/contoh-acara.json", import.meta.url), "utf8"));
const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const j = (o) => `$json$${JSON.stringify(o)}$json$::jsonb`;

const baris = [];
baris.push("-- Data contoh acara (dibuat otomatis dari supabase/contoh-acara.json).");
baris.push("-- Jalankan SETELAH migrations/0001_skema_awal.sql. Aman dijalankan ulang.");
baris.push(`delete from public.events where slug = ${q(data.slug)};`);
baris.push(
  `insert into public.events (slug, tema, waktu_acara, batas_rsvp, aktif_sampai, izinkan_tanpa_kode, konten, hadiah) values (` +
    [q(data.slug), q(data.tema), q(data.waktu_acara), q(data.batas_rsvp), q(data.aktif_sampai), data.izinkan_tanpa_kode, j(data.konten), j(data.hadiah)].join(", ") +
    ");"
);
for (const t of data.tamu) {
  baris.push(
    `insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, ${q(t.kode)}, ${q(t.nama)}, ${q(t.kategori)}, ${t.maks_orang} from public.events where slug = ${q(data.slug)};`
  );
}
for (const u of data.ucapan) {
  baris.push(
    `select public.kirim_rsvp(${q(data.slug)}, ${q(u.kode)}, ${q(u.nama)}, ${q(u.kehadiran)}, ${u.jumlah}, ${q(u.pesan)});`
  );
}
baris.push("-- Hubungkan acara ke akun pemilik setelah login pertama di dashboard:");
baris.push("-- update public.events set owner_id = '<USER_ID_ANDA>' where slug = " + q(data.slug) + ";");

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), baris.join("\n") + "\n");
console.log("supabase/seed.sql dibuat:", baris.length, "baris");

// File gabungan (skema + data contoh) untuk dijalankan sekali di Supabase SQL Editor.
const kepala = [
  "-- =====================================================================",
  "-- SETUP SUPABASE MOMENMU.ID — CUKUP JALANKAN FILE INI SEKALI",
  "-- Cara: Supabase → SQL Editor → New query → tempel SELURUH isi file ini → Run.",
  "-- Isi: (1) tabel + keamanan + fungsi, (2) data contoh acara.",
  "-- Aman dijalankan ulang (data contoh akan di-reset).",
  "-- =====================================================================",
  "",
].join("\n");
const skema = readFileSync(new URL("../supabase/migrations/0001_skema_awal.sql", import.meta.url), "utf8").trimEnd();
const pemisah = "\n\n-- =====================================================================\n-- (2) DATA CONTOH\n-- =====================================================================\n";
writeFileSync(new URL("../supabase/SETUP-SUPABASE.sql", import.meta.url), kepala + "\n" + skema + pemisah + baris.join("\n") + "\n");
console.log("supabase/SETUP-SUPABASE.sql dibuat");
