---
name: momenmu-tes
description: Tes otomatis tampilan HP untuk Momenmu (smoke test Playwright 390×844 dengan screenshot bukti), dijalankan langsung di sesi cloud. Pakai saat Deny bilang "tes", "cek tampilan HP", "QA", "smoke test", "udah aman belum", "cek pratinjau", atau saat skill momenmu-pr mengubah halaman atau komponen. Menguji beranda, sampul dan isi undangan tamu, login /kelola, link salah (404), cron /api/jaga, geser ke samping di HP, error konsol, dan kebocoran secret key.
---

# Tes HP Momenmu

Buka jawaban dengan `Deny, [QA]`, dan pakai format laporan skill `deny-toolkit:qa-validasi`. Skrip smoke test Python di qa-validasi tidak jalan di sesi cloud ini, karena yang terpasang Playwright versi Node. Jadi pakai skrip di folder ini.

## Yang dites skrip

| ID | Tes | Lulus kalau |
|---|---|---|
| TC-01 | Beranda `/` | status 200, tidak ada geser ke samping, tidak ada error konsol |
| TC-02 | Sampul undangan | status 200, tombol "Buka Undangan" muncul |
| TC-03 | Nama tamu di sampul | nama tamu tampil, bukan layar "Undangan pribadi" |
| TC-04 | Buka Undangan → isi | animasi pembuka selesai, isi undangan tampil tanpa geser ke samping |
| TC-05/06 | Login `/kelola` | status 200, kolom email muncul |
| TC-07 | Link salah | status 404 (tes negatif) |
| TC-08 | Cron `/api/jaga` | `ok:true`, atau 401 kalau `CRON_SECRET` aktif |

Di semua halaman, skrip juga memeriksa bahwa HTML dan JS tidak memuat `sb_secret_…` atau JWT dengan role selain `anon`.

Ketukan pertama saat intro berjalan memang hanya melewati intro (sesuai desain). Skrip sudah menangani ini dengan mengetuk lagi.

## Mode 1: lokal, mode demo (default)

Datanya contoh dari `supabase/contoh-acara.json`, jadi aman diulang-ulang. Dependensi sudah dipasang otomatis oleh hook sesi.

```bash
BUKTI=<scratchpad>/bukti-tes
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm run build
(env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npx next start -p 3000 > "$BUKTI.log" 2>&1 &)
for i in $(seq 1 30); do curl -s -o /dev/null localhost:3000 && break; sleep 1; done
node .claude/skills/momenmu-tes/smoke.mjs http://localhost:3000 "$BUKTI"
fuser -k 3000/tcp
```

Matikan server lewat port (`fuser -k 3000/tcp`). Jangan pakai `pkill -f "next start ..."`, karena polanya ikut cocok dengan shell yang menjalankannya, jadi shell itu ikut mati.

Ganti `<scratchpad>` dengan folder scratchpad sesi supaya screenshot bisa dikirim ke Deny. Kalau ada `.env.local` berisi kunci Supabase, mode demo tidak aktif. Jangan pakai file itu untuk tes.

## Mode 2: link pratinjau atau produksi (database asli)

- Jangan pernah memakai link tamu sungguhan, karena "Buka Undangan" memakai 1 dari 3 jatah perangkat link itu. Minta Deny link **Tamu Pratinjau** (tombol "Lihat undangan" di `/kelola`), lalu kirim path-nya sebagai argumen ketiga:
  ```bash
  node .claude/skills/momenmu-tes/smoke.mjs https://<link-pratinjau> "$BUKTI" /<slug>/<kode-pratinjau>
  ```
- Skrip ini hanya membaca: tidak mengirim RSVP, ucapan, atau unggahan. ID perangkatnya tetap (`smoke-test-momenmu`), jadi tes berulang dihitung satu perangkat.
- Kalau link pratinjau terkunci Vercel Authentication (status 401 atau halaman login Vercel), skrip tidak bisa masuk. Pakai mode 1, lalu cek isi pratinjau lewat konektor Vercel (`web_fetch_vercel_url`) kalau tersedia.

## Setelah skrip jalan

1. Baca output dan `hasil.json` di folder bukti. Untuk yang gagal, buka screenshot `TC-xx.png` dengan Read untuk melihat penyebabnya.
2. Kirim 2–3 screenshot penting (minimal `TC-02.png` dan `TC-04.png`) ke Deny lewat `SendUserFile`.
3. Fitur yang menulis data tidak diuji skrip: RSVP, ucapan, impor atau ekspor Excel, kirim WA, unggah foto atau musik. Kalau perubahan menyentuh fitur itu, tambahkan langkah tes manual yang bisa Deny jalankan dari HP, dengan status `Belum dites`.
4. Jangan menulis `Lulus` untuk tes yang tidak dijalankan.
5. Kalau konektor Google Sheets tersambung, catat ringkasannya ke tab QA lewat `deny-toolkit:simpan-drive`.

## Format laporan

```
Deny, [QA] <objek>: <GO / GO dengan catatan / NO-GO>
Tes: <n> · Lulus <a> · Gagal <b> · Belum dites <c>
Bug terbuka: S1 <w> · S2 <x> · S3 <y> · S4 <z>
<maksimal 5 baris temuan>
Langkah berikutnya: <1–2 kalimat>
```

`NO-GO` kalau TC-02, TC-03, TC-04, atau TC-05 gagal (alur utama tamu atau dashboard), atau ada rahasia bocor.
