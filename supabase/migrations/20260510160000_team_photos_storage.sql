-- Bucket de stockage pour les photos des membres de l'équipe (landing).
-- Lecture publique (la landing affiche les photos en clair) + écriture
-- réservée aux admins via la fonction `is_admin()` posée plus haut.

insert into storage.buckets (id, name, public)
values ('team-photos', 'team-photos', true)
on conflict (id) do nothing;

-- Lecture publique
drop policy if exists "anon read team photos" on storage.objects;
create policy "anon read team photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'team-photos');

-- Insert : admins uniquement
drop policy if exists "admins insert team photos" on storage.objects;
create policy "admins insert team photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'team-photos' and public.is_admin());

-- Update : admins uniquement (overwrite d'un fichier existant)
drop policy if exists "admins update team photos" on storage.objects;
create policy "admins update team photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'team-photos' and public.is_admin())
  with check (bucket_id = 'team-photos' and public.is_admin());

-- Delete : admins uniquement (purge manuelle, hors-scope V1)
drop policy if exists "admins delete team photos" on storage.objects;
create policy "admins delete team photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'team-photos' and public.is_admin());
