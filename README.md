# Momenmu.id — Undangan Digital (versi live, tahap 1)

Website undangan pernikahan dengan tema **Kastil Cahaya**, link pribadi per tamu, RSVP, dan "Langit Doa" (ucapan tamu menjadi lampion).

Dibangun dengan **Next.js 16** (App Router) dan **Supabase** (database Postgres). Hosting: **Vercel**.

---

## Isi tahap 1

| Fitur | Status |
| --- | --- |
| Undangan tema Kastil Cahaya (sampul kastil, lampion, semua bagian) | ✅ |
| Opening: kamera zoom ke gerbang → pintu terbuka → masuk aula kastil (±4 dtk, bisa Lewati) | ✅ |
| Link pribadi per tamu `/{slug}/{kode}` + link umum `/{slug}` | ✅ |
| Status "dibuka" tercatat saat tamu menekan **Buka Undangan** (bukan saat bot WhatsApp membuat pratinjau) | ✅ |
| RSVP + ucapan tersimpan, satu jawaban per tamu (bisa diubah) | ✅ |
| Langit Doa, ringkasan hadir/tidak, ucapan diperbarui otomatis tiap 1 menit | ✅ |
| Rekening & alamat kado hanya tampil di link pribadi | ✅ |
| Halaman tidak diindeks Google, pratinjau link WhatsApp (judul, nama tamu, gambar kastil) | ✅ |
| Mode setelah acara, batas waktu RSVP | ✅ |
| Anti-spam Cloudflare Turnstile (opsional) | ✅ |
| Dashboard pemilik + login, kirim WhatsApp, pilih tema, ekspor Excel | ⏳ tahap 2 |
| Tema Peach Garden & Malam Seribu Lampion | ⏳ tahap 2 |

## Coba di komputer (mode demo, tanpa database)

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev
```

Buka http://localhost:3000/arya-nadia/dn7s. Data contoh disimpan di memori, jadi RSVP hilang saat server dimatikan.

## Menyalakan versi live (langkah demi langkah)

Semua akun atas nama kamu sendiri. Total ±30–40 menit.

### 1. Supabase (database)
1. Login di https://supabase.com, lalu klik **New project**. Region: **Southeast Asia (Singapore)**. Simpan password database di tempat aman (tidak dipakai di website).
2. Tunggu sampai project siap (±2 menit). Buka **SQL Editor → New query**, tempel **seluruh isi** `supabase/SETUP-SUPABASE.sql`, klik **Run**. Kalau muncul peringatan "destructive operation", pilih jalankan (aman, hanya data contoh).
3. Salin 2 nilai ini ke catatan:
   - **Project URL** (bentuknya `https://xxxx.supabase.co`) — ada di tombol **Connect** di atas, atau **Project Settings → Data API**.
   - **Publishable key** (`sb_publishable_...`) di **Project Settings → API Keys**. Kalau yang muncul tab **Legacy API keys**, pakai **anon public**. Keduanya bisa.
   - Jangan pakai **secret / service_role** key.

### 2. GitHub (penyimpan kode)
1. Klik **+ → New repository**. Nama: `momenmu`, pilih **Private**, jangan centang apa pun, lalu **Create repository**.
2. Di halaman repo kosong, klik link **uploading an existing file**.
3. Ekstrak zip, buka folder `momenmu`, pilih **semua isinya** (folder `public`, `src`, `supabase`, `scripts` dan semua file), lalu drag ke halaman GitHub. Tunggu semua file selesai terunggah, lalu klik **Commit changes**.
   - Yang di-drag adalah *isi* folder, bukan folder `momenmu`-nya, supaya `package.json` ada di halaman utama repo.

### 3. Vercel (website online)
1. Login di https://vercel.com, lalu **Add New → Project**. Hubungkan GitHub kalau diminta, lalu pilih repo `momenmu` → **Import**.
2. Buka bagian **Environment Variables** dan isi 2 baris:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Publishable key (atau anon public)
3. Klik **Deploy** dan tunggu ±2 menit sampai muncul kembang api.
4. Buka `https://<alamat-vercel>/arya-nadia/dn7s` di HP. Coba **Buka Undangan** dan kirim RSVP; ucapanmu harus muncul di **Supabase → Table Editor → wishes**.

### 4. Domain momenmu.id (menyusul)
1. Beli domain di registrar Indonesia. Untuk .id biasanya diminta KTP.
2. Di Vercel, buka **Settings → Domains → Add** dan masukkan `momenmu.id`. Ikuti instruksi DNS yang muncul.
3. Gambar pratinjau WhatsApp otomatis memakai domain produksi. Kalau perlu memaksa alamat tertentu, isi env `NEXT_PUBLIC_SITE_URL`, lalu Redeploy.

### 5. Supaya database gratis tidak "tidur"
Supabase versi gratis bisa dijeda kalau project lama tidak dipakai. Sebelum hari H, buka undangan secara berkala, atau upgrade sementara di bulan acara. Cek kebijakan terbaru Supabase.

## Cara update setelah online
- **Ubah data** (nama, acara, tamu): Supabase → Table Editor. Langsung berlaku tanpa deploy ulang.
- **Ubah tampilan/kode**: buka repo di GitHub → masuk ke folder yang berubah → **Add file → Upload files** → drag file baru (nama sama akan menimpa) → **Commit changes**. Vercel otomatis deploy ulang (±2 menit), link tetap sama.
- Kalau ada yang rusak setelah update: Vercel → **Deployments** → pilih versi sebelumnya → **⋯ → Promote to Production** (kembali ke versi lama dalam beberapa detik).

## Mengganti data acara

Sebelum dashboard tersedia, data acara diubah langsung di Supabase:
- **Table Editor → events**: kolom `konten` (mempelai, acara, kisah, galeri, dll.) dan `hadiah` (rekening, alamat). Bentuk datanya lihat `src/lib/tipe.ts` dan contoh di `supabase/contoh-acara.json`.
- **Table Editor → guests**: tambah tamu. `kode` diisi 4–12 huruf kecil/angka acak, misalnya `k7x2`. Link-nya menjadi `/{slug}/{kode}`.
- Foto: upload ke **Storage** (bucket publik) atau taruh di `public/`, lalu isi URL-nya di `konten`.

## Struktur penting

```
src/app/[slug]/page.tsx            link umum
src/app/[slug]/[kode]/page.tsx     link pribadi tamu
src/app/[slug]/tampil.tsx          ambil data + metadata pratinjau WhatsApp
src/app/api/rsvp|dibuka|ucapan     API (RSVP, tandai dibuka, daftar ucapan)
src/components/kastil/             tema Kastil Cahaya (komponen + CSS)
src/lib/data.ts                    akses Supabase via RPC + mode demo
supabase/migrations/               skema database, RLS, fungsi RPC
supabase/SETUP-SUPABASE.sql        skema + data contoh, dijalankan sekali di SQL Editor
supabase/contoh-acara.json         data contoh (buat ulang seed & SETUP: node scripts/buat-seed.mjs)
public/tema/                       ilustrasi kastil, pohon, lampion, foto contoh
```

## Keamanan

- Pengunjung tidak pernah membaca tabel secara langsung. Semua lewat fungsi RPC yang memeriksa slug dan kode tamu, dan Row Level Security aktif di semua tabel.
- Hanya **anon key** yang dipakai di website. Jangan pernah memasang `service_role` key di Vercel untuk tahap ini.
- Nama tamu diambil dari database, jadi tidak bisa diubah lewat URL.
