import localFont from "next/font/local";

// Semua font di-host sendiri (tanpa request ke Google): lebih cepat, tidak berkedip,
// tetap tampil walau jaringan tamu memblokir Google Fonts. Lisensi: lihat ./fonts/LISENSI.md

// Serif tipis-elegan untuk nama mempelai & judul (mengikuti gaya video referensi)
export const fontSerif = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--f-serif",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Huruf kapital berjarak untuk label kecil ("THE WEDDING OF", tanggal)
export const fontCaps = localFont({
  src: [
    { path: "./fonts/cinzel-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cinzel-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--f-caps",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Teks isi: mudah dibaca di HP, termasuk oleh tamu yang sudah sepuh
export const fontSans = localFont({
  src: [
    { path: "./fonts/lato-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/lato-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--f-sans",
  display: "swap",
});

// Huruf Arab (basmalah & ayat)
export const fontArab = localFont({
  src: "./fonts/amiri-arabic-400-normal.woff2",
  weight: "400",
  variable: "--f-arab",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

export const kelasFont = [fontSerif.variable, fontCaps.variable, fontSans.variable, fontArab.variable].join(" ");
