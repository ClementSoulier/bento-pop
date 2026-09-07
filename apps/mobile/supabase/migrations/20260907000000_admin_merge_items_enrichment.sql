-- Migration : `admin_merge_items` v2, la fusion enrichit le canonique.
--
-- Constat sur le catalogue réel (septembre 2026) : dans plusieurs grappes de
-- doublons, le meilleur canonique (celui qui est référencé dans le plus de
-- bentos) est aussi le plus pauvre — pas d'image, pas d'année, pas de
-- sous-titre — alors qu'un des perdants les portait. La v1 jetait cette
-- donnée : on gardait le bon item mais on perdait son illustration.
--
-- Trois ajouts par rapport à la v1, tout le reste est identique :
--   1. Le canonique hérite des champs qu'il n'a PAS (image + crédit, année,
--      sous-titre) en les prenant sur le perdant le plus ancien qui les a.
--      `image_url` et `image_credit` voyagent ensemble : un crédit attaché à
--      une autre image serait une fausse attribution.
--   2. Les ALIAS des perdants deviennent alias du canonique (la v1 ne
--      reprenait que leurs titres, donc un alias saisi à la main sur un
--      perdant disparaissait de la recherche).
--   3. On n'insère plus le titre d'un perdant comme alias quand il est déjà
--      le titre du canonique à la casse près : c'était du bruit.
--
-- Idempotent, même signature : le BO (`mergeItems`) et le script
-- `catalog-merge.mjs` appellent la fonction sans changement.
--
-- À appliquer sur le projet Supabase mobile via le SQL editor du dashboard.

create or replace function public.admin_merge_items(
  canonical_id uuid,
  loser_ids uuid[]
)
returns void
language plpgsql
as $$
declare
  donor_image record;
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

  -- Étape 2a : hydrater les aliases du canonical avec les titres des losers
  insert into public.item_aliases (item_id, alias)
    select canonical_id, i.title
      from public.items i
     where i.id = any(loser_ids)
       and lower(i.title) is distinct from (
         select lower(c.title) from public.items c where c.id = canonical_id
       )
     on conflict (item_id, alias) do nothing;

  -- Étape 2b : et avec les aliases que les losers portaient déjà
  insert into public.item_aliases (item_id, alias)
    select canonical_id, a.alias
      from public.item_aliases a
     where a.item_id = any(loser_ids)
     on conflict (item_id, alias) do nothing;

  -- Étape 2c : héritage de l'illustration si le canonique n'en a pas.
  -- Le couple (image, crédit) est repris tel quel depuis un seul perdant.
  if (select image_url from public.items where id = canonical_id) is null then
    select i.image_url, i.image_credit
      into donor_image
      from public.items i
     where i.id = any(loser_ids)
       and i.image_url is not null
     order by i.created_at asc
     limit 1;

    if donor_image.image_url is not null then
      update public.items
         set image_url = donor_image.image_url,
             image_credit = donor_image.image_credit
       where id = canonical_id;
    end if;
  end if;

  -- Étape 2d : héritage des métadonnées manquantes, champ par champ
  -- (une année peut venir d'un perdant et le sous-titre d'un autre).
  update public.items c
     set year = coalesce(
           c.year,
           (select l.year from public.items l
             where l.id = any(loser_ids) and l.year is not null
             order by l.created_at asc limit 1)
         ),
         subtitle = coalesce(
           c.subtitle,
           (select l.subtitle from public.items l
             where l.id = any(loser_ids)
               and l.subtitle is not null
               and btrim(l.subtitle) <> ''
             order by l.created_at asc limit 1)
         )
   where c.id = canonical_id;

  -- Étape 3 : marquer les losers comme mergés
  update public.items
     set status = 'merged',
         merged_into_id = canonical_id
   where id = any(loser_ids);
end;
$$;

comment on function public.admin_merge_items(uuid, uuid[]) is
  'Fusionne plusieurs items (losers) dans un canonical. Transactionnel : '
  'réécrit bento_items, reprend titres ET alias des losers, fait hériter le '
  'canonical de l''image/crédit/année/sous-titre qui lui manquent, puis passe '
  'les losers en status=merged. À n''appeler que depuis le BO admin '
  '(service-role) — l''anon/authenticated n''a pas l''UPDATE policy sur items.';
