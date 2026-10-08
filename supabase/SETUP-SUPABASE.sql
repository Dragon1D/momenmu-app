-- =====================================================================
-- SETUP SUPABASE MOMENMU.ID — CUKUP JALANKAN FILE INI SEKALI
-- Cara: Supabase → SQL Editor → New query → tempel SELURUH isi file ini → Run.
-- Isi: (1) tabel + keamanan + fungsi, (2) data contoh acara.
-- Aman dijalankan ulang (data contoh akan di-reset).
-- =====================================================================

-- =====================================================================
-- Momenmu.id — skema awal
-- Jalankan di Supabase: SQL Editor → tempel seluruh file ini → Run.
-- Prinsip keamanan:
--   * Semua tabel memakai Row Level Security (RLS).
--   * Tamu (anon) TIDAK pernah membaca tabel langsung; mereka hanya
--     memanggil fungsi RPC di bawah yang memvalidasi slug + kode tamu.
--   * Pemilik acara (login) bisa mengelola data acaranya sendiri.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  owner_id           uuid references auth.users (id) on delete set null,
  tema               text not null default 'kastil'
                     check (tema in ('peach', 'lampion', 'kastil')),
  waktu_acara        timestamptz not null,
  batas_rsvp         timestamptz,
  aktif_sampai       timestamptz,
  -- konten publik: mempelai, acara, kisah, galeri, penutup, musik
  konten             jsonb not null default '{}'::jsonb,
  -- rekening & alamat kado: hanya dikirim ke link tamu yang valid
  hadiah             jsonb not null default '{}'::jsonb,
  izinkan_tanpa_kode boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.guests (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  kode          text not null check (kode ~ '^[a-z0-9]{4,12}$'),
  nama          text not null check (char_length(nama) between 1 and 120),
  kategori      text not null default 'Teman'
                check (kategori in ('Keluarga', 'Teman', 'Rekan kerja', 'Lainnya')),
  telepon       text check (telepon is null or telepon ~ '^\+?[0-9]{8,16}$'),
  maks_orang    int not null default 2 check (maks_orang between 1 and 20),
  status        text not null default 'baru'
                check (status in ('baru', 'terkirim', 'dibuka', 'hadir', 'tidak')),
  jumlah_hadir  int check (jumlah_hadir between 0 and 20),
  dikirim_pada  timestamptz,
  dibuka_pada   timestamptz,
  dijawab_pada  timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, kode)
);

create table if not exists public.wishes (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete cascade,
  guest_id        uuid references public.guests (id) on delete set null,
  nama            text not null check (char_length(nama) between 1 and 80),
  kehadiran       text not null check (kehadiran in ('hadir', 'tidak')),
  jumlah          int not null default 1 check (jumlah between 0 and 20),
  pesan           text not null default '' check (char_length(pesan) <= 500),
  disembunyikan   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists guests_event_idx on public.guests (event_id);
create index if not exists wishes_event_idx on public.wishes (event_id, created_at desc);
-- satu RSVP per tamu berkode (dikirim ulang = diperbarui)
create unique index if not exists wishes_satu_per_tamu on public.wishes (guest_id) where guest_id is not null;

-- updated_at otomatis
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
drop trigger if exists wishes_updated_at on public.wishes;
create trigger wishes_updated_at before update on public.wishes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: hanya pemilik acara
-- ---------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.wishes enable row level security;

drop policy if exists "pemilik kelola acara" on public.events;
create policy "pemilik kelola acara" on public.events
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "pemilik kelola tamu" on public.guests;
create policy "pemilik kelola tamu" on public.guests
  for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

drop policy if exists "pemilik kelola ucapan" on public.wishes;
create policy "pemilik kelola ucapan" on public.wishes
  for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid()));

-- ---------------------------------------------------------------------
-- RPC publik (dipanggil website undangan dengan anon key)
-- ---------------------------------------------------------------------

-- Ambil data undangan. Hadiah & data tamu hanya ikut jika kode valid.
create or replace function public.ambil_undangan(p_slug text, p_kode text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  ev public.events;
  tm public.guests;
  uc public.wishes;
begin
  select * into ev from public.events where slug = lower(p_slug);
  if not found then
    return null;
  end if;

  if p_kode is not null then
    select * into tm from public.guests where event_id = ev.id and kode = lower(p_kode);
  end if;

  if tm.id is null and not ev.izinkan_tanpa_kode then
    return jsonb_build_object('slug', ev.slug, 'butuh_kode', true);
  end if;

  if tm.id is not null then
    select * into uc from public.wishes where guest_id = tm.id;
  end if;

  return jsonb_build_object(
    'slug', ev.slug,
    'tema', ev.tema,
    'waktu_acara', ev.waktu_acara,
    'batas_rsvp', ev.batas_rsvp,
    'aktif_sampai', ev.aktif_sampai,
    'konten', ev.konten,
    'hadiah', case when tm.id is not null then ev.hadiah else null end,
    'tamu', case when tm.id is null then null else jsonb_build_object(
      'kode', tm.kode,
      'nama', tm.nama,
      'kategori', tm.kategori,
      'maks_orang', tm.maks_orang,
      'status', tm.status,
      'jumlah_hadir', tm.jumlah_hadir,
      'ucapan', case when uc.id is null then null else jsonb_build_object(
        'kehadiran', uc.kehadiran, 'jumlah', uc.jumlah, 'pesan', uc.pesan)
      end
    ) end
  );
end $$;

-- Tandai link tamu sudah dibuka (dipanggil saat tamu menekan "Buka Undangan",
-- bukan saat halaman dimuat, supaya bot pratinjau WhatsApp tidak ikut terhitung).
create or replace function public.tandai_dibuka(p_slug text, p_kode text)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  update public.guests g
     set status = case when g.status in ('baru', 'terkirim') then 'dibuka' else g.status end,
         dibuka_pada = coalesce(g.dibuka_pada, now())
    from public.events e
   where e.id = g.event_id and e.slug = lower(p_slug) and g.kode = lower(p_kode);
end $$;

-- Kirim / perbarui RSVP + ucapan.
create or replace function public.kirim_rsvp(
  p_slug text,
  p_kode text,
  p_nama text,
  p_kehadiran text,
  p_jumlah int,
  p_pesan text
) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  ev public.events;
  tm public.guests;
  v_nama text := btrim(coalesce(p_nama, ''));
  v_pesan text := btrim(coalesce(p_pesan, ''));
  v_jumlah int := case when p_kehadiran = 'hadir' then greatest(1, coalesce(p_jumlah, 1)) else 0 end;
  hasil public.wishes;
  baru_baru int;
begin
  select * into ev from public.events where slug = lower(p_slug);
  if not found then
    raise exception 'ACARA_TIDAK_DITEMUKAN';
  end if;
  if ev.batas_rsvp is not null and now() > ev.batas_rsvp then
    raise exception 'RSVP_DITUTUP';
  end if;
  if p_kehadiran not in ('hadir', 'tidak') then
    raise exception 'KEHADIRAN_TIDAK_VALID';
  end if;
  if char_length(v_nama) < 1 or char_length(v_nama) > 80 then
    raise exception 'NAMA_TIDAK_VALID';
  end if;
  if char_length(v_pesan) > 500 then
    raise exception 'PESAN_TERLALU_PANJANG';
  end if;

  if p_kode is not null then
    select * into tm from public.guests where event_id = ev.id and kode = lower(p_kode);
    if not found then
      raise exception 'KODE_TIDAK_VALID';
    end if;
    if v_jumlah > tm.maks_orang then
      raise exception 'JUMLAH_MELEBIHI_BATAS';
    end if;

    insert into public.wishes (event_id, guest_id, nama, kehadiran, jumlah, pesan)
    values (ev.id, tm.id, v_nama, p_kehadiran, v_jumlah, v_pesan)
    on conflict (guest_id) where guest_id is not null
    do update set nama = excluded.nama, kehadiran = excluded.kehadiran,
                  jumlah = excluded.jumlah, pesan = excluded.pesan
    returning * into hasil;

    update public.guests
       set status = p_kehadiran, jumlah_hadir = v_jumlah, dijawab_pada = now(),
           dibuka_pada = coalesce(dibuka_pada, now())
     where id = tm.id;
  else
    if not ev.izinkan_tanpa_kode then
      raise exception 'BUTUH_KODE';
    end if;
    if v_jumlah > 4 then
      raise exception 'JUMLAH_MELEBIHI_BATAS';
    end if;
    -- rem sederhana untuk link umum
    select count(*) into baru_baru from public.wishes
     where event_id = ev.id and guest_id is null and created_at > now() - interval '1 minute';
    if baru_baru >= 20 then
      raise exception 'TERLALU_BANYAK_PERMINTAAN';
    end if;
    insert into public.wishes (event_id, nama, kehadiran, jumlah, pesan)
    values (ev.id, v_nama, p_kehadiran, v_jumlah, v_pesan)
    returning * into hasil;
  end if;

  return jsonb_build_object('id', hasil.id, 'nama', hasil.nama, 'kehadiran', hasil.kehadiran,
                            'jumlah', hasil.jumlah, 'pesan', hasil.pesan, 'created_at', hasil.created_at);
end $$;

-- Daftar ucapan publik (tanpa yang disembunyikan pemilik).
create or replace function public.daftar_ucapan(p_slug text, p_batas int default 60)
returns table (id uuid, nama text, kehadiran text, pesan text, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select w.id, w.nama, w.kehadiran, w.pesan, w.created_at
    from public.wishes w
    join public.events e on e.id = w.event_id
   where e.slug = lower(p_slug) and not w.disembunyikan and w.pesan <> ''
   order by w.created_at desc
   limit least(greatest(coalesce(p_batas, 60), 1), 200);
$$;

-- Ringkasan kehadiran publik (angka saja).
create or replace function public.ringkasan_kehadiran(p_slug text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'hadir', count(*) filter (where w.kehadiran = 'hadir'),
    'tidak', count(*) filter (where w.kehadiran = 'tidak'),
    'ucapan', count(*) filter (where not w.disembunyikan and w.pesan <> '')
  )
  from public.wishes w join public.events e on e.id = w.event_id
  where e.slug = lower(p_slug);
$$;

revoke all on function public.ambil_undangan(text, text) from public;
revoke all on function public.tandai_dibuka(text, text) from public;
revoke all on function public.kirim_rsvp(text, text, text, text, int, text) from public;
revoke all on function public.daftar_ucapan(text, int) from public;
revoke all on function public.ringkasan_kehadiran(text) from public;
grant execute on function public.ambil_undangan(text, text) to anon, authenticated;
grant execute on function public.tandai_dibuka(text, text) to anon, authenticated;
grant execute on function public.kirim_rsvp(text, text, text, text, int, text) to anon, authenticated;
grant execute on function public.daftar_ucapan(text, int) to anon, authenticated;
grant execute on function public.ringkasan_kehadiran(text) to anon, authenticated;

-- =====================================================================
-- (2) DATA CONTOH
-- =====================================================================
-- Data contoh acara (dibuat otomatis dari supabase/contoh-acara.json).
-- Jalankan SETELAH migrations/0001_skema_awal.sql. Aman dijalankan ulang.
delete from public.events where slug = 'arya-nadia';
insert into public.events (slug, tema, waktu_acara, batas_rsvp, aktif_sampai, izinkan_tanpa_kode, konten, hadiah) values ('arya-nadia', 'kastil', '2027-04-03T19:00:00+07:00', '2027-03-27T23:59:00+07:00', '2027-07-03T23:59:00+07:00', true, $json${"mempelai":{"pria":{"panggilan":"Arya","nama_lengkap":"Arya Pradana, S.T.","keterangan":"Putra pertama dari","orang_tua":"Bapak Hendra Wijaya & Ibu Sri Lestari","instagram":"aryapradana","foto":"/tema/bersama/foto-1.webp"},"wanita":{"panggilan":"Nadia","nama_lengkap":"Nadia Kirana, S.Ds.","keterangan":"Putri kedua dari","orang_tua":"Bapak Bambang Sutrisno & Ibu Ratna Sari","instagram":"nadiakirana","foto":"/tema/bersama/foto-2.webp"}},"acara":[{"nama":"Akad Nikah","mulai":"2027-04-03T19:00:00+07:00","selesai":null,"tempat":"Masjid Al-Ikhlas","alamat":"Jl. Melati Raya No. 10, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"},{"nama":"Resepsi Taman","mulai":"2027-04-03T19:30:00+07:00","selesai":"2027-04-03T22:00:00+07:00","tempat":"Taman Terbuka Gedung Melati","alamat":"Jl. Melati Raya No. 12, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"}],"lokasi_utama":{"nama":"Gedung Serbaguna Melati","alamat":"Jl. Melati Raya No. 12, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"},"catatan_acara":"Outdoor di taman · siapkan jaket tipis","dress_code":[{"nama":"Navy","warna":"#1E2752"},{"nama":"Emas","warna":"#E9B95A"},{"nama":"Champagne","warna":"#F3E3C7"},{"nama":"Hijau hutan","warna":"#1C4438"}],"kutipan":{"arab":"وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُمْ مِنْ أَنْفُسِكُمْ أَزْوَاجًا لِتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَوَدَّةً وَرَحْمَةً","terjemahan":"Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.","sumber":"QS. Ar-Rum: 21"},"tagline":"Di bawah cahaya ribuan lampion, kisah kami dimulai.","kisah":[{"tahun":"2019","judul":"Pertama Bertemu","teks":"Kami bertemu di festival lampion di taman kota. Satu lampion yang tersangkut di dahan pohon jadi alasan kami berkenalan.","foto":"/tema/bersama/foto-1.webp"},{"tahun":"2022","judul":"Menjadi Kita","teks":"Setelah tiga tahun berteman, kami memutuskan melangkah bersama dan saling mengenalkan keluarga.","foto":"/tema/bersama/foto-3.webp"},{"tahun":"2026","judul":"Lamaran","teks":"Di malam yang sama setiap tahunnya, Arya melamar Nadia dengan restu kedua keluarga.","foto":"/tema/bersama/foto-4.webp"},{"tahun":"2027","judul":"Selamanya","teks":"Kami memulai babak baru, dan ingin Anda ikut menerbangkan doa bersama kami.","foto":"/tema/bersama/foto-5.webp"}],"galeri":[{"src":"/tema/bersama/foto-1.webp","alt":"Foto galeri 1"},{"src":"/tema/bersama/foto-2.webp","alt":"Foto galeri 2"},{"src":"/tema/bersama/foto-3.webp","alt":"Foto galeri 3"},{"src":"/tema/bersama/foto-4.webp","alt":"Foto galeri 4"},{"src":"/tema/bersama/foto-5.webp","alt":"Foto galeri 5"},{"src":"/tema/bersama/foto-6.webp","alt":"Foto galeri 6"}],"turut_mengundang":["Keluarga Besar Bapak Hendra Wijaya","Keluarga Besar Bapak Bambang Sutrisno","Keluarga Besar Alm. H. Soedarmo","Rekan-rekan kantor dan sahabat"],"musik_url":null}$json$::jsonb, $json${"rekening":[{"bank":"BCA","nomor":"1234567890","atas_nama":"Arya Pradana"}],"alamat":{"penerima":"Nadia Kirana","alamat":"Jl. Kenanga No. 8, RT 03/RW 05, Jakarta Selatan 12345"}}$json$::jsonb);
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'dn7s', 'Deny Setyawan, S.Kom.', 'Teman', 2 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'sr4d', 'Bapak H. Suryadi', 'Keluarga', 2 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'rt2n', 'Ibu Ratna Dewi', 'Keluarga', 2 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'bm8a', 'Bima Saputra', 'Teman', 1 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'wl3s', 'Ibu Wulan Sari', 'Rekan kerja', 2 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'ag5h', 'Pak Agus Hartono', 'Rekan kerja', 2 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'dr9m', 'Keluarga Besar Pak Darmo', 'Keluarga', 5 from public.events where slug = 'arya-nadia';
insert into public.guests (event_id, kode, nama, kategori, maks_orang) select id, 'ct6y', 'Citra Ayu', 'Teman', 2 from public.events where slug = 'arya-nadia';
select public.kirim_rsvp('arya-nadia', 'sr4d', 'Bapak H. Suryadi', 'hadir', 2, 'Selamat menempuh hidup baru. Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.');
select public.kirim_rsvp('arya-nadia', 'ct6y', 'Citra Ayu', 'hadir', 1, 'Semoga cinta kalian selalu bersinar seperti lampion malam ini.');
select public.kirim_rsvp('arya-nadia', 'wl3s', 'Ibu Wulan Sari', 'hadir', 1, 'Barakallahu lakuma wa baraka alaikuma wa jama''a bainakuma fii khair.');
select public.kirim_rsvp('arya-nadia', 'bm8a', 'Bima Saputra', 'tidak', 0, 'Selamat ya! Maaf belum bisa datang, doa terbaik dari jauh.');
-- Hubungkan acara ke akun pemilik setelah login pertama di dashboard:
-- update public.events set owner_id = '<USER_ID_ANDA>' where slug = 'arya-nadia';
