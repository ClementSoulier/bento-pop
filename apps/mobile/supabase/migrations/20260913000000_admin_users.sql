-- Migration : gestion des utilisateurs depuis le back-office.
--
-- Trois choses, servant les trois besoins du chantier 14
-- (cf. `docs/UX-14-BACK-OFFICE-UTILISATEURS.md`) :
--
--   1. découpler `public.users` de `auth.users`, pour qu'un profil
--      éditorial puisse exister sans compte d'authentification ;
--   2. trois colonnes de télémétrie, écrites par l'app ;
--   3. un registre de suppression, minimal et purgé à 12 mois.
--
-- À appliquer à la main dans le SQL editor du dashboard du projet mobile
-- (`ggjgktbcqumfxrixcdyx`) : il n'y a pas de lanceur de migrations.
--
-- Comptages de référence avant application, à comparer après :
--   auth.users 106 · users 70 · bentos 56 · bento_items 282
--   items 324 · reports 3

-- ─── 0. Un identifiant qui peut se générer seul ───────────────────────
--
-- `users.id` n'avait pas de valeur par défaut : il venait toujours de
-- `auth.uid()`. Un profil éditorial n'a pas de compte, donc personne ne
-- fournit d'identifiant, et l'insertion échouait sur un `23502`.
--
-- Sans risque pour les membres : la valeur par défaut ne s'applique que si
-- la colonne est omise, et un client qui l'omettrait obtiendrait un UUID
-- aléatoire aussitôt rejeté par `users_insert_own`, qui exige
-- `id = auth.uid()`.
alter table public.users alter column id set default gen_random_uuid();

-- ─── 1. Type de profil ────────────────────────────────────────────────
--
-- `member`    : quelqu'un qui a installé l'app et choisi un pseudo.
-- `editorial` : un bento composé par l'équipe pour un créateur invité,
--               rencontré hors de l'app. Sans compte, donc sans moyen de
--               se connecter, et hors des compteurs d'utilisateurs.
alter table public.users
  add column if not exists kind text not null default 'member'
    check (kind in ('member', 'editorial'));

comment on column public.users.kind is
  'member = compte réel avec authentification anonyme. editorial = profil '
  'créé par l''équipe pour un créateur invité, sans compte auth. Ne compte '
  'pas comme utilisateur.';

-- ─── 2. Découplage de auth.users ──────────────────────────────────────
--
-- Pourquoi ce n'est pas dangereux malgré les apparences.
--
-- Créer un compte d'authentification exige un email ou un téléphone :
-- l'API répond « Cannot create a user without either an email or phone ».
-- Un email inventé polluerait le compteur de comptes qu'on veut justement
-- garder propre. Il faut donc pouvoir créer un profil sans compte.
--
-- Dix-sept politiques RLS de ce schéma comparent une colonne à
-- `auth.uid()`. Aucune n'est modifiée ici, parce que **l'invariant qui les
-- fait fonctionner est conservé** : pour un membre, `users.id` reste égal
-- à son `auth.uid()`, ce que `users_insert_own` impose déjà
-- (`with check (id = (select auth.uid()))`). Un profil éditorial reçoit un
-- UUID aléatoire, qui ne peut correspondre à aucun `auth.uid()` : il est
-- donc lisible par tous (`users_read_all` est `using (true)`) et
-- modifiable seulement en service-role. C'est exactement le comportement
-- voulu, obtenu sans toucher à une seule politique.
--
-- Ce qu'on perd : la cascade automatique depuis `auth.users`. C'est
-- assumé. La suppression doit désormais passer par le back-office, qui
-- supprime les deux côtés et enregistre un motif ; une suppression faite
-- ailleurs laisserait un profil orphelin, ce qui se voit dans la liste.
alter table public.users drop constraint if exists users_id_fkey;

-- Un profil éditorial n'a pas de compte, donc personne n'a accepté de CGU
-- en son nom. La contrainte dit l'invariant plutôt que de le confier à la
-- convention.
alter table public.users
  drop constraint if exists users_editorial_has_no_terms;
alter table public.users
  add constraint users_editorial_has_no_terms
    check (kind = 'member' or terms_accepted_at is null);

-- ─── 3. Télémétrie ────────────────────────────────────────────────────
--
-- Écrites par l'app au démarrage, sans blocage ni remontée d'erreur.
--
-- `last_seen_at` existe parce que `auth.users.last_sign_in_at` ne dit rien
-- de la dernière visite : avec l'anonymous sign-in la session persiste et
-- se rafraîchit sans nouvelle connexion. Mesuré sur les 106 comptes,
-- l'écart médian entre création et « dernière connexion » est de 0,0 s, et
-- aucun compte ne dépasse une heure.
--
-- État courant seulement, pas d'historique : on veut la composition du
-- parc, pas sa trajectoire. Une série temporelle est un autre sujet, avec
-- sa rétention et son volume.
alter table public.users
  add column if not exists last_seen_at timestamptz,
  -- Valeur fermée plutôt que texte libre : une faute de frappe côté client
  -- casserait les filtres en silence.
  add column if not exists platform text check (platform in ('ios', 'android')),
  add column if not exists app_version text;

-- Tri par défaut de la liste d'administration.
create index if not exists users_last_seen_idx
  on public.users (last_seen_at desc nulls last);

comment on column public.users.last_seen_at is
  'Dernier démarrage de l''app, écrit par le client. Null tant que la '
  'personne n''a pas ouvert une version instrumentée.';

-- ─── 4. Registre de suppression ───────────────────────────────────────
--
-- Contenu volontairement minimal. Ni pseudo ni nom affiché : ce sont des
-- données personnelles, et les conserver après une suppression demandée
-- irait contre le geste. Conséquence acceptée : une demande de support du
-- type « mon compte @machin a disparu » ne se recoupe plus avec ce
-- registre.
--
-- `deleted_user_id` n'a pas de clé étrangère, et ne peut pas en avoir : la
-- ligne qu'il désigne n'existe plus au moment de l'insertion.
create table if not exists public.user_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null,
  kind text not null check (kind in ('member', 'editorial')),
  reason text not null check (char_length(reason) between 1 and 500),
  deleted_by text not null,
  deleted_at timestamptz not null default now()
);

create index if not exists user_deletions_deleted_at_idx
  on public.user_deletions (deleted_at);

alter table public.user_deletions enable row level security;

-- Aucune policy, volontairement : la table n'est atteignable qu'en
-- service-role. Un registre de suppressions lisible par les clients serait
-- une fuite en soi. Avec la RLS activée et zéro policy, `anon` et
-- `authenticated` obtiennent un résultat vide, pas une erreur.

comment on table public.user_deletions is
  'Registre RGPD des suppressions de compte. Minimal par choix : ni pseudo '
  'ni nom affiché. Purge à 12 mois via purge_user_deletions(). '
  'Cf. docs/UX-14-BACK-OFFICE-UTILISATEURS.md §5.3.';

-- ─── 5. Purge ─────────────────────────────────────────────────────────
--
-- Appelée à l'ouverture de l'écran d'administration plutôt que par une
-- tâche planifiée : le projet n'a pas d'ordonnanceur, et la table grossit
-- de quelques lignes par mois.
--
-- `security definer` avec `search_path` vide : la fonction doit pouvoir
-- écrire dans une table sans policy, et le chemin de recherche figé évite
-- qu'un objet homonyme placé ailleurs ne détourne l'exécution.
create or replace function public.purge_user_deletions()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.user_deletions
    where deleted_at < now() - interval '12 months'
    returning 1
  )
  select count(*)::int from gone;
$$;

comment on function public.purge_user_deletions() is
  'Supprime les entrées du registre de plus de 12 mois et renvoie le '
  'nombre de lignes retirées. Appelée par le back-office.';

-- Retirer le droit d'exécution à tout le monde sauf au service-role.
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` aux
-- rôles `anon` et `authenticated` par des privilèges par défaut, et ces
-- droits-là survivent au revoke sur `public`. Constaté : la fonction
-- répondait 200 avec la clé anonyme, donc n'importe qui pouvait vider le
-- registre d'une fonction `security definer`.
revoke all on function public.purge_user_deletions() from public;
revoke all on function public.purge_user_deletions() from anon;
revoke all on function public.purge_user_deletions() from authenticated;
