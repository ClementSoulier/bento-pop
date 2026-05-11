-- Apple App Store guideline 5.1.1(v) exige que toute app permettant la
-- création de compte permette aussi la suppression depuis l'app.
-- On ouvre une policy DELETE sur `public.users` pour que l'utilisateur
-- puisse supprimer son propre profil. Le ON DELETE CASCADE sur les FKs
-- de bentos / bento_items s'occupe du reste automatiquement.
--
-- À noter : `auth.users` reste orphelin (anonymous), mais sans aucune
-- donnée publique liée. Apple considère ça suffisant pour la conformité
-- tant qu'aucune info personnelle n'y est stockée — et au MVP, c'est le
-- cas (anonymous sign-in, pas d'email).

create policy "users_delete_own"
  on public.users
  for delete
  to authenticated
  using (id = (select auth.uid()));
