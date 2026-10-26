-- ─────────────────────────────────────────────────────────────────────────
-- Supprimer son compte depuis l'app, compte d'authentification compris
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 28, D8. Cf. `docs/UX-28-COMPTE-RECUPERABLE.md` §6.1.
--
-- ─── Le défaut ───────────────────────────────────────────────────────────
--
-- L'app supprime un compte en supprimant sa ligne de `public.users`, par la
-- règle `users_delete_own` : bentos, cases et anciens pseudos partent avec
-- elle, mais la ligne d'`auth.users` reste, et rien n'entre au registre.
-- Mesuré en production le 26 octobre 2026 : 9 comptes sans profil ni
-- session, très probablement ces suppressions.
--
-- Tant que les comptes sont anonymes, ce reste ne porte rien. Dès qu'une
-- adresse email s'y rattache, il la garderait : l'adresse survivrait à la
-- suppression demandée, et s'en servir pour se reconnecter rouvrirait un
-- compte vide.
--
-- ─── La sortie ───────────────────────────────────────────────────────────
--
-- `delete_own_account()` fait tout, pour le compte appelant, en une
-- transaction : l'entrée au registre puis le profil, comme
-- `admin_delete_user` pour le back-office, puis la ligne d'`auth.users`.
--
-- Mesuré en production le 26 octobre 2026, en lecture seule : toutes les
-- clés qui pointent sur `auth.users` suivent sa suppression. Identités,
-- sessions, jetons et facteurs du schéma `auth` partent en cascade, comme
-- les appareils (`push_tokens_user_id_fkey`) ; les propositions d'items
-- perdent leur auteur (`items_submitted_by_fkey`, `on delete set null`).
-- `postgres`, propriétaire des fonctions, a le droit de supprimer dans
-- `auth.users`.
--
-- Un compte sans profil, celui qu'un téléphone neuf abandonne en retrouvant
-- l'ancien (D2), n'a que sa ligne d'`auth.users` à perdre, et rien à
-- inscrire : le registre suit les profils.
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- Une fonction en plus, que la 1.1 et la 0.1.0 n'appellent pas : elles
-- suppriment toujours par `users_delete_own`, comme avant.
--
-- À appliquer à la main dans l'éditeur SQL du projet mobile.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_kind text;
begin
  if v_user is null then
    raise exception 'Aucun compte connecté.' using errcode = '42501';
  end if;

  -- `for update` : deux appels partis ensemble, un double tap, n'écrivent
  -- qu'une entrée au registre. Le second ne trouve plus de profil.
  select kind into v_kind
  from public.users
  where id = v_user
  for update;

  if v_kind is not null then
    insert into public.user_deletions (deleted_user_id, kind, reason, deleted_by)
    values (v_user, v_kind, 'Supprimé depuis l''app', 'app');

    -- Cascade vers bentos, cases et anciens pseudos ; le déclencheur
    -- `users_forget_author` efface l'auteur des propositions et les
    -- appareils.
    delete from public.users where id = v_user;
  end if;

  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.delete_own_account() is
  'Supprime le compte appelant : entrée au registre et profil s''il en a '
  'un, puis la ligne d''auth.users, identités et adresse comprises, en une '
  'transaction. Chantier 28, D8. '
  'Cf. docs/UX-28-COMPTE-RECUPERABLE.md §6.1.';
