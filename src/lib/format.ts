const ZONA = "Asia/Jakarta";

export function tanggalPanjang(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
}

export function tanggalSingkat(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA }).split("/").join(" · ");
}

export function bagianTanggal(iso: string) {
  const d = new Date(iso);
  return {
    hari: d.toLocaleDateString("id-ID", { weekday: "long", timeZone: ZONA }),
    angka: d.toLocaleDateString("id-ID", { day: "2-digit", timeZone: ZONA }),
    bulanTahun: d.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: ZONA }),
  };
}

export function jam(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA }).replace(":", ".");
}

export function rentangJam(mulai: string, selesai?: string | null): string {
  return selesai ? `Pukul ${jam(mulai)} – ${jam(selesai)} WIB` : `Pukul ${jam(mulai)} WIB – selesai`;
}

export function linkKalender(judul: string, mulai: string, selesai: string | null, lokasi: string): string {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const a = new Date(mulai);
  const b = selesai ? new Date(selesai) : new Date(a.getTime() + 3 * 3_600_000);
  const p = new URLSearchParams({ action: "TEMPLATE", text: judul, dates: `${f(a)}/${f(b)}`, location: lokasi, details: "Undangan via momenmu.id" });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function waktuRelatif(iso: string, sekarang: number): string {
  const detik = Math.max(0, Math.round((sekarang - Date.parse(iso)) / 1000));
  if (detik < 60) return "Baru saja";
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jamLalu = Math.floor(menit / 60);
  if (jamLalu < 24) return `${jamLalu} jam lalu`;
  const hari = Math.floor(jamLalu / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA });
}

export function namaDepan(nama: string): string {
  const kata = nama.split(/\s+/).filter((x) => !/^(bapak|ibu|pak|bu|h\.|hj\.|sdr\.?|keluarga|besar)$/i.test(x));
  return (kata[0] ?? nama).replace(/,$/, "");
}

// Angka acak deterministik supaya posisi lampion sama di server & browser.
export function acak(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export interface Lampion {
  x: string;
  w: number;
  dur: string;
  delay: string;
  op: number;
}

export function buatLampion(n: number, seed: number, minW: number, maxW: number): Lampion[] {
  const r = acak(seed);
  return Array.from({ length: n }, () => {
    const w = minW + r() * (maxW - minW);
    const dur = 14 + (1 - (w - minW) / (maxW - minW + 1)) * 12 + r() * 4;
    return { x: `${(r() * 92).toFixed(1)}%`, w: Math.round(w), dur: `${dur.toFixed(1)}s`, delay: `${(-r() * dur).toFixed(1)}s`, op: +(0.55 + r() * 0.45).toFixed(2) };
  });
}
