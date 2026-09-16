-- ─────────────────────────────────────────────────────────────────────────
-- Purger la landing quand une édition change de titre ou de sortie
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 13, lot 5. Reporté du lot 1 volontairement : l'écrire là-bas
-- aurait dupliqué la logique de coffre et de `net.http_post` de
-- `20260916120000_bentos_slug_and_primary.sql`, avant même que le titre
-- d'une édition ne s'affiche quelque part.
--
-- ─── Le problème ─────────────────────────────────────────────────────────
--
-- Depuis ce lot, la page publique d'un bento d'édition affiche le titre de
-- son édition, et son aperçu de lien aussi. Ces pages sont servies depuis le
-- cache de la landing, purgé par le déclencheur `bentos_revalidate_landing`
-- quand un bento est publié. **Modifier une édition ne touche aucun bento**,
-- donc rien ne purge, et l'ancien titre reste servi jusqu'à la prochaine
-- publication de chaque personne. C'est-à-dire, en pratique, pour toujours.
--
-- ─── La sortie ───────────────────────────────────────────────────────────
--
-- Un déclencheur sur `editions` qui purge les pages de tous les bentos
-- publiés de cette édition. Une seule requête HTTP, quel qu'en soit le
-- nombre : `net.http_post` prend une liste de chemins.
--
-- Le corps reprend celui du déclencheur de bento, secrets de coffre compris.
-- Recopier n'est pas idéal, mais factoriser demanderait une fonction qui
-- prend une liste de chemins et que les deux appelleraient, donc de réécrire
-- un déclencheur appliqué en production pour un gain de lisibilité. À faire
-- quand une troisième purge apparaîtra.

create or replace function public.revalidate_landing_edition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row    record;
  v_base   text;
  v_token  text;
  v_paths  jsonb;
begin
  v_row := coalesce(new, old);

  -- Ni le titre ni la sortie n'ont bougé : rien à purger. Une mise à jour de
  -- `updated_at` seule ne doit pas déclencher d'appel réseau.
  if tg_op = 'UPDATE'
     and new.title       is not distinct from old.title
     and new.slug        is not distinct from old.slug
     and new.released_at is not distinct from old.released_at then
    return v_row;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'landing_base_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'landing_revalidate_token';

  if v_base is null or v_token is null then
    return v_row;
  end if;

  -- Les deux adresses de chaque bento publié de cette édition : la page du
  -- compte, qui met en avant le principal, et celle du bento lui-même.
  select jsonb_agg(chemin) into v_paths
  from (
    select '/u/' || lower(u.pseudo) as chemin
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.edition_id = v_row.id and b.published_at is not null
    union
    select '/u/' || lower(u.pseudo) || '/' || b.slug
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.edition_id = v_row.id and b.published_at is not null
  ) as chemins;

  -- Aucun bento publié : l'édition vient d'être créée ou personne ne l'a
  -- encore composée. Rien à purger, et surtout pas d'appel à vide.
  if v_paths is null then
    return v_row;
  end if;

  perform net.http_post(
    url     := v_base || '/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object('paths', v_paths),
    timeout_milliseconds := 3000
  );

  return v_row;

exception when others then
  -- Jamais au détriment de l'équipe : une landing injoignable ou un secret
  -- mal formé ne doit pas empêcher de corriger le titre d'une édition.
  return coalesce(new, old);
end;
$$;

drop trigger if exists editions_revalidate_landing on public.editions;
create trigger editions_revalidate_landing
  after insert or update or delete on public.editions
  for each row execute function public.revalidate_landing_edition();

comment on function public.revalidate_landing_edition() is
  'Purge la landing pour tous les bentos publiés d''une édition dont le titre, '
  'l''adresse ou la sortie a changé. Asynchrone via pg_net, silencieuse en cas '
  'd''échec. Cf. docs/UX-13-BENTO-HEBDOMADAIRE.md lot 5.';

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. Le déclencheur existe et vise les trois opérations :
--
--   select tgname, tgtype from pg_trigger where tgname = 'editions_revalidate_landing';
--
-- 2. Sans secret de coffre, une mise à jour ne lève pas :
--
--   begin;
--     update public.editions set title = title || ' !' where id = (select min(id) from public.editions);
--   rollback;
--
-- 3. Cf. le contrôle 9 de `apps/mobile/scripts/check-editions.sql`.
