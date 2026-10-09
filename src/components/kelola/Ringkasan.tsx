"use client";
import { useEffect, useMemo, useState } from "react";
import contoh from "../../../supabase/contoh-acara.json";
import type { Acara, KelolaApi, TamuBaris, UcapanBaris } from "@/lib/kelola/tipe";
import { jam, tanggalPanjang, waktuRelatif } from "@/lib/format";
import { waktuWib } from "@/lib/kelola/util";
import { pesanGalat, PRATINJAU, type BeriTahu } from "./bersama";
import type { FilterTamu } from "./TabTamu";
import type { Tab } from "./Kelola";

interface Angka {
  tamu: number;
  orang: number;
  terkirim: number;
  dibuka: number;
  hadir: number;
  tidak: number;
}

function hitung(semua: TamuBaris[], batas: number) {
  const tamu = semua.filter((t) => t.kategori !== PRATINJAU);
  const kosong = (): Angka => ({ tamu: 0, orang: 0, terkirim: 0, dibuka: 0, hadir: 0, tidak: 0 });
  const total = kosong();
  const perKategori = new Map<string, Angka>();
  let kapasitas = 0;
  let tanpaWa = 0;
  let terkunci = 0;
  for (const t of tamu) {
    const k = perKategori.get(t.kategori) ?? kosong();
    perKategori.set(t.kategori, k);
    for (const a of [total, k]) {
      a.tamu++;
      if (t.dikirim_pada || t.status !== "baru") a.terkirim++;
      if (t.dibuka_pada) a.dibuka++;
      if (t.status === "hadir") {
        a.hadir++;
        a.orang += t.jumlah_hadir ?? 0;
      }
      if (t.status === "tidak") a.tidak++;
    }
    kapasitas += t.maks_orang;
    if (!t.telepon) tanpaWa++;
    if (batas > 0 && t.perangkat.length >= batas) terkunci++;
  }
  return { total, kapasitas, tanpaWa, terkunci, perKategori: [...perKategori.entries()].sort((a, b) => b[1].tamu - a[1].tamu) };
}

const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const KODE_CONTOH = new Set(contoh.tamu.map((t) => t.kode));
const fotoContoh = (src: string | null | undefined) => !!src && src.startsWith("/tema/");

interface ButirSiap {
  label: string;
  ok: boolean;
  opsional?: boolean;
  ke: Tab;
}

/** Daftar periksa sebelum undangan disebar (mendeteksi isi contoh yang belum diganti). */
function cekKesiapan(a: Acara, tamuAsli: number, adaContoh: boolean): ButirSiap[] {
  const k = a.konten;
  const m = [k.mempelai.pria, k.mempelai.wanita];
  // alamat dianggap lengkap bila memuat nama jalan atau nomor (bukan hanya nama kota)
  const alamatJelas = (s: string) => s.trim().length >= 12 && /\d|\bjl\b|jalan|\bgg\b|gang|kav|blok|komplek/i.test(s);
  return [
    { label: "Nama lengkap & orang tua kedua mempelai", ok: m.every((x) => x.nama_lengkap.trim() && x.orang_tua.trim() && !x.orang_tua.includes("…")), ke: "konten" },
    { label: "Foto mempelai sudah diganti (atau dikosongkan)", ok: m.every((x) => !fotoContoh(x.foto)), ke: "konten" },
    { label: "Alamat lengkap & link Google Maps tiap sesi", ok: alamatJelas(k.lokasi_utama.alamat) && k.acara.every((s) => alamatJelas(s.alamat) && !!s.maps_url), ke: "konten" },
    { label: "Kisah cinta: teks & foto contoh diganti (atau dihapus)", ok: (k.kisah ?? []).every((x) => !x.teks.includes("teks contoh") && !fotoContoh(x.foto)), ke: "konten" },
    { label: "Galeri: foto contoh diganti (atau dihapus)", ok: (k.galeri ?? []).every((g) => !fotoContoh(g.src)), ke: "konten" },
    { label: "Tamu & ucapan contoh sudah dihapus", ok: !adaContoh, ke: "ringkasan" },
    { label: "Daftar tamu sudah diisi", ok: tamuAsli > 0, ke: "tamu" },
    { label: "Amplop digital / rekening", ok: (a.hadiah?.rekening?.length ?? 0) > 0 || !!a.hadiah?.alamat, opsional: true, ke: "konten" },
    { label: "Musik latar", ok: !!k.musik_url, opsional: true, ke: "konten" },
  ];
}

export default function Ringkasan({
  api,
  acara,
  tamu,
  ucapan,
  ubahTamu,
  ubahUcapan,
  beriTahu,
  keTamu,
  keTab,
  lihatUndangan,
}: {
  api: KelolaApi;
  acara: Acara;
  tamu: TamuBaris[];
  ucapan: UcapanBaris[];
  ubahTamu: (f: (t: TamuBaris[]) => TamuBaris[]) => void;
  ubahUcapan: (f: (u: UcapanBaris[]) => UcapanBaris[]) => void;
  beriTahu: BeriTahu;
  keTamu: (f: FilterTamu) => void;
  keTab: (t: Tab) => void;
  lihatUndangan: () => void;
}) {
  const [sekarang, setSekarang] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    const awal = setTimeout(() => setSekarang(Date.now()), 0);
    const t = setInterval(() => setSekarang(Date.now()), 60_000);
    return () => {
      clearTimeout(awal);
      clearInterval(t);
    };
  }, []);

  const s = useMemo(() => hitung(tamu, acara.batas_perangkat), [tamu, acara.batas_perangkat]);
  const { total } = s;
  const belum = total.tamu - total.hadir - total.tidak;

  const aktivitas = useMemo(() => {
    const d: { waktu: string; teks: string }[] = [];
    for (const t of tamu) {
      if (t.kategori === PRATINJAU) continue;
      if (t.dijawab_pada) d.push({ waktu: t.dijawab_pada, teks: t.status === "hadir" ? `${t.nama} akan hadir (${t.jumlah_hadir ?? 1} orang)` : t.status === "tidak" ? `${t.nama} berhalangan hadir` : `${t.nama} menjawab undangan` });
      if (t.dibuka_pada && t.dibuka_pada !== t.dijawab_pada) d.push({ waktu: t.dibuka_pada, teks: `${t.nama} membuka undangan` });
    }
    for (const u of ucapan) if (!u.guest_id) d.push({ waktu: u.created_at, teks: `${u.nama} mengirim ucapan` });
    return d.sort((a, b) => b.waktu.localeCompare(a.waktu)).slice(0, 8);
  }, [tamu, ucapan]);

  // data contoh bawaan pemasangan awal (tidak berlaku di mode demo)
  const tamuContoh = useMemo(() => (api.demo ? [] : tamu.filter((t) => KODE_CONTOH.has(t.kode))), [api.demo, tamu]);
  const ucapanContoh = useMemo(() => {
    if (api.demo) return [];
    const id = new Set(tamuContoh.map((t) => t.id));
    return ucapan.filter((u) => (u.guest_id && id.has(u.guest_id)) || contoh.ucapan.some((c) => c.nama === u.nama && c.pesan === u.pesan));
  }, [api.demo, tamuContoh, ucapan]);
  const adaContoh = tamuContoh.length + ucapanContoh.length > 0;
  const siap = cekKesiapan(acara, total.tamu - tamuContoh.length, adaContoh);
  const wajib = siap.filter((x) => !x.opsional);
  const kurang = wajib.filter((x) => !x.ok).length;

  async function hapusContoh() {
    if (!window.confirm(`Hapus ${tamuContoh.length} tamu contoh dan ${ucapanContoh.length} ucapan contoh?\n\nLink contoh (mis. /${acara.slug}/${tamuContoh[0]?.kode ?? "dn7s"}) tidak bisa dibuka lagi — pakai tombol “Lihat undangan” untuk pratinjau.`)) return;
    setSibuk(true);
    try {
      const idU = new Set(ucapanContoh.map((u) => u.id));
      const idT = new Set(tamuContoh.map((t) => t.id));
      for (const u of ucapanContoh) await api.hapusUcapan(u.id);
      if (idT.size) await api.hapusTamu([...idT]);
      ubahUcapan((d) => d.filter((u) => !idU.has(u.id)));
      ubahTamu((d) => d.filter((t) => !idT.has(t.id)));
      beriTahu("Data contoh sudah dihapus");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setSibuk(false);
    }
  }

  const sisaHari = sekarang ? Math.ceil((Date.parse(acara.waktu_acara) - sekarang) / 86_400_000) : null;
  const ucapanTampil = ucapan.filter((u) => !u.disembunyikan && u.pesan.trim()).length;

  return (
    <div className="kl-tumpuk">
      <div className="kl-kartu kl-acara">
        <div>
          <div className="kl-kecil kl-redup">Acara utama</div>
          <div className="kl-acara-tanggal">{tanggalPanjang(acara.waktu_acara)}</div>
          <div className="kl-redup">
            Pukul {jam(acara.waktu_acara)} WIB · {acara.konten.lokasi_utama.nama}
          </div>
          {acara.batas_rsvp && <div className="kl-kecil kl-redup">Batas konfirmasi kehadiran: {waktuWib(acara.batas_rsvp)}</div>}
        </div>
        <div className="kl-acara-hitung">
          {sisaHari !== null && (sisaHari > 0 ? <><b>H-{sisaHari}</b><span>hari lagi</span></> : sisaHari === 0 ? <b>Hari ini</b> : <b>Selesai</b>)}
        </div>
        <div className="kl-baris-tombol">
          <button type="button" className="kl-btn kl-btn-utama kl-btn-kecil" onClick={lihatUndangan}>
            Lihat undangan
          </button>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => keTab("konten")}>
            Ubah isi undangan
          </button>
        </div>
      </div>

      {kurang > 0 && (
        <div className="kl-kartu kl-siap">
          <div className="kl-siap-kepala">
            <h2 className="kl-subjudul">Persiapan sebelum menyebar undangan</h2>
            <span className="kl-lencana">
              {wajib.length - kurang}/{wajib.length} siap
            </span>
          </div>
          <ul className="kl-siap-daftar">
            {siap.map((x) => (
              <li key={x.label} className={x.ok ? "kl-siap-ok" : x.opsional ? "kl-siap-opsional" : "kl-siap-belum"}>
                <span aria-hidden="true">{x.ok ? "✓" : x.opsional ? "○" : "!"}</span>
                <span>
                  {x.label}
                  {x.opsional && !x.ok && <em> (opsional)</em>}
                </span>
                {!x.ok && x.label.startsWith("Tamu & ucapan contoh") ? (
                  <button type="button" className="kl-btn kl-btn-bahaya kl-btn-kecil" onClick={hapusContoh} disabled={sibuk}>
                    {sibuk ? "Menghapus…" : `Hapus ${tamuContoh.length + ucapanContoh.length} data contoh`}
                  </button>
                ) : (
                  !x.ok && (
                    <button type="button" className="kl-tautan" onClick={() => keTab(x.ke)}>
                      Atur
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {total.tamu === 0 ? (
        <div className="kl-kartu kl-kosong">
          <h2>Belum ada tamu</h2>
          <p className="kl-redup">Tambahkan satu per satu, atau salin daftar dari Excel/Google Sheets sekaligus.</p>
          <button type="button" className="kl-btn kl-btn-utama" onClick={() => keTamu("")}>
            Kelola daftar tamu
          </button>
        </div>
      ) : (
        <>
          <div className="kl-statistik">
            <Kotak label="Total tamu" nilai={total.tamu} ket={`maks. ${s.kapasitas} orang`} onClick={() => keTamu("")} />
            <Kotak label="Sudah dikirim" nilai={total.terkirim} ket={`${persen(total.terkirim, total.tamu)}% dari tamu`} onClick={() => keTamu("belum-kirim")} ketKlik="lihat yang belum" />
            <Kotak label="Sudah dibuka" nilai={total.dibuka} ket={`${persen(total.dibuka, total.terkirim)}% dari yang dikirim`} onClick={() => keTamu("dibuka")} />
            <Kotak label="Akan hadir" nilai={total.hadir} ket={`${total.orang} orang`} nada="ok" onClick={() => keTamu("hadir")} />
            <Kotak label="Berhalangan" nilai={total.tidak} ket="tamu" nada="redup" onClick={() => keTamu("tidak")} />
            <Kotak label="Belum menjawab" nilai={belum} ket="tamu" onClick={() => keTamu("belum-jawab")} />
          </div>

          <div className="kl-kartu">
            <h2 className="kl-subjudul">Perjalanan undangan</h2>
            <Batang label="Dikirim" a={total.terkirim} b={total.tamu} />
            <Batang label="Dibuka" a={total.dibuka} b={total.tamu} />
            <Batang label="Menjawab" a={total.hadir + total.tidak} b={total.tamu} />
          </div>

          {(s.tanpaWa > 0 || s.terkunci > 0) && (
            <div className="kl-kartu kl-perhatian">
              <h2 className="kl-subjudul">Perlu perhatian</h2>
              {s.tanpaWa > 0 && (
                <p>
                  {s.tanpaWa} tamu belum punya nomor WhatsApp.{" "}
                  <button type="button" className="kl-tautan" onClick={() => keTamu("tanpa-wa")}>
                    Lihat
                  </button>
                </p>
              )}
              {s.terkunci > 0 && (
                <p>
                  {s.terkunci} link sudah dibuka di {acara.batas_perangkat} perangkat (terkunci untuk HP baru). Jika tamu ganti HP, reset perangkatnya.{" "}
                  <button type="button" className="kl-tautan" onClick={() => keTamu("terkunci")}>
                    Lihat
                  </button>
                </p>
              )}
            </div>
          )}

          <div className="kl-kartu">
            <h2 className="kl-subjudul">Per kategori</h2>
            <div className="kl-tabel-gulir">
              <table className="kl-tabel">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Tamu</th>
                    <th>Dikirim</th>
                    <th>Dibuka</th>
                    <th>Hadir</th>
                    <th>Orang</th>
                    <th>Berhalangan</th>
                  </tr>
                </thead>
                <tbody>
                  {s.perKategori.map(([k, a]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{a.tamu}</td>
                      <td>{a.terkirim}</td>
                      <td>{a.dibuka}</td>
                      <td>{a.hadir}</td>
                      <td>{a.orang}</td>
                      <td>{a.tidak}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="kl-dua-kolom">
        <div className="kl-kartu">
          <h2 className="kl-subjudul">Aktivitas terbaru</h2>
          {aktivitas.length === 0 ? (
            <p className="kl-redup">Belum ada tamu yang membuka undangan.</p>
          ) : (
            <ul className="kl-aktivitas">
              {aktivitas.map((a, i) => (
                <li key={i}>
                  <span>{a.teks}</span>
                  <time className="kl-redup" dateTime={a.waktu}>
                    {sekarang ? waktuRelatif(a.waktu, sekarang) : ""}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="kl-kartu">
          <h2 className="kl-subjudul">Ucapan & doa</h2>
          <p>
            <b>{ucapan.length}</b> ucapan masuk, <b>{ucapanTampil}</b> tampil di undangan.
          </p>
          <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => keTab("ucapan")}>
            Baca & kelola ucapan
          </button>
        </div>
      </div>
    </div>
  );
}

function Kotak({ label, nilai, ket, nada, onClick, ketKlik }: { label: string; nilai: number; ket: string; nada?: "ok" | "redup"; onClick: () => void; ketKlik?: string }) {
  return (
    <button type="button" className={`kl-kotak ${nada ? `kl-kotak-${nada}` : ""}`} onClick={onClick} title={ketKlik ? `Klik untuk ${ketKlik}` : "Klik untuk melihat daftar"}>
      <span className="kl-kotak-label">{label}</span>
      <span className="kl-kotak-nilai">{nilai}</span>
      <span className="kl-kotak-ket">{ket}</span>
    </button>
  );
}

function Batang({ label, a, b }: { label: string; a: number; b: number }) {
  const p = persen(a, b);
  return (
    <div className="kl-batang">
      <div className="kl-batang-label">
        <span>{label}</span>
        <span className="kl-redup">
          {a} / {b} · {p}%
        </span>
      </div>
      <div className="kl-batang-jalur" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
