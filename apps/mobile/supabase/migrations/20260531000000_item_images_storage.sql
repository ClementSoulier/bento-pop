-- Migration : bucket Storage `item-images` + policies pour les illustrations
-- du catalogue maison (depuis Wikipedia ou upload manuel admin).
--
-- Architecture choisie :
--   - Bucket PUBLIC en lecture (les images sont chargées dans l'app mobile
--     publique, pas besoin d'URL signée).
--   - Écriture exclusivement service-role (= BO admin). Pas de policy
--     authenticated pour éviter qu'un user puisse uploader quoi que ce
--     soit (anti-spam + propriété images).
--   - Path convention : `{itemId}/main.{ext}` → un seul fichier par item,
--     l'écrasement remplace l'illustration sans rotation de cache aval.
--
-- À appliquer sur le projet Supabase mobile via le SQL editor du dashboard.

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = excluded.public;

-- Lecture publique : nécessaire pour que le <Image source={{ uri }} /> de
-- l'app mobile et l'admin puissent afficher les illustrations sans token.
drop policy if exists "item_images_public_read" on storage.objects;
create policy "item_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'item-images');

-- Pas de policy INSERT/UPDATE/DELETE pour anon/authenticated : seul
-- service-role peut écrire (bypass RLS). C'est le comportement par défaut
-- sur storage.objects donc rien à expliciter, mais on documente.
