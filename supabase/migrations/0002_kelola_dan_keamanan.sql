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
