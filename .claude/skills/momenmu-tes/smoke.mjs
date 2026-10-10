// Smoke test Momenmu di layar HP (390×844) pakai Playwright + Chromium.
// Pemakaian (dari root repo):
//   node .claude/skills/momenmu-tes/smoke.mjs [url] [folder-bukti] [path-undangan]
// Default: http://localhost:3000, <tmp>/momenmu-bukti, /arya-nadia/dn7s (tamu demo).
// Keluar dengan kode 1 kalau ada tes yang gagal.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
function muatPlaywright() {
  try {
    return require("playwright");
  } catch {
    const global = execSync("npm root -g").toString().trim();
    return require(path.join(global, "playwright"));
  }
}
const { chromium } = muatPlaywright();

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const out = path.resolve(process.argv[3] || path.join(tmpdir(), "momenmu-bukti"));
const pathUndangan = process.argv[4] || "/arya-nadia/dn7s";
mkdirSync(out, { recursive: true });

const hasil = [];
const catat = (id, nama, status, catatan = "", bukti = "") => {
  hasil.push({ id, nama, status, catatan, bukti });
  console.log(`${status === "Lulus" ? "✅" : status === "Gagal" ? "❌" : "⚠️ "} ${id} ${nama}${catatan ? ` · ${catatan}` : ""}`);
};

// Kunci rahasia tidak boleh ada di HTML/JS yang dikirim ke browser.
// Kunci anon/publishable memang publik; yang dicari secret key dan JWT service_role.
// (Teks "service_role" sendiri ada di library supabase-js, jadi bukan tanda bocor.)
function cariRahasia(teks) {
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(teks)) return "secret key sb_secret_…";
  for (const jwt of teks.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const isi = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
      if (isi.role && isi.role !== "anon") return `JWT dengan role ${isi.role}`;
    } catch {}
  }
  return null;
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
}
const konteks = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "id-ID",
  timezoneId: "Asia/Jakarta",
});
// ID perangkat tetap, jadi tes berulang dihitung satu perangkat (batas 3 HP per link).
await konteks.addInitScript(() => {
  try {
    localStorage.setItem("momenmu-perangkat", "smoke-test-momenmu");
  } catch {}
});

async function bukaHalaman(id, nama, rute, { harapStatus = 200, tunggu } = {}) {
  const page = await konteks.newPage();
  const errorKonsol = [];
  const sumber = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Halaman yang memang diharapkan 404 pasti memunculkan error "Failed to load resource".
    if (harapStatus !== 200 && m.location().url === base + rute) return;
    errorKonsol.push(m.text());
  });
  page.on("pageerror", (e) => errorKonsol.push(String(e)));
  page.on("response", async (r) => {
    const t = r.request().resourceType();
    if ((t === "document" || t === "script") && r.url().startsWith(base)) {
      sumber.push(r.text().catch(() => ""));
    }
  });

  const mulai = Date.now();
  let resp;
  try {
    resp = await page.goto(base + rute, { waitUntil: "load", timeout: 45000 });
  } catch (e) {
    catat(id, nama, "Gagal", `tidak bisa dibuka: ${String(e).split("\n")[0]}`);
    await page.close();
    return null;
  }
  const waktu = Date.now() - mulai;
  if (tunggu) await tunggu(page).catch(() => {});

  const file = `${id}.png`;
  await page.screenshot({ path: path.join(out, file) });
  const status = resp ? resp.status() : 0;
  const lebar = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const rahasia = (await Promise.all(sumber)).map(cariRahasia).find(Boolean);

  const masalah = [];
  if (status !== harapStatus) masalah.push(`status ${status}, harusnya ${harapStatus}`);
  if (lebar > 1) masalah.push(`geser ke samping ${lebar}px`);
  if (rahasia) masalah.push(`RAHASIA BOCOR: ${rahasia}`);
  if (errorKonsol.length) masalah.push(`error konsol: ${errorKonsol.slice(0, 2).join(" | ").slice(0, 200)}`);
  catat(id, nama, masalah.length ? "Gagal" : "Lulus", masalah.join("; ") || `${status} · ${(waktu / 1000).toFixed(1)} dtk`, file);
  return page;
}

// TC-01 Beranda
await (await bukaHalaman("TC-01", "Beranda /", "/"))?.close();

// TC-02..04 Undangan tamu: sampul → Buka Undangan → isi
const undangan = await bukaHalaman("TC-02", `Sampul undangan ${pathUndangan}`, pathUndangan, {
  tunggu: (p) => p.getByRole("button", { name: "Buka Undangan" }).waitFor({ state: "visible", timeout: 15000 }),
});
if (undangan) {
  const tombol = undangan.getByRole("button", { name: "Buka Undangan" });
  const nama = (await undangan.locator(".km-nama-tamu").textContent().catch(() => ""))?.trim();
  if (await undangan.getByText("Undangan pribadi", { exact: true }).first().isVisible().catch(() => false) && !(await tombol.isVisible().catch(() => false))) {
    catat("TC-03", "Nama tamu di sampul", "Gagal", "yang muncul layar 'Undangan pribadi' (kode salah, link dikunci, atau sudah 3 perangkat)");
  } else {
    catat("TC-03", "Nama tamu di sampul", nama && nama !== "Tamu Undangan" ? "Lulus" : "Gagal", nama ? `"${nama}"` : "nama tamu tidak ketemu");
  }
  try {
    // Ketukan pertama saat intro masih jalan hanya melewati intro (sesuai desain),
    // jadi tombol diklik lagi kalau undangan belum mulai membuka.
    await tombol.click({ timeout: 10000 });
    await undangan.waitForTimeout(800);
    if (await undangan.locator(".km-tertutup").count()) await tombol.click({ timeout: 10000 });
    await undangan.waitForTimeout(1500);
    const lewati = undangan.getByRole("button", { name: "Lewati" });
    if (await lewati.isVisible().catch(() => false)) await lewati.click();
    await tombol.waitFor({ state: "detached", timeout: 15000 });
    await undangan.waitForTimeout(1000);
    await undangan.screenshot({ path: path.join(out, "TC-04.png") });
    const lebar = await undangan.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    catat("TC-04", "Buka Undangan → isi undangan", lebar > 1 ? "Gagal" : "Lulus", lebar > 1 ? `geser ke samping ${lebar}px` : "", "TC-04.png");
  } catch (e) {
    await undangan.screenshot({ path: path.join(out, "TC-04.png") }).catch(() => {});
    catat("TC-04", "Buka Undangan → isi undangan", "Gagal", String(e).split("\n")[0].slice(0, 160), "TC-04.png");
  }
  await undangan.close();
}

// TC-05 Dashboard login
const kelola = await bukaHalaman("TC-05", "Login dashboard /kelola", "/kelola", {
  tunggu: (p) => p.locator('input[type="email"]').waitFor({ state: "visible", timeout: 15000 }),
});
if (kelola) {
  if (!(await kelola.locator('input[type="email"]').isVisible().catch(() => false))) {
    catat("TC-06", "Form email di /kelola", "Gagal", "kolom email tidak muncul");
  } else {
    catat("TC-06", "Form email di /kelola", "Lulus");
  }
  await kelola.close();
}

// TC-07 Link salah → 404 (negatif)
await (await bukaHalaman("TC-07", "Link undangan salah → 404", "/link-yang-tidak-ada-xyz/zzzz", { harapStatus: 404 }))?.close();

// TC-08 Cron penjaga Supabase
try {
  const r = await konteks.request.get(base + "/api/jaga");
  const isi = await r.text();
  if (r.status() === 200 && /"ok":true/.test(isi)) catat("TC-08", "Cron /api/jaga", "Lulus", isi.slice(0, 80));
  else if (r.status() === 401) catat("TC-08", "Cron /api/jaga", "Lulus", "401, terkunci CRON_SECRET (normal di Vercel)");
  else catat("TC-08", "Cron /api/jaga", "Gagal", `status ${r.status()} ${isi.slice(0, 80)}`);
} catch (e) {
  catat("TC-08", "Cron /api/jaga", "Gagal", String(e).split("\n")[0]);
}

await browser.close();

const gagal = hasil.filter((h) => h.status === "Gagal").length;
writeFileSync(path.join(out, "hasil.json"), JSON.stringify({ url: base, waktu: new Date().toISOString(), hasil }, null, 2));
console.log(`\nTes: ${hasil.length} · Lulus ${hasil.length - gagal} · Gagal ${gagal}`);
console.log(`Bukti: ${out}`);
process.exit(gagal ? 1 : 0);
