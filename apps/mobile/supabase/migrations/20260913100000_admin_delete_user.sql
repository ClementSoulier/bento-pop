-- Migration : suppression d'un profil avec trace, en une transaction.
--
-- Le registre RGPD et la suppression doivent être **indissociables**. Les
-- enchaîner depuis le back-office, en deux appels PostgREST, laisse deux
-- fenêtres d'incohérence :
--
--   - registre écrit puis suppression échouée → une trace de suppression
--     pour quelqu'un qui existe toujours ;
--   - suppression réussie puis registre échoué → un compte effacé sans
--     trace, ce qui est précisément ce que le registre doit empêcher.
--
-- Une fonction plpgsql fait les deux dans la même transaction : soit les
-- deux, soit aucun. Reste hors transaction la suppression du compte
-- `auth.users`, qui passe par l'API d'administration et ne peut pas y
-- entrer ; c'est assumé, et l'ordre choisi côté serveur fait qu'un échec y
-- laisse au pire un compte sans profil, invisible et sans donnée.
--
-- À appliquer à la main dans le SQL editor du projet mobile.

create or replace function public.admin_delete_user(
  target_id uuid,
  reason text,
  admin_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  -- `for update` : verrouille la ligne pour la durée de la transaction, ce
  -- qui évite que deux administrateurs supprimant le même profil au même
  -- moment n'écrivent deux entrées de registre.
  select kind into v_kind
  from public.users
  where id = target_id
  for update;

  if v_kind is null then
    raise exception 'Profil introuvable.' using errcode = 'P0002';
  end if;

  insert into public.user_deletions (deleted_user_id, kind, reason, deleted_by)
  values (target_id, v_kind, reason, admin_email);

  -- Cascade vers bentos puis bento_items.
  delete from public.users where id = target_id;

  return v_kind;
end;
$$;

comment on function public.admin_delete_user(uuid, text, text) is
  'Supprime un profil et écrit son entrée de registre dans la même '
  'transaction. Renvoie le type du profil supprimé, dont l''appelant a '
  'besoin pour savoir s''il doit aussi supprimer un compte auth. '
  'Cf. docs/UX-14-BACK-OFFICE-UTILISATEURS.md §5.3.';

-- Réservée au service-role.
--
-- `revoke ... from public` **ne suffit pas** : Supabase accorde `execute` aux
-- rôles `anon` et `authenticated` par des privilèges par défaut, et ces
-- droits survivent au revoke sur `public`. Constaté sur
-- `purge_user_deletions` lors de la migration précédente, où la fonction
-- restait appelable avec la clé anonyme. Ici la conséquence serait bien
-- pire : n'importe qui pourrait supprimer n'importe quel compte.
revoke all on function public.admin_delete_user(uuid, text, text) from public;
revoke all on function public.admin_delete_user(uuid, text, text) from anon;
revoke all on function public.admin_delete_user(uuid, text, text) from authenticated;
