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
-- Momenmu.id — 0002: link pribadi lebih aman + dukungan dashboard /kelola
-- Jalankan SEKALI di Supabase: SQL Editor → New query → tempel seluruh file → Run.
-- Aman dijalankan ulang.
--
-- Isi:
--   1. Batas perangkat per link tamu (default 3). Lewat dari itu, link terkunci
--      dan bisa di-reset pemilik dari dashboard.
--   2. Link umum (tanpa kode) dimatikan: undangan hanya untuk tamu yang dituju.
--   3. Rekening & alamat kado tidak lagi ikut di halaman; diambil setelah
--      tamu membuka undangan dari perangkat yang terdaftar.
--   4. Nama pada RSVP tamu berkode dikunci ke nama di daftar tamu.
--   5. Kategori tamu bebas (mis. "Keluarga Pria", "VIP"), maks 40 huruf.
--   6. Penyimpanan foto & musik (bucket "media") untuk upload dari dashboard.
-- =====================================================================

-- ---------- kolom baru ----------
alter table public.events add column if not exists batas_perangkat int not null default 3;
alter table public.events drop constraint if exists events_batas_perangkat_check;
alter table public.events add constraint events_batas_perangkat_check check (batas_perangkat between 0 and 20);
alter table public.events alter column izinkan_tanpa_kode set default false;
update public.events set izinkan_tanpa_kode = false where izinkan_tanpa_kode;

alter table public.guests add column if not exists perangkat text[] not null default '{}';

alter table public.guests drop constraint if exists guests_kategori_check;
alter table public.guests add constraint guests_kategori_check check (char_length(btrim(kategori)) between 1 and 40);

create index if not exists guests_event_status_idx on public.guests (event_id, status);

-- Dashboard memakai akun login (role authenticated) + Row Level Security pemilik (lihat 0001).
grant select, insert, update, delete on public.events, public.guests, public.wishes to authenticated;

-- ---------- ambil_undangan: tanpa data hadiah ----------
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
    'hadiah', null,
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

-- ---------- tandai_dibuka: catat perangkat, kunci jika lewat batas ----------
drop function if exists public.tandai_dibuka(text, text);
create or replace function public.tandai_dibuka(p_slug text, p_kode text, p_perangkat text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  ev public.events;
  tm public.guests;
  v_dev text := left(nullif(btrim(coalesce(p_perangkat, '')), ''), 64);
begin
  select * into ev from public.events where slug = lower(p_slug);
  if not found then
    return jsonb_build_object('ok', false, 'terkunci', false);
  end if;
  select * into tm from public.guests where event_id = ev.id and kode = lower(p_kode) for update;
  if not found then
    return jsonb_build_object('ok', false, 'terkunci', false);
  end if;

  if ev.batas_perangkat > 0 and v_dev is not null and not (v_dev = any (tm.perangkat)) then
    if coalesce(array_length(tm.perangkat, 1), 0) >= ev.batas_perangkat then
      return jsonb_build_object('ok', false, 'terkunci', true);
    end if;
    update public.guests set perangkat = array_append(perangkat, v_dev) where id = tm.id;
  end if;

  update public.guests
     set status = case when status in ('baru', 'terkirim') then 'dibuka' else status end,
         dibuka_pada = coalesce(dibuka_pada, now())
   where id = tm.id;
  return jsonb_build_object('ok', true, 'terkunci', false);
end $$;

-- ---------- ambil_hadiah: hanya untuk perangkat yang sudah terdaftar ----------
create or replace function public.ambil_hadiah(p_slug text, p_kode text, p_perangkat text default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  ev public.events;
  tm public.guests;
begin
  select * into ev from public.events where slug = lower(p_slug);
  if not found then
    return null;
  end if;
  select * into tm from public.guests where event_id = ev.id and kode = lower(coalesce(p_kode, ''));
  if not found then
    return null;
  end if;
  if ev.batas_perangkat > 0 and not (coalesce(p_perangkat, '') = any (tm.perangkat)) then
    return null;
  end if;
  return ev.hadiah;
end $$;

-- ---------- kirim_rsvp: nama tamu berkode dikunci, perangkat harus terdaftar ----------
drop function if exists public.kirim_rsvp(text, text, text, text, int, text);
create or replace function public.kirim_rsvp(
  p_slug text,
  p_kode text,
  p_nama text,
  p_kehadiran text,
  p_jumlah int,
  p_pesan text,
  p_perangkat text default null
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
  if char_length(v_pesan) > 500 then
    raise exception 'PESAN_TERLALU_PANJANG';
  end if;

  if p_kode is not null then
    select * into tm from public.guests where event_id = ev.id and kode = lower(p_kode);
    if not found then
      raise exception 'KODE_TIDAK_VALID';
    end if;
    if ev.batas_perangkat > 0 and not (coalesce(p_perangkat, '') = any (tm.perangkat)) then
      raise exception 'PERANGKAT_TIDAK_TERDAFTAR';
    end if;
    if v_jumlah > tm.maks_orang then
      raise exception 'JUMLAH_MELEBIHI_BATAS';
    end if;
    v_nama := left(tm.nama, 80);   -- nama mengikuti daftar tamu, tidak bisa diganti

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
    if char_length(v_nama) < 1 or char_length(v_nama) > 80 then
      raise exception 'NAMA_TIDAK_VALID';
    end if;
    if v_jumlah > 4 then
      raise exception 'JUMLAH_MELEBIHI_BATAS';
    end if;
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

revoke all on function public.tandai_dibuka(text, text, text) from public;
revoke all on function public.ambil_hadiah(text, text, text) from public;
revoke all on function public.kirim_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function public.ambil_undangan(text, text) to anon, authenticated;
grant execute on function public.tandai_dibuka(text, text, text) to anon, authenticated;
grant execute on function public.ambil_hadiah(text, text, text) to anon, authenticated;
grant execute on function public.kirim_rsvp(text, text, text, text, int, text, text) to anon, authenticated;

-- ---------- penyimpanan foto & musik (upload dari dashboard) ----------
-- Bucket publik: foto bisa dilihat tamu lewat URL; hanya pemilik akun yang bisa
-- mengunggah/menghapus, dan hanya di folder miliknya sendiri (<id-akun>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760,
        array['image/webp', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media: pemilik unggah" on storage.objects;
create policy "media: pemilik unggah" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media: pemilik lihat" on storage.objects;
create policy "media: pemilik lihat" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media: pemilik hapus" on storage.objects;
create policy "media: pemilik hapus" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Momenmu.id — 0003: multi-klien (admin agensi + folder file per acara)
-- Jalankan di Supabase → SQL Editor SETELAH 0001 & 0002. Aman dijalankan ulang;
-- acara, tamu, ucapan, dan file yang sudah ada tetap.
--
-- 1. Tabel staf (admin agensi) + fungsi pemeriksa akses
-- 2. Aturan akses: pemilik acara ATAU admin. Buat/hapus acara khusus admin.
--    Pemilik acara & masa aktif hanya bisa diubah admin.
-- 3. File per acara: media/<id-acara>/foto/... dan media/<id-acara>/musik/...
-- 4. Fungsi admin: daftar_klien(), sambungkan_pemilik()
--
-- Menjadikan akun sebagai admin (ganti emailnya dulu):
--   insert into public.staf (user_id, catatan)
--   select id, 'admin Momenmu' from auth.users where email = 'email-admin@contoh.com'
--   on conflict (user_id) do nothing returning user_id;
-- =====================================================================

-- 1. Admin agensi -------------------------------------------------------
create table if not exists public.staf (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  catatan    text,
  created_at timestamptz not null default now()
);
alter table public.staf enable row level security;
revoke all on public.staf from anon, authenticated;
-- Sengaja tanpa policy: daftar admin hanya bisa diubah lewat SQL Editor.

create or replace function public.is_staf()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staf where user_id = auth.uid());
$$;

-- Boleh mengelola acara ini? (pemilik acaranya atau admin)
create or replace function public.boleh_kelola(p_acara uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_acara and (e.owner_id = auth.uid() or public.is_staf())
  );
$$;

-- Untuk aturan penyimpanan file: nama folder pertama = id acara
create or replace function public.boleh_kelola_folder(p_folder text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.boleh_kelola(p_folder::uuid)
    else false
  end;
$$;

-- 2. Aturan akses data --------------------------------------------------
drop policy if exists "pemilik kelola acara" on public.events;
drop policy if exists "acara: lihat" on public.events;
drop policy if exists "acara: ubah" on public.events;
drop policy if exists "acara: buat (admin)" on public.events;
drop policy if exists "acara: hapus (admin)" on public.events;

create policy "acara: lihat" on public.events
  for select to authenticated
  using (owner_id = auth.uid() or public.is_staf());
create policy "acara: ubah" on public.events
  for update to authenticated
  using (owner_id = auth.uid() or public.is_staf())
  with check (owner_id = auth.uid() or public.is_staf());
create policy "acara: buat (admin)" on public.events
  for insert to authenticated
  with check (public.is_staf());
create policy "acara: hapus (admin)" on public.events
  for delete to authenticated
  using (public.is_staf());

drop policy if exists "pemilik kelola tamu" on public.guests;
create policy "pemilik kelola tamu" on public.guests
  for all to authenticated
  using (public.boleh_kelola(event_id))
  with check (public.boleh_kelola(event_id));

drop policy if exists "pemilik kelola ucapan" on public.wishes;
create policy "pemilik kelola ucapan" on public.wishes
  for all to authenticated
  using (public.boleh_kelola(event_id))
  with check (public.boleh_kelola(event_id));

-- Klien tidak bisa memindahkan acara ke akun lain atau memperpanjang masa aktif sendiri.
-- (Perintah dari SQL Editor tidak membawa akun, jadi tetap boleh.)
create or replace function public.jaga_kolom_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staf()
     and (new.owner_id is distinct from old.owner_id or new.aktif_sampai is distinct from old.aktif_sampai) then
    raise exception 'khusus_admin: pemilik acara dan masa aktif hanya bisa diubah admin' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists events_jaga_kolom_admin on public.events;
create trigger events_jaga_kolom_admin
  before update on public.events
  for each row execute function public.jaga_kolom_admin();

-- 3. File per acara -----------------------------------------------------
-- Policy lama (folder = id akun) dari 0002 dibiarkan supaya file lama tetap bisa dikelola.
drop policy if exists "media acara: unggah" on storage.objects;
create policy "media acara: unggah" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.boleh_kelola_folder((storage.foldername(name))[1]));

drop policy if exists "media acara: lihat" on storage.objects;
create policy "media acara: lihat" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.boleh_kelola_folder((storage.foldername(name))[1]));

drop policy if exists "media acara: hapus" on storage.objects;
create policy "media acara: hapus" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.boleh_kelola_folder((storage.foldername(name))[1]));

-- 4. Fungsi admin -------------------------------------------------------
drop function if exists public.daftar_klien();
create or replace function public.daftar_klien()
returns table (
  id uuid,
  slug text,
  nama text,
  waktu_acara timestamptz,
  aktif_sampai timestamptz,
  owner_email text,
  jumlah_tamu bigint,
  sudah_jawab bigint,
  hadir bigint,
  dibuat timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_staf() then
    raise exception 'khusus_admin' using errcode = '42501';
  end if;
  return query
    select e.id, e.slug,
           coalesce(e.konten #>> '{mempelai,pria,panggilan}', '') || ' & ' || coalesce(e.konten #>> '{mempelai,wanita,panggilan}', ''),
           e.waktu_acara, e.aktif_sampai, u.email::text,
           count(g.id) filter (where g.kategori <> 'Pratinjau'),
           count(g.id) filter (where g.kategori <> 'Pratinjau' and g.status in ('hadir', 'tidak')),
           coalesce(sum(g.jumlah_hadir) filter (where g.kategori <> 'Pratinjau' and g.status = 'hadir'), 0)::bigint,
           e.created_at
      from public.events e
      left join auth.users u on u.id = e.owner_id
      left join public.guests g on g.event_id = e.id
     group by e.id, u.email
     order by e.waktu_acara;
end;
$$;

-- Sambungkan acara ke akun klien lewat email (email kosong = lepaskan pemilik).
create or replace function public.sambungkan_pemilik(p_acara uuid, p_email text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
begin
  if not public.is_staf() then
    raise exception 'khusus_admin' using errcode = '42501';
  end if;
  if p_email is not null and btrim(p_email) <> '' then
    select u.id, u.email::text into v_id, v_email
      from auth.users u
     where lower(u.email) = lower(btrim(p_email))
     limit 1;
    if v_id is null then
      raise exception 'akun_tidak_ditemukan';
    end if;
  end if;
  update public.events set owner_id = v_id where id = p_acara;
  if not found then
    raise exception 'acara_tidak_ditemukan';
  end if;
  return v_email;
end;
$$;

revoke execute on function public.is_staf() from public, anon;
revoke execute on function public.boleh_kelola(uuid) from public, anon;
revoke execute on function public.boleh_kelola_folder(text) from public, anon;
revoke execute on function public.daftar_klien() from public, anon;
revoke execute on function public.sambungkan_pemilik(uuid, text) from public, anon;
grant execute on function public.is_staf() to authenticated;
grant execute on function public.boleh_kelola(uuid) to authenticated;
grant execute on function public.boleh_kelola_folder(text) to authenticated;
grant execute on function public.daftar_klien() to authenticated;
grant execute on function public.sambungkan_pemilik(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- (2) DATA CONTOH
-- =====================================================================
-- Data contoh acara (dibuat otomatis dari supabase/contoh-acara.json).
-- Jalankan SETELAH semua file di supabase/migrations. Aman dijalankan ulang.
delete from public.events where slug = 'arya-nadia';
insert into public.events (slug, tema, waktu_acara, batas_rsvp, aktif_sampai, izinkan_tanpa_kode, konten, hadiah) values ('arya-nadia', 'kastil', '2027-04-03T19:00:00+07:00', '2027-03-27T23:59:00+07:00', '2027-07-03T23:59:00+07:00', false, $json${"mempelai":{"pria":{"panggilan":"Arya","nama_lengkap":"Arya Pradana, S.T.","keterangan":"Putra pertama dari","orang_tua":"Bapak Hendra Wijaya & Ibu Sri Lestari","instagram":"aryapradana","foto":"/tema/bersama/foto-1.webp"},"wanita":{"panggilan":"Nadia","nama_lengkap":"Nadia Kirana, S.Ds.","keterangan":"Putri kedua dari","orang_tua":"Bapak Bambang Sutrisno & Ibu Ratna Sari","instagram":"nadiakirana","foto":"/tema/bersama/foto-2.webp"}},"acara":[{"nama":"Akad Nikah","mulai":"2027-04-03T19:00:00+07:00","selesai":null,"tempat":"Masjid Al-Ikhlas","alamat":"Jl. Melati Raya No. 10, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"},{"nama":"Resepsi Taman","mulai":"2027-04-03T19:30:00+07:00","selesai":"2027-04-03T22:00:00+07:00","tempat":"Taman Terbuka Gedung Melati","alamat":"Jl. Melati Raya No. 12, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"}],"lokasi_utama":{"nama":"Gedung Serbaguna Melati","alamat":"Jl. Melati Raya No. 12, Jakarta Selatan","maps_url":"https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan"},"catatan_acara":"Outdoor di taman · siapkan jaket tipis","dress_code":[{"nama":"Navy","warna":"#1E2752"},{"nama":"Emas","warna":"#E9B95A"},{"nama":"Champagne","warna":"#F3E3C7"},{"nama":"Hijau hutan","warna":"#1C4438"}],"kutipan":{"arab":"وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُمْ مِنْ أَنْفُسِكُمْ أَزْوَاجًا لِتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُمْ مَوَدَّةً وَرَحْمَةً","terjemahan":"Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.","sumber":"QS. Ar-Rum: 21"},"tagline":"Di bawah cahaya ribuan lampion, kisah kami dimulai.","kisah":[{"tahun":"2019","judul":"Pertama Bertemu","teks":"Kami bertemu di festival lampion di taman kota. Satu lampion yang tersangkut di dahan pohon jadi alasan kami berkenalan.","foto":"/tema/bersama/foto-1.webp"},{"tahun":"2022","judul":"Menjadi Kita","teks":"Setelah tiga tahun berteman, kami memutuskan melangkah bersama dan saling mengenalkan keluarga.","foto":"/tema/bersama/foto-3.webp"},{"tahun":"2026","judul":"Lamaran","teks":"Di malam yang sama setiap tahunnya, Arya melamar Nadia dengan restu kedua keluarga.","foto":"/tema/bersama/foto-4.webp"},{"tahun":"2027","judul":"Selamanya","teks":"Kami memulai babak baru, dan ingin Anda ikut menerbangkan doa bersama kami.","foto":"/tema/bersama/foto-5.webp"}],"galeri":[{"src":"/tema/bersama/foto-1.webp","alt":"Foto galeri 1"},{"src":"/tema/bersama/foto-2.webp","alt":"Foto galeri 2"},{"src":"/tema/bersama/foto-3.webp","alt":"Foto galeri 3"},{"src":"/tema/bersama/foto-4.webp","alt":"Foto galeri 4"},{"src":"/tema/bersama/foto-5.webp","alt":"Foto galeri 5"},{"src":"/tema/bersama/foto-6.webp","alt":"Foto galeri 6"}],"turut_mengundang":["Keluarga Besar Bapak Hendra Wijaya","Keluarga Besar Bapak Bambang Sutrisno","Keluarga Besar Alm. H. Soedarmo","Rekan-rekan kantor dan sahabat"],"musik_url":null}$json$::jsonb, $json${"rekening":[{"bank":"BCA","nomor":"1234567890","atas_nama":"Arya Pradana"}],"alamat":{"penerima":"Nadia Kirana","alamat":"Jl. Kenanga No. 8, RT 03/RW 05, Jakarta Selatan 12345"}}$json$::jsonb);
update public.events set batas_perangkat = 0 where slug = 'arya-nadia';
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
update public.events set batas_perangkat = 3 where slug = 'arya-nadia';
-- Hubungkan acara ke akun pemilik setelah login pertama di dashboard:
-- update public.events set owner_id = '<USER_ID_ANDA>' where slug = 'arya-nadia';
