-- ─────────────────────────────────────────────────────────────────────────
-- Likes, commentaires et modération
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 22, lot 1. Cf. `docs/UX-22-LIKES-COMMENTAIRES.md`, §6.1 et §11.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `bento_likes` : un cœur par compte et par bento (D1, D5) ;
--   2. `bento_comments` : les commentaires, à plat (D4), masquables par
--      l'équipe avec un motif que seul leur auteur voit (D8) ;
--   3. `account_blocks` : le blocage en base (D9) ;
--   4. `blocked_terms` et le filtre des commentaires (D6) ;
--   5. les réglages `accept_comments` et `accept_likes` (D14), et
--      l'interrupteur `app_config.comments_enabled` (D15) ;
--   6. `reports` : trois cibles, un motif, la copie du texte signalé, et un
--      signaleur sans profil enfin accepté (D10, §4.2) ;
--   7. les fonctions de l'app, seul chemin des clients vers ces tables.
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent aucune des
-- tables neuves. Elles lisent `users` en `select('*')` et y reçoivent deux
-- colonnes de plus, qu'elles ignorent, comme `searchable` au chantier 20.
-- Elles signalent par une insertion de cinq colonnes dans `reports`,
-- toujours accordée : la contrainte de `target_kind` ne fait qu'ajouter des
-- valeurs, et la clé étrangère de `reporter_id` accepte tout ce que
-- l'ancienne acceptait, plus les comptes sans profil. Contrôles de
-- `scripts/check-social.mjs`.
--
-- ─── Aucune écriture directe ─────────────────────────────────────────────
--
-- Les clients n'ont aucun droit sur les tables neuves : tout passe par les
-- fonctions de §7, qui portent les règles (D3, D5, D7, D9, D14, D15). Le
-- back-office lit et modère par la clé de service.

-- ─── 1. Les likes ────────────────────────────────────────────────────────

create table if not exists public.bento_likes (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  -- Un compte, anonyme compris (D5) : la ligne d'`auth.users`, pas le
  -- profil, que seuls les comptes qui ont publié possèdent.
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bento_id, user_id)
);

create index if not exists bento_likes_user_id on public.bento_likes (user_id);

alter table public.bento_likes enable row level security;
revoke all on public.bento_likes from anon, authenticated;

comment on table public.bento_likes is
  'Chantier 22 (D1, D5) : un cœur par compte et par bento publié, jamais le '
  'sien. Écrit par `set_like`, compté par `bento_social`. Le nombre est '
  'public, la liste non.';

-- ─── 2. Les commentaires ─────────────────────────────────────────────────

create table if not exists public.bento_comments (
  id uuid primary key default gen_random_uuid(),
  bento_id uuid not null references public.bentos(id) on delete cascade,
  -- Le profil : on ne commente qu'avec un bento publié (D3).
  author_id uuid not null references public.users(id) on delete cascade,
  -- Une ligne, nettoyée par `post_comment` (D6).
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  -- Posés par le back-office quand l'équipe masque (D8). Le motif n'est
  -- rendu qu'à l'auteur, par `list_bento_comments`.
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by text,
  created_at timestamptz not null default now()
);

create index if not exists bento_comments_bento
  on public.bento_comments (bento_id, created_at desc);
create index if not exists bento_comments_author
  on public.bento_comments (author_id, created_at desc);

alter table public.bento_comments enable row level security;
revoke all on public.bento_comments from anon, authenticated;

comment on table public.bento_comments is
  'Chantier 22 : les commentaires d''un bento, à plat (D4). Écrits par '
  '`post_comment`, lus par `list_bento_comments`, supprimés par `delete_comment` ; '
  'masqués par le back-office, avec un motif que seul l''auteur voit (D8).';

-- ─── 3. Le blocage ───────────────────────────────────────────────────────

create table if not exists public.account_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists account_blocks_blocked on public.account_blocks (blocked_id);

alter table public.account_blocks enable row level security;
revoke all on public.account_blocks from anon, authenticated;

comment on table public.account_blocks is
  'Chantier 22 (D9) : le blocage en base. Le bloqué ne commente ni n''aime '
  'plus les bentos de qui l''a bloqué, et ses commentaires y disparaissent '
  'pour tous. Écrit par `set_block` et `sync_blocks`. Les versions publiées '
  'gardent leur liste locale.';

-- ─── 4. Le filtre des commentaires ───────────────────────────────────────
--
-- Les motifs des pseudos ne servent pas ici : des expressions sans borne de
-- mot, qui refuseraient 11 mots courants sur 20 dans une phrase (§1.2). Le
-- filtre compare des mots entiers, après normalisation, à une liste à part.

create table if not exists public.blocked_terms (
  id smallint primary key generated always as identity,
  -- Normalisé comme le texte : minuscules, sans accent, sans chiffre.
  term text not null unique check (term ~ '^[a-z]+$'),
  -- `word` : le mot entier ; `stem` : tout mot qui commence ainsi.
  kind text not null default 'word' check (kind in ('word', 'stem')),
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.blocked_terms enable row level security;
revoke all on public.blocked_terms from anon, authenticated;

comment on table public.blocked_terms is
  'Chantier 22 (D6) : les mots refusés dans un commentaire, normalisés. Lue '
  'par `comment_filter_hit` seulement. Les injures des motifs de pseudos, en '
  'mots entiers, sans les motifs d''usurpation ni les sujets (un film sur '
  'la guerre peut nommer ce qu''un pseudo ne doit pas porter).';

-- La liste de départ : les injures de `blocked_pseudo_patterns`, chacune en
-- ses formes courantes, plus trois abréviations sans autre sens. Ni
-- « retard », ni « fagot », ni « nique » : ils ont un autre sens en
-- français (« en retard », « pique-nique »).
insert into public.blocked_terms (term, kind, label) values
  ('nigger', 'word', 'injure raciste'), ('niggers', 'word', 'injure raciste'),
  ('nigga', 'word', 'injure raciste'), ('niggas', 'word', 'injure raciste'),
  ('bougnoule', 'word', 'injure raciste'), ('bougnoules', 'word', 'injure raciste'),
  ('bicot', 'word', 'injure raciste'), ('bicots', 'word', 'injure raciste'),
  ('youpin', 'word', 'injure antisémite'), ('youpins', 'word', 'injure antisémite'),
  ('youpine', 'word', 'injure antisémite'), ('youpines', 'word', 'injure antisémite'),
  ('chinetoque', 'word', 'injure raciste'), ('chinetoques', 'word', 'injure raciste'),
  ('negre', 'word', 'injure raciste'), ('negres', 'word', 'injure raciste'),
  ('negresse', 'word', 'injure raciste'), ('negresses', 'word', 'injure raciste'),
  ('negro', 'word', 'injure raciste'), ('negros', 'word', 'injure raciste'),
  ('kike', 'word', 'injure antisémite'), ('kikes', 'word', 'injure antisémite'),
  ('chink', 'word', 'injure raciste'), ('chinks', 'word', 'injure raciste'),
  ('spic', 'word', 'injure raciste'), ('spics', 'word', 'injure raciste'),
  ('faggot', 'word', 'injure homophobe'), ('faggots', 'word', 'injure homophobe'),
  ('pede', 'word', 'injure homophobe'), ('pedes', 'word', 'injure homophobe'),
  ('pd', 'word', 'injure homophobe'),
  ('gouine', 'word', 'injure homophobe'), ('gouines', 'word', 'injure homophobe'),
  ('tarlouze', 'word', 'injure homophobe'), ('tarlouzes', 'word', 'injure homophobe'),
  ('tranny', 'word', 'injure transphobe'), ('trannies', 'word', 'injure transphobe'),
  ('retarded', 'word', 'injure validiste'),
  ('pute', 'word', 'insulte'), ('putes', 'word', 'insulte'),
  ('salope', 'word', 'insulte'), ('salopes', 'word', 'insulte'),
  ('salopard', 'word', 'insulte'), ('salopards', 'word', 'insulte'),
  ('connard', 'word', 'insulte'), ('connards', 'word', 'insulte'),
  ('conard', 'word', 'insulte'), ('conards', 'word', 'insulte'),
  ('bitch', 'word', 'insulte'), ('bitches', 'word', 'insulte'),
  ('encul', 'stem', 'insulte'),
  ('fdp', 'word', 'insulte'), ('ntm', 'word', 'insulte')
on conflict (term) do nothing;

-- Le texte tel que le filtre le lit : minuscules ; accents, ligatures et
-- caractères invisibles retirés ; chiffres et symboles ramenés à la lettre
-- qu'ils imitent ; trois lettres répétées ou plus ramenées à une seule, ce
-- qui rend « niiigger » mais garde « connard » et « Niger ».
create or replace function public.normalize_for_filter(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      replace(replace(
        regexp_replace(lower(coalesce(p_text, '')), '[­​-‍⁠﻿]', '', 'g'),
        'œ', 'oe'), 'æ', 'ae'),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ013457@$',
      'aaaaaaceeeeiiiinooooouuuuyyoieastas'
    ),
    '([a-z])\1{2,}', '\1', 'g'
  );
$$;

-- Ce qui refuse un commentaire : le libellé du mot touché, « lien » pour un
-- lien, ou rien. Un lien se lit sur le texte en minuscules, avant la
-- normalisation, qui changerait ses chiffres en lettres.
create or replace function public.comment_filter_hit(p_body text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_norm text := public.normalize_for_filter(p_body);
  v_hit  text;
begin
  if lower(coalesce(p_body, '')) ~
     '(https?://|www\.|\m[a-z0-9-]+\.(com|fr|net|org|io|gg|ly|me|tv|xyz|app|link|co|be|ch|ca|eu|de|uk|us|to|info|biz|site|shop|store)\M)' then
    return 'lien';
  end if;

  select t.label into v_hit
  from public.blocked_terms t
  where t.is_active
    and v_norm ~ case t.kind
                   when 'stem' then '\m' || t.term
                   else '\m' || t.term || '\M'
                 end
  limit 1;

  return v_hit;
end;
$$;

-- ─── 5. Les réglages et l'interrupteur ───────────────────────────────────

alter table public.users
  add column if not exists accept_comments boolean not null default true,
  add column if not exists accept_likes boolean not null default true;

comment on column public.users.accept_comments is
  'Chantier 22 (D14) : « Accepter les commentaires ». Éteint, rien ne '
  's''écrit sur ses bentos, et ce qui existe est masqué, rendu au rallumage.';
comment on column public.users.accept_likes is
  'Chantier 22 (D14) : « Afficher les j''aime ». Éteint, ni cœur ni nombre '
  'sur ses bentos, et aucun like ne s''écrit.';

-- Modifiables par leur propriétaire seul : la règle `users_update_own`
-- borne les lignes, ce droit borne les colonnes, comme `searchable` au 20.
grant update (accept_comments, accept_likes) on public.users to authenticated;

alter table public.app_config
  add column if not exists comments_enabled boolean not null default true;

comment on column public.app_config.comments_enabled is
  'Chantier 22 (D15) : éteint, l''app cache tout ce qui touche aux '
  'commentaires et la base refuse d''en écrire, sans nouvelle version. Les '
  'likes restent.';

-- ─── 6. Les signalements ─────────────────────────────────────────────────
--
-- `reporter_id` référençait `public.users` : un compte sans profil, qui peut
-- ouvrir un bento depuis « La table », ne pouvait pas le signaler (§4.2).
-- Il référence désormais le compte d'authentification.

alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;

alter table public.reports drop constraint if exists reports_target_kind_check;
alter table public.reports
  add constraint reports_target_kind_check
  check (target_kind in ('bento', 'pseudo', 'comment', 'account'));

alter table public.reports
  add column if not exists target_comment_id uuid
    references public.bento_comments(id) on delete set null,
  -- Sans clé étrangère : la trace survit au compte, comme `target_pseudo`.
  add column if not exists target_user_id uuid,
  add column if not exists reason_code text
    check (reason_code in ('hate', 'harassment', 'sexual', 'violence', 'spam', 'other')),
  add column if not exists details text check (char_length(details) <= 500),
  -- Le commentaire tel qu'il était au signalement : il survit à sa
  -- suppression, et l'équipe juge ce qui a été signalé.
  add column if not exists target_text text,
  -- Posé par le back-office quand un mail a prévenu l'équipe (D11).
  add column if not exists alerted_at timestamptz;

create index if not exists reports_unalerted
  on public.reports (created_at)
  where status = 'pending' and alerted_at is null;

-- ─── 7. Les fonctions de l'app ───────────────────────────────────────────
--
-- Toutes en `security definer`, `search_path` vide, pour le compte appelant
-- (`auth.uid()`). Leurs erreurs portent une clé que l'app traduit en phrase
-- (`src/lib/social.ts`).

-- Aimer ou ne plus aimer (D5). Idempotente. Rend le nombre et l'état.
create or replace function public.set_like(p_bento uuid, p_liked boolean)
returns table (likes int, liked boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_published timestamptz;
  v_accepts   boolean;
begin
  if v_uid is null then
    raise exception 'like_needs_session' using errcode = '42501';
  end if;

  select b.user_id, b.published_at, u.accept_likes
    into v_owner, v_published, v_accepts
  from public.bentos b
  join public.users u on u.id = b.user_id
  where b.id = p_bento;

  if not found or v_published is null then
    raise exception 'bento_not_found' using errcode = 'P0002';
  end if;

  -- Jamais le sien ; jamais chez qui refuse les likes, ou vous a bloqué.
  if v_owner = v_uid
     or not v_accepts
     or exists (
       select 1 from public.account_blocks k
       where k.blocker_id = v_owner and k.blocked_id = v_uid
     ) then
    raise exception 'like_not_allowed' using errcode = '42501';
  end if;

  if p_liked then
    insert into public.bento_likes (bento_id, user_id)
    values (p_bento, v_uid)
    on conflict do nothing;
  else
    delete from public.bento_likes l
    where l.bento_id = p_bento and l.user_id = v_uid;
  end if;

  return query
    select (select count(*)::int from public.bento_likes l where l.bento_id = p_bento),
           coalesce(p_liked, false);
end;
$$;

-- Écrire un commentaire (D3, D6, D7, D9, D14, D15). Rend la ligne telle que
-- `list_bento_comments` la rendra.
create or replace function public.post_comment(p_bento uuid, p_body text)
returns table (
  id uuid,
  bento_id uuid,
  body text,
  status text,
  hidden_reason text,
  created_at timestamptz,
  author_id uuid,
  author_pseudo text,
  author_avatar text,
  is_mine boolean,
  can_delete boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_published timestamptz;
  v_accepts   boolean;
  v_kept      boolean;
  v_body      text;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'comment_needs_session' using errcode = '42501';
  end if;

  if not coalesce((select c.comments_enabled from public.app_config c where c.id = 1), true) then
    raise exception 'comments_closed' using errcode = '55000';
  end if;

  select b.user_id, b.published_at, u.accept_comments
    into v_owner, v_published, v_accepts
  from public.bentos b
  join public.users u on u.id = b.user_id
  where b.id = p_bento;

  if not found or v_published is null then
    raise exception 'bento_not_found' using errcode = 'P0002';
  end if;
  if not v_accepts then
    raise exception 'comments_closed' using errcode = '55000';
  end if;

  -- D3, dans l'ordre où l'app les demande : un bento publié, donc un
  -- profil et ses règles acceptées, puis un compte gardé.
  if not exists (
    select 1 from public.bentos b
    where b.user_id = v_uid and b.published_at is not null
  ) then
    raise exception 'comment_needs_bento' using errcode = '42501';
  end if;
  if (select u.terms_accepted_at from public.users u where u.id = v_uid) is null then
    raise exception 'comment_needs_terms' using errcode = '42501';
  end if;
  select (not coalesce(a.is_anonymous, true)) and a.email is not null
    into v_kept
  from auth.users a
  where a.id = v_uid;
  if not coalesce(v_kept, false) then
    raise exception 'comment_needs_kept_account' using errcode = '42501';
  end if;

  -- D9 : bloqué par le propriétaire.
  if exists (
    select 1 from public.account_blocks k
    where k.blocker_id = v_owner and k.blocked_id = v_uid
  ) then
    raise exception 'comment_not_allowed' using errcode = '42501';
  end if;

  -- D6 : une ligne, 1 à 280 caractères, ni lien ni mot refusé. Les blancs
  -- réduits d'abord : `btrim` seul ne retire que les espaces, et un texte
  -- fait de sauts de ligne devenait un commentaire d'un espace.
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) = 0 or char_length(v_body) > 280 or v_body ~ '[[:cntrl:]]' then
    raise exception 'comment_invalid' using errcode = '22023';
  end if;
  if public.comment_filter_hit(v_body) is not null then
    raise exception 'comment_refused_filter' using errcode = '23514';
  end if;

  -- D7 : 5 par minute, 50 par jour.
  if (select count(*) from public.bento_comments c
      where c.author_id = v_uid and c.created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.bento_comments c
         where c.author_id = v_uid and c.created_at > now() - interval '1 day') >= 50 then
    raise exception 'comment_too_fast' using errcode = '54000';
  end if;

  insert into public.bento_comments (bento_id, author_id, body)
  values (p_bento, v_uid, v_body)
  returning bento_comments.id into v_id;

  return query
    select c.id, c.bento_id, c.body, c.status, c.hidden_reason, c.created_at,
           c.author_id, u.pseudo, u.avatar, true, true
    from public.bento_comments c
    join public.users u on u.id = c.author_id
    where c.id = v_id;
end;
$$;

-- Supprimer un commentaire : le sien, ou n'importe lequel de son bento (D8).
create or replace function public.delete_comment(p_comment uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'comment_needs_session' using errcode = '42501';
  end if;

  delete from public.bento_comments c
  using public.bentos b
  where c.id = p_comment
    and b.id = c.bento_id
    and (c.author_id = v_uid or b.user_id = v_uid);

  return found;
end;
$$;

-- Les commentaires d'un bento, du plus récent au plus ancien, par pages
-- avant `p_before` (l'app les remet dans l'ordre). Les visibles, plus ceux
-- du lecteur que l'équipe a masqués, avec leur motif (D8) ; sans ceux des
-- comptes que le lecteur ou le propriétaire ont bloqués (D9) ; rien si le
-- propriétaire refuse les commentaires ou si l'interrupteur est éteint.
create or replace function public.list_bento_comments(
  p_bento uuid,
  p_before timestamptz default null,
  p_limit int default 50
)
returns table (
  id uuid,
  bento_id uuid,
  body text,
  status text,
  hidden_reason text,
  created_at timestamptz,
  author_id uuid,
  author_pseudo text,
  author_avatar text,
  is_mine boolean,
  can_delete boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_published timestamptz;
  v_accepts   boolean;
begin
  if not coalesce((select c.comments_enabled from public.app_config c where c.id = 1), true) then
    return;
  end if;

  select b.user_id, b.published_at, u.accept_comments
    into v_owner, v_published, v_accepts
  from public.bentos b
  join public.users u on u.id = b.user_id
  where b.id = p_bento;

  if not found or v_published is null or not v_accepts then
    return;
  end if;

  return query
    select c.id, c.bento_id, c.body, c.status,
           case when c.author_id = v_uid then c.hidden_reason end,
           c.created_at, c.author_id, u.pseudo, u.avatar,
           c.author_id = v_uid,
           c.author_id = v_uid or v_owner = v_uid
    from public.bento_comments c
    join public.users u on u.id = c.author_id
    where c.bento_id = p_bento
      and (c.status = 'visible' or c.author_id = v_uid)
      and (p_before is null or c.created_at < p_before)
      and not exists (
        select 1 from public.account_blocks k
        where k.blocked_id = c.author_id
          and (k.blocker_id = v_owner or k.blocker_id = v_uid)
      )
    order by c.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Les nombres d'une série de bentos publiés, 100 au plus (D16) : likes,
-- commentaires visibles du lecteur, et s'il aime. `null` pour ce que le
-- propriétaire refuse, ou pour les commentaires quand l'interrupteur est
-- éteint.
create or replace function public.bento_social(p_bentos uuid[])
returns table (
  bento_id uuid,
  likes int,
  comments int,
  liked boolean,
  accepts_likes boolean,
  accepts_comments boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select auth.uid() as uid,
           coalesce((select c.comments_enabled from public.app_config c where c.id = 1), true) as open
  ),
  b as (
    select b.id, b.user_id as owner, u.accept_likes, u.accept_comments
    from public.bentos b
    join public.users u on u.id = b.user_id
    where b.id = any ((coalesce(p_bentos, '{}'::uuid[]))[1:100])
      and b.published_at is not null
  )
  select b.id,
         case when b.accept_likes then
           (select count(*)::int from public.bento_likes l where l.bento_id = b.id)
         end,
         case when b.accept_comments and v.open then
           (select count(*)::int
            from public.bento_comments c
            where c.bento_id = b.id
              and c.status = 'visible'
              and not exists (
                select 1 from public.account_blocks k
                where k.blocked_id = c.author_id
                  and (k.blocker_id = b.owner or k.blocker_id = v.uid)
              ))
         end,
         b.accept_likes and exists (
           select 1 from public.bento_likes l
           where l.bento_id = b.id and l.user_id = v.uid
         ),
         b.accept_likes,
         b.accept_comments and v.open
  from b
  cross join v;
$$;

-- Signaler un commentaire, un compte ou un bento (D10). La cible se lit en
-- base, jamais depuis le client ; un seul signalement en attente par
-- signaleur et par cible, 20 par jour. Rend l'identifiant du signalement.
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
    target_comment_id, target_user_id, reason_code, details, target_text
  )
  values (
    v_uid, p_target_kind, v_pseudo, v_bento,
    v_comment, v_user, p_reason, v_details, v_text
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Bloquer ou débloquer un compte (D9). Un compte disparu ne s'écrit pas.
create or replace function public.set_block(p_blocked uuid, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'block_needs_session' using errcode = '42501';
  end if;
  if p_blocked is null or p_blocked = v_uid then
    raise exception 'block_invalid' using errcode = '22023';
  end if;

  if p_on then
    insert into public.account_blocks (blocker_id, blocked_id)
    select v_uid, a.id from auth.users a where a.id = p_blocked
    on conflict do nothing;
  else
    delete from public.account_blocks k
    where k.blocker_id = v_uid and k.blocked_id = p_blocked;
  end if;

  return coalesce(p_on, false);
end;
$$;

-- Verse la liste locale d'un téléphone, 500 comptes au plus, puis rend la
-- liste en base, avec les pseudos du moment (D9). Appelée avec une liste
-- vide, elle ne fait que la rendre.
create or replace function public.sync_blocks(p_blocked uuid[])
returns table (blocked_id uuid, pseudo text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'block_needs_session' using errcode = '42501';
  end if;

  insert into public.account_blocks (blocker_id, blocked_id)
  select v_uid, a.id
  from auth.users a
  where a.id = any ((coalesce(p_blocked, '{}'::uuid[]))[1:500])
    and a.id <> v_uid
  on conflict do nothing;

  return query
    select k.blocked_id, u.pseudo
    from public.account_blocks k
    left join public.users u on u.id = k.blocked_id
    where k.blocker_id = v_uid
    order by k.created_at;
end;
$$;

-- Ce que l'export de ses données ajoute (D21).
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
      where k.blocker_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- ─── 8. Les droits ───────────────────────────────────────────────────────
--
-- `revoke ... from public` ne suffit pas : Supabase accorde `execute` à
-- `anon` et `authenticated` par des privilèges par défaut (cf.
-- `20260913100000_admin_delete_user.sql`). Le filtre reste interne.

revoke all on function public.normalize_for_filter(text) from public, anon, authenticated;
revoke all on function public.comment_filter_hit(text) from public, anon, authenticated;
revoke all on function public.set_like(uuid, boolean) from public, anon, authenticated;
revoke all on function public.post_comment(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_comment(uuid) from public, anon, authenticated;
revoke all on function public.list_bento_comments(uuid, timestamptz, int) from public, anon, authenticated;
revoke all on function public.bento_social(uuid[]) from public, anon, authenticated;
revoke all on function public.submit_report(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_block(uuid, boolean) from public, anon, authenticated;
revoke all on function public.sync_blocks(uuid[]) from public, anon, authenticated;
revoke all on function public.my_social_export() from public, anon, authenticated;

grant execute on function public.set_like(uuid, boolean) to authenticated;
grant execute on function public.post_comment(uuid, text) to authenticated;
grant execute on function public.delete_comment(uuid) to authenticated;
grant execute on function public.list_bento_comments(uuid, timestamptz, int) to authenticated;
grant execute on function public.bento_social(uuid[]) to authenticated;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.set_block(uuid, boolean) to authenticated;
grant execute on function public.sync_blocks(uuid[]) to authenticated;
grant execute on function public.my_social_export() to authenticated;

comment on function public.set_like(uuid, boolean) is
  'Chantier 22 (D5) : aimer ou ne plus aimer un bento publié, jamais le sien, '
  'jamais chez qui refuse les likes ou a bloqué l''appelant. Rend le nombre '
  'et l''état. Cf. docs/UX-22-LIKES-COMMENTAIRES.md §6.1.';
comment on function public.post_comment(uuid, text) is
  'Chantier 22 (D3, D6, D7) : un commentaire, d''un compte gardé qui a publié '
  'son bento, filtré, au rythme de 5 par minute et 50 par jour.';
comment on function public.delete_comment(uuid) is
  'Chantier 22 (D8) : supprime le sien, ou n''importe lequel de son bento.';
comment on function public.list_bento_comments(uuid, timestamptz, int) is
  'Chantier 22 (D8, D9, D14, D15) : les commentaires d''un bento, par pages, '
  'sans les comptes bloqués ; ceux du lecteur masqués par l''équipe, avec '
  'leur motif.';
comment on function public.bento_social(uuid[]) is
  'Chantier 22 (D16) : likes et commentaires de 100 bentos au plus, et si le '
  'lecteur aime.';
comment on function public.submit_report(text, uuid, text, text) is
  'Chantier 22 (D10) : un signalement de commentaire, de compte ou de bento, '
  'avec un motif ; la cible lue en base, le texte copié.';
comment on function public.set_block(uuid, boolean) is
  'Chantier 22 (D9) : bloque ou débloque un compte.';
comment on function public.sync_blocks(uuid[]) is
  'Chantier 22 (D9) : verse la liste locale d''un téléphone et rend celle de '
  'la base.';
comment on function public.my_social_export() is
  'Chantier 22 (D21) : ses commentaires, ses likes et ses blocages, pour '
  'l''export de ses données.';
