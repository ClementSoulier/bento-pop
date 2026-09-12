-- Migration : propositions par défaut à l'ouverture de la recherche d'item.
--
-- Alimente le bloc « AU MENU » de `app/search-modal.tsx`, qui remplace
-- l'écran vide « Tape pour chercher » (chantier 3, cf.
-- `docs/UX-03-RECHERCHE-ITEM.md`).
--
-- Les agrégats PostgREST sont désactivés sur ce projet (`PGRST123`), donc
-- un `count` groupé côté client est impossible : la fonction SQL n'est pas
-- un confort, c'est la seule voie.
--
-- À appliquer à la main dans le SQL editor du dashboard du projet mobile
-- (`ggjgktbcqumfxrixcdyx`) : il n'y a pas de lanceur de migrations.

-- ─── popular_items ────────────────────────────────────────────────────
--
-- Renvoie les items validés d'une catégorie, les plus choisis d'abord.
--
-- ── Sur le classement ──
-- Au 12 septembre 2026, le signal de popularité est quasi nul : sur 26
-- bentos publiés, au plus 3 items par catégorie ont été choisis plus d'une
-- fois, et zéro pour « Chanson ». Le tri est donc surtout porté par ses
-- critères de départage, et c'est assumé : l'appelant affiche un
-- échantillon du catalogue, pas un palmarès (d'où le libellé « AU MENU »
-- côté app, cf. la décision D2 de la spec). Le classement devient
-- informatif tout seul à mesure que la base grossit, sans changement ici.
--
-- ── Sur les quatre niveaux de tri ──
--   1. picks desc                      le vrai signal, quand il existe
--   2. (image_url is not null) desc    une grille d'affiches sans affiche
--                                      est laide ; ce critère fait passer
--                                      « Chanson » de 35 % d'items avec
--                                      image à 10 sur 12 dans le top
--   3. created_at desc                 les entrées récentes du catalogue
--   4. id                              départage stable. Sans lui, deux
--                                      appels successifs peuvent renvoyer
--                                      un ordre différent sur des items
--                                      importés dans la même transaction,
--                                      ce qui casse les tests et le cache
--                                      d'images côté client
--
-- ── Sur la sécurité ──
-- `security invoker` (le défaut) : la RLS `bento_items_read_published` et
-- `items_read_validated_or_own_pending` s'appliquent. La règle de
-- visibilité reste à un seul endroit, plutôt que recopiée dans une
-- fonction `definer` où elle pourrait diverger.
--
-- Le filtre `b.published_at is not null` est malgré tout écrit
-- explicitement, parce que la policy dit « publié OU le mien » : sans lui,
-- un utilisateur connecté verrait son propre brouillon compté dans le
-- classement, le résultat différerait d'une personne à l'autre, et il ne
-- serait donc ni testable ni cachable. Avec, l'intersection avec la RLS
-- vaut exactement « bentos publiés », identique pour tout le monde.
--
-- ── Sur la performance ──
-- Le coût est le sous-plan RLS sur `bento_items`, un `exists` par ligne.
-- 156 lignes aujourd'hui, donc négligeable. Seuil de réexamen posé à
-- 50 000 lignes (~8 000 bentos publiés) : à ce moment une vue
-- matérialisée devient le bon outil, sans changer cette signature.
-- Objectif de latence : sous 150 ms à chaud, contre ~80 ms mesurés pour
-- `search_items`.
create or replace function public.popular_items(
  category_key text,
  lim int default 12,
  exclude_item uuid default null
)
returns table (
  id uuid,
  title text,
  subtitle text,
  year int,
  image_url text,
  image_credit text,
  picks int
)
language sql
stable
as $$
  with cat as (
    select id from public.bento_categories
    where key = category_key and is_active = true
    limit 1
  ),
  tally as (
    select bi.item_id, count(*)::int as n
    from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id
    where b.published_at is not null
    group by bi.item_id
  )
  select
    i.id,
    i.title,
    i.subtitle,
    i.year,
    i.image_url,
    i.image_credit,
    coalesce(t.n, 0) as picks
  from public.items i
  left join tally t on t.item_id = i.id
  where i.category_id = (select id from cat)
    and i.status = 'validated'
    and (exclude_item is null or i.id <> exclude_item)
  order by
    coalesce(t.n, 0) desc,
    (i.image_url is not null) desc,
    i.created_at desc,
    i.id
  limit lim;
$$;

comment on function public.popular_items(text, int, uuid) is
  'Propositions par défaut de la recherche d''item : catalogue validé '
  'd''une catégorie, les plus choisis d''abord, items avec image en '
  'priorité. Compte uniquement les bentos publiés, donc identique pour '
  'tous les appelants. Cf. docs/UX-03-RECHERCHE-ITEM.md §6.1.';

-- ─── Grant ────────────────────────────────────────────────────────────
-- PostgREST n'expose une fonction qu'aux rôles qui ont explicitement
-- EXECUTE dessus. `anon` en plus de `authenticated` : l'app tourne en
-- anonymous sign-in, et la recette derrière le proxy n'a aucune session.
grant execute on function public.popular_items(text, int, uuid)
  to anon, authenticated;
