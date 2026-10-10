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
