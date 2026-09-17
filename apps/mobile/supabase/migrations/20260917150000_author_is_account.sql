-- ─────────────────────────────────────────────────────────────────────────
-- L'auteur d'une proposition, et le propriétaire d'un appareil : le compte
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 17, lot 2 (D13). Cf. `docs/UX-17-NOTIFICATIONS-PUSH.md`.
--
-- ─── Le défaut ───────────────────────────────────────────────────────────
--
-- Depuis le chantier 9, le profil (`public.users`) ne naît qu'à la première
-- publication, par `publish_first_bento`. Or `items.submitted_by` pointait
-- sur `public.users` : un nouvel utilisateur ne pouvait donc pas proposer un
-- item avant de publier, ni publier un bento dont un item manque au
-- catalogue. Mesuré sur la base locale le 17 septembre 2026 :
--
--   insert or update on table "items" violates foreign key constraint
--   "items_submitted_by_fkey" (23503)
--
-- Le même refus attendait l'enregistrement d'un appareil, que le lot 2
-- demande juste après une proposition (D5).
--
-- Les versions publiées n'ont pas ce défaut : la 1.1 et la 0.1.0 créent le
-- profil avant de composer.
--
-- ─── La sortie ───────────────────────────────────────────────────────────
--
-- Les deux clés pointent sur `auth.users`, qui existe dès l'ouverture de
-- l'app par `signInAnonymously`. Un profil porte l'identifiant de son compte :
-- rien ne change pour un compte qui en a un.
--
-- Supprimer un profil effaçait l'auteur de ses propositions, par la clé
-- (`on delete set null`). Un déclencheur sur `public.users` garde exactement
-- ce comportement, et efface aussi les appareils du compte.
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- Mesuré en production le 17 septembre 2026, en lecture seule : 146 items ont
-- un auteur et tous ont un compte d'authentification, aucun profil n'est sans
-- compte. La nouvelle clé se valide donc sur les données existantes. La 1.1 et
-- la 0.1.0 proposent toujours avec un profil, dont l'identifiant est celui du
-- compte. Contrôles 8, 10 et 11 de `scripts/check-push.sql`.

-- ─── 1. L'auteur d'une proposition ───────────────────────────────────────

alter table public.items
  drop constraint if exists items_submitted_by_fkey;

alter table public.items
  add constraint items_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

-- ─── 2. Le propriétaire d'un appareil ────────────────────────────────────

alter table public.push_tokens
  drop constraint if exists push_tokens_user_id_fkey;

alter table public.push_tokens
  add constraint push_tokens_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ─── 3. Supprimer un profil efface toujours ses traces ───────────────────
--
-- Ce que la clé vers `public.users` faisait d'elle-même, et ce qu'on attend
-- d'une suppression de compte (chantier 14) : les propositions perdent leur
-- auteur, les appareils ne reçoivent plus rien.

create or replace function public.users_forget_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.items set submitted_by = null where submitted_by = old.id;
  delete from public.push_tokens where user_id = old.id;
  return old;
end;
$$;

revoke all on function public.users_forget_author() from public, anon, authenticated;

drop trigger if exists users_forget_author on public.users;
create trigger users_forget_author
  after delete on public.users
  for each row execute function public.users_forget_author();
