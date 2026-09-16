-- ─────────────────────────────────────────────────────────────────────────
-- Éditions hebdomadaires : un modèle de bento, et des cases qui le décrivent
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 13, lot 1. Cf. `docs/UX-13-BENTO-HEBDOMADAIRE.md` §5.1 et §6.1.
--
-- ─── Ce que la roadmap croyait bloquant, et qui ne l'est pas ──────────────
--
-- « La PK `(bento_id, category_id)` interdit deux cases du même type dans une
-- édition. » C'était vrai jusqu'au chantier 15, qui a séparé le type d'un
-- élément de la case qui l'accueille en donnant un `type_id` à chaque case.
-- `bento_categories` est depuis **la table des cases** : deux cases « film »
-- sont deux lignes portant le même `type_id`, et la clé primaire dit déjà
-- « un item par case ». `bento_items` n'est donc pas touchée ici, ni en
-- colonne, ni en clé, ni en contrainte.
--
-- ─── Ce que cette migration ajoute ───────────────────────────────────────
--
-- Une table d'éditions, quatre colonnes sur la table des cases, une colonne
-- sur `bentos`. Tout est additif : aucune version déployée ne voit quoi que
-- ce soit tant que l'équipe n'a pas créé d'édition.
--
-- ⚠️ Elle corrige aussi deux défauts d'un code déjà écrit mais jamais
-- appliqué, cf. sections 5 et 6. Sans eux, la première édition créée casse
-- l'inscription.

-- ─── 1. Les éditions ──────────────────────────────────────────────────────
--
-- `released_at` porte à la fois la date de sortie et le fait d'être sortie :
-- nul, l'édition est un brouillon que personne ne voit. Pas de colonne de
-- statut à tenir cohérente avec la date, il n'y en aurait qu'une de trop.
--
-- Montrer à partir d'une date est un filtre de lecture, pas un ordonnanceur :
-- `pg_cron` n'est pas installé et n'a pas à l'être. Prévenir à cette heure-là
-- est un autre sujet, c'est le chantier 17.
create table public.editions (
  id smallint primary key generated always as identity,
  -- Même forme que `bentos_slug_format` : le slug de l'édition devient celui
  -- du bento de chaque personne qui la compose.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title text not null check (length(btrim(title)) between 1 and 80),
  released_at timestamptz,
  -- Réservé au chantier 19, lire une édition liée à une émission. Aucun
  -- client ne le lit, aucune contrainte ne le vise : il est là pour que la
  -- colonne n'arrive pas après les données.
  show_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger editions_touch_updated_at
  before update on public.editions
  for each row execute function public.touch_updated_at();

alter table public.editions enable row level security;

-- Sorties seulement. Une édition programmée est invisible **en base**, et non
-- masquée par un écran : c'est ce qui rend vraie la promesse d'annoncer la
-- suivante sans la dévoiler.
create policy "editions_read_released"
  on public.editions
  for select
  using (released_at is not null and released_at <= now());

-- Écrites par le seul back-office, en service-role. Même régime que
-- `item_types` et `bento_categories` (`20260915100000:65, 108`).
revoke insert, update, delete on public.editions from anon, authenticated;

comment on table public.editions is
  'Une édition hebdomadaire : un titre, une adresse, une date de sortie. '
  'Modèle de bento, elle ne porte aucun item. `released_at` nul = brouillon, '
  'invisible des clients. Cf. docs/UX-13-BENTO-HEBDOMADAIRE.md.';

comment on column public.editions.released_at is
  'Date de sortie, heure de Paris à la saisie. Nul tant que l''édition est un '
  'brouillon. La visibilité se lit, elle ne se déclenche pas.';

-- ─── 2. Les cases d'une édition ───────────────────────────────────────────
--
-- Quatre colonnes sur la table des cases. `display_order` existe déjà et
-- sert de rang dans la boîte, y compris pour une édition : inutile d'ajouter
-- une `position` qui dirait la même chose, et qui serait en plus un nom de
-- fonction Postgres.
--
-- Pourquoi `prompt` en plus de `label_fr`, qui existe. Les deux ne disent pas
-- la même chose, et la base le prouve : `label_fr` vaut « Artiste musical »
-- et « Lieu de voyage » quand l'app affiche « Artiste » et « Lieu »
-- (`packages/supabase-mobile/src/bento.ts:71-76`). Le premier est le mot du
-- back-office, utile pour distinguer deux cases de type Personne ; le second
-- est ce que lit l'utilisateur. Les confondre obligerait à sacrifier l'un des
-- deux. `prompt` porte donc ce qui s'affiche, et pour une édition c'est la
-- question : « Le film qui t'a fait pleurer ».
alter table public.bento_categories
  add column edition_id smallint references public.editions(id) on delete cascade,
  add column prompt text,
  add column stamp text,
  add column gender text check (gender in ('m', 'f'));

-- Les six cases du bento principal reçoivent exactement les valeurs que l'app
-- compile aujourd'hui. Elle continue de lire ses constantes (chantier 15, D8)
-- : rien ne change à l'écran, et `bento-categories-vs-app.test.ts` échoue si
-- les deux sources divergent un jour.
update public.bento_categories as c
set prompt = v.prompt, stamp = v.stamp, gender = v.gender
from (values
  ('film',    'Film',                'FILM',    'm'),
  ('series',  'Série',               'SÉRIE',   'f'),
  ('artist',  'Artiste',             'ARTISTE', 'm'),
  ('track',   'Chanson',             'SON',     'f'),
  ('creator', 'Créateur de contenu', 'CRÉA',    'm'),
  ('place',   'Lieu',                'LIEU',    'm')
) as v(case_key, prompt, stamp, gender)
where c.key = v.case_key;

-- Posé après le remplissage, pour que la contrainte vaille aussi pour les
-- cases d'édition à venir.
alter table public.bento_categories
  alter column prompt set not null,
  alter column stamp set not null,
  alter column gender set not null;

-- Un rang par case et par édition. Les six du bento principal ont
-- `edition_id` nul, que `unique` ne compare pas : elles gardent leurs rangs
-- 1 à 6 sans contrainte, ce qui est le comportement voulu.
create unique index bento_categories_edition_order
  on public.bento_categories (edition_id, display_order)
  where edition_id is not null;

-- Une édition tient dans la boîte : de 2 à 6 cases, les dispositions dessinées.
alter table public.bento_categories
  add constraint bento_categories_edition_order_range
  check (edition_id is null or display_order between 1 and 6);

-- La lecture publique devient : les six cases du bento principal, plus les
-- cases des seules éditions sorties. Une édition programmée ne laisse donc
-- rien deviner de son contenu.
drop policy if exists "bento_categories_read_active" on public.bento_categories;
create policy "bento_categories_read_active"
  on public.bento_categories
  for select
  using (
    is_active = true
    and (
      edition_id is null
      or exists (
        select 1 from public.editions e
        where e.id = edition_id
          and e.released_at is not null
          and e.released_at <= now()
      )
    )
  );

-- `select` sur les nouvelles colonnes, comme sur les anciennes.
grant select (edition_id, prompt, stamp, gender) on public.bento_categories to anon, authenticated;

comment on table public.bento_categories is
  'Les cases. Celles du bento principal ont `edition_id` nul ; les autres '
  'décrivent une édition hebdomadaire. Chacune a un type (type_id). Le nom de '
  'la table est historique depuis 20260915100000_item_types_and_cases.sql.';

comment on column public.bento_categories.prompt is
  'Ce que lit l''utilisateur : « Film » pour le bento principal, « Le film '
  'qui t''a fait pleurer » pour une édition. Distinct de `label_fr`, qui est '
  'le mot du back-office.';

comment on column public.bento_categories.stamp is
  'Tampon court de la tuile pleine, capitales. Vient du type, pas de la '
  'question : FILM, SÉRIE, JEU.';

comment on column public.bento_categories.gender is
  'Genre grammatical de `prompt`, pour accorder « Cherche un film » et '
  '« Cherche une série ». Propriété du mot, pas de l''écran qui l''emploie.';

-- ─── 3. Un bento peut appartenir à une édition ───────────────────────────
--
-- Un bento d'édition est un bento secondaire comme un autre : il hérite de
-- son adresse, de sa place dans le fil, du partage, du signalement ciblé et
-- de l'export, tous construits au chantier 16.
alter table public.bentos
  add column edition_id smallint references public.editions(id) on delete set null;

-- Un seul bento par personne et par édition. Rien n'est dit des bentos
-- libres, dont `edition_id` est nul.
create unique index bentos_one_per_edition
  on public.bentos (user_id, edition_id)
  where edition_id is not null;

-- Hors des droits colonne du client, comme `slug` et `is_primary` : seule
-- `create_edition_bento` l'écrit.
grant select (edition_id) on public.bentos to anon, authenticated;

comment on column public.bentos.edition_id is
  'L''édition que ce bento compose, ou nul pour un bento libre. Écrit par la '
  'seule fonction create_edition_bento.';

-- ─── 4. ⚠️ Correctif : la complétude comptait les cases d'édition ────────
--
-- `publish_first_bento` refusait une publication dont le nombre de cases
-- n'égalait pas `count(*) from bento_categories where is_active`. Avec des
-- cases d'édition dans la même table, ce compte enfle : **la première
-- publication de tout nouveau compte serait refusée dès la première édition
-- créée**, avec le message « Un bento se publie complet ».
--
-- Le contrôle ne vise que le bento principal, il compte donc les seules cases
-- du bento principal. Cf. `20260916180000_publish_first_bento.sql:82`.
create or replace function public.publish_first_bento(
  p_pseudo text,
  p_terms_accepted_at timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_bento uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour publier.' using errcode = '42501';
  end if;

  if exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Ce compte a déjà un profil.' using errcode = '23505';
  end if;

  if p_pseudo is null or p_pseudo !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Pseudo invalide : 3 à 20 caractères, lettres, chiffres, points et underscores.'
      using errcode = '22023';
  end if;

  if p_terms_accepted_at is null then
    raise exception 'Les conditions d''utilisation doivent être acceptées.' using errcode = '42501';
  end if;

  select count(*) into v_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  -- `edition_id is null` : le chemin du premier bento ne concerne que le
  -- bento principal, donc ses six cases et elles seules.
  if v_count <> (select count(*) from public.bento_categories
                  where is_active and edition_id is null) then
    raise exception 'Un bento se publie complet.' using errcode = '22023';
  end if;

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_uid, p_pseudo, least(p_terms_accepted_at, now()));

  insert into public.bentos (user_id, published_at)
  values (v_uid, now())
  returning id into v_bento;

  insert into public.bento_items (bento_id, category_id, item_id)
  select v_bento, (e ->> 'category_id')::smallint, (e ->> 'item_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_bento;

exception when unique_violation then
  raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
end;
$$;

-- ─── 5. ⚠️ Correctif : le plafond de bentos, et l'adresse des éditions ───
--
-- Deux défauts de `create_bento`, tels que `20260916140000_bentos_lift_unique.sql`
-- l'a écrite. Aucun des deux n'a jamais tourné en production, et tous deux
-- vivent dans le corps de la fonction : un `create or replace` suffit, la
-- migration B n'est pas touchée.
--
-- **Le plafond.** Son propre commentaire le condamne : « 20 est large pour
-- l'usage prévu, une édition par semaine ». Une édition par semaine, avec les
-- éditions passées qui restent composables, atteint 20 en vingt semaines.
-- Le plafond ne compte donc plus que les bentos **libres**, ceux que la
-- personne crée elle-même. Les bentos d'édition sont bornés autrement, et
-- mieux : `bentos_one_per_edition` en autorise un par édition, et il n'existe
-- que les éditions que l'équipe publie.
--
-- **L'adresse.** Le slug d'un bento d'édition est celui de son édition. Si
-- quelqu'un prend « semaine-38 » pour un bento libre, sa composition de
-- l'édition du même nom échouerait sur `bentos_user_slug`. La liste en dur ne
-- pouvait pas le prévoir : on interroge donc `editions`, ce qui réserve
-- exactement les adresses concernées, présentes et futures.
create or replace function public.create_bento(p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_count int;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour créer un bento.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Choisis d''abord un pseudo.' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Adresse invalide : 3 à 40 caractères, minuscules, chiffres et tirets.'
      using errcode = '22023';
  end if;

  -- Routes de convention Next, plus les adresses gardées pour les chantiers
  -- 13 et 21. Cf. `20260916140000_bentos_lift_unique.sql:82-93`.
  if p_slug in (
    'opengraph-image', 'twitter-image', 'icon', 'apple-icon', 'sitemap', 'robots',
    'tous', 'edit', 'new', 'api', 'admin', 'settings'
  ) then
    raise exception 'Cette adresse est réservée.' using errcode = '22023';
  end if;

  -- Toutes les éditions, y compris celles qui ne sont pas encore sorties :
  -- c'est en `security definer` que cette lecture se fait, donc la RLS ne la
  -- limite pas, et une édition programmée doit être réservée avant sa sortie.
  if exists (select 1 from public.editions e where e.slug = p_slug) then
    raise exception 'Cette adresse est réservée.' using errcode = '22023';
  end if;

  -- Ne compte que les bentos libres : une édition composée n'entame pas le
  -- quota de quelqu'un qui joue le jeu chaque semaine.
  select count(*) into v_count
  from public.bentos b
  where b.user_id = v_uid and b.edition_id is null;
  if v_count >= 20 then
    raise exception 'Tu as atteint la limite de bentos pour ce compte.' using errcode = '22023';
  end if;

  insert into public.bentos (user_id, slug, is_primary)
  values (v_uid, p_slug, false)
  returning id into v_id;

  return v_id;

exception when unique_violation then
  raise exception 'Tu as déjà un bento à cette adresse.' using errcode = '23505';
end;
$$;

comment on function public.create_bento(text) is
  'Crée un bento LIBRE pour auth.uid(), toujours non principal. Le plafond de '
  '20 ne compte que les bentos libres ; les bentos d''édition passent par '
  'create_edition_bento. Refuse les adresses réservées et celles des éditions.';

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- Les huit contrôles de `apps/mobile/scripts/check-editions.sql`, dans une
-- transaction annulée. Ils couvrent notamment les deux correctifs ci-dessus,
-- qu'aucun test d'application ne verrait.
