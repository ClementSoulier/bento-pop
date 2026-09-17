-- Données de départ pour la recette du chantier 13, sur le Supabase LOCAL.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/seed-editions-local.sql
--
-- ⚠️ **Local seulement.** Le script refuse de s'exécuter si la base porte des
-- données de production, et ce contrôle est la première chose qu'il fait.
--
-- Contrairement à `check-editions.sql`, celui-ci **ne s'annule pas** : il
-- laisse de quoi recetter. Rejouable : il efface d'abord ses propres
-- éditions, reconnues à leur préfixe `rec-`.
--
-- Ce qu'il pose, et pourquoi chaque édition existe :
--
--   rec-deux    2 cases, sortie      la disposition la plus éloignée des six
--   rec-trois   3 cases, sortie      une question longue en rangée à deux
--   rec-six     6 cases, sortie      la rangée à trois, intitulés courts
--   rec-avenir  1 case,  programmée  doit rester invisible de l'app
--
-- Les items viennent du catalogue existant : le script ne crée aucun item,
-- pour que la recherche dans l'app rende ce qu'elle rendrait vraiment.

do $$
declare
  v_type_film   smallint;
  v_type_serie  smallint;
  v_type_son    smallint;
  v_type_lieu   smallint;
  v_type_perso  smallint;
  v_deux  smallint;
  v_trois smallint;
  v_six   smallint;
  v_avenir smallint;
  v_n int;
begin
  -- ── Garde-fou : jamais ailleurs qu'en local ─────────────────────────
  --
  -- Un pseudo de production suffit à reconnaître la vraie base. La liste
  -- vient des comptes de l'équipe, qui n'existent que là-bas.
  select count(*) into v_n
  from public.users
  where lower(pseudo) in ('dark_hifus', 'keremasan', 'ondella', 'godjiz');
  if v_n > 0 then
    raise exception
      'Base de PRODUCTION détectée (% pseudo(s) de l''équipe). Ce script est réservé au Supabase local.', v_n;
  end if;

  select id into v_type_film  from public.item_types where key = 'film';
  select id into v_type_serie from public.item_types where key = 'series';
  select id into v_type_son   from public.item_types where key = 'song';
  select id into v_type_lieu  from public.item_types where key = 'place';
  select id into v_type_perso from public.item_types where key = 'person';

  -- ── Nettoyage de ses propres éditions ───────────────────────────────
  delete from public.bento_categories
   where edition_id in (select id from public.editions where slug like 'rec-%');
  delete from public.bentos
   where edition_id in (select id from public.editions where slug like 'rec-%');
  delete from public.editions where slug like 'rec-%';

  -- ── 2 cases, sortie ─────────────────────────────────────────────────
  -- Deux bandes pleine largeur, 280 et 184. La disposition la plus loin de
  -- la boîte habituelle : c'est celle où une divergence de géométrie se
  -- verrait le plus.
  insert into public.editions (slug, title, released_at)
  values ('rec-deux', 'Le duel du samedi', now() - interval '2 days')
  returning id into v_deux;

  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('rec2_1', 'Film pleurer', 'Le film qui t’a fait pleurer', 'FILM', 'm', 1, 'admin', v_type_film, v_deux),
    ('rec2_2', 'Film rire',    'Celui qui t’a fait rire',      'FILM', 'm', 2, 'admin', v_type_film, v_deux);

  -- ── 3 cases, sortie ─────────────────────────────────────────────────
  -- Une vedette de 220 puis une paire de 244. Les deux cases du bas font
  -- 136,5 points utiles : une question y tient, et c'est ce qu'on vérifie.
  insert into public.editions (slug, title, released_at)
  values ('rec-trois', 'La semaine du film qui pique', now() - interval '1 day')
  returning id into v_trois;

  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('rec3_1', 'Film surcoté', 'Le film que tu trouves surcoté', 'FILM',  'm', 1, 'admin', v_type_film,  v_trois),
    ('rec3_2', 'Série cachée', 'La série que tu caches',         'SÉRIE', 'f', 2, 'admin', v_type_serie, v_trois),
    ('rec3_3', 'Son de l''été', 'Le son de ton été',             'SON',   'm', 3, 'admin', v_type_son,   v_trois);

  -- ── 6 cases, sortie ─────────────────────────────────────────────────
  -- La boîte du bento principal, avec des cases d'édition : c'est le cas qui
  -- prouve que le dessin n'a pas bougé. De vraies questions, courtes en
  -- rangée à trois, qui n'offre que 81 points utiles : toutes passent la règle
  -- du back-office, « Ton voyage rêvé » de justesse. Ce sont elles que
  -- l'étiquette d'une case remplie affiche depuis la proposition A.
  insert into public.editions (slug, title, released_at)
  values ('rec-six', 'Le grand inventaire', now() - interval '3 hours')
  returning id into v_six;

  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('rec6_1', 'Film ce soir', 'Le film que tu reverrais ce soir', 'FILM',  'm', 1, 'admin', v_type_film,  v_six),
    ('rec6_2', 'Série cachée', 'La série que tu caches',           'SÉRIE', 'f', 2, 'admin', v_type_serie, v_six),
    ('rec6_3', 'Son été',      'Le son de ton été',                'SON',   'm', 3, 'admin', v_type_son,   v_six),
    ('rec6_4', 'Voyage',       'Ton voyage rêvé',                  'LIEU',  'm', 4, 'admin', v_type_lieu,  v_six),
    ('rec6_5', 'Idole',        'Ton idole d’ado',                  'STAR',  'f', 5, 'admin', v_type_perso, v_six),
    ('rec6_6', 'Film doudou',  'Ton film doudou',                  'FILM',  'm', 6, 'admin', v_type_film,  v_six);

  -- ── 1 case, programmée : doit rester invisible ──────────────────────
  -- Une seule case, donc hors des dispositions dessinées. Si elle
  -- apparaissait malgré tout, la boîte ne saurait pas la dessiner : le
  -- double défaut se verrait d'un coup.
  insert into public.editions (slug, title, released_at)
  values ('rec-avenir', 'Celle qu''on ne doit pas voir', now() + interval '10 days')
  returning id into v_avenir;

  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('recA_1', 'Secret', 'Ceci ne doit pas s''afficher', 'FILM', 'm', 1, 'admin', v_type_film, v_avenir);

  raise notice '════ 4 éditions posées : rec-deux (2), rec-trois (3), rec-six (6), rec-avenir (programmée) ════';
end $$;

-- Ce que l'app doit voir, à vérifier avant de lancer la recette :
--   trois éditions, jamais rec-avenir
select slug, title, released_at, (select count(*) from public.bento_categories c where c.edition_id = e.id) as cases
from public.editions e
where e.released_at is not null and e.released_at <= now()
order by e.released_at desc;
