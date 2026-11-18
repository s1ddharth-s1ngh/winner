-- Profile customization: avatar photo (existing avatar_url), cover color and cover photo.
-- Images live in the public "profile-images" bucket, one folder per user: <user_id>/avatar.jpg, <user_id>/cover.jpg.
alter table public.profiles
  add column cover_color text check (cover_color ~ '^#[0-9a-fA-F]{6}$'),
  add column cover_url text;

-- Public read (group mates load them in <img>); the client resizes to JPEG before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Users write only inside their own folder.
create policy "profile-images: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile-images: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profile-images: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Upsert needs to see the existing row.
create policy "profile-images: select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
