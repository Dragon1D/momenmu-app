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
8. **Lapor ke Deny** pakai format serah terima di bawah. Tawarkan untuk memantau PR (komentar review dan status Vercel) lewat `subscribe_pr_activity`.

## Format isi PR

```markdown
Langkah database sebelum Merge: tidak ada

## Ringkasan perubahan
- <apa yang berubah dan kenapa, 1–4 poin>

## Cara cek di pratinjau
1. Buka link pratinjau Vercel di komentar bot Vercel pada PR ini.
2. <halaman yang dibuka dan apa yang harus terlihat, di HP>

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

## Format serah terima ke Deny

```
Deny, [PR] <judul PR>
Link: <url PR>
Isi: <1–3 poin>
Database: tidak ada / <nama file SQL, jalankan sebelum Merge>
Cek: cek.sh bersih · tes HP <n>/<n>
Cek di pratinjau: <1–2 langkah>
```

## Kalau ada kendala

- Push ditolak atau GitHub MCP tidak tersedia: bilang terus terang, dan kasih Deny link `https://github.com/Dragon1D/momenmu-app/pull/new/<nama-branch>` supaya dia bisa buka PR sendiri.
- Build gagal karena hal di luar perubahan ini (misalnya `main` memang sudah rusak): jangan memperlebar PR. Laporkan errornya dan usulkan PR perbaikan terpisah.
- Status Vercel di PR gagal: baca log deployment lewat konektor Vercel (`list_deployments`, `list_deployment_events`) kalau tersedia, perbaiki, lalu push lagi ke branch yang sama.
