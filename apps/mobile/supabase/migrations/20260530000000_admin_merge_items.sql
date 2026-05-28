-- Migration : fonction de fusion d'items côté admin.
--
-- `admin_merge_items(canonical_id, loser_ids[])` fait, en une transaction :
--   1. Réécrit `bento_items.item_id` des losers → canonical_id, pour que
--      les utilisateurs qui pointaient vers un loser voient désormais le
--      canonical de manière transparente (aucun ré-hydrate nécessaire).
--   2. Insère les titres des losers comme aliases du canonical, pour que
--      la recherche fuzzy continue à matcher (« La Guerre des Étoiles »
--      retombe sur « Star Wars »).
--   3. Marque les losers `status='merged' + merged_into_id`. Ils sortent
--      automatiquement de la recherche publique (RLS filtre validated +
--      own pending) sans qu'on ait à les supprimer.
--
-- Conflits gérés :
--   - Si un bento_item existe déjà pour (bento_id, canonical_id) côté
--     destinataire (i.e. le user avait DÉJÀ le canonical ET un loser),
--     on supprime simplement le loser pour ne pas violer la PK composite
--     `(bento_id, category_id)`.
--   - Alias en doublon : ON CONFLICT DO NOTHING sur (item_id, alias).
--
-- Pas SECURITY DEFINER : on s'appuie sur le fait que seul service-role
-- (BO admin) appelle cette fonction. Les anon/authenticated n'ont pas
-- l'UPDATE policy sur items donc l'appel échouerait pour eux.

create or replace function public.admin_merge_items(
  canonical_id uuid,
  loser_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  conflicting_bentos uuid[];
begin
  if canonical_id = any(loser_ids) then
    raise exception 'canonical_id ne peut pas figurer dans loser_ids';
  end if;
  if array_length(loser_ids, 1) is null then
    return; -- rien à merger
  end if;

  -- Étape 1a : repérer les bentos qui auraient déjà le canonical ET un
  -- loser dans la même catégorie. Pour ces conflits, on doit supprimer
  -- la ligne loser AVANT le UPDATE sinon on viole la PK composite
  -- (bento_id, category_id).
  delete from public.bento_items
   where item_id = any(loser_ids)
     and bento_id in (
       select bento_id from public.bento_items
        where item_id = canonical_id
     );

  -- Étape 1b : réécriture des bento_items restants
  update public.bento_items
     set item_id = canonical_id
   where item_id = any(loser_ids);

  -- Étape 2 : hydrater les aliases du canonical avec les titres des losers
  insert into public.item_aliases (item_id, alias)
    select canonical_id, title
      from public.items
     where id = any(loser_ids)
     on conflict (item_id, alias) do nothing;

  -- Étape 3 : marquer les losers comme mergés
  update public.items
     set status = 'merged',
         merged_into_id = canonical_id
   where id = any(loser_ids);
end;
$$;

comment on function public.admin_merge_items(uuid, uuid[]) is
  'Fusionne plusieurs items (losers) dans un canonical. Transactionnel : '
  'réécrit bento_items, hydrate item_aliases, marque losers status=merged. '
  'À n''appeler que depuis le BO admin (service-role) — l''anon/authenticated '
  'n''a pas l''UPDATE policy sur items.';
