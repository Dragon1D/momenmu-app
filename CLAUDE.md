# CLAUDE.md — Momenmu.id

Undangan pernikahan online. Next.js 16 + React 19, Supabase, deploy di Vercel. Pemilik: Deny. Jawab pakai bahasa Indonesia santai (gua/lu) dan ringkas, karena Deny sering buka dari HP.

## Aturan kerja (wajib)
1. Selalu kerja di branch baru dari `main`, lalu buka Pull Request. Jangan pernah merge. Yang menekan Merge itu Deny.
2. Sebelum push, `npm ci`, `npx tsc --noEmit`, `npm run lint`, dan `npm run build` harus bersih.
3. Perubahan database ditulis sebagai file SQL baru di `supabase/migrations/` dengan nomor berikutnya. Jangan ubah atau jalankan ulang `0001_skema_awal.sql` dan `SETUP-SUPABASE.sql`. SQL dijalankan Deny di Supabase SQL Editor sebelum Merge.
4. Isi PR selalu dibuka dengan bagian "Langkah database sebelum Merge" (tulis "tidak ada" kalau memang tidak ada), lalu ringkasan perubahan dan cara cek di pratinjau.
5. Jangan ubah kode 1–14 Des 2026 (hari H 13 Des), kecuali Deny minta perbaikan darurat.
6. Setiap lapor PR, tulis jelas urutan sebelum Merge: (1) jalankan SQL kalau ada, (2) coba di link pratinjau dengan langkah yang ditulis, (3) baru Merge. Kalau tidak ada yang perlu dicoba, bilang terang-terangan. Jangan bilang "tinggal merge" sebelum Deny bilang sudah mencoba pratinjau.

## Fakta teknis
- `main` otomatis deploy ke produksi. Setiap branch dapat link pratinjau Vercel.
- Tanpa `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`, aplikasi otomatis jalan di mode demo (data contoh).
- Hanya kunci publishable/anon yang boleh dipakai. Jangan pakai service_role/secret key, dan jangan tulis rahasia apa pun di kode, commit, atau log.
- Cron harian `/api/jaga` di `vercel.json` menjaga Supabase Free supaya tidak dijeda. Jangan dihapus.
- Supabase Free tidak punya backup. Migrasi yang menghapus atau mengubah data wajib disebut jelas di PR.
- Desain mobile-first, karena tamu kebanyakan buka dari HP.
- Kalau ragu soal API Next.js atau Supabase, cek dokumentasi resminya. Jangan mengarang nama fungsi.

## Skill dan hook di repo
- `momenmu-pr` (`.claude/skills/momenmu-pr/`): alur branch → `cek.sh` → PR. Dipakai untuk setiap perubahan. Cek wajib cukup lewat `bash .claude/skills/momenmu-pr/cek.sh`.
- `momenmu-tes` (`.claude/skills/momenmu-tes/`): tes tampilan HP otomatis (Playwright 390×844) dengan screenshot bukti.
- `.claude/hooks/session-start.sh` otomatis memasang dependensi di awal setiap sesi cloud.
