# Momenmu.id — Undangan Digital (tahap 2: dashboard)

Website undangan pernikahan bertema **Kastil Cahaya** (ungu-lilac & emas): opening sinematik, link pribadi per tamu, RSVP, "Langit Doa", dan **dashboard pengantin** di `/kelola` untuk mengatur isi undangan & ±500 tamu tanpa menyentuh kode.

Dibangun dengan **Next.js 16** (App Router) dan **Supabase** (Postgres + Auth + Storage). Hosting: **Vercel**.

---

## Fitur

| Fitur | Status |
| --- | --- |
| Opening seperti video referensi: kamera mundur dari kastil & bulan, jembatan, bunga & dedaunan berlampion masuk, nama muncul per huruf (ketuk = lewati) | ✅ |
| Buka Undangan: kamera maju ke gerbang → pintu terbuka → masuk aula (±4 dtk, bisa Lewati) | ✅ |
| Font di-host sendiri (Cormorant Garamond, Cinzel, Lato, Amiri), angka tegak mudah dibaca | ✅ |
| Link pribadi per tamu `/{slug}/{kode}`; link umum dimatikan (bisa dinyalakan) | ✅ |
| **Maks. 3 HP/laptop per link**; perangkat ke-4 melihat layar "Undangan pribadi" (bisa di-reset) | ✅ |
| Nama di RSVP terkunci sesuai undangan; rekening/alamat kado hanya muncul di perangkat terdaftar | ✅ |
| Dashboard `/kelola` (login email + sandi) | ✅ |
| — Tamu: tambah/ubah/hapus, impor Excel (.xlsx/CSV/tempel), ekspor Excel, cari & saring, pilih banyak | ✅ |
| — Kirim WhatsApp per tamu atau **berurutan** dengan template pesan, status terkirim otomatis | ✅ |
| — Reset perangkat, buat link baru (link lama mati), konfirmasi kehadiran manual | ✅ |
| — Isi undangan: mempelai, jadwal, lokasi, kata-kata, kisah, galeri, dress code, musik, amplop digital (+ unggah foto/musik) | ✅ |
| — Ucapan: sembunyikan/hapus, unduh Excel; Ringkasan: statistik, per kategori, aktivitas, daftar persiapan | ✅ |
| Penjaga database (Vercel Cron harian) supaya Supabase gratis tidak dijeda | ✅ |
| Tema lain, domain sendiri, QR check-in di lokasi | ⏳ berikutnya |

## Coba di komputer (mode demo, tanpa database)

Butuh Node.js 20+.

```bash
npm install
npm run dev
```

- Undangan contoh: http://localhost:3000/arya-nadia/dn7s
- Dashboard: http://localhost:3000/kelola (mode demo: email & sandi apa saja; data hanya di memori)

---

## A. Update dari versi tahap 1 (yang sudah online)

Urutan penting: **database dulu, baru kode** (kode baru memakai fungsi database baru).

1. **Supabase → SQL Editor → New query** → tempel seluruh isi `supabase/migrations/0002_kelola_dan_keamanan.sql` → **Run**. Aman dijalankan ulang; data tamu & ucapan tetap.
2. **Supabase → Authentication → Users → Add user → Create new user**: isi email & kata sandi pengantin, centang **Auto Confirm User**.
3. **Supabase → Authentication → Sign In / Providers**: matikan **Allow new users to sign up** (supaya orang lain tidak bisa membuat akun).
4. **GitHub** → repo → **Add file → Upload files** → drag *isi* folder hasil ekstrak zip (bukan foldernya) → **Commit changes**. Vercel otomatis deploy ±2 menit.
5. Buka `https://<alamat-vercel>/kelola`, masuk dengan akun langkah 2. Pertama kali akan muncul **“Akun belum terhubung”** beserta perintah SQL berisi ID akunmu → salin → jalankan di SQL Editor → **Muat ulang**.
6. Di **Ringkasan**, ikuti daftar **Persiapan sebelum menyebar undangan**: hapus data contoh, ganti foto/kisah/galeri contoh, lengkapi alamat & link Maps, isi rekening, impor tamu.
7. (Opsional) **Vercel → Settings → Environment Variables**: tambah `CRON_SECRET` berisi teks acak panjang → Redeploy. Penjaga database tetap jalan tanpa ini, hanya lebih rapi.

## B. Pasang dari nol

1. **Supabase**: New project (region Singapore) → SQL Editor → jalankan seluruh `supabase/SETUP-SUPABASE.sql` (skema + data contoh + fitur tahap 2). Catat **Project URL** dan **Publishable key** (atau *anon public*). Jangan pakai *secret/service_role*.
2. Lakukan langkah A2, A3.
3. **GitHub**: buat repo, unggah isi folder.
4. **Vercel**: Import repo → Environment Variables `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Deploy.
5. Lakukan langkah A5–A7 (ganti `deny-carelina` di perintah SQL dengan alamat acaramu, data contoh memakai `arya-nadia`).

## Memakai dashboard (ringkas)

1. **Isi undangan** → lengkapi, klik **Simpan**. Langsung berlaku di semua link tamu.
2. **Tamu** → **Impor dari Excel** (kolom Nama, Kategori, No WA, Maks orang; contoh Excel bisa diunduh di sana) atau **+ Tambah tamu**. Setiap tamu otomatis mendapat link pribadi.
3. **Kirim WA berurutan** → WhatsApp terbuka dengan pesan + link untuk tiap tamu; tekan kirim, kembali, lanjut tamu berikutnya. Atur kalimatnya di **Atur pesan WA**.
4. **Ringkasan** → pantau dikirim/dibuka/hadir. Tamu ganti HP? **Ubah → Reset perangkat**. Link bocor? **Buat link baru**.
5. **Lihat undangan** (kanan atas) membuka pratinjau sebagai “Tamu Pratinjau” tanpa memakai jatah HP tamu sungguhan.

## Batas layanan gratis (cek berkala)

- **Supabase Free**: database 500 MB, penyimpanan file 1 GB, egress 5 GB/bulan; proyek dijeda setelah 1 minggu tanpa aktivitas → sudah dicegah oleh cron harian `/api/jaga` (`vercel.json`).
- **Vercel Hobby**: hanya untuk pemakaian pribadi non-komersial. Saat Momenmu.id mulai menerima klien berbayar, pindah ke paket Pro.
- Foto otomatis diperkecil (WebP ±1600 px) sebelum diunggah; musik maks. 10 MB (MP3 128 kbps disarankan).

## Cara update kode setelah online
- Unggah file yang berubah lewat GitHub (**Add file → Upload files**, nama sama menimpa) → Vercel deploy otomatis.
- Ada yang rusak? Vercel → **Deployments** → versi sebelumnya → **⋯ → Promote to Production**.

## Struktur penting

```
src/app/kelola/page.tsx            dashboard pengantin
src/components/kelola/             UI dashboard (Ringkasan, Tamu, Isi undangan, Ucapan, Pengaturan)
src/lib/kelola/                    akses Supabase dari browser, impor/ekspor Excel, utilitas
src/app/[slug]/[kode]/page.tsx     link pribadi tamu
src/app/[slug]/tampil.tsx          ambil data + metadata pratinjau WhatsApp
src/app/api/                       rsvp, dibuka (catat perangkat), hadiah, ucapan, jaga (cron)
src/components/kastil/             tema Kastil Cahaya (komponen + CSS animasi)
src/app/fonts.ts, src/app/fonts/   font yang di-host sendiri (lisensi OFL)
src/lib/data.ts                    akses Supabase via RPC + mode demo
supabase/migrations/               0001 skema awal, 0002 dashboard & keamanan
supabase/SETUP-SUPABASE.sql        gabungan semua migrasi + data contoh (node scripts/buat-seed.mjs)
public/tema/kastil/                ilustrasi kastil, gerbang, aula, lapisan intro
```

## Keamanan

- Tamu tidak pernah membaca tabel langsung; semua lewat fungsi RPC yang memeriksa slug, kode, dan perangkat. Row Level Security aktif di semua tabel.
- Dashboard memakai login Supabase Auth; RLS memastikan akun hanya melihat & mengubah acaranya sendiri. File foto/musik hanya bisa diunggah ke folder milik akun itu.
- Hanya **publishable/anon key** yang dipasang di Vercel. Jangan pernah memasang `service_role` key.
- Kode tamu 6 karakter acak (±887 juta kemungkinan); nama tamu diambil dari database, tidak bisa diubah lewat URL.
