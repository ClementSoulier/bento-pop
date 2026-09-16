-- ─────────────────────────────────────────────────────────────────────────
-- Plusieurs bentos par compte, étape 1 sur 2 : les colonnes, rien d'autre
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 16, lot 1. Cf. `docs/UX-16-PLUSIEURS-BENTOS.md`.
--
-- ─── Pourquoi deux migrations, et pourquoi celle-ci ne casse rien ────────
--
-- Lever `bentos_user_id_key` change la forme des réponses de PostgREST. C'est
-- mesuré, et c'est contre-intuitif : dès que la contrainte unique sur
-- `user_id` devient partielle, PostgREST cesse de voir la relation
-- `users -> bentos` comme un un-à-un et la rend en TABLEAU, **même si aucun
-- compte n'a deux bentos**. Toute app déjà installée lit alors
-- `.published_at` sur un tableau, obtient `undefined`, et affiche « rien en
-- ligne » sur toutes les pages publiques.
--
-- Cette migration-ci ne touche donc pas à la contrainte : elle n'ajoute que
-- des colonnes. Vérifié sur le Supabase local, après application :
--
--   select conname from pg_constraint
--    where conrelid = 'public.bentos'::regclass and contype = 'u';
--   -- bentos_user_id_key  ← toujours là
--   -- bentos_user_slug
--
--   GET /rest/v1/users?select=pseudo,bentos(id,published_at)&pseudo=eq.<x>
--   -- "bentos" revient en OBJET, comme avant
--
-- Elle est donc invisible pour les apps en circulation et peut s'appliquer
-- immédiatement. C'est la migration `2026xxxx_bentos_lift_unique.sql`, écrite
-- au lot 2, qui portera la bascule, et elle n'est appliquée qu'une fois la
-- build du lot 1 adoptée.
--
-- ─── Le modèle ───────────────────────────────────────────────────────────
--
--   slug        adresse publique du bento, unique par compte. TOUT bento en a
--               une, les existants compris : `/u/<pseudo>/<slug>`.
--   is_primary  le bento que `/u/<pseudo>` met en avant. Au plus un par
--               compte ; tant que `bentos_user_id_key` existe, la garantie
--               est portée par elle, ensuite par l'index partiel du lot 2.

alter table public.bentos add column slug text;
alter table public.bentos add column is_primary boolean not null default false;

-- Rétroactif. `bentos_user_id_key` est encore en place au moment où ceci
-- s'exécute, donc chaque compte a au plus un bento : les marquer tous
-- principaux ne peut pas créer de doublon. Les brouillons sont inclus, un
-- bento non publié étant le principal de son compte tout autant qu'un autre.
update public.bentos set slug = 'mon-bento', is_primary = true;

alter table public.bentos alter column slug set not null;

-- Même esprit que `pseudo_format` sur `public.users` : la forme est tenue par
-- la base, pas seulement par le client. 3 à 40 caractères, minuscules,
-- chiffres et tirets, ni tiret en tête ni en queue, donc rien qui demande un
-- encodage dans une URL.
alter table public.bentos add constraint bentos_slug_format
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

-- Deux bentos d'un même compte ne peuvent pas partager une adresse. Deux
-- comptes différents le peuvent : l'adresse complète porte le pseudo.
alter table public.bentos add constraint bentos_user_slug unique (user_id, slug);

-- ─── Droits ──────────────────────────────────────────────────────────────
--
-- Lecture seulement. `20260913200000_bentos_column_privileges.sql` a réduit
-- l'écriture du client à `published_at`, et `20260915000000_close_privilege_
-- gaps.sql` l'insertion à `user_id` : ces deux colonnes restent hors de sa
-- portée, volontairement.
--
-- Un `grant insert (slug)` laisserait n'importe qui choisir l'adresse d'un de
-- ses bentos, sans passer par le contrôle des slugs réservés ; un
-- `grant update (is_primary)` laisserait déplacer la mise en avant. La
-- création d'un bento secondaire passera par `public.create_bento(...)`,
-- `security definer`, écrite au lot 2.
grant select (slug, is_primary) on public.bentos to anon, authenticated;

comment on column public.bentos.slug is
  'Adresse publique du bento, unique par compte : /u/<pseudo>/<slug>. Écrite par service_role ou par create_bento() uniquement. Cf. chantier 16.';

comment on column public.bentos.is_primary is
  'Le bento mis en avant par /u/<pseudo>. Au plus un par compte. Écrit par service_role uniquement. Cf. chantier 16.';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. La contrainte historique est intacte, donc rien ne change pour les apps
--    en circulation. Doit rendre `bentos_user_id_key` ET `bentos_user_slug`.
--
--   select conname from pg_constraint
--    where conrelid = 'public.bentos'::regclass and contype = 'u'
--    order by conname;
--
-- 2. Chaque bento est principal et porte une adresse. Doit rendre 0.
--
--   select count(*) from public.bentos
--    where slug is null or is_primary is not true;
--
-- 3. Le client ne peut toujours écrire que `user_id` et `published_at`.
--    Doit rendre exactement ces deux lignes.
--
--   select grantee, privilege_type, column_name
--     from information_schema.column_privileges
--    where table_name = 'bentos'
--      and grantee in ('anon', 'authenticated')
--      and privilege_type in ('INSERT', 'UPDATE')
--    order by grantee, privilege_type, column_name;

-- ─────────────────────────────────────────────────────────────────────────
-- La purge de la landing vise les deux adresses d'un bento
-- ─────────────────────────────────────────────────────────────────────────
--
-- `revalidate_landing_bento` (20260911000000) résolvait le compte en un
-- pseudo et purgeait `/u/<pseudo>`. Un bento a désormais deux adresses : celle
-- du compte, quand il en est le principal, et la sienne, `/u/<pseudo>/<slug>`.
-- Purger la première seulement laisserait la seconde périmée jusqu'à cinq
-- minutes.
--
-- Les deux sont envoyées sans condition : `revalidatePath` sur un chemin sans
-- entrée de cache ne coûte rien, et le cas « ce bento vient de devenir le
-- principal » demanderait sinon de savoir ce qu'il était avant.
--
-- Le reste de la fonction est repris tel quel, y compris le filtre sur UPDATE
-- et le `exception when others` qui garantit qu'une landing injoignable
-- n'empêche jamais une publication.
create or replace function public.revalidate_landing_bento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     record;
  v_pseudo  text;
  v_base    text;
  v_token   text;
begin
  v_row := coalesce(new, old);

  if tg_op = 'UPDATE'
     and new.published_at is not distinct from old.published_at
     and new.is_featured  is not distinct from old.is_featured then
    return v_row;
  end if;

  select lower(u.pseudo) into v_pseudo
  from public.users u
  where u.id = v_row.user_id;

  if v_pseudo is null then
    return v_row;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'landing_base_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'landing_revalidate_token';

  if v_base is null or v_token is null then
    return v_row;
  end if;

  perform net.http_post(
    url     := v_base || '/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object(
      'paths', jsonb_build_array(
        '/u/' || v_pseudo,
        '/u/' || v_pseudo || '/' || v_row.slug,
        -- Le sitemap ne liste que les bentos mis en avant : un
        -- basculement de `is_featured` doit l'y faire entrer ou sortir.
        '/sitemap.xml'
      )
    ),
    timeout_milliseconds := 3000
  );

  return v_row;

exception when others then
  -- Jamais au détriment de l'utilisateur : une landing injoignable, une
  -- extension absente ou un secret mal formé ne doivent pas empêcher la
  -- publication d'un bento.
  return coalesce(new, old);
end;
$$;

-- ─── Contrôle ────────────────────────────────────────────────────────────
-- La fonction doit nommer les deux adresses. Doit rendre `true`.
--
--   select prosrc like '%|| v_row.slug%'
--     from pg_proc where proname = 'revalidate_landing_bento';
