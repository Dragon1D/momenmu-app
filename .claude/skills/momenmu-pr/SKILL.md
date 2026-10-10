---
name: momenmu-pr
description: Alur kerja wajib setiap kali Deny minta perubahan di repo Momenmu (fitur, perbaikan, teks, desain, config, atau database), dari branch baru sampai link Pull Request. Pemicunya antara lain "ubah", "tambahin", "benerin", "ganti", "bikin fitur", "update", "fix", "bikin PR", "push", atau tugas berkode seperti "E1". Skill ini menjalankan cek wajib lewat cek.sh, menulis isi PR dengan format Deny, dan tidak pernah merge.
---

# Alur PR Momenmu

Buka jawaban ke Deny dengan `Deny, [PR]`. Santai (gua/lu), ringkas, karena Deny buka dari HP.

## Aturan keras

- Jangan pernah merge, approve, atau push langsung ke `main`. Yang menekan Merge itu Deny.
- Jangan ubah kode di masa beku 1–14 Des 2026 (hari H 13 Des), kecuali Deny minta perbaikan darurat.
- Jangan sentuh `supabase/migrations/0001_skema_awal.sql` dan `supabase/SETUP-SUPABASE.sql`.
- Jangan tulis rahasia (service_role, secret key, token, password) di kode, commit, PR, atau chat. Kunci Supabase cuma diisi Deny di Environment Variables Vercel.
- Cron `/api/jaga` di `vercel.json` jangan dihapus.
- `main` langsung jadi produksi. Jangan pernah bilang "tinggal merge" atau "siap di-merge" sebelum Deny bilang sudah mencoba pratinjau. Yang benar: "pratinjau siap dicoba", lalu tulis linknya dan langkahnya. Ini berlaku juga saat memantau PR dan statusnya jadi hijau.

## Langkah

1. **Branch baru dari main.** Pakai nama dari Deny kalau ada. Kalau tidak ada, pakai kebab-case pendek (contoh `e1-galeri-hp`).
   ```bash
   git fetch origin main && git checkout -b <nama-branch> origin/main && git branch --unset-upstream
   ```
2. **Kerjakan perubahannya.** Pakai versi terkecil yang menjawab permintaan, tanpa merapikan hal lain. Desain mobile-first. Kalau ragu soal API Next.js 16 atau Supabase, buka dokumentasi resminya dulu, jangan menebak nama fungsi.
3. **Kalau ada perubahan database:** bikin file baru `supabase/migrations/<nomor berikutnya>_<nama>.sql`. Cek nomornya dengan `ls supabase/migrations`. Usahakan aman dijalankan ulang (`if not exists`, `create or replace`). Kalau migrasinya menghapus atau mengubah data, tulis dengan jelas di PR, karena Supabase Free tidak punya backup.
4. **Cek wajib** sampai keluar `SEMUA BERSIH`:
   ```bash
   bash .claude/skills/momenmu-pr/cek.sh
   ```
   Isinya: cek masa beku, bukan di `main`, file database terlarang, cron `/api/jaga`, scan rahasia, lalu `npm ci`, `npx tsc --noEmit`, `npm run lint`, dan `npm run build`. Kalau ada ❌, perbaiki lalu ulangi. Jangan push kalau masih ada yang gagal.
5. **Tes tampilan HP** kalau perubahan menyentuh halaman atau komponen: jalankan skill `momenmu-tes` (mode lokal).
6. **Commit dan push.** Pesan commit ditulis dalam bahasa Indonesia, singkat:
   ```bash
   git add <file yang diubah> && git commit -m "<ringkasan>" && git push -u origin <nama-branch>
   ```
   Hasil build (`node_modules/`, `.next/`) sudah diabaikan `.gitignore`, jadi jangan di-commit.
7. **Buka PR ke `main`** lewat tool GitHub MCP `create_pull_request` (owner `Dragon1D`, repo `momenmu-app`). Pakai judul dari Deny kalau ada. Isinya pakai format di bawah, dan baris pertamanya selalu bagian database.
8. **Ambil link pratinjau.** Cek status Vercel lewat `pull_request_read` (`get_status`), lalu ambil link Preview dari komentar bot Vercel (`get_comments`). Kalau masih Building, tulis "pratinjau lagi dibangun ±1 menit". Jangan kirim link yang belum siap. Alamat produksi: `https://momenmu-app.vercel.app`.
9. **Lapor ke Deny** pakai format serah terima di bawah, dengan blok **Sebelum Merge** paling atas. Tawarkan untuk memantau PR (komentar review dan status Vercel) lewat `subscribe_pr_activity`.

## Format isi PR

```markdown
Langkah database sebelum Merge: tidak ada

## Ringkasan perubahan
- <apa yang berubah dan kenapa, 1–4 poin>

## Cara cek di pratinjau (centang sebelum Merge)
Link pratinjau: <link Preview dari komentar bot Vercel>
- [ ] <halaman yang dibuka dan apa yang harus terlihat, di HP>
- [ ] <langkah berikutnya>

## Cek lokal
cek.sh: semua bersih · tes HP (momenmu-tes): <n>/<n> lulus atau "tidak dijalankan, karena <alasan>"
```

Kalau ada migrasi, ganti baris pertama dengan:

```markdown
## Langkah database sebelum Merge
1. Supabase → SQL Editor → New query.
2. Tempel seluruh isi `supabase/migrations/000N_<nama>.sql` → Run.
3. <hasil yang harus terlihat, misalnya "Success. No rows returned">
⚠️ <kalau ada data yang dihapus atau diubah: tabel dan barisnya>
```

Langkah pratinjau ditulis sebagai checkbox, supaya Deny bisa mencentangnya di HP dan GitHub menampilkan "0 of n tasks" sampai semuanya dicoba. Kalau PR tidak mengubah tampilan atau perilaku app (misalnya cuma teks aturan atau skill), tulis satu checkbox: `- [ ] Tidak ada yang perlu dicoba di pratinjau, cukup lihat isi perubahan (Files changed)`.

## Format serah terima ke Deny

```
Deny, [PR] <judul PR>
Link PR: <url PR>

⚠️ Sebelum Merge (urut):
1. Database: tidak ada / jalankan `<file SQL>` di Supabase SQL Editor dulu
2. Coba di pratinjau: <link pratinjau>
   - <langkah 1 dan yang harus terlihat>
   - <langkah 2>
3. Kalau semua oke, baru Merge. Kalau ada yang aneh, bilang gua dulu.

Isi: <1–3 poin>
Cek: cek.sh bersih · tes HP <n>/<n>
```

Kalau tidak ada yang perlu dicoba, ganti poin 2 dengan "Nggak ada perubahan tampilan, cukup lihat isi perubahan (Files changed)". Jangan hilangkan blok Sebelum Merge.

## Kalau ada kendala

- Push ditolak atau GitHub MCP tidak tersedia: bilang terus terang, dan kasih Deny link `https://github.com/Dragon1D/momenmu-app/pull/new/<nama-branch>` supaya dia bisa buka PR sendiri.
- Build gagal karena hal di luar perubahan ini (misalnya `main` memang sudah rusak): jangan memperlebar PR. Laporkan errornya dan usulkan PR perbaikan terpisah.
- Status Vercel di PR gagal: baca log deployment lewat konektor Vercel (`list_deployments`, `list_deployment_events`) kalau tersedia, perbaiki, lalu push lagi ke branch yang sama.
