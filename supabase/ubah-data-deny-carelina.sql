-- Ganti data contoh menjadi acara Deny & Carelina (13 Desember 2026, Jakarta Timur).
-- Cara: Supabase → SQL Editor → New query → tempel seluruh isi file ini → Run.
-- Link baru: /deny-carelina/<kode-tamu>
update public.events
set slug         = 'deny-carelina',
    waktu_acara  = '2026-12-13 19:00:00+07',
    batas_rsvp   = '2026-12-06 23:59:00+07',
    aktif_sampai = '2027-03-13 23:59:00+07',
    -- rekening & alamat kado dikosongkan dulu (nomor contoh dihapus supaya tamu tidak salah transfer)
    hadiah       = '{"rekening": [], "alamat": null}'::jsonb,
    konten       = konten || $j${
      "mempelai": {
        "pria":   {"panggilan": "Deny", "nama_lengkap": "Deny Setyawan, S.Kom.", "keterangan": "Putra dari", "orang_tua": "Bapak … & Ibu …", "instagram": null, "foto": "/tema/bersama/foto-1.webp"},
        "wanita": {"panggilan": "Carelina", "nama_lengkap": "Carelina", "keterangan": "Putri dari", "orang_tua": "Bapak … & Ibu …", "instagram": null, "foto": "/tema/bersama/foto-2.webp"}
      },
      "acara": [
        {"nama": "Akad Nikah", "mulai": "2026-12-13T19:00:00+07:00", "selesai": null, "tempat": "Jakarta Timur", "alamat": "Jakarta Timur, DKI Jakarta", "maps_url": "https://www.google.com/maps/search/?api=1&query=Jakarta+Timur"},
        {"nama": "Resepsi", "mulai": "2026-12-13T19:30:00+07:00", "selesai": "2026-12-13T22:00:00+07:00", "tempat": "Jakarta Timur", "alamat": "Jakarta Timur, DKI Jakarta", "maps_url": "https://www.google.com/maps/search/?api=1&query=Jakarta+Timur"}
      ],
      "lokasi_utama": {"nama": "Jakarta Timur", "alamat": "Jakarta Timur, DKI Jakarta", "maps_url": "https://www.google.com/maps/search/?api=1&query=Jakarta+Timur"},
      "catatan_acara": null,
      "kisah": [
        {"tahun": "2019", "judul": "Pertama Bertemu", "teks": "Cerita awal pertemuan kami (teks contoh, nanti diganti).", "foto": "/tema/bersama/foto-1.webp"},
        {"tahun": "2022", "judul": "Menjadi Kita", "teks": "Perjalanan kami saling mengenal dan mengenalkan keluarga (teks contoh).", "foto": "/tema/bersama/foto-3.webp"},
        {"tahun": "2025", "judul": "Lamaran", "teks": "Deny melamar Carelina dengan restu kedua keluarga (teks contoh).", "foto": "/tema/bersama/foto-4.webp"},
        {"tahun": "2026", "judul": "Selamanya", "teks": "Kami memulai babak baru, dan ingin Anda ikut menerbangkan doa bersama kami.", "foto": "/tema/bersama/foto-5.webp"}
      ],
      "turut_mengundang": []
    }$j$::jsonb
where slug in ('arya-nadia', 'arya-carelina', 'deny-carelina');

-- Cek hasil: harus muncul 1 baris dengan slug deny-carelina
select slug, waktu_acara, konten->'mempelai'->'pria'->>'panggilan' as pria, konten->'mempelai'->'wanita'->>'panggilan' as wanita
from public.events where slug = 'deny-carelina';
