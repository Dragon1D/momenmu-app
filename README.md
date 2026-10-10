# Momenmu.id — Undangan Digital (tahap 3: multi-klien)

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
| **Admin agensi** (tab **Klien**): lihat semua acara, buat acara baru, sambungkan akun klien, cek & bersihkan file, hapus acara | ✅ |
| **Kirim undangan** ke email klien dari tab Klien: akun dibuat otomatis, acara langsung tersambung, klien membuat kata sandi sendiri; **Lupa kata sandi?** di halaman masuk | ✅ (butuh setelan bagian C) |
| File foto/musik per acara (`media/<id-acara>/foto|musik/`); foto yang diganti/batal otomatis dihapus | ✅ |
| Klien hanya bisa membuka acaranya sendiri; pemilik & masa aktif hanya bisa diubah admin | ✅ |
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

## B. Update ke tahap 3 (multi-klien)

Urutan: **database dulu, baru kode**. Undangan & link tamu yang sudah tersebar tidak berubah.

1. **Supabase → SQL Editor → New query** → tempel seluruh isi `supabase/migrations/0003_multi_klien.sql` → **Run**. Aman dijalankan ulang.
2. **Buat akun admin** (terpisah dari akun pernikahan): Authentication → Users → **Add user** → Create new user, centang **Auto Confirm User**.
3. **Jadikan akun itu admin** — SQL Editor, ganti emailnya dulu, lalu Run:
   ```sql
   insert into public.staf (user_id, catatan)
   select id, 'admin Momenmu' from auth.users where email = 'email-admin@contoh.com'
   on conflict (user_id) do nothing
   returning user_id;
   ```
   Harus muncul 1 baris. Kalau kosong, emailnya salah ketik.
4. **GitHub** → repo → **Add file → Upload files** → drag *isi* folder hasil ekstrak zip update (README.md, `src`, `supabase`) → **Commit changes**. File lain tidak terhapus.
5. Buka `/kelola`, masuk dengan **akun admin** → muncul tab **Klien** berisi semua acara. Akun pernikahan tetap seperti biasa (hanya acaranya sendiri, tanpa tab Klien).

### Alur klien baru
1. Tab **Klien → + Buat acara baru**: isi nama panggilan, tanggal, alamat link. Isi awal dari contoh Kastil Cahaya; rekening kosong.
2. (Paket dibuatkan) **Kelola** → isi undangan & unggah foto.
3. Tab Klien → **Undang klien** → ketik email klien → **Kirim undangan**. Akun dibuat otomatis, acara langsung tersambung, dan klien menerima email untuk membuat kata sandi (setelan sekali pasang: bagian C).
4. Klien klik link di email → langsung masuk dashboard acaranya → buat kata sandi. Klien hanya melihat acaranya sendiri.
   - Tanpa email: buat akun di Supabase (**Add user**, Auto Confirm) → **Sambungkan saja** → salin pesan untuk klien, kirim sandinya terpisah.
5. Setelah acara selesai: unduh Excel tamu/ucapan bila perlu → tab Klien → **Hapus** (tamu, ucapan, dan file ikut terhapus).

## C. Undang klien lewat email (setelan sekali pasang)

Tombol **Kirim undangan** (tab Klien → Undang klien / Atur akun) memanggil `/api/kelola/undang` di server Vercel. Server memastikan pemanggilnya admin lewat fungsi database `is_staf()`, lalu meminta Supabase membuat akun + mengirim email undangan, lalu menyambungkan acara lewat `sambungkan_pemilik()`.

1. **Vercel** → Settings → Environment Variables: harus ada `SUPABASE_SERVICE_ROLE_KEY` (Production). Integrasi Supabase–Vercel biasanya sudah mengisinya otomatis. Kunci ini hanya dipakai server; **jangan** dibuat versi `NEXT_PUBLIC_`.
2. **Supabase → Authentication → URL Configuration → Site URL**: `https://<alamat-website>/kelola` (sekarang `https://momenmu-app.vercel.app/kelola`), lalu di **Redirect URLs** tambahkan alamat yang sama. Link di email undangan & lupa kata sandi membuka alamat ini. Saat pindah ke domain sendiri, ganti juga di sini.
3. **SMTP sendiri** (Authentication → SMTP Settings), wajib untuk email klien sungguhan. Tanpa ini, email bawaan Supabase hanya terkirim ke anggota tim project Supabase, maks. 2 email/jam. Contoh layanan: Resend (perlu domain sendiri), Brevo, Postmark.
4. **Template email** (Authentication → Emails → Templates), ganti ke bahasa Indonesia:
   - *Invite user* — Subjek: `Undangan mengelola undangan digital Anda di Momenmu`
     ```html
     <h2>Selamat datang di Momenmu</h2>
     <p>Admin Momenmu sudah menyiapkan dashboard untuk undangan digital Anda.</p>
     <p><a href="{{ .ConfirmationURL }}">Buka dashboard &amp; buat kata sandi</a></p>
     <p>Link ini hanya bisa dipakai sekali dan berlaku terbatas. Kalau sudah kedaluwarsa, minta admin Momenmu mengirim ulang undangan.</p>
     <p>Tidak merasa memesan undangan di Momenmu? Abaikan email ini.</p>
     ```
   - *Reset password* — Subjek: `Buat kata sandi baru Momenmu`
     ```html
     <h2>Buat kata sandi baru</h2>
     <p>Ada permintaan membuat kata sandi baru untuk akun {{ .Email }} di Momenmu.</p>
     <p><a href="{{ .ConfirmationURL }}">Buat kata sandi baru</a></p>
     <p>Tidak merasa meminta? Abaikan email ini; kata sandi lama tetap berlaku.</p>
     ```

Klien yang membuka link undangan langsung masuk dashboard acaranya dan diminta membuat kata sandi. Link yang sudah kedaluwarsa memunculkan pesan di halaman masuk. **Lupa kata sandi?** di halaman masuk mengirim link untuk membuat kata sandi baru (butuh SMTP yang sama).

## D. Pasang dari nol

1. **Supabase**: New project (region Singapore) → SQL Editor → jalankan seluruh `supabase/SETUP-SUPABASE.sql` (skema + data contoh + fitur tahap 2). Catat **Project URL** dan **Publishable key** (atau *anon public*). Kunci *service_role* hanya untuk variabel server `SUPABASE_SERVICE_ROLE_KEY` (bagian C), jangan pernah di browser.
2. Lakukan langkah A2, A3.
3. **GitHub**: buat repo, unggah isi folder.
4. **Vercel**: Import repo → Environment Variables `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ `SUPABASE_SERVICE_ROLE_KEY` untuk Kirim undangan) → Deploy.
5. Lakukan langkah A6–A7 dan B2–B3, lalu buat acara pertama dari tab **Klien** (data contoh memakai `arya-nadia`).

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
src/components/kelola/             UI dashboard (Klien [admin], Ringkasan, Tamu, Isi undangan, Ucapan, Pengaturan)
src/lib/kelola/                    akses Supabase dari browser, impor/ekspor Excel, utilitas
src/app/[slug]/[kode]/page.tsx     link pribadi tamu
src/app/[slug]/tampil.tsx          ambil data + metadata pratinjau WhatsApp
src/app/api/                       rsvp, dibuka (catat perangkat), hadiah, ucapan, jaga (cron), kelola/undang (kirim undangan klien, khusus admin)
src/components/kastil/             tema Kastil Cahaya (komponen + CSS animasi)
src/app/fonts.ts, src/app/fonts/   font yang di-host sendiri (lisensi OFL)
src/lib/data.ts                    akses Supabase via RPC + mode demo
supabase/migrations/               0001 skema awal, 0002 dashboard & keamanan, 0003 multi-klien
supabase/SETUP-SUPABASE.sql        gabungan semua migrasi + data contoh (node scripts/buat-seed.mjs)
public/tema/kastil/                ilustrasi kastil, gerbang, aula, lapisan intro
```

## Keamanan

- Tamu tidak pernah membaca tabel langsung; semua lewat fungsi RPC yang memeriksa slug, kode, dan perangkat. Row Level Security aktif di semua tabel.
- Dashboard memakai login Supabase Auth; RLS memastikan klien hanya melihat & mengubah acaranya sendiri. Admin (tabel `staf`, hanya bisa diisi lewat SQL Editor) bisa mengelola semua acara.
- File foto/musik disimpan per acara (`media/<id-acara>/...`) dan hanya bisa diunggah/dihapus oleh pemilik acara itu atau admin. File lama di `media/<id-akun>/...` tetap tampil.
- Membuat/menghapus acara, memindah pemilik, dan mengubah masa aktif hanya bisa dilakukan admin (dijaga di database, bukan hanya di tampilan).
- Browser hanya memakai **publishable/anon key**. Kunci `service_role` hanya dibaca server di `/api/kelola/undang` untuk membuat akun undangan, setelah database memastikan pemanggilnya admin (`is_staf()`); penyambungan acara tetap lewat fungsi database khusus admin. Jangan pernah memberi kunci ini awalan `NEXT_PUBLIC_`.
- Kode tamu 6 karakter acak (±887 juta kemungkinan); nama tamu diambil dari database, tidak bisa diubah lewat URL.
