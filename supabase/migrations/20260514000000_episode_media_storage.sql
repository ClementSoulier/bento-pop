-- Bucket de stockage pour les médias des épisodes (landing).
-- Usages :
--   - guests/<uuid>.webp    : photo d'un invité one-shot
--   - mentions/<uuid>.webp  : cover d'une œuvre mentionnée
--
-- Lecture publique (les pages publiques /emissions/[slug] et
-- /podcasts/[slug] affichent ces médias en clair) + écriture réservée aux
-- admins via la fonction `is_admin()`.

insert into storage.buckets (id, name, public)
values ('episode-media', 'episode-media', true)
on conflict (id) do nothing;

-- Lecture publique
drop policy if exists "anon read episode media" on storage.objects;
create policy "anon read episode media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'episode-media');

-- Insert : admins uniquement
drop policy if exists "admins insert episode media" on storage.objects;
create policy "admins insert episode media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'episode-media' and public.is_admin());

-- Update : admins uniquement (overwrite d'un fichier existant)
drop policy if exists "admins update episode media" on storage.objects;
create policy "admins update episode media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'episode-media' and public.is_admin())
  with check (bucket_id = 'episode-media' and public.is_admin());

-- Delete : admins uniquement (purge manuelle, hors-scope V1)
drop policy if exists "admins delete episode media" on storage.objects;
create policy "admins delete episode media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'episode-media' and public.is_admin());
