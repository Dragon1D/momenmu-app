"use client";
// Dashboard pengantin & admin: momenmu.id/kelola
// Semua data dibaca & diubah langsung dari browser ke Supabase dengan akun yang masuk
// (Row Level Security: klien hanya melihat acaranya sendiri, admin agensi melihat semua + tab Klien).
import "./kelola.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { kelolaApi } from "@/lib/kelola/api";
import type { Acara, Pengguna, TamuBaris, UcapanBaris } from "@/lib/kelola/tipe";
import { kodeUnik, linkTamu } from "@/lib/kelola/util";
import { asalSitus, Isian, PRATINJAU, pesanGalat, salinTeks, type BeriTahu } from "./bersama";
import Ringkasan from "./Ringkasan";
import TabTamu, { type FilterTamu } from "./TabTamu";
import TabKonten from "./TabKonten";
import TabUcapan from "./TabUcapan";
import TabPengaturan from "./TabPengaturan";
import TabKlien from "./TabKlien";

export type Tab = "klien" | "ringkasan" | "tamu" | "konten" | "ucapan" | "pengaturan";

export default function Kelola() {
  // undefined = sedang memeriksa sesi (juga saat render di server)
  const [pengguna, setPengguna] = useState<Pengguna | null | undefined>(undefined);
  useEffect(() => {
    let batal = false;
    kelolaApi()
      .sesi()
      .then(
        (p) => !batal && setPengguna(p),
        () => !batal && setPengguna(null),
      );
    return () => {
      batal = true;
    };
  }, []);

  if (pengguna === undefined) {
    return (
      <main className="kl kl-tengah">
        <p className="kl-redup">Memuat…</p>
      </main>
    );
  }
  if (!pengguna) return <Masuk onMasuk={setPengguna} />;
  return <Dasbor pengguna={pengguna} onKeluar={() => setPengguna(null)} />;
}

// ---------------------------------------------------------------------------
// Halaman masuk
// ---------------------------------------------------------------------------
function Masuk({ onMasuk }: { onMasuk: (p: Pengguna) => void }) {
  const api = kelolaApi();
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [lihat, setLihat] = useState(false);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setGalat("");
    setSibuk(true);
    try {
      onMasuk(await api.masuk(email, sandi));
    } catch (er) {
      setGalat(pesanGalat(er));
      setSibuk(false);
    }
  }

  return (
    <main className="kl kl-masuk">
      <form className="kl-kartu kl-masuk-kartu" onSubmit={kirim}>
        <img src="/brand/logo.png" alt="momenmu.id — Untuk Setiap Momen Berharga" className="kl-masuk-logo" />
        <h1>Kelola Undangan</h1>
        <p className="kl-redup">Masuk untuk mengatur isi undangan, daftar tamu, dan ucapan.</p>
        {api.demo && <p className="kl-catatan">Mode demo (Supabase belum diisi): masukkan email & sandi apa saja. Perubahan hanya tersimpan di tab ini.</p>}
        <Isian label="Email">
          <input type="email" autoComplete="username" inputMode="email" required={!api.demo} value={email} onChange={(e) => setEmail(e.target.value)} data-fokus />
        </Isian>
        <div className="kl-isian">
          <label className="kl-label" htmlFor="kl-sandi">
            Kata sandi
          </label>
          <div className="kl-gabung">
            <input id="kl-sandi" type={lihat ? "text" : "password"} autoComplete="current-password" required={!api.demo} value={sandi} onChange={(e) => setSandi(e.target.value)} />
            <button type="button" className="kl-btn kl-btn-teks" onClick={() => setLihat(!lihat)} aria-pressed={lihat}>
              {lihat ? "Sembunyikan" : "Lihat"}
            </button>
          </div>
        </div>
        {galat && (
          <p className="kl-galat" role="alert">
            {galat}
          </p>
        )}
        <button type="submit" className="kl-btn kl-btn-utama kl-btn-penuh" disabled={sibuk}>
          {sibuk ? "Memeriksa…" : "Masuk"}
        </button>
        <p className="kl-kecil kl-redup">Lupa sandi? Atur ulang di Supabase → Authentication → Users.</p>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const TAB: { id: Tab; label: string }[] = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "tamu", label: "Tamu" },
  { id: "konten", label: "Isi undangan" },
  { id: "ucapan", label: "Ucapan" },
  { id: "pengaturan", label: "Pengaturan" },
];

const TAB_KLIEN: { id: Tab; label: string } = { id: "klien", label: "Klien" };

const namaAcara = (a: Acara) => `${a.konten.mempelai.pria.panggilan} & ${a.konten.mempelai.wanita.panggilan}`;

function Dasbor({ pengguna, onKeluar }: { pengguna: Pengguna; onKeluar: () => void }) {
  const api = kelolaApi();
  const [daftar, setDaftar] = useState<Acara[] | null>(null);
  const [acaraId, setAcaraId] = useState<string | null>(null);
  const [tamu, setTamu] = useState<TamuBaris[] | null>(null);
  const [ucapan, setUcapan] = useState<UcapanBaris[] | null>(null);
  const [galatMuat, setGalatMuat] = useState("");
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [pernahDibuka, setPernahDibuka] = useState<Tab[]>(["ringkasan"]);
  const [filterTamu, setFilterTamu] = useState<FilterTamu>("");
  const [toast, setToast] = useState<{ n: number; teks: string; jenis: "ok" | "galat" } | null>(null);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const [staf, setStaf] = useState(false);
  const [versi, setVersi] = useState(0);

  const beriTahu: BeriTahu = useCallback((teks, jenis = "ok") => setToast((t) => ({ n: (t?.n ?? 0) + 1, teks, jenis })), []);
  useEffect(() => {
    if (!toast) return;
    const w = setTimeout(() => setToast(null), toast.jenis === "galat" ? 6000 : 2800);
    return () => clearTimeout(w);
  }, [toast]);

  useEffect(() => {
    let batal = false;
    Promise.all([api.daftarAcara(), api.peran()]).then(
      ([d, p]) => {
        if (batal) return;
        setDaftar(d);
        setAcaraId((x) => x ?? d[0]?.id ?? null);
        if (p === "staf") {
          setStaf(true);
          setTab("klien");
          setPernahDibuka((x) => (x.includes("klien") ? x : [...x, "klien"]));
        }
      },
      (e) => !batal && setGalatMuat(pesanGalat(e)),
    );
    return () => {
      batal = true;
    };
  }, [api]);

  useEffect(() => {
    if (!acaraId) return;
    let batal = false;
    Promise.all([api.daftarTamu(acaraId), api.daftarUcapan(acaraId)]).then(
      ([t, u]) => {
        if (batal) return;
        setTamu(t);
        setUcapan(u);
      },
      (e) => !batal && setGalatMuat(pesanGalat(e)),
    );
    return () => {
      batal = true;
    };
  }, [api, acaraId]);

  const acara = daftar?.find((a) => a.id === acaraId) ?? null;
  const asal = asalSitus();
  const perbaruiAcara = useCallback((a: Acara) => setDaftar((d) => (d ? d.map((x) => (x.id === a.id ? a : x)) : [a])), []);
  const ubahTamu = useCallback((f: (t: TamuBaris[]) => TamuBaris[]) => setTamu((t) => (t ? f(t) : t)), []);
  const ubahUcapan = useCallback((f: (u: UcapanBaris[]) => UcapanBaris[]) => setUcapan((u) => (u ? f(u) : u)), []);
  const jumlahTamu = useMemo(() => tamu?.filter((t) => t.kategori !== PRATINJAU).length ?? 0, [tamu]);

  function pindahTab(t: Tab) {
    setTab(t);
    setPernahDibuka((p) => (p.includes(t) ? p : [...p, t]));
    window.scrollTo({ top: 0 });
  }
  const keTamu = useCallback((f: FilterTamu) => {
    setFilterTamu(f);
    setTab("tamu");
    setPernahDibuka((p) => (p.includes("tamu") ? p : [...p, "tamu"]));
    window.scrollTo({ top: 0 });
  }, []);

  function pilihAcara(id: string) {
    setAcaraId(id);
    setTamu(null);
    setUcapan(null);
  }

  async function muatUlang() {
    setMemuatUlang(true);
    try {
      const [d, t, u] = await Promise.all([api.daftarAcara(), acaraId ? api.daftarTamu(acaraId) : null, acaraId ? api.daftarUcapan(acaraId) : null]);
      setDaftar(d);
      if (t) setTamu(t);
      if (u) setUcapan(u);
      setVersi((v) => v + 1);
      beriTahu("Data terbaru sudah dimuat");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setMemuatUlang(false);
    }
  }

  // --- dari tab Klien (admin) ---
  const acaraBaru = useCallback((a: Acara) => {
    setDaftar((d) => [...(d ?? []), a].sort((x, y) => Date.parse(x.waktu_acara) - Date.parse(y.waktu_acara)));
    setAcaraId((x) => x ?? a.id);
  }, []);
  function acaraDihapus(id: string) {
    const sisa = (daftar ?? []).filter((a) => a.id !== id);
    setDaftar(sisa);
    if (acaraId === id) {
      setAcaraId(sisa[0]?.id ?? null);
      setTamu(null);
      setUcapan(null);
    }
  }
  function kelolaAcara(id: string) {
    if (id !== acaraId) pilihAcara(id);
    pindahTab("ringkasan");
  }

  async function keluar() {
    await api.keluar();
    onKeluar();
  }

  /** Buka undangan sebagai tamu "Pratinjau" (tidak memakai jatah perangkat tamu sungguhan). */
  async function lihatUndangan() {
    if (!acara || !tamu) return;
    if (api.demo) {
      window.open(linkTamu(asal, acara.slug, tamu[0]?.kode ?? ""), "_blank", "noopener");
      return;
    }
    const ada = tamu.find((t) => t.kategori === PRATINJAU);
    if (ada) {
      window.open(linkTamu(asal, acara.slug, ada.kode), "_blank", "noopener");
      return;
    }
    const w = window.open("about:blank", "_blank"); // dibuka langsung saat diketuk supaya tidak diblokir browser
    try {
      const [t] = await api.tambahTamu(acara.id, [{ nama: "Tamu Pratinjau", kategori: PRATINJAU, telepon: null, maks_orang: 2, kode: kodeUnik(new Set(tamu.map((x) => x.kode))) }]);
      ubahTamu((d) => [...d, t]);
      const url = linkTamu(asal, acara.slug, t.kode);
      if (w) {
        w.opener = null;
        w.location.replace(url);
      } else window.location.assign(url);
    } catch (e) {
      w?.close();
      beriTahu(pesanGalat(e), "galat");
    }
  }

  if (!daftar) {
    return (
      <main className="kl kl-tengah">
        {galatMuat ? (
          <div className="kl-kartu kl-sempit">
            <h1 className="kl-judul">Gagal memuat data</h1>
            <p>{galatMuat}</p>
            <button type="button" className="kl-btn kl-btn-utama" onClick={() => window.location.reload()}>
              Coba lagi
            </button>
          </div>
        ) : (
          <p className="kl-redup">Memuat acara…</p>
        )}
      </main>
    );
  }

  if (!acara && !staf) return <BelumTerhubung pengguna={pengguna} onKeluar={keluar} />;
  const daftarTab = staf ? [TAB_KLIEN, ...(acara ? TAB : [])] : TAB;

  return (
    <div className="kl">
      <header className="kl-kepala">
        <div className="kl-kepala-baris">
          <img src="/brand/monogram.png" alt="" className="kl-monogram" />
          <div className="kl-kepala-judul">
            <span className="kl-kecil kl-redup">{staf ? "Admin Momenmu" : "Kelola undangan"}</span>
            {!acara ? (
              <strong>Belum ada acara</strong>
            ) : daftar.length > 1 ? (
              <select value={acara.id} onChange={(e) => pilihAcara(e.target.value)} aria-label="Pilih acara">
                {daftar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {staf ? `${namaAcara(a)} · ${a.slug}` : namaAcara(a)}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{namaAcara(acara)}</strong>
            )}
          </div>
          {acara && (
            <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={lihatUndangan} disabled={!tamu}>
              Lihat undangan
            </button>
          )}
          <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil kl-muat" onClick={muatUlang} disabled={memuatUlang} aria-label="Muat ulang data terbaru" title="Muat ulang data terbaru">
            <span aria-hidden="true" className={memuatUlang ? "kl-putar" : ""}>↻</span>
            <span className="kl-sembunyi-hp">{memuatUlang ? "Memuat…" : "Muat ulang"}</span>
          </button>
        </div>
        <nav className="kl-tab" role="tablist" aria-label="Menu dashboard">
          {daftarTab.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={tab === t.id} className={tab === t.id ? "kl-tab-aktif" : ""} onClick={() => pindahTab(t.id)}>
              {t.label}
              {t.id === "tamu" && tamu && <span className="kl-hitung">{jumlahTamu}</span>}
              {t.id === "ucapan" && ucapan && <span className="kl-hitung">{ucapan.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      {api.demo && <div className="kl-pita-demo">Mode demo — data contoh, perubahan tidak disimpan ke database.</div>}

      <main className="kl-isi">
        {staf && pernahDibuka.includes("klien") && (
          <section role="tabpanel" id="panel-klien" aria-labelledby="tab-klien" hidden={tab !== "klien"}>
            <TabKlien api={api} daftar={daftar} acaraId={acaraId} versi={versi} asal={asal} beriTahu={beriTahu} onDibuat={acaraBaru} onDihapus={acaraDihapus} onKelola={kelolaAcara} />
          </section>
        )}
        {!acara ? null : !tamu || !ucapan ? (
          tab === "klien" ? null : galatMuat ? (
            <div className="kl-kartu">
              <p className="kl-galat">{galatMuat}</p>
              <button type="button" className="kl-btn kl-btn-utama" onClick={muatUlang}>
                Coba lagi
              </button>
            </div>
          ) : (
            <p className="kl-redup">Memuat daftar tamu…</p>
          )
        ) : (
          TAB.filter((t) => pernahDibuka.includes(t.id)).map((t) => (
            <section key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
              {t.id === "ringkasan" && <Ringkasan api={api} acara={acara} tamu={tamu} ucapan={ucapan} ubahTamu={ubahTamu} ubahUcapan={ubahUcapan} beriTahu={beriTahu} keTamu={keTamu} keTab={pindahTab} lihatUndangan={lihatUndangan} />}
              {t.id === "tamu" && <TabTamu api={api} acara={acara} tamu={tamu} ubahTamu={ubahTamu} perbaruiAcara={perbaruiAcara} beriTahu={beriTahu} filter={filterTamu} setFilter={setFilterTamu} asal={asal} />}
              {t.id === "konten" && <TabKonten key={acara.id} api={api} acara={acara} acaraLain={daftar.filter((x) => x.id !== acara.id)} perbaruiAcara={perbaruiAcara} beriTahu={beriTahu} />}
              {t.id === "ucapan" && <TabUcapan api={api} acara={acara} ucapan={ucapan} ubahUcapan={ubahUcapan} beriTahu={beriTahu} />}
              {t.id === "pengaturan" && <TabPengaturan key={acara.id} api={api} acara={acara} perbaruiAcara={perbaruiAcara} beriTahu={beriTahu} pengguna={pengguna} onKeluar={keluar} asal={asal} />}
            </section>
          ))
        )}
      </main>

      {toast && (
        <div key={toast.n} className={`kl-toast ${toast.jenis === "galat" ? "kl-toast-galat" : ""}`} role={toast.jenis === "galat" ? "alert" : "status"}>
          {toast.teks}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Akun belum dihubungkan ke acara mana pun
// ---------------------------------------------------------------------------
function BelumTerhubung({ pengguna, onKeluar }: { pengguna: Pengguna; onKeluar: () => void }) {
  const [tersalin, setTersalin] = useState(false);
  const sql = `insert into public.staf (user_id, catatan) values ('${pengguna.id}', 'admin Momenmu') on conflict (user_id) do nothing;`;
  return (
    <main className="kl kl-tengah">
      <div className="kl-kartu kl-sempit">
        <h1 className="kl-judul">Akun belum terhubung ke undangan</h1>
        <p>
          Anda masuk sebagai <b>{pengguna.email}</b>, tetapi akun ini belum memegang acara apa pun. Minta admin Momenmu menyambungkan email ini ke acara Anda, lalu muat ulang halaman.
        </p>
        <details className="kl-rincian">
          <summary>Untuk admin Momenmu</summary>
          <ol className="kl-langkah">
            <li>
              Menyambungkan klien: masuk dengan akun admin → tab <b>Klien</b> → <b>Sambungkan akun</b> → tulis email ini.
            </li>
            <li>
              Menjadikan akun <i>ini</i> sebagai admin (sekali saja, setelah file SQL 0003 dijalankan): Supabase → SQL Editor → jalankan perintah di bawah → muat ulang.
            </li>
          </ol>
          <pre className="kl-kode-blok">{sql}</pre>
          <button
            type="button"
            className="kl-btn kl-btn-garis kl-btn-kecil"
            onClick={async () => {
              setTersalin(await salinTeks(sql));
            }}
          >
            {tersalin ? "Tersalin ✓" : "Salin perintah"}
          </button>
        </details>
        <div className="kl-baris-tombol">
          <button type="button" className="kl-btn kl-btn-utama" onClick={() => window.location.reload()}>
            Muat ulang
          </button>
          <button type="button" className="kl-btn kl-btn-teks" onClick={onKeluar}>
            Keluar
          </button>
        </div>
      </div>
    </main>
  );
}
