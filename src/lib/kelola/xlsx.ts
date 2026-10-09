// Baca & tulis file Excel (.xlsx) sederhana langsung di browser, tanpa library tambahan.
// - tulisXlsx: satu sheet, semua sel teks (nomor WA tetap utuh), baris judul tebal & dibekukan.
// - bacaXlsx : sheet pertama → tabel teks (dipakai untuk impor daftar tamu).
// File .xlsx = arsip ZIP berisi beberapa file XML.

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------
const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP tanpa kompresi (metode "store") — cukup untuk file Excel kecil. */
function buatZip(berkas: { nama: string; isi: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const lokal: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let offset = 0;
  for (const b of berkas) {
    const nama = enc.encode(b.nama);
    const crc = crc32(b.isi);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(8, 0, true); // store
    h.setUint16(12, 0x21, true); // tanggal 1 Jan 1980
    h.setUint32(14, crc, true);
    h.setUint32(18, b.isi.length, true);
    h.setUint32(22, b.isi.length, true);
    h.setUint16(26, nama.length, true);
    lokal.push(new Uint8Array(h.buffer), nama, b.isi);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, b.isi.length, true);
    c.setUint32(24, b.isi.length, true);
    c.setUint16(28, nama.length, true);
    c.setUint32(42, offset, true);
    pusat.push(new Uint8Array(c.buffer), nama);
    offset += 30 + nama.length + b.isi.length;
  }
  const ukuranPusat = pusat.reduce((n, x) => n + x.length, 0);
  const akhir = new DataView(new ArrayBuffer(22));
  akhir.setUint32(0, 0x06054b50, true);
  akhir.setUint16(8, berkas.length, true);
  akhir.setUint16(10, berkas.length, true);
  akhir.setUint32(12, ukuranPusat, true);
  akhir.setUint32(16, offset, true);
  const semua = [...lokal, ...pusat, new Uint8Array(akhir.buffer)];
  const hasil = new Uint8Array(semua.reduce((n, x) => n + x.length, 0));
  let p = 0;
  for (const x of semua) {
    hasil.set(x, p);
    p += x.length;
  }
  return hasil;
}

async function bacaZip(data: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(data);
  let eocd = -1;
  for (let i = data.byteLength - 22; i >= Math.max(0, data.byteLength - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Berkas bukan file Excel (.xlsx) yang valid.");
  const jumlah = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const isi = new Map<string, () => Promise<string>>();
  for (let i = 0; i < jumlah; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metode = v.getUint16(p + 10, true);
    const ukuran = v.getUint32(p + 20, true);
    const panjangNama = v.getUint16(p + 28, true);
    const panjangEkstra = v.getUint16(p + 30, true);
    const panjangKomentar = v.getUint16(p + 32, true);
    const offsetLokal = v.getUint32(p + 42, true);
    const nama = dec.decode(new Uint8Array(data, p + 46, panjangNama));
    p += 46 + panjangNama + panjangEkstra + panjangKomentar;
    isi.set(nama, async () => {
      const mulai = offsetLokal + 30 + v.getUint16(offsetLokal + 26, true) + v.getUint16(offsetLokal + 28, true);
      const mentah = new Uint8Array(data, mulai, ukuran);
      if (metode === 0) return dec.decode(mentah);
      if (metode !== 8) throw new Error("Format kompresi Excel tidak didukung.");
      if (typeof DecompressionStream === "undefined") throw new Error("Browser ini belum bisa membaca .xlsx. Salin-tempel dari Excel saja.");
      const aliran = new Blob([mentah]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(aliran).text();
    });
  }
  return isi;
}

// ---------------------------------------------------------------------------
// Tulis
// ---------------------------------------------------------------------------
const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function namaKolom(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * @param baris baris pertama = judul kolom
 * @param kolomAngka indeks kolom yang disimpan sebagai angka (mis. "Maks orang")
 * @param lebar lebar kolom (karakter)
 */
export function tulisXlsx(baris: string[][], { namaSheet = "Sheet1", kolomAngka = [] as number[], lebar = [] as number[] } = {}): Blob {
  const angka = new Set(kolomAngka);
  const sel = baris
    .map((r, i) => {
      const isi = r
        .map((nilai, j) => {
          const ref = `${namaKolom(j)}${i + 1}`;
          const gaya = i === 0 ? ' s="1"' : "";
          if (i > 0 && angka.has(j) && /^-?\d{1,9}$/.test(nilai)) return `<c r="${ref}"${gaya}><v>${nilai}</v></c>`;
          if (nilai === "") return "";
          return `<c r="${ref}" t="inlineStr"${gaya}><is><t xml:space="preserve">${esc(nilai)}</t></is></c>`;
        })
        .join("");
      return `<row r="${i + 1}">${isi}</row>`;
    })
    .join("");
  const kolom = lebar.length ? `<cols>${lebar.map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const NS = "http://schemas.openxmlformats.org";
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const enc = new TextEncoder();
  const f = (nama: string, isi: string) => ({ nama, isi: enc.encode(xml + isi) });
  const zip = buatZip([
    f(
      "[Content_Types].xml",
      `<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    f("_rels/.rels", `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f(
      "xl/workbook.xml",
      `<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${esc(namaSheet.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    f(
      "xl/_rels/workbook.xml.rels",
      `<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    f(
      "xl/styles.xml",
      `<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
    f(
      "xl/worksheets/sheet1.xml",
      `<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${kolom}<sheetData>${sel}</sheetData></worksheet>`,
    ),
  ]);
  return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------------
function indeksKolom(ref: string): number {
  const huruf = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const c of huruf) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const semua = (el: Document | Element, nama: string) => Array.from(el.getElementsByTagNameNS("*", nama));
const teksDari = (el: Element) => semua(el, "t").map((t) => t.textContent ?? "").join("");

function rapikanAngka(v: string): string {
  if (/^-?\d+(\.\d+)?e[+-]?\d+$/i.test(v)) return Number(v).toFixed(0); // 6.28123E+12 → 6281230000000
  if (/^-?\d+\.0+$/.test(v)) return v.replace(/\.0+$/, "");
  return v;
}

/** Sheet pertama dari file .xlsx → tabel teks. */
export async function bacaXlsx(berkas: Blob): Promise<string[][]> {
  const zip = await bacaZip(await berkas.arrayBuffer());
  const xml = async (nama: string) => {
    const ambil = zip.get(nama);
    return ambil ? new DOMParser().parseFromString(await ambil(), "application/xml") : null;
  };

  // cari sheet pertama lewat workbook.xml → relasi
  let jalurSheet = "xl/worksheets/sheet1.xml";
  const wb = await xml("xl/workbook.xml");
  const rels = await xml("xl/_rels/workbook.xml.rels");
  const sheetPertama = wb ? semua(wb, "sheet")[0] : undefined;
  const rid = sheetPertama?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? sheetPertama?.getAttribute("r:id");
  const target = rid && rels ? semua(rels, "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target") : null;
  if (target) jalurSheet = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;

  const ss = await xml("xl/sharedStrings.xml");
  const teksBersama = ss ? semua(ss, "si").map(teksDari) : [];
  const sheet = await xml(jalurSheet);
  if (!sheet) throw new Error("Sheet pertama tidak ditemukan di file Excel.");

  const hasil: string[][] = [];
  for (const row of semua(sheet, "row")) {
    const baris: string[] = [];
    let j = 0;
    for (const c of semua(row, "c")) {
      const ref = c.getAttribute("r");
      if (ref) j = indeksKolom(ref);
      const tipe = c.getAttribute("t");
      const v = semua(c, "v")[0]?.textContent ?? "";
      let nilai = "";
      if (tipe === "s") nilai = teksBersama[Number(v)] ?? "";
      else if (tipe === "inlineStr") nilai = semua(c, "is")[0] ? teksDari(semua(c, "is")[0]) : "";
      else if (tipe === "b") nilai = v === "1" ? "TRUE" : "FALSE";
      else if (tipe === "str" || tipe === "e") nilai = v;
      else nilai = rapikanAngka(v);
      while (baris.length < j) baris.push("");
      baris[j] = nilai.trim();
      j++;
    }
    const r = Number(row.getAttribute("r"));
    if (r > 0) while (hasil.length < r - 1) hasil.push([]); // baris kosong di tengah tetap diperhitungkan
    hasil.push(baris);
  }
  return hasil.filter((b) => b.some((x) => x !== ""));
}
