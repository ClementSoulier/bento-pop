-- ─────────────────────────────────────────────────────────────────────────
-- Le « pourquoi » par case
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 12, lot 1. Cf. `docs/UX-12-POURQUOI-PAR-CASE.md`, §6 et §11.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `bento_whys` : une phrase par case, facultative, publique une fois le
--      bento publié et l'item de la case validé (D1, D5, D15) ;
--   2. l'interrupteur `app_config.whys_enabled` (D10) ;
--   3. ce que devient un pourquoi quand sa case change (D7), et la fusion
--      des doublons qui ne vide plus de case (D17) ;
--   4. la purge de la page web à chaque écriture d'un pourquoi (D16) ;
--   5. `reports` : la cible `why` (D8) ;
--   6. les fonctions de l'app, seul chemin d'écriture des clients (D2, D3,
--      D5, D18), et l'export (D13).
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent pas la table
-- neuve. Elle n'est liée qu'à `bento_items`, par une seule clé étrangère
-- composée, en cascade : leurs requêtes embarquées ne gagnent aucun chemin,
-- et leur suppression d'une case, comme celle d'un compte, emporte le
-- pourquoi. Leur remplacement d'un item, un `upsert` des trois colonnes,
-- l'efface par le déclencheur de §3. Elles signalent toujours un bento par
-- leur insertion de cinq colonnes. Contrôles de `scripts/check-whys.mjs`.
--
-- ─── Aucune écriture directe ─────────────────────────────────────────────
--
-- Les clients lisent la table par sa règle, quelques colonnes seulement, et
-- n'y écrivent que par `set_bento_why`. Le back-office masque et rétablit
-- par la clé de service.

-- ─── 1. Les pourquoi ─────────────────────────────────────────────────────

create table if not exists public.bento_whys (
  id uuid primary key default gen_random_uuid(),
  bento_id uuid not null,
  category_id smallint not null,
  -- Une ligne, nettoyée par `set_bento_why` (D5).
  body text not null check (char_length(body) between 1 and 120),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  -- Posés par le back-office quand l'équipe masque (D8). Le motif n'est
  -- rendu qu'au propriétaire, par `my_bento_whys`.
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bento_whys_case unique (bento_id, category_id),
  -- La seule clé étrangère (D15), composée et en cascade : vider la case,
  -- supprimer le bento ou le compte emporte le pourquoi, et la table
  -- n'ouvre aucun chemin nouveau entre les tables que les versions publiées
  -- embarquent.
  constraint bento_whys_case_fkey foreign key (bento_id, category_id)
    references public.bento_items (bento_id, category_id)
    on delete cascade on update cascade
);

alter table public.bento_whys enable row level security;
revoke all on public.bento_whys from anon, authenticated;
-- Quelques colonnes, jamais l'état ni le motif : un lecteur ne reçoit que
-- des pourquoi visibles, par la règle ci-dessous.
grant select (id, bento_id, category_id, body, created_at, updated_at)
  on public.bento_whys to anon, authenticated;

comment on table public.bento_whys is
  'Chantier 12 : le pourquoi d''une case, une ligne de 120 caractères au plus '
  '(D5). Écrit par `set_bento_why` ; public une fois le bento publié et l''item '
  'validé ; masqué par le back-office avec un motif que seul le propriétaire '
  'lit, par `my_bento_whys` (D8). Effacé avec sa case, ou quand son item change '
  '(D7).';

-- Le journal du rythme (D18) : une ligne par écriture acceptée, effacée
-- après un jour. Chaque écriture purge une page web : il faut contenir un
-- script.
create table if not exists public.bento_why_writes (
  user_id uuid not null references auth.users(id) on delete cascade,
  written_at timestamptz not null default now()
);

create index if not exists bento_why_writes_user
  on public.bento_why_writes (user_id, written_at);

alter table public.bento_why_writes enable row level security;
revoke all on public.bento_why_writes from anon, authenticated;

comment on table public.bento_why_writes is
  'Chantier 12 (D18) : les écritures de pourquoi de la dernière journée, pour '
  'le rythme de `set_bento_why`. Sans accès client.';

-- ─── 2. L'interrupteur ───────────────────────────────────────────────────

alter table public.app_config
  add column if not exists whys_enabled boolean not null default true;

comment on column public.app_config.whys_enabled is
  'Chantier 12 (D10) : éteint, l''app cache les pourquoi et leur écran, la '
  'base refuse d''en écrire et n''en rend plus aucun, web compris, sans '
  'nouvelle version. Les pourquoi restent stockés.';

-- Ce qu'un lecteur peut voir d'une case : l'interrupteur allumé, le bento
-- publié, l'item de la case validé. En `security definer`, la règle ne
-- dépend pas de celles des tables qu'elle lit.
create or replace function public.why_is_public(p_bento uuid, p_category smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.whys_enabled from public.app_config c where c.id = 1), true)
     and exists (
       select 1
       from public.bento_items bi
       join public.bentos b on b.id = bi.bento_id
       join public.items i on i.id = bi.item_id
       where bi.bento_id = p_bento
         and bi.category_id = p_category
         and b.published_at is not null
         and i.status = 'validated'
     );
$$;

drop policy if exists bento_whys_read_public on public.bento_whys;
create policy bento_whys_read_public on public.bento_whys
  for select to anon, authenticated
  using (status = 'visible' and public.why_is_public(bento_id, category_id));

-- ─── 3. Quand la case change ─────────────────────────────────────────────
--
-- Remplacer l'item d'une case efface son pourquoi : il expliquait l'autre
-- (D7). L'app comme la 1.1 et la 0.1.0 remplacent par une mise à jour de la
-- ligne, d'où un déclencheur plutôt qu'une règle de l'app. Vider la case
-- passe par la cascade de la clé étrangère.

create or replace function public.bento_items_drop_why()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- La fusion de deux doublons garde le pourquoi : c'est le même item (D17).
  if current_setting('bento_pop.merging_items', true) = 'on' then
    return null;
  end if;
  delete from public.bento_whys w
  where w.bento_id = new.bento_id
    and w.category_id = new.category_id;
  return null;
end;
$$;

drop trigger if exists bento_items_drop_why on public.bento_items;
create trigger bento_items_drop_why
  after update of item_id on public.bento_items
  for each row
  when (new.item_id is distinct from old.item_id)
  execute function public.bento_items_drop_why();

-- La fusion (D17). Reprise de `20260907000000_admin_merge_items_enrichment.sql`
-- à deux changements près :
--   - l'étape 1a disparaît : elle supprimait la case d'un doublon dès que le
--     bento tenait l'item gardé dans une AUTRE case, pour éviter un conflit
--     que la clé `(bento_id, category_id)` rend impossible. Une personne
--     choisie comme artiste et comme créateur de contenu, en deux fiches,
--     perdait une case, et son pourquoi avec ;
--   - la réécriture se signale à sa transaction, pour que le déclencheur
--     ci-dessus garde les pourquoi.
-- Même signature, mêmes droits : `create or replace` les conserve.

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

  -- Étape 1 : la réécriture, signalée à la transaction pour que
  -- `bento_items_drop_why` garde les pourquoi (D17). La clé
  -- `(bento_id, category_id)` exclut tout conflit : aucune case n'est
  -- supprimée d'abord.
  perform set_config('bento_pop.merging_items', 'on', true);

  update public.bento_items
     set item_id = canonical_id
   where item_id = any(loser_ids);

  perform set_config('bento_pop.merging_items', 'off', true);

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

-- ─── 4. La page web suit ─────────────────────────────────────────────────
--
-- Écrire, changer, effacer ou masquer un pourquoi purge la page du bento
-- (D16), comme une publication : un pourquoi masqué ne reste pas en ligne
-- le temps du cache. Le gabarit de `revalidate_landing_bento`, asynchrone,
-- et jamais au détriment de l'écriture.

create or replace function public.revalidate_landing_why()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   record;
  v_paths jsonb;
  v_base  text;
  v_token text;
begin
  v_row := coalesce(new, old);

  select jsonb_build_array(
           '/u/' || lower(u.pseudo),
           '/u/' || lower(u.pseudo) || '/' || b.slug)
    into v_paths
  from public.bentos b
  join public.users u on u.id = b.user_id
  where b.id = v_row.bento_id
    and b.published_at is not null;

  if v_paths is null then
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
    body    := jsonb_build_object('paths', v_paths),
    timeout_milliseconds := 3000
  );

  return v_row;

exception when others then
  -- La landing rattrapera au plus tard à la régénération suivante, 5 minutes
  -- après.
  return v_row;
end;
$$;

drop trigger if exists bento_whys_revalidate_landing on public.bento_whys;
create trigger bento_whys_revalidate_landing
  after insert or update or delete on public.bento_whys
  for each row execute function public.revalidate_landing_why();

-- ─── 5. Les signalements ─────────────────────────────────────────────────

alter table public.reports drop constraint if exists reports_target_kind_check;
alter table public.reports
  add constraint reports_target_kind_check
  check (target_kind in ('bento', 'pseudo', 'comment', 'account', 'why'));

alter table public.reports
  add column if not exists target_why_id uuid
    references public.bento_whys(id) on delete set null;

-- Reprise de `20261026200000_likes_comments_moderation.sql`, la cible `why`
-- en plus : le texte copié, comme pour un commentaire, et le bento noté.
create or replace function public.submit_report(
  p_target_kind text,
  p_target uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
  v_pseudo  text;
  v_user    uuid;
  v_bento   uuid;
  v_comment uuid;
  v_why     uuid;
  v_text    text;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'report_needs_session' using errcode = '42501';
  end if;
  if p_reason is null
     or p_reason not in ('hate', 'harassment', 'sexual', 'violence', 'spam', 'other')
     or char_length(coalesce(v_details, '')) > 500 then
    raise exception 'report_invalid' using errcode = '22023';
  end if;

  if p_target_kind = 'comment' then
    select c.id, c.bento_id, c.author_id, u.pseudo, c.body
      into v_comment, v_bento, v_user, v_pseudo, v_text
    from public.bento_comments c
    join public.users u on u.id = c.author_id
    where c.id = p_target;
  elsif p_target_kind = 'why' then
    select w.id, w.bento_id, b.user_id, u.pseudo, w.body
      into v_why, v_bento, v_user, v_pseudo, v_text
    from public.bento_whys w
    join public.bentos b on b.id = w.bento_id
    join public.users u on u.id = b.user_id
    where w.id = p_target;
  elsif p_target_kind = 'account' then
    select u.id, u.pseudo into v_user, v_pseudo
    from public.users u
    where u.id = p_target;
  elsif p_target_kind = 'bento' then
    select b.id, b.user_id, u.pseudo into v_bento, v_user, v_pseudo
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.id = p_target;
  else
    raise exception 'report_invalid' using errcode = '22023';
  end if;

  if v_pseudo is null then
    raise exception 'report_target_not_found' using errcode = 'P0002';
  end if;
  if v_user = v_uid then
    raise exception 'report_invalid' using errcode = '22023';
  end if;

  select r.id into v_id
  from public.reports r
  where r.reporter_id = v_uid
    and r.status = 'pending'
    and r.target_kind = p_target_kind
    and case p_target_kind
          when 'comment' then r.target_comment_id = v_comment
          when 'why' then r.target_why_id = v_why
          when 'bento' then r.target_bento_id = v_bento
          else r.target_user_id = v_user
        end
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if (select count(*) from public.reports r
      where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'report_too_fast' using errcode = '54000';
  end if;

  insert into public.reports (
    reporter_id, target_kind, target_pseudo, target_bento_id,
    target_comment_id, target_why_id, target_user_id, reason_code, details,
    target_text
  )
  values (
    v_uid, p_target_kind, v_pseudo, v_bento,
    v_comment, v_why, v_user, p_reason, v_details,
    v_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── 6. Les fonctions de l'app ───────────────────────────────────────────
--
-- En `security definer`, `search_path` vide, pour le compte appelant. Leurs
-- erreurs portent une clé que l'app traduit en phrase (`src/lib/whys.ts`).

-- Écrire, remplacer ou, vide, effacer le pourquoi d'une case de son bento
-- (D2, D3, D5, D8, D18). La case se nomme par sa clé, `film` ou `ed3_2`,
-- comme l'app nomme les siennes. Rend la ligne écrite, rien quand elle
-- s'efface.
create or replace function public.set_bento_why(
  p_bento uuid,
  p_case text,
  p_body text
)
returns table (
  case_key text,
  body text,
  status text,
  hidden_reason text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_category smallint;
  v_body     text;
  v_old      public.bento_whys%rowtype;
begin
  if v_uid is null then
    raise exception 'why_needs_session' using errcode = '42501';
  end if;

  if not coalesce((select c.whys_enabled from public.app_config c where c.id = 1), true) then
    raise exception 'whys_closed' using errcode = '55000';
  end if;

  -- D3 : son bento, donc un profil et ses règles acceptées, que pose la
  -- première publication. Le bento d'un autre se refuse comme un bento
  -- absent, sans dire lequel des deux.
  if not exists (
    select 1
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.id = p_bento
      and b.user_id = v_uid
      and u.terms_accepted_at is not null
  ) then
    raise exception 'why_not_yours' using errcode = '42501';
  end if;

  -- Une clé inconnue se lit comme une case vide.
  select g.id into v_category
  from public.bento_categories g
  where g.key = p_case;
  if v_category is null or not exists (
    select 1 from public.bento_items bi
    where bi.bento_id = p_bento and bi.category_id = v_category
  ) then
    raise exception 'why_case_empty' using errcode = 'P0002';
  end if;

  -- D5 : les blancs réduits avant de rogner, comme un commentaire.
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));

  select * into v_old
  from public.bento_whys w
  where w.bento_id = p_bento and w.category_id = v_category;

  -- Vide, le pourquoi s'efface. Hors du rythme : on peut toujours retirer
  -- ce qu'on regrette.
  if char_length(v_body) = 0 then
    delete from public.bento_whys w
    where w.bento_id = p_bento and w.category_id = v_category;
    return;
  end if;

  if char_length(v_body) > 120 or v_body ~ '[[:cntrl:]]' then
    raise exception 'why_invalid' using errcode = '22023';
  end if;
  if public.comment_filter_hit(v_body) is not null then
    raise exception 'why_refused_filter' using errcode = '23514';
  end if;

  -- Le même texte : rien à écrire, ni purge ni décompte. Masqué, il le
  -- reste ; c'est un autre texte qui le fait revenir (D8).
  if v_old.id is not null and v_old.body = v_body then
    return query
      select p_case, v_old.body, v_old.status, v_old.hidden_reason, v_old.updated_at;
    return;
  end if;

  -- D18 : 30 écritures par heure, comptées sur la dernière journée.
  delete from public.bento_why_writes j
  where j.user_id = v_uid and j.written_at < now() - interval '1 day';
  if (select count(*) from public.bento_why_writes j
      where j.user_id = v_uid and j.written_at > now() - interval '1 hour') >= 30 then
    raise exception 'why_too_fast' using errcode = '54000';
  end if;
  insert into public.bento_why_writes (user_id) values (v_uid);

  insert into public.bento_whys as w (bento_id, category_id, body)
  values (p_bento, v_category, v_body)
  on conflict on constraint bento_whys_case do update
    set body = excluded.body,
        status = 'visible',
        hidden_reason = null,
        hidden_at = null,
        hidden_by = null,
        updated_at = now();

  return query
    select p_case, w.body, w.status, w.hidden_reason, w.updated_at
    from public.bento_whys w
    where w.bento_id = p_bento and w.category_id = v_category;
end;
$$;

-- Les pourquoi de son bento, masqués compris, avec leur motif (D8) : pour sa
-- page et l'écran « Tes pourquoi ». Rien pour le bento d'un autre.
create or replace function public.my_bento_whys(p_bento uuid)
returns table (
  case_key text,
  body text,
  status text,
  hidden_reason text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.key, w.body, w.status, w.hidden_reason, w.updated_at
  from public.bento_whys w
  join public.bentos b on b.id = w.bento_id
  join public.bento_categories g on g.id = w.category_id
  where w.bento_id = p_bento
    and b.user_id = auth.uid()
  order by g.display_order;
$$;

-- L'export de ses données (D13) : celui du 22, ses pourquoi en plus.
create or replace function public.my_social_export()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bento_id', c.bento_id, 'body', c.body,
               'status', c.status, 'created_at', c.created_at)
             order by c.created_at)
      from public.bento_comments c
      where c.author_id = auth.uid()), '[]'::jsonb),
    'likes', coalesce((
      select jsonb_agg(jsonb_build_object('bento_id', l.bento_id, 'created_at', l.created_at)
             order by l.created_at)
      from public.bento_likes l
      where l.user_id = auth.uid()), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('blocked_id', k.blocked_id, 'created_at', k.created_at)
             order by k.created_at)
      from public.account_blocks k
      where k.blocker_id = auth.uid()), '[]'::jsonb),
    'whys', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bento_id', w.bento_id, 'case', g.key, 'body', w.body,
               'status', w.status, 'hidden_reason', w.hidden_reason,
               'updated_at', w.updated_at)
             order by w.bento_id, g.display_order)
      from public.bento_whys w
      join public.bentos b on b.id = w.bento_id
      join public.bento_categories g on g.id = w.category_id
      where b.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ─── 7. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut. `why_is_public`
-- reste exécutable par les lecteurs : leur règle de lecture l'appelle.

revoke all on function public.why_is_public(uuid, smallint) from public, anon, authenticated;
revoke all on function public.bento_items_drop_why() from public, anon, authenticated;
revoke all on function public.revalidate_landing_why() from public, anon, authenticated;
revoke all on function public.submit_report(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_bento_why(uuid, text, text) from public, anon, authenticated;
revoke all on function public.my_bento_whys(uuid) from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.why_is_public(uuid, smallint) to anon, authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.set_bento_why(uuid, text, text) to authenticated;
grant execute on function public.my_bento_whys(uuid) to authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.why_is_public(uuid, smallint) is
  'Chantier 12 (D1, D10) : une case dont le pourquoi se lit, l''interrupteur '
  'allumé, le bento publié, l''item validé. Appelée par la règle de lecture '
  'de `bento_whys`.';
comment on function public.set_bento_why(uuid, text, text) is
  'Chantier 12 (D2, D3, D5, D18) : écrit, remplace ou efface le pourquoi d''une '
  'case de son bento, filtré, au rythme de 30 par heure. Cf. '
  'docs/UX-12-POURQUOI-PAR-CASE.md §6.2.';
comment on function public.my_bento_whys(uuid) is
  'Chantier 12 (D8) : les pourquoi de son bento, masqués compris, avec leur '
  'motif.';
comment on function public.submit_report(text, uuid, text, text) is
  'Chantiers 22 (D10) et 12 (D8) : un signalement de commentaire, de '
  'pourquoi, de compte ou de bento, avec un motif ; la cible lue en base, le '
  'texte copié.';
comment on function public.my_social_export() is
  'Chantiers 22 (D21) et 12 (D13) : ses commentaires, ses likes, ses '
  'blocages et ses pourquoi, pour l''export de ses données.';

notify pgrst, 'reload schema';
