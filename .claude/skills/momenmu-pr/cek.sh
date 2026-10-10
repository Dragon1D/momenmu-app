#!/bin/bash
# Cek wajib sebelum push (aturan CLAUDE.md), dijalankan dari root repo:
#   bash .claude/skills/momenmu-pr/cek.sh
# Perbaikan darurat di masa beku 1–14 Des 2026 (atas permintaan Deny):
#   DARURAT=1 bash .claude/skills/momenmu-pr/cek.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

gagal=0
lulus() { echo "✅ $1"; }
salah() { echo "❌ $1"; gagal=1; }

# 0. Masa beku hari H
hari_ini=$(TZ=Asia/Jakarta date +%Y%m%d)
if [ "$hari_ini" -ge 20261201 ] && [ "$hari_ini" -le 20261214 ]; then
  if [ "${DARURAT:-}" = "1" ]; then
    echo "⚠️  Masa beku 1–14 Des 2026, lanjut karena DARURAT=1."
  else
    salah "Masa beku 1–14 Des 2026. Jangan ubah kode kecuali Deny minta perbaikan darurat (jalankan ulang dengan DARURAT=1)."
  fi
fi

# 1. Bukan di main
cabang=$(git branch --show-current)
if [ "$cabang" = "main" ]; then
  salah "Lagi di branch main. Bikin branch baru dulu."
else
  lulus "Branch: $cabang"
fi

git fetch -q origin main 2>/dev/null || echo "⚠️  Gagal fetch origin/main, pakai salinan lokal."
dasar=$(git merge-base HEAD origin/main 2>/dev/null || echo origin/main)
berubah=$( (git diff --name-only "$dasar"; git ls-files --others --exclude-standard) | sort -u)

# 2. File database yang tidak boleh disentuh
terlarang=$(echo "$berubah" | grep -E '^supabase/(migrations/0001_skema_awal\.sql|SETUP-SUPABASE\.sql)$' || true)
if [ -n "$terlarang" ]; then
  salah "File ini tidak boleh diubah: $terlarang"
else
  lulus "0001_skema_awal.sql dan SETUP-SUPABASE.sql tidak diubah"
fi
baru_sql=$(echo "$berubah" | grep -E '^supabase/migrations/.+\.sql$' || true)
[ -n "$baru_sql" ] && echo "ℹ️  Ada migrasi: $baru_sql (wajib tulis di 'Langkah database sebelum Merge')"

# 3. Cron penjaga Supabase masih ada
if node -e 'const v=require("./vercel.json");process.exit((v.crons||[]).some(c=>c.path==="/api/jaga")?0:1)'; then
  lulus "Cron /api/jaga masih ada di vercel.json"
else
  salah "Cron /api/jaga hilang dari vercel.json"
fi

# 4. Tidak ada rahasia di perubahan (folder .claude/skills dikecualikan karena
#    memuat pola pencariannya sendiri). JWT ikut ditolak: kunci Supabase
#    ditaruh di Environment Variables Vercel, bukan di kode.
pola='service_role|sb_secret_|SUPABASE_SERVICE|BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.'
rahasia=$( {
  git diff -U0 "$dasar" -- . ':(exclude)package-lock.json' ':(exclude).claude/skills' \
    | awk '/^\+\+\+ /{f=substr($0,7);next} /^\+/{print f "\t" substr($0,2)}' \
    | grep -iE "$pola" | cut -f1
  git ls-files --others --exclude-standard -- . ':(exclude).claude/skills' | xargs -r grep -lIiE "$pola"
} | sort -u)
if [ -n "$rahasia" ]; then
  salah "Ada yang mirip rahasia/kunci di file ini (isinya sengaja tidak ditampilkan):"
  echo "$rahasia" | sed 's/^/   - /'
else
  lulus "Tidak ada service_role/secret key/JWT di perubahan"
fi

# 5. Empat cek wajib
jalan() {
  local nama="$1"; shift
  local log; log=$(mktemp)
  if "$@" >"$log" 2>&1; then
    lulus "$nama"
  else
    salah "$nama gagal. 40 baris terakhir:"; tail -40 "$log"
  fi
  rm -f "$log"
}
jalan "npm ci" npm ci --no-audit --no-fund
jalan "npx tsc --noEmit" npx tsc --noEmit
jalan "npm run lint" npm run lint
jalan "npm run build" npm run build

echo
if [ "$gagal" = 0 ]; then
  echo "SEMUA BERSIH, boleh push."
else
  echo "BELUM BERSIH, jangan push dulu."
fi
exit "$gagal"
