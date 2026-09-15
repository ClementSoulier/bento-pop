-- Migration : ferme quatre failles de privilèges et deux points d'hygiène.
--
-- Relevés le 15 septembre 2026 en préparant la roadmap produit, de la même
-- famille que `is_featured` (cf. `20260913200000_bentos_column_privileges.sql`) :
-- des policies qui filtrent les LIGNES, et des privilèges par défaut qui
-- laissent toutes les COLONNES aux rôles `anon` et `authenticated`.
--
--   1. la télémétrie de `users` est lisible par tout le monde ;
--   2. un membre peut se déclarer profil éditorial ;
--   3. un client peut insérer un item déjà validé ;
--   4. un membre peut contourner la correction de `is_featured` en
--      supprimant puis réinsérant son bento ;
--   5. un signalement peut naître déjà classé ;
--   6. `admin_merge_items` reste exécutable par les clients.
--
-- La 1 est mesurée sur la production, à la clé anonyme. Les autres sont
-- reproduites sur un Supabase local construit depuis ces migrations : douze
-- attaques passent avant, aucune après, et le parcours complet de l'app passe
-- toujours. Contrôle rejouable : `apps/mobile/scripts/check-privileges.ts`.
--
-- **Contrainte qui commande tout le reste : les versions déjà publiées.** Elles
-- lisent leur profil en `select('*')` (`src/state/session.ts`). Retirer la
-- lecture d'une seule colonne de `users` fait répondre « permission denied for
-- table users » à cette requête, mesuré en local : toutes les installations
-- perdraient leur profil au lancement. D'où un trigger pour la télémétrie, et
-- des droits par colonne sur les seules écritures.
--
-- Les écritures autorisées ci-dessous sont exactement celles des versions
-- publiées, relevées commit par commit sur les builds EAS du 29 mai au
-- 13 septembre (6426779 pour la 0.1.0 du Play Store, 9b717f2 pour la 1.2.0).
--
-- À appliquer à la main dans le SQL editor du dashboard du projet mobile
-- (`ggjgktbcqumfxrixcdyx`) : il n'y a pas de lanceur de migrations.

-- ─── 1. Télémétrie : détournée vers une table privée ─────────────────
--
-- `users_read_all` est `using (true)` : le pseudo doit rester lisible par
-- tous, pour la recherche et les pages publiques. Tout ce qui vit dans cette
-- table est donc public, et `last_seen_at` y disait à n'importe qui quand
-- chaque membre avait ouvert l'app pour la dernière fois.
--
-- Les trois colonnes restent en place, parce que la 1.2.0 les écrit
-- (`src/lib/telemetry.ts`) et qu'une colonne supprimée ferait échouer sa
-- requête. Un trigger range leurs valeurs dans `user_telemetry`, que seul le
-- service-role lit, puis les remet à `null` avant l'écriture : elles ne sont
-- plus jamais stockées dans `users`.
--
-- Conséquence acceptée : l'export des données de l'app, qui lit `users`, ne
-- contient plus la télémétrie. Une demande d'accès RGPD la retrouve dans
-- `user_telemetry`, par le back-office.
create table if not exists public.user_telemetry (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_seen_at timestamptz,
  -- Même valeur fermée que `users.platform`.
  platform text check (platform in ('ios', 'android')),
  app_version text,
  updated_at timestamptz not null default now()
);

alter table public.user_telemetry enable row level security;

-- Aucune policy, et aucun privilège : même régime que `user_deletions`.
-- `revoke` explicite parce que les privilèges par défaut de Supabase
-- accordent tout à `anon` et `authenticated`.
revoke all on public.user_telemetry from anon, authenticated;

comment on table public.user_telemetry is
  'Dernier démarrage de l''app, plateforme et version, par membre. Écrite par '
  'le trigger users_divert_telemetry, lue par le back-office en service-role '
  'uniquement. Cf. 20260915000000_close_privilege_gaps.sql.';

-- Reprise de l'existant, avant que le trigger ne vide les colonnes.
insert into public.user_telemetry (user_id, last_seen_at, platform, app_version)
select id, last_seen_at, platform, app_version
from public.users
where last_seen_at is not null or platform is not null or app_version is not null
on conflict (user_id) do update
  set last_seen_at = excluded.last_seen_at,
      platform = excluded.platform,
      app_version = excluded.app_version,
      updated_at = now();

-- `security definer` : l'appelant est le membre, qui n'a aucun droit sur
-- `user_telemetry`. `search_path` vide et noms qualifiés, comme
-- `purge_user_deletions`, pour qu'aucun objet homonyme ne détourne l'écriture.
--
-- Sur INSERT, rien à ranger : l'app n'y pose jamais de télémétrie, et la clé
-- étrangère n'existe pas encore pour la ligne en cours de création. Les
-- colonnes sont remises à `null` dans les deux cas.
create or replace function public.users_divert_telemetry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.last_seen_at is not null
          or new.platform is not null
          or new.app_version is not null) then
    insert into public.user_telemetry (user_id, last_seen_at, platform, app_version, updated_at)
    values (new.id, new.last_seen_at, new.platform, new.app_version, now())
    on conflict (user_id) do update
      set last_seen_at = excluded.last_seen_at,
          platform = excluded.platform,
          app_version = excluded.app_version,
          updated_at = now();
  end if;

  new.last_seen_at := null;
  new.platform := null;
  new.app_version := null;
  return new;
end;
$$;

revoke all on function public.users_divert_telemetry() from public;
revoke all on function public.users_divert_telemetry() from anon;
revoke all on function public.users_divert_telemetry() from authenticated;

drop trigger if exists users_divert_telemetry on public.users;
create trigger users_divert_telemetry
  before insert or update on public.users
  for each row execute function public.users_divert_telemetry();

-- Vide ce qui était déjà écrit. Passe par le trigger, qui n'a plus rien à
-- ranger. `users_touch_updated_at` avance `updated_at` sur ces lignes.
update public.users
set last_seen_at = null, platform = null, app_version = null
where last_seen_at is not null or platform is not null or app_version is not null;

-- L'index de tri de la liste d'administration porte désormais sur une
-- colonne toujours vide. Le back-office trie en mémoire.
drop index if exists public.users_last_seen_idx;

comment on column public.users.last_seen_at is
  'Toujours null depuis le 15/09/2026 : la valeur est détournée vers '
  'user_telemetry par le trigger users_divert_telemetry. Conservée parce que '
  'la 1.2.0 l''écrit.';

-- ─── 2. users : les écritures limitées à ce que l'app pose ───────────
--
-- `users_insert_own` et `users_update_own` vérifient `id = auth.uid()` et
-- rien d'autre. Un membre pouvait donc écrire `kind = 'editorial'` sur sa
-- ligne, en mettant `terms_accepted_at` à `null` dans la même requête pour
-- satisfaire `users_editorial_has_no_terms`, et recevoir l'étiquette d'invité
-- dans le fil et sur sa page (`isGuest`, `src/lib/feed.ts`). Ou naître ainsi.
--
-- Ce que l'app écrit, toutes versions publiées confondues :
--   insert : id, pseudo, terms_accepted_at        (onboarding/pseudo.tsx)
--   update : terms_accepted_at                    (onboarding/terms.tsx)
--   update : last_seen_at, platform, app_version  (telemetry.ts, 1.2.0)
--
-- Conséquence voulue : changer son pseudo ou son nom par l'API devient
-- impossible. Aucune version ne le fait ; le chantier 21 rouvrira ces droits
-- en même temps que l'écran.
--
-- Le back-office écrit en service-role, que ces `revoke` ne concernent pas.
revoke insert, update on public.users from anon, authenticated;
grant insert (id, pseudo, terms_accepted_at) on public.users to authenticated;
grant update (terms_accepted_at, last_seen_at, platform, app_version)
  on public.users to authenticated;

-- ─── 3. items : tout ce qui vient de l'API passe par la modération ───
--
-- `items_insert_authenticated` est `with check (true)`, et le trigger de
-- statut ne forçait `pending` que pour `external_source = 'user'` : il
-- respectait le statut demandé pour `admin`, et forçait `validated` pour les
-- autres sources, héritage d'un ancien client qui insérait depuis TMDb. Un
-- compte anonyme pouvait donc écrire un titre libre directement dans le
-- catalogue validé, visible aussitôt par `search_items`.
--
-- Désormais, pour tout appelant `anon` ou `authenticated` : `pending`,
-- l'auteur pris de la session, et les champs de validation effacés. Le
-- back-office et les scripts du catalogue, en service-role, gardent le
-- comportement d'avant. `current_user` vaut le rôle de la requête : la
-- fonction n'est pas `security definer`.
--
-- Effet de bord accepté : un client d'avant le 28 mai qui insérait depuis
-- TMDb voit ses ajouts passer en modération, comme ceux des versions
-- actuelles.
create or replace function public.items_set_status_on_insert()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.status := 'pending';
    new.submitted_by := (select auth.uid());
    new.submitted_at := now();
    new.validated_at := null;
    new.validated_by := null;
    new.rejected_at := null;
    new.rejected_by := null;
    new.rejected_reason := null;
    new.merged_into_id := null;
  elsif new.external_source = 'user' then
    new.status := 'pending';
    new.submitted_by := coalesce(new.submitted_by, (select auth.uid()));
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif new.external_source = 'admin' then
    -- Service-role depuis le back-office : on respecte le statut posé.
    null;
  else
    new.status := 'validated';
  end if;
  return new;
end;
$$;

-- Aucune policy n'autorise la mise à jour ni la suppression d'un item par un
-- client, qui obtenait « 0 ligne ». Le refus devient explicite.
revoke update, delete on public.items from anon, authenticated;

-- ─── 4. bentos : l'insertion ne pose que le propriétaire ─────────────
--
-- La migration du 13 septembre a retiré `update` sur `is_featured`, pas
-- `insert`. Avec `bentos_delete_own`, un membre pouvait supprimer son bento et
-- en réinsérer un avec `is_featured = true`, `featured_order` et
-- `published_at` : mesuré en local, le coup de cœur usurpé sort dans la liste
-- publique.
--
-- L'app n'insère que `user_id` (`ensureBento`), et publie ensuite par une
-- mise à jour de `published_at`, déjà seule colonne autorisée.
revoke insert on public.bentos from anon, authenticated;
grant insert (user_id) on public.bentos to authenticated;

-- ─── 5. reports : un signalement naît en attente ─────────────────────
--
-- L'app envoie ces cinq colonnes (`src/lib/report.ts`). `status`,
-- `reviewed_at` et `reviewed_by` sont l'affaire du back-office.
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (reporter_id, target_kind, target_pseudo, target_bento_id, reason)
  on public.reports to authenticated;

-- ─── 6. admin_merge_items : réservée au service ──────────────────────
--
-- Écrite « pas SECURITY DEFINER, seul service-role l'appelle », mais jamais
-- retirée aux clients. Ses écritures restaient bornées par la RLS, et
-- l'insertion d'alias la faisait échouer : aucun dégât constaté, un droit de
-- trop quand même. Le back-office l'appelle en service-role.
revoke all on function public.admin_merge_items(uuid, uuid[]) from public;
revoke all on function public.admin_merge_items(uuid, uuid[]) from anon;
revoke all on function public.admin_merge_items(uuid, uuid[]) from authenticated;

notify pgrst, 'reload schema';

-- ─── Contrôles, à lancer après application ───────────────────────────
--
-- Les sorties attendues sont celles relevées sur le Supabase local après
-- `supabase db reset`, le 15 septembre 2026.
--
-- 1. Les écritures accordées colonne par colonne. Attendu, six lignes :
--    bentos  · INSERT · user_id
--    bentos  · UPDATE · published_at
--    items   · INSERT · toutes les colonnes (le trigger force `pending`)
--    reports · INSERT · reason, reporter_id, target_bento_id, target_kind,
--                       target_pseudo
--    users   · INSERT · id, pseudo, terms_accepted_at
--    users   · UPDATE · app_version, last_seen_at, platform, terms_accepted_at
--
--   select table_name, privilege_type,
--          string_agg(column_name, ', ' order by column_name) as columns
--     from information_schema.column_privileges
--    where table_schema = 'public'
--      and table_name in ('users', 'items', 'bentos', 'reports')
--      and grantee = 'authenticated'
--      and privilege_type in ('INSERT', 'UPDATE')
--    group by 1, 2 order by 1, 2;
--
-- 2. Les droits de table. Attendu, pour `anon` comme pour `authenticated` :
--    bentos  · DELETE, REFERENCES, SELECT, TRIGGER, TRUNCATE
--    items   · INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE
--    reports · REFERENCES, SELECT, TRIGGER, TRUNCATE
--    users   · DELETE, REFERENCES, SELECT, TRIGGER, TRUNCATE
--    et aucune ligne pour `user_telemetry`.
--    `DELETE` reste pour supprimer son compte ou son bento, borné par les
--    policies. `REFERENCES`, `TRIGGER` et `TRUNCATE` sont les privilèges par
--    défaut de Supabase, qu'aucune route de l'API n'expose.
--
--   select table_name, grantee,
--          string_agg(privilege_type, ', ' order by privilege_type) as privileges
--     from information_schema.role_table_grants
--    where table_schema = 'public'
--      and table_name in ('users', 'items', 'bentos', 'reports', 'user_telemetry')
--      and grantee in ('anon', 'authenticated')
--    group by 1, 2 order by 1, 2;
--
-- 3. `admin_merge_items` n'est plus exécutable par les clients. Attendu :
--    aucune ligne.
--
--   select grantee from information_schema.routine_privileges
--    where routine_schema = 'public' and routine_name = 'admin_merge_items'
--      and grantee in ('anon', 'authenticated', 'PUBLIC');
--
-- 4. À la clé anonyme, sans rien écrire : les trois colonnes rendent `null`.
--
--   GET /rest/v1/users?select=last_seen_at,platform,app_version&last_seen_at=not.is.null
--   → []
