-- Correctif de données : les sous-titres hérités des anciens imports.
--
-- Projet Supabase mobile `ggjgktbcqumfxrixcdyx`, table `public.items`. Ce
-- n'est pas une migration : aucun schéma ne change, et ces identifiants
-- n'existent qu'en production. Seule la colonne `subtitle` change, sur
-- 55 items. Aucune ligne n'est supprimée.
--
-- Relevé le 17 septembre 2026 sur `bento-pop.com/u/dark_hifus` : la case
-- Artiste de 浦沢直樹 affiche « JP · Person ». Inventaire en lecture seule le
-- même jour (GET PostgREST, clé anonyme) : 25 des 48 artistes portent le
-- format brut de MusicBrainz, en anglais, sur 19 des 27 bentos publiés. Les
-- autres cases n'ont pas ce défaut, mais quatre descriptions Wikidata de
-- créateurs parlent d'autre chose, et l'année des chansons est souvent celle
-- d'une réédition. Détail et règle : `docs/MON-BENTO-POP-CATALOG.md`, §11.
--
-- Arbitré par Clément le 17 septembre 2026 :
--   - Artistes (25) : un rôle court en français, au format des créateurs
--     (« rappeur français »), vide quand il n'est pas sûr (5).
--   - Créateurs (5) : les 4 descriptions hors sujet vidées, une casse corrigée.
--   - Chansons (23) : l'artiste seul, sans l'année.
--   - Lieux (2) : « États-Unis d'Amérique » devient « États-Unis ».
--   - Films et séries : rien ne change.
--
-- Mode d'emploi. Une requête par exécution, dans le SQL editor du projet ou
-- par le serveur MCP : l'éditeur n'affiche que le résultat de la dernière.
--   1. Requête A, lecture seule. Attendu : 55 lignes `validated`. Une ligne
--      d'un autre statut est hors liste, et B n'y touche pas.
--   2. Requête B, telle quelle. Elle rend une ligne par item de la liste,
--      « écrit » ou « ignoré » avec le sous-titre trouvé. Elle n'écrit que si
--      le sous-titre est encore celui de l'inventaire : une retouche faite
--      entre-temps au back-office n'est jamais écrasée.
--   3. Requête A de nouveau. Attendu : plus aucune ligne `validated`.
--   Retour arrière : requête B avec `annuler` à `true`. Elle ne restaure que
--   les sous-titres encore égaux à ce qu'elle avait écrit.
--
-- Déclencheurs de `items` relus : `items_touch_lifecycle_on_update` n'agit
-- que sur un changement de statut, `items_set_type_from_case` et
-- `items_zz_check_type_change` que sur `category_id` et `type_id`. Rien ne
-- prévient la landing : ses pages `/u/<pseudo>` se régénèrent seules
-- (`revalidate = 300`).
--
-- Éprouvé le 17 septembre 2026 sur le Supabase local construit depuis les
-- migrations, dans une transaction annulée, avec les 55 items et leurs
-- sous-titres de production : A les rend tous, plus un doublon fusionné
-- laissé hors liste ; B en écrit 54 et ignore celui qu'une retouche simulée
-- avait changé, sans toucher aucune autre colonne ; relancée, B n'écrit plus
-- rien ; annulée, elle rend les valeurs d'origine à l'identique.
--
-- Appliqué en production le 17 septembre 2026, par le serveur MCP, sur le feu
-- vert de Clément. A a rendu les 55 items `validated` et un doublon « Daft
-- Punk » au statut `merged`, au même sous-titre anglais, laissé tel quel
-- puisqu'il ne s'affiche nulle part. B a écrit les 55 items, sans en ignorer
-- aucun. A relancée n'a plus rendu que ce doublon.

-- ─── A. Aperçu et contrôle, lecture seule ────────────────────────────
select
  t.key as type,
  i.status,
  i.title,
  i.subtitle,
  (select count(*)
     from public.bento_items bi
     join public.bentos b on b.id = bi.bento_id
    where bi.item_id = i.id
      and b.published_at is not null) as cases_publiees,
  i.id
from public.items i
join public.item_types t on t.id = i.type_id
where
  -- Artistes : « pays · type · précision » de MusicBrainz, en anglais.
  i.subtitle ~ '^([A-Z]{2} · )?(Person|Group|Orchestra|Choir|Character|Other)( · |$)'
  -- Chansons : « artiste · année ».
  or (t.key = 'song' and i.subtitle ~ ' · [0-9]{4}$')
  -- Lieux : la forme longue.
  or (t.key = 'place' and i.subtitle = 'États-Unis d''Amérique')
  -- Créateurs : quatre descriptions hors sujet et une casse.
  or (t.key = 'person' and i.subtitle in (
      'wrestling term: to attempt a scripted move or spoken line that does not come out as it was originally planned',
      'Streameuse québécoise',
      'prénom masculin',
      'initiale d''un prénom, inconnu ou non-identifiable',
      'pays d''Asie du Sud-Est'
  ))
order by t.key, i.status, i.title;

-- ─── B. Écriture, ou retour arrière ──────────────────────────────────
with reglage(annuler) as (values (false)),
corrections(id, titre, avant, apres) as (
  values
    -- Artistes (25) : un rôle court en français, vide quand il n'est pas sûr.
    ('db49bf63-64a7-40d9-96c4-015e19b50c35'::uuid, '[unknown]'::text, 'XW · Other · Special Purpose Artist – Do not add releases here, if possible.'::text, null::text),
    ('1468990b-523c-41f7-a715-498533aa9285', 'AJ DiSpirito', 'Person', null),
    ('25eeefa8-f7d1-4f14-b752-359a23434caa', 'Alan Lee', 'Person · guest artist on The Umbrellas "Quedate"', null),
    ('916ed190-4756-498e-8563-ccc823b8bafc', 'Beyoncé', 'US · Person', 'chanteuse américaine'),
    ('519cc4c2-65eb-49ff-b09e-66111fe8dd59', 'Daft Punk', 'FR · Group · French electronic duo', 'duo électro français'),
    ('f58254d6-1707-4c76-b454-d396d5e89af3', 'Damso', 'BE · Person · Belgian-Congolese rapper', 'rappeur belgo-congolais'),
    ('2a8c70f3-53f1-4d63-bd21-a82c4d8e1765', 'Daniel Balavoine', 'FR · Person', 'chanteur français'),
    ('6642e5bb-a0ca-4132-8b56-70d3349dbd36', 'GIMS', 'FR · Person · French-Congolese rapper, Maître Gims', 'rappeur et chanteur'),
    ('35e201b0-1b6f-49a8-a508-2f5c2419ac64', 'Hans Zimmer', 'US · Person · German score composer', 'compositeur de films'),
    ('2bd80763-4da0-4ac6-b285-30de35d1cd59', 'Interstate Intercourse', 'Group', null),
    ('99509759-8f08-4d5b-a4d1-c0b3f999bbc5', 'Lady Gaga', 'US · Person', 'chanteuse américaine'),
    ('09b29689-f3db-4210-b9d4-9240a9f3ec30', 'Layne Staley', 'US · Person', 'chanteur américain'),
    ('f7086fb3-6a4d-4bb7-bc60-f7ffbd408662', 'Orelsan', 'FR · Person · French rapper', 'rappeur français'),
    ('ae274021-1d29-45f7-b528-089a315a9dc0', 'PLK', 'FR · Person · French rapper', 'rappeur français'),
    ('75df6621-f99f-403d-b87b-11d0b35819d3', 'Ren', 'GB · Person · British singer, songwriter, producer, rapper, multi-instrumentalist, aka Ren Eryn Gill', 'chanteur britannique'),
    ('9a4b8c0c-420b-4e67-a509-98b051d83005', 'ROSALÍA', 'ES · Person · Spanish singer', 'chanteuse espagnole'),
    ('0c5b2a12-d8f2-4eab-bf30-9eaed90dd2f5', 'Sabrina Carpenter', 'US · Person', 'chanteuse américaine'),
    ('322d7503-b4a4-4e28-8017-d9dd118ea246', 'Stan Lee', 'US · Person · Marvel comics', 'scénariste de comics'),
    ('49bb2b52-1269-4f1a-83fb-6d440d1693d9', 'Tate McRae', 'CA · Person', 'chanteuse canadienne'),
    ('0021d09c-cf3c-47de-ba7a-dac03cba2837', 'Taylor Swift', 'US · Person', 'chanteuse américaine'),
    ('ef64c375-f1b2-4ac6-88f9-404b2519f720', 'Vincent Munier', 'FR · Person', 'photographe animalier'),
    ('d6db77f4-79c5-474b-8c56-cccf8192ec0f', 'Yuston XIII', 'Person', null),
    ('0e969d6d-005e-409c-8a3a-1c78f9b779ce', '浦沢直樹', 'JP · Person', 'mangaka japonais'),
    ('1554e960-114c-496d-858f-2cc55f4a6267', '稲葉曇', 'JP · Person · Vocaloid producer', 'producteur Vocaloid'),
    ('e539d0d6-4051-442e-8fc5-fbc82b24b9ab', '鷺巣詩郎', 'JP · Person · anime & film music composer', 'compositeur japonais'),
    -- Créateurs (5) : descriptions hors sujet vidées, une casse corrigée.
    ('1ece5a21-56eb-4554-a7b3-3fd2a1e9ab69', 'Botch', 'wrestling term: to attempt a scripted move or spoken line that does not come out as it was originally planned', null),
    ('58bfa13a-8595-40c5-b8e7-7dd8a0169955', 'Cocotte', 'Streameuse québécoise', 'streameuse québécoise'),
    ('bb9934cd-2899-4fa6-8647-53d2bfb61255', 'Ego', 'prénom masculin', null),
    ('d3a68a8b-afe4-42c2-9d15-8ca5090311bc', 'J.', 'initiale d''un prénom, inconnu ou non-identifiable', null),
    ('9e823858-1911-4b73-a92a-edf07e2effb0', 'Laos', 'pays d''Asie du Sud-Est', null),
    -- Chansons (23) : l'artiste seul, sans l'année.
    ('f65abf7f-c8d4-4eae-901b-19d97f9174e8', 'A Window to the Past', 'John Williams · 2004', 'John Williams'),
    ('74ff9d44-e252-4070-baa6-04360fd32aac', 'AIZO', 'King Gnu · 2026', 'King Gnu'),
    ('31f6ad48-dccb-48f7-b0e2-df3b7bb73eb0', 'Autotune', 'Damso · 2016', 'Damso'),
    ('63db32b4-b697-4cab-b678-b011bd174098', 'Beat It (Michael Jackson''s Vision)', 'Michael Jackson · 2013', 'Michael Jackson'),
    ('63d33851-64f9-4690-a988-e03171ed6172', 'C‐C‐C', 'Me First and the Gimme Gimmes · 2011', 'Me First and the Gimme Gimmes'),
    ('d24d502d-ef08-4198-bdd2-dc859dd7be1b', 'Copine', 'PLK · 2018', 'PLK'),
    ('c8a2ec30-c8ca-45c7-b2d5-0bf6dd54afac', 'Courez courez', 'OrelSan · 2009', 'OrelSan'),
    ('ba51b0c0-9ccc-4f73-9cb2-811ce3e21235', 'G G. G', 'Il Tuniz · 2007', 'Il Tuniz'),
    ('824bcc4e-67c8-4de1-a391-cb6a8f73b0e2', 'Gogo Gadget', 'Orelsan · 2012', 'Orelsan'),
    ('0a58ed49-a6cb-48b7-965b-5165ccbb3875', 'How To Train Your Dragon', 'John Powell · 2013', 'John Powell'),
    ('21c73bd2-7481-4beb-9a89-1b97a7df3970', 'Jimmy Punchline', 'OrelSan · 2009', 'OrelSan'),
    ('6c6bd591-74b9-4eb6-b602-e75386a4e1eb', 'Lithium', 'Nirvana · 1994', 'Nirvana'),
    ('fb584cec-536d-4603-88a3-7ae91a2e3568', 'Lumière (from Clair Obscur: Expedition 33)', 'Little V. · 2025', 'Little V.'),
    ('1ddf51c0-d85f-40ac-a34b-296e116fd569', 'Megalovania X Megalovania', 'sans undertale · 2018', 'sans undertale'),
    ('a2de63db-d87a-42e7-8127-df596378c40f', 'mia paper planes (larsht_ edit)', 'larsht_ · 2022', 'larsht_'),
    ('8687805d-6627-49c8-b15c-317328f5b394', 'Paper Plane', 'Status Quo · 2001', 'Status Quo'),
    ('ce8acc57-cd3f-4eb2-b99b-ff7cd2d32d81', 'Papercut', 'Linkin Park · 2007', 'Linkin Park'),
    ('3e82ed2e-be7c-48ea-bd77-a0c70aa52eae', 'Taylor Swift - 22 (nxc)', 'dive to the heart · 2022', 'dive to the heart'),
    ('bc68dba5-efbe-41ca-8717-7ffd57fc8347', 'The secret', '未来 · 2002', '未来'),
    ('12d116ee-4b1f-4eea-9f68-047adce961bc', 'Tous les cris les S.O.S.', 'Daniel Balavoine · 2015', 'Daniel Balavoine'),
    ('0f0e75ba-57a6-4875-a207-a2fe0ebf6128', 'Waka Waka Waka', 'Neal Morse · 2009', 'Neal Morse'),
    ('149aa030-73e1-4426-9549-a8dc63855502', 'Y Y Y', 'Thijsenterprise · 2021', 'Thijsenterprise'),
    ('55e93a91-6956-427f-b213-fdfda29a4c79', 'ロストアンブレラ', '稲葉曇 · 2019', '稲葉曇'),
    -- Lieux (2) : la forme courante du pays.
    ('66608894-c9d3-45ce-9293-5cacc6fd23d3', 'Cupertino', 'États-Unis d''Amérique', 'États-Unis'),
    ('b4958972-fab3-450f-94bd-95d4e6578441', 'Los Angeles', 'États-Unis d''Amérique', 'États-Unis')
),
cible as (
  select
    c.id,
    c.titre,
    case when r.annuler then c.apres else c.avant end as attendu,
    case when r.annuler then c.avant else c.apres end as nouveau
  from corrections c
  cross join reglage r
),
ecrits as (
  update public.items i
  set subtitle = cible.nouveau
  from cible
  where i.id = cible.id
    and i.subtitle is not distinct from cible.attendu
  returning i.id
)
select
  case
    when e.id is not null then 'écrit'
    when i.id is null then 'ignoré : item introuvable'
    else 'ignoré : sous-titre trouvé « ' || coalesce(i.subtitle, '(vide)') || ' »'
  end as resultat,
  c.titre,
  c.attendu as avant,
  c.nouveau as apres,
  c.id
from cible c
left join ecrits e on e.id = c.id
left join public.items i on i.id = c.id
order by (e.id is not null), c.titre;
