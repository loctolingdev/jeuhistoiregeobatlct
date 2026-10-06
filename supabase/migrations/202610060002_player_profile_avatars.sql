-- Publicly readable profile pictures, with writes restricted to each player's own folder.
-- Profile names and avatar object paths are stored in Supabase Auth user_metadata.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-avatars',
  'player-avatars',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view player profile photos" on storage.objects;
create policy "Public can view player profile photos"
  on storage.objects for select to public
  using (bucket_id = 'player-avatars');

drop policy if exists "Players upload their own profile photo" on storage.objects;
create policy "Players upload their own profile photo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_play_game()
  );

drop policy if exists "Players update their own profile photo" on storage.objects;
create policy "Players update their own profile photo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_play_game()
  )
  with check (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_play_game()
  );

drop policy if exists "Players delete their own profile photo" on storage.objects;
create policy "Players delete their own profile photo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'player-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_play_game()
  );
