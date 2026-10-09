"use client";
// Tab "Ucapan": baca semua ucapan & konfirmasi kehadiran, sembunyikan yang tidak pantas, unduh sebagai kenang-kenangan.
import { useMemo, useState } from "react";
import type { Acara, KelolaApi, UcapanBaris } from "@/lib/kelola/tipe";
import { keCsv, unduh, waktuWib } from "@/lib/kelola/util";
import { tulisXlsx } from "@/lib/kelola/xlsx";
import { pesanGalat, type BeriTahu } from "./bersama";

type Saring = "" | "hadir" | "tidak" | "disembunyikan";

export default function TabUcapan({ api, acara, ucapan, ubahUcapan, beriTahu }: { api: KelolaApi; acara: Acara; ucapan: UcapanBaris[]; ubahUcapan: (f: (u: UcapanBaris[]) => UcapanBaris[]) => void; beriTahu: BeriTahu }) {
  const [saring, setSaring] = useState<Saring>("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState<string | null>(null);

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return ucapan.filter((u) => {
      if (saring === "disembunyikan" ? !u.disembunyikan : saring && u.kehadiran !== saring) return false;
      return !q || u.nama.toLowerCase().includes(q) || u.pesan.toLowerCase().includes(q);
    });
  }, [ucapan, saring, cari]);

  async function sembunyikan(u: UcapanBaris) {
    setSibuk(u.id);
    try {
      await api.ubahUcapan(u.id, !u.disembunyikan);
      ubahUcapan((d) => d.map((x) => (x.id === u.id ? { ...x, disembunyikan: !u.disembunyikan } : x)));
      beriTahu(u.disembunyikan ? "Ucapan ditampilkan lagi" : "Ucapan disembunyikan dari undangan");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setSibuk(null);
    }
  }

  async function hapus(u: UcapanBaris) {
    if (!window.confirm(`Hapus ucapan dari ${u.nama}? Tidak bisa dibatalkan. (Status kehadiran tamu tetap tercatat.)`)) return;
    setSibuk(u.id);
    try {
      await api.hapusUcapan(u.id);
      ubahUcapan((d) => d.filter((x) => x.id !== u.id));
      beriTahu("Ucapan dihapus");
    } catch (e) {
      beriTahu(pesanGalat(e), "galat");
    } finally {
      setSibuk(null);
    }
  }

  function ekspor(jenis: "xlsx" | "csv") {
    const rows = [["Nama", "Kehadiran", "Jumlah", "Ucapan", "Waktu", "Ditampilkan"], ...ucapan.map((u) => [u.nama, u.kehadiran === "hadir" ? "Hadir" : "Berhalangan", String(u.jumlah), u.pesan, waktuWib(u.created_at), u.disembunyikan ? "Tidak" : "Ya"])];
    const nama = `ucapan-${acara.slug}.${jenis}`;
    if (jenis === "xlsx") unduh(nama, tulisXlsx(rows, { namaSheet: "Ucapan", kolomAngka: [2], lebar: [30, 14, 9, 70, 22, 12] }));
    else unduh(nama, keCsv(rows));
  }

  const jumlahTersembunyi = ucapan.filter((u) => u.disembunyikan).length;

  return (
    <div className="kl-tumpuk">
      <div className="kl-kartu kl-alat">
        <div className="kl-saring">
          <input type="search" placeholder="Cari nama atau isi ucapan…" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari ucapan" />
          <select value={saring} onChange={(e) => setSaring(e.target.value as Saring)} aria-label="Saring ucapan">
            <option value="">Semua ({ucapan.length})</option>
            <option value="hadir">Akan hadir ({ucapan.filter((u) => u.kehadiran === "hadir").length})</option>
            <option value="tidak">Berhalangan ({ucapan.filter((u) => u.kehadiran === "tidak").length})</option>
            <option value="disembunyikan">Disembunyikan ({jumlahTersembunyi})</option>
          </select>
          <button type="button" className="kl-btn kl-btn-garis" onClick={() => ekspor("xlsx")} disabled={!ucapan.length}>
            Unduh Excel
          </button>
        </div>
        <p className="kl-kecil kl-redup">Ucapan yang disembunyikan tidak tampil di undangan, tetapi tetap tersimpan di sini.</p>
      </div>

      {daftar.length === 0 ? (
        <div className="kl-kartu kl-kosong">
          <p className="kl-redup">{ucapan.length ? "Tidak ada ucapan yang cocok." : "Belum ada ucapan. Ucapan dari tamu akan muncul di sini."}</p>
        </div>
      ) : (
        <ul className="kl-ucapan">
          {daftar.map((u) => (
            <li key={u.id} className={`kl-kartu ${u.disembunyikan ? "kl-ucapan-sembunyi" : ""}`}>
              <div className="kl-ucapan-kepala">
                <strong>{u.nama}</strong>
                <span className={`kl-status ${u.kehadiran === "hadir" ? "kl-status-hadir" : "kl-status-tidak"}`}>{u.kehadiran === "hadir" ? `Hadir · ${u.jumlah} org` : "Berhalangan"}</span>
                {!u.guest_id && <span className="kl-lencana">link umum</span>}
                {u.disembunyikan && <span className="kl-lencana">disembunyikan</span>}
              </div>
              {u.pesan ? <p className="kl-ucapan-isi">{u.pesan}</p> : <p className="kl-redup kl-kecil">(tanpa ucapan)</p>}
              <div className="kl-ucapan-kaki">
                <time className="kl-kecil kl-redup" dateTime={u.created_at}>
                  {waktuWib(u.created_at)}
                </time>
                <div className="kl-baris-tombol">
                  <button type="button" className="kl-btn kl-btn-garis kl-btn-kecil" onClick={() => sembunyikan(u)} disabled={sibuk === u.id}>
                    {u.disembunyikan ? "Tampilkan" : "Sembunyikan"}
                  </button>
                  <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil kl-merah" onClick={() => hapus(u)} disabled={sibuk === u.id}>
                    Hapus
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {ucapan.length > 0 && (
        <button type="button" className="kl-btn kl-btn-teks kl-btn-kecil" onClick={() => ekspor("csv")}>
          Unduh CSV
        </button>
      )}
    </div>
  );
}
