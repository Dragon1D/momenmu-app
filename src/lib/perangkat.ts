// ID acak per perangkat/browser (bukan data pribadi). Dipakai untuk membatasi
// satu link undangan hanya bisa dibuka di beberapa perangkat.
const KUNCI = "momenmu-perangkat";
let cadangan: string | null = null;

function buatId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function idPerangkat(): string {
  try {
    const ada = localStorage.getItem(KUNCI);
    if (ada && /^[a-zA-Z0-9-]{8,64}$/.test(ada)) return ada;
    const baru = buatId();
    localStorage.setItem(KUNCI, baru);
    return baru;
  } catch {
    // mode privat / penyimpanan diblokir: tetap konsisten selama halaman terbuka
    cadangan ??= buatId();
    return cadangan;
  }
}
