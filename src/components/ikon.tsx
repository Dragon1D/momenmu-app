import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { ukuran?: number };

function Dasar({ ukuran = 18, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
      {children}
    </svg>
  );
}

export const IkonKalender = (p: P) => (<Dasar {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Dasar>);
export const IkonPeta = (p: P) => (<Dasar {...p}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></Dasar>);
export const IkonGembok = (p: P) => (<Dasar {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Dasar>);
export const IkonBawah = (p: P) => (<Dasar {...p}><path d="M6 9l6 6 6-6" /></Dasar>);
export const IkonRumah = (p: P) => (<Dasar {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Dasar>);
export const IkonHati = (p: P) => (<Dasar {...p}><path d="M12 20s-7-4.2-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.8 12 20 12 20z" /></Dasar>);
export const IkonFoto = (p: P) => (<Dasar {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></Dasar>);
export const IkonLampion = (p: P) => (<Dasar {...p}><path d="M12 3c3 0 5 2 5 5l-1 9c0 2-2 3-4 3s-4-1-4-3L7 8c0-3 2-5 5-5z" /></Dasar>);
export const IkonTutup = (p: P) => (<Dasar {...p}><path d="M6 6l12 12M18 6L6 18" /></Dasar>);
export const IkonKiri = (p: P) => (<Dasar {...p}><path d="M15 6l-6 6 6 6" /></Dasar>);
export const IkonKanan = (p: P) => (<Dasar {...p}><path d="M9 6l6 6-6 6" /></Dasar>);
export const IkonSalin = (p: P) => (<Dasar {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></Dasar>);
export const IkonInstagram = (p: P) => (<Dasar {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></Dasar>);
export const IkonKado = (p: P) => (<Dasar {...p}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zM12 8c2-4 6-4 6-1s-6 1-6 1z" /></Dasar>);
