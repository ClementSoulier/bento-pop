-- ─────────────────────────────────────────────────────────────────────────
-- Signaux de retour : le compteur de visites, et la date de première
-- publication qui sert au rappel
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 8, lot 1. Cf. `docs/UX-08-SIGNAUX-DE-RETOUR.md` §6.1.
--
-- ─── Le problème ─────────────────────────────────────────────────────────
--
-- Rien ne compte une ouverture de bento, nulle part : la page web est
-- statique et régénérée toutes les 5 minutes, et l'app n'envoie rien. Et
-- rien ne distingue un bento jamais publié d'un bento dépublié, ce que le
-- rappel du lot 4 doit savoir (D1, D16).
--
-- ─── La forme ────────────────────────────────────────────────────────────
--
-- Une visite, c'est l'affichage de la page d'un bento publié (D2) : une par
-- compte et par jour dans l'app, une par empreinte et par jour sur le web
-- (D6, D13). L'identité du visiteur ne se garde jamais : elle se hache avec
-- un sel tiré chaque jour, et la purge de la nuit efface le sel et les clés
-- du jour passé. Ne restent que des nombres, par bento, par jour et par
-- source. Le lendemain, plus rien ne relie une visite à quelqu'un.
--
-- Trois tables, qu'aucun client ne lit, et trois fonctions publiques :
--
--   1. `record_bento_visit_app`, pour un compte connecté, anonyme compris ;
--   2. `record_bento_visit_web`, pour la seule landing, qui détient le secret
--      du coffre `bento_visit_secret` (D15) ;
--   3. `bento_visit_count`, que tout le monde lit (D3), sauf quand le
--      propriétaire masque ses visites (`users.show_visits`, D9).
--
-- ─── Compatibilité avec la 1.1 et la 0.1.0 ───────────────────────────────
--
-- Elles lisent `bentos` par des listes de colonnes, jamais `select('*')` :
-- `first_published_at` leur reste invisible, et leur publication, une mise à
-- jour de `published_at`, la pose sans rien changer d'autre. Le profil de la
-- 1.1 lit `users` en `select('*')` : il reçoit `show_visits`, que son code
-- ne lit pas. Leurs écritures sur `users` (pseudo, CGU, télémétrie) sont
-- inchangées, et ni les tables ni les fonctions de visites n'existaient pour
-- elles. Contrôles dans `scripts/check-visits.sql` et
-- `scripts/check-privileges.ts`.

-- ─── 1. La date de première publication (D16) ────────────────────────────
--
-- La dépublication remet `published_at` à nul : seule cette colonne dit
-- qu'un bento non publié l'a déjà été. Posée par un déclencheur, jamais par
-- un client, les droits colonne n'accordant que `published_at`.

alter table public.bentos
  add column if not exists first_published_at timestamptz;

comment on column public.bentos.first_published_at is
  'Chantier 8 : la première date à laquelle ce bento a été publié, gardée '
  'quand il est dépublié. Posée par le déclencheur '
  '`bentos_set_first_published_at`. Aucun client ne l''écrit.';

-- Le rattrapage, exact : aucune version publiée ne sait dépublier, la
-- fonction étant arrivée le 13 septembre 2026 après la 1.1 du 7, et le
-- back-office ne dépublie pas. Un bento non publié aujourd'hui ne l'a donc
-- jamais été. `bentos_touch_updated_at` est suspendu le temps du
-- rattrapage : sans quoi tous les bentos en ligne prendraient la date de
-- cette migration pour dernière modification. Les deux autres déclencheurs
-- de la table ne réagissent qu'à `published_at` et `is_featured`, que cette
-- mise à jour ne touche pas.

alter table public.bentos disable trigger bentos_touch_updated_at;

update public.bentos
set first_published_at = published_at
where published_at is not null
  and first_published_at is null;

alter table public.bentos enable trigger bentos_touch_updated_at;

create or replace function public.set_first_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published_at is not null and new.first_published_at is null then
    new.first_published_at := new.published_at;
  end if;
  return new;
end;
$$;

revoke all on function public.set_first_published_at() from public, anon, authenticated;

-- À l'insertion aussi : le back-office et `publish_first_bento` créent des
-- bentos déjà publiés.
drop trigger if exists bentos_set_first_published_at on public.bentos;
create trigger bentos_set_first_published_at
  before insert or update of published_at on public.bentos
  for each row execute function public.set_first_published_at();

-- ─── 2. Masquer ses visites (D9) ─────────────────────────────────────────
--
-- Un réglage par compte, allumé par défaut. Éteint, seul le propriétaire
-- voit son compteur ; les visites continuent de se compter. Écrit par son
-- propriétaire seulement : la politique `users_update_own` ne laisse
-- modifier que sa propre ligne.

alter table public.users
  add column if not exists show_visits boolean not null default true;

comment on column public.users.show_visits is
  'Chantier 8 : vrai si les autres voient le compteur de visites des bentos '
  'de ce compte. Éteint, seul le propriétaire le voit.';

grant update (show_visits) on public.users to authenticated;

-- ─── 3. Les visites ──────────────────────────────────────────────────────

-- Le sel du jour, tiré à la première visite du jour, effacé par la purge de
-- la nuit suivante. Sans lui, une clé de la veille ne se recalcule plus.
create table if not exists public.visit_salts (
  day date primary key,
  salt bytea not null
);

comment on table public.visit_salts is
  'Chantier 8 : un sel aléatoire par jour, qui hache l''identité des '
  'visiteurs. Effacé la nuit suivante par `bento_visit_purge`.';

-- Le dédoublonnage du jour : une ligne par visiteur haché et par bento.
-- `key_hash` est un SHA-256, jamais une identité en clair.
create table if not exists public.bento_visit_keys (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  day date not null,
  key_hash bytea not null,
  primary key (bento_id, day, key_hash)
);

comment on table public.bento_visit_keys is
  'Chantier 8 : qui a déjà compté aujourd''hui, haché avec le sel du jour. '
  'Effacé la nuit suivante par `bento_visit_purge`.';

-- Ce qui reste : un nombre par bento, par jour et par source. La source
-- distingue l'app du web, pour lire d'où viennent les visites.
create table if not exists public.bento_visit_days (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  day date not null,
  source text not null check (source in ('app', 'web')),
  visits int not null default 0 check (visits >= 0),
  primary key (bento_id, day, source)
);

comment on table public.bento_visit_days is
  'Chantier 8 : le nombre de visites d''un bento, par jour et par source '
  '(`app` ou `web`). Seule trace gardée des visites.';

-- Aucun client ne lit ni n'écrit ces tables : tout passe par les fonctions
-- de la section 5. La RLS sans politique ferme tout, le retrait des droits
-- le dit une seconde fois.
alter table public.visit_salts enable row level security;
alter table public.bento_visit_keys enable row level security;
alter table public.bento_visit_days enable row level security;
revoke all on public.visit_salts from anon, authenticated;
revoke all on public.bento_visit_keys from anon, authenticated;
revoke all on public.bento_visit_days from anon, authenticated;

-- ─── 4. Les fonctions internes ───────────────────────────────────────────
--
-- Sans `security definer` : elles ne s'appellent que depuis les fonctions
-- publiques, qui le sont, ou depuis `pg_cron`. Aucun client ne les exécute.

-- Le jour des visites est celui de Paris : une visite à 0 h 30 compte pour
-- le jour qui commence, comme le lira l'équipe.
create or replace function public.visit_day()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

create or replace function public.visit_salt(p_day date)
returns bytea
language plpgsql
set search_path = ''
as $$
declare
  v_salt bytea;
begin
  -- Deux premières visites simultanées : une seule insertion gagne, et les
  -- deux relisent le même sel.
  insert into public.visit_salts (day, salt)
  values (p_day, extensions.gen_random_bytes(32))
  on conflict (day) do nothing;

  select s.salt into v_salt from public.visit_salts s where s.day = p_day;
  return v_salt;
end;
$$;

-- Compte une visite si ce visiteur n'a pas déjà compté aujourd'hui pour ce
-- bento. La source entre dans le hachage : un compte et une empreinte ne se
-- confondent jamais.
create or replace function public.count_bento_visit(p_bento uuid, p_identity text, p_source text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_day date := public.visit_day();
begin
  insert into public.bento_visit_keys (bento_id, day, key_hash)
  values (
    p_bento,
    v_day,
    extensions.digest(
      public.visit_salt(v_day) || convert_to(p_source || ':' || p_identity, 'UTF8'),
      'sha256'
    )
  )
  on conflict do nothing;

  if found then
    insert into public.bento_visit_days as d (bento_id, day, source, visits)
    values (p_bento, v_day, p_source, 1)
    on conflict (bento_id, day, source)
    do update set visits = d.visits + 1;
  end if;
end;
$$;

-- Le compteur tel que l'appelant a le droit de le voir : toujours pour le
-- propriétaire ; pour les autres, seulement sur un bento publié dont le
-- propriétaire montre ses visites. Nul sinon, et pour un bento inconnu.
create or replace function public.bento_visits_visible(p_bento uuid)
returns int
language plpgsql
stable
set search_path = ''
as $$
declare
  v_owner     uuid;
  v_published timestamptz;
  v_show      boolean;
begin
  select b.user_id, b.published_at, u.show_visits
  into v_owner, v_published, v_show
  from public.bentos b
  join public.users u on u.id = b.user_id
  where b.id = p_bento;

  if not found then
    return null;
  end if;

  if v_owner is distinct from auth.uid() and (v_published is null or not v_show) then
    return null;
  end if;

  return coalesce(
    (select sum(d.visits) from public.bento_visit_days d where d.bento_id = p_bento),
    0
  )::int;
end;
$$;

revoke all on function public.visit_day() from public, anon, authenticated;
revoke all on function public.visit_salt(date) from public, anon, authenticated;
revoke all on function public.count_bento_visit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.bento_visits_visible(uuid) from public, anon, authenticated;

-- ─── 5. Les fonctions publiques ──────────────────────────────────────────

-- Une page ouverte dans l'app. Ne compte que sur un bento publié, et jamais
-- pour son propriétaire (D2). Rend le compteur visible par l'appelant.
create or replace function public.record_bento_visit_app(p_bento uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_published timestamptz;
begin
  if v_uid is null then
    raise exception 'Une visite d''app demande une session.'
      using errcode = '42501';
  end if;

  select b.user_id, b.published_at into v_owner, v_published
  from public.bentos b
  where b.id = p_bento;

  if found and v_published is not null and v_owner <> v_uid then
    perform public.count_bento_visit(p_bento, v_uid::text, 'app');
  end if;

  return public.bento_visits_visible(p_bento);
end;
$$;

-- Une page ouverte dans un navigateur. Seule la route de la landing connaît
-- le secret : la clé anonyme, dans chaque copie de l'app, ne suffit pas à
-- gonfler un compteur (D15). L'empreinte est l'adresse IP et le navigateur,
-- assemblés par la landing ; elle n'est jamais gardée.
create or replace function public.record_bento_visit_web(
  p_bento uuid,
  p_fingerprint text,
  p_secret text
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected  text;
  v_published timestamptz;
begin
  select s.decrypted_secret into v_expected
  from vault.decrypted_secrets s
  where s.name = 'bento_visit_secret';

  -- Une erreur à part pour un secret absent du coffre : la landing la
  -- journalise, et l'on voit qu'il manque une mise en service plutôt qu'un
  -- secret faux.
  if v_expected is null then
    raise exception 'Le comptage web attend le secret bento_visit_secret.'
      using errcode = '55000';
  end if;

  -- Comparés hachés : la durée de la comparaison ne dit rien du secret.
  if p_secret is null
     or extensions.digest(p_secret, 'sha256') <> extensions.digest(v_expected, 'sha256') then
    raise exception 'Secret refusé.' using errcode = '42501';
  end if;

  if p_fingerprint is null or length(p_fingerprint) = 0 or length(p_fingerprint) > 1024 then
    raise exception 'Empreinte invalide.' using errcode = '22023';
  end if;

  select b.published_at into v_published
  from public.bentos b
  where b.id = p_bento;

  if found and v_published is not null then
    perform public.count_bento_visit(p_bento, p_fingerprint, 'web');
  end if;

  return public.bento_visits_visible(p_bento);
end;
$$;

-- Le compteur, pour la page d'un bento et pour le profil (D3).
create or replace function public.bento_visit_count(p_bento uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select public.bento_visits_visible(p_bento);
$$;

revoke all on function public.record_bento_visit_app(uuid) from public, anon, authenticated;
revoke all on function public.record_bento_visit_web(uuid, text, text) from public, anon, authenticated;
revoke all on function public.bento_visit_count(uuid) from public, anon, authenticated;

grant execute on function public.record_bento_visit_app(uuid) to authenticated;
grant execute on function public.record_bento_visit_web(uuid, text, text) to anon;
grant execute on function public.bento_visit_count(uuid) to anon, authenticated;

comment on function public.record_bento_visit_app(uuid) is
  'Chantier 8 : compte une visite d''app, une par compte, par jour et par '
  'bento publié, jamais pour son propriétaire. Rend le compteur visible par '
  'l''appelant, ou nul.';
comment on function public.record_bento_visit_web(uuid, text, text) is
  'Chantier 8 : compte une visite web, une par empreinte, par jour et par '
  'bento publié. Réservée à la landing, qui détient `bento_visit_secret`. '
  'Rend le compteur visible, ou nul.';
comment on function public.bento_visit_count(uuid) is
  'Chantier 8 : le compteur de visites d''un bento, ou nul si l''appelant '
  'n''a pas le droit de le voir.';

-- ─── 6. Masquer ses visites rafraîchit la page web ───────────────────────
--
-- La page web est statique pendant 5 minutes et porte le chiffre de son
-- dernier rendu : sans revalidation, un compteur masqué y resterait lisible
-- jusque-là. Le gabarit de `revalidate_landing_bento`, pour chaque bento
-- publié du compte ; échec silencieux, comme lui.

create or replace function public.revalidate_landing_visits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paths jsonb;
  v_base  text;
  v_token text;
begin
  if new.show_visits is not distinct from old.show_visits then
    return new;
  end if;

  select jsonb_agg(distinct p.path) into v_paths
  from public.bentos b
  cross join lateral (
    values ('/u/' || lower(new.pseudo)), ('/u/' || lower(new.pseudo) || '/' || b.slug)
  ) as p(path)
  where b.user_id = new.id
    and b.published_at is not null;

  if v_paths is null then
    return new;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'landing_base_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'landing_revalidate_token';

  if v_base is null or v_token is null then
    return new;
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

  return new;

exception when others then
  -- Jamais au détriment du réglage : la landing rattrapera au plus tard à la
  -- régénération suivante, 5 minutes après.
  return new;
end;
$$;

revoke all on function public.revalidate_landing_visits() from public, anon, authenticated;

drop trigger if exists users_revalidate_landing_visits on public.users;
create trigger users_revalidate_landing_visits
  after update of show_visits on public.users
  for each row execute function public.revalidate_landing_visits();

-- ─── 7. La purge de la nuit ──────────────────────────────────────────────
--
-- Efface les clés et les sels des jours passés. Seuls les nombres restent.
-- Sans `security definer` : seul `pg_cron` l'appelle.

create or replace function public.bento_visit_purge()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.bento_visit_keys where day < public.visit_day();
  delete from public.visit_salts where day < public.visit_day();
end;
$$;

revoke all on function public.bento_visit_purge() from public, anon, authenticated;

-- 3 h 40 UTC, après minuit à Paris toute l'année : le jour des visites a
-- déjà changé. `cron.schedule` remplace un travail du même nom.
select cron.schedule('visits-purge', '40 3 * * *', 'select public.bento_visit_purge()');

-- ─── Contrôle ────────────────────────────────────────────────────────────
-- Sur le Supabase local, après application :
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-visits.sql
--
-- Mise en service du comptage web, en production, par Clément (D8) :
--
--   select vault.create_secret('<le secret>', 'bento_visit_secret');
--
-- et la même valeur dans `BENTO_VISIT_SECRET`, sur l'app landing de Coolify,
-- au runtime.
