"use client";
// Komponen & fungsi kecil yang dipakai bersama oleh semua tab dashboard /kelola.
import { useEffect, useRef, type ReactNode } from "react";

export type BeriTahu = (teks: string, jenis?: "ok" | "galat") => void;

/** Kategori khusus untuk link pratinjau milik pengantin (tidak dihitung di statistik). */
export const PRATINJAU = "Pratinjau";
export const KATEGORI_BAWAAN = ["Keluarga", "Teman", "Rekan kerja", "Lainnya"];

export const pesanGalat = (e: unknown) => (e instanceof Error && e.message ? e.message : "Terjadi kesalahan. Coba lagi.");

/** Alamat website untuk link tamu: isian NEXT_PUBLIC_SITE_URL (domain sendiri) atau alamat yang sedang dibuka. */
export function asalSitus(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** "6281234567890" → "0812-3456-7890" (lebih mudah dibaca). */
export function formatTelepon(t: string | null | undefined): string {
  if (!t) return "";
  const lokal = t.startsWith("62") ? "0" + t.slice(2) : t;
  return lokal.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

export async function salinTeks(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // cadangan untuk browser lama / halaman tanpa izin clipboard
    try {
      const ta = document.createElement("textarea");
      ta.value = teks;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function Isian({ label, bantuan, wajib, children, className }: { label: string; bantuan?: ReactNode; wajib?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`kl-isian ${className ?? ""}`}>
      <span className="kl-label">
        {label}
        {wajib && <b className="kl-wajib" aria-hidden="true"> *</b>}
      </span>
      {children}
      {bantuan && <small className="kl-bantuan">{bantuan}</small>}
    </label>
  );
}

/** Jendela dialog sederhana. Tutup dengan tombol ×, tombol Batal, atau Esc (tidak tertutup jika latar diketuk, supaya isian tidak hilang). */
export function Modal({ judul, onTutup, children, kaki, lebar = false }: { judul: string; onTutup: () => void; children: ReactNode; kaki?: ReactNode; lebar?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  const tutup = useRef(onTutup);
  useEffect(() => {
    tutup.current = onTutup;
  });
  useEffect(() => {
    const sebelumnya = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panel.current;
    const pertama = el?.querySelector<HTMLElement>("[data-fokus]");
    (pertama ?? el)?.focus();
    const tombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup.current();
    };
    document.addEventListener("keydown", tombol);
    const html = document.documentElement;
    const lama = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tombol);
      html.style.overflow = lama;
      sebelumnya?.focus();
    };
  }, []);
  return (
    <div className="kl-latar-modal">
      <div className={`kl-modal ${lebar ? "kl-modal-lebar" : ""}`} role="dialog" aria-modal="true" aria-label={judul} ref={panel} tabIndex={-1}>
        <div className="kl-modal-kepala">
          <h2>{judul}</h2>
          <button type="button" className="kl-ikon-btn" onClick={() => tutup.current()} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="kl-modal-isi">{children}</div>
        {kaki && <div className="kl-modal-kaki">{kaki}</div>}
      </div>
    </div>
  );
}
