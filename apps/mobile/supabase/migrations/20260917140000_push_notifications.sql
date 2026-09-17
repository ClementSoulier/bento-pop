-- ─────────────────────────────────────────────────────────────────────────
-- Notifications push : appareils, tickets, déclencheur de modération
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 17, lot 1. Cf. `docs/UX-17-NOTIFICATIONS-PUSH.md`, §5.2, §6 et §8.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `push_tokens` : un jeton Expo par appareil, et ses deux réglages ;
--   2. `register_push_token` : l'enregistrement d'un appareil, qui reprend
--      un jeton qu'un autre compte détenait ;
--   3. `push_tickets` : un ticket Expo par envoi, relu plus tard ;
--   4. `editions.announced_at` : une édition ne s'annonce qu'une fois ;
--   5. `push_webhook_post` : le seul endroit qui appelle le back-office ;
--   6. `items_notify_moderation` : un item proposé est validé, fusionné ou
--      refusé (D4, D12) ;
--   7. `push_tick` : ce que `pg_cron` appellera au lot 3 (D10).
--
-- ─── Inerte tant que les secrets manquent ────────────────────────────────
--
-- Rien ne part sans les secrets de coffre `push_webhook_url` et
-- `push_webhook_token`, posés quand l'envoi sera déployé (D11). D'ici là, le
-- déclencheur et `push_tick` ne font rien : la migration peut précéder
-- l'envoi en production sans aucun effet.
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent aucune de ces
-- tables, créées après elles, ni `editions`. Les clients ne peuvent plus
-- modifier un item depuis `20260915000000_close_privilege_gaps.sql:213` :
-- le déclencheur ne part que d'une modération du back-office, et
-- l'insertion d'un item proposé, telle que la 1.1 la fait, ne le touche pas.
-- Contrôles 3, 8 et 9 de `scripts/check-push.sql`.

-- ─── 1. Les appareils ────────────────────────────────────────────────────

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Le jeton Expo, `ExponentPushToken[…]`. Unique : un appareil qui
  -- réinstalle en obtient un nouveau, l'ancien mourra de lui-même. Aucune
  -- longueur supposée : un simulateur rend des jetons plus longs (§4.5).
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  -- Les deux réglages, séparés parce que leurs régimes le sont (§1.4).
  -- L'éditorial attend un accord explicite : règle Apple 4.5.4 (D6).
  transactional boolean not null default true,
  editorial boolean not null default false,
  created_at timestamptz not null default now(),
  -- Touché à chaque ouverture de l'app. Un jeton qu'on n'a pas vu depuis
  -- 60 jours ne reçoit plus rien (D7).
  last_seen_at timestamptz not null default now(),
  -- Posé quand un accusé de réception dit `DeviceNotRegistered`. La ligne
  -- reste : on veut pouvoir compter les appareils perdus.
  revoked_at timestamptz
);

create index if not exists push_tokens_user_id on public.push_tokens (user_id);

comment on table public.push_tokens is
  'Un jeton Expo par appareil (D8). Écrit par register_push_token, lu par le '
  'back-office à la clé de service pour envoyer. Chantier 17.';

alter table public.push_tokens enable row level security;

-- Supabase accorde tout aux clients sur une table neuve : on repart de rien,
-- puis on rend exactement ce qu'il faut. Le client lit ses appareils et règle
-- ses deux interrupteurs ; l'enregistrement passe par la fonction.
revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;
grant update (transactional, editorial) on public.push_tokens to authenticated;

drop policy if exists "push_tokens_read_own" on public.push_tokens;
create policy "push_tokens_read_own"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
  on public.push_tokens for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─── 2. L'enregistrement d'un appareil ───────────────────────────────────
--
-- Une insertion directe ne suffit pas. Une session anonyme perdue recrée un
-- compte sur le même téléphone (chantier 28) : le jeton existe déjà, au nom
-- de l'ancien compte, et l'unicité ferait échouer l'enregistrement. Le
-- nouveau compte ne recevrait alors plus rien, sans que personne le sache.
--
-- Au changement de propriétaire, les réglages reviennent aux valeurs par
-- défaut : l'accord éditorial d'un compte ne passe pas à un autre (§6.5).

create or replace function public.register_push_token(p_token text, p_platform text)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.push_tokens;
begin
  if v_uid is null then
    raise exception 'register_push_token : session requise'
      using errcode = '42501';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'register_push_token : plateforme inconnue'
      using errcode = '22023';
  end if;

  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise exception 'register_push_token : jeton Expo attendu'
      using errcode = '22023';
  end if;

  insert into public.push_tokens as t (user_id, token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (token) do update
    set user_id       = excluded.user_id,
        platform      = excluded.platform,
        last_seen_at  = now(),
        revoked_at    = null,
        transactional = case when t.user_id = excluded.user_id
                             then t.transactional else true end,
        editorial     = case when t.user_id = excluded.user_id
                             then t.editorial else false end
  returning t.* into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ─── 3. Les tickets ──────────────────────────────────────────────────────
--
-- Expo rend un ticket par envoi. L'accusé de réception se demande au moins
-- 15 minutes plus tard, et disparaît à 24 heures : c'est lui, et lui seul,
-- qui révèle `DeviceNotRegistered` (§4.5). Aucun droit client.

create table if not exists public.push_tickets (
  id uuid primary key default gen_random_uuid(),
  -- L'identifiant rendu par Expo, qui sert à demander l'accusé.
  ticket_id text not null unique,
  token_id uuid not null references public.push_tokens(id) on delete cascade,
  kind text not null check (kind in ('item_moderated', 'edition_released')),
  created_at timestamptz not null default now(),
  -- Posé quand l'accusé a été lu, quelle qu'en soit l'issue.
  checked_at timestamptz,
  -- `ok`, ou le code d'erreur d'Expo, par exemple `DeviceNotRegistered`.
  receipt_status text
);

create index if not exists push_tickets_to_check
  on public.push_tickets (created_at)
  where checked_at is null;

comment on table public.push_tickets is
  'Un ticket Expo par envoi, relu par le travail planifié pour révoquer les '
  'appareils perdus. Back-office seulement. Chantier 17.';

alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from anon, authenticated;

-- ─── 4. Une édition ne s'annonce qu'une fois ─────────────────────────────

alter table public.editions
  add column if not exists announced_at timestamptz;

comment on column public.editions.announced_at is
  'Posé par le back-office une fois l''édition annoncée. Une édition ne '
  's''annonce qu''une fois, dans les 24 heures qui suivent sa sortie (§6.5).';

-- ─── 5. Le seul appel au back-office ─────────────────────────────────────
--
-- Le gabarit des déclencheurs de la landing (§4.3), écrit une fois pour les
-- deux appelants. Rend `false` sans rien poster quand un secret manque : c'est
-- ce qui rend toute la chaîne inerte avant que l'envoi soit déployé (D11).

create or replace function public.push_webhook_post(p_path text, p_body jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base  text;
  v_token text;
begin
  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'push_webhook_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'push_webhook_token';

  if v_base is null or v_token is null then
    return false;
  end if;

  perform net.http_post(
    url     := rtrim(v_base, '/') || p_path,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := p_body,
    timeout_milliseconds := 3000
  );

  return true;
end;
$$;

revoke all on function public.push_webhook_post(text, jsonb) from public, anon, authenticated;

-- ─── 6. Un item proposé est modéré ───────────────────────────────────────
--
-- Le déclencheur ne fait que poster l'événement : il ne lit aucun jeton et
-- ne décide de rien (§6.1). Le back-office retrouve l'auteur, ses appareils,
-- et, pour une fusion, le titre de l'item conservé (D12).
--
-- `submitted_by` écarte les items saisis au back-office, qui n'ont personne à
-- prévenir.

create or replace function public.notify_item_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_webhook_post(
    '/api/push',
    jsonb_build_object(
      'type',    'item_moderated',
      'item_id', new.id,
      'status',  new.status
    )
  );
  return null;

exception when others then
  -- Jamais au détriment de la modération : un back-office injoignable, une
  -- extension absente ou un secret mal formé ne doivent pas empêcher de
  -- valider, fusionner ou refuser un item.
  return null;
end;
$$;

revoke all on function public.notify_item_moderation() from public, anon, authenticated;

drop trigger if exists items_notify_moderation on public.items;
create trigger items_notify_moderation
  after update of status on public.items
  for each row
  when (
    old.status is distinct from new.status
    and new.status in ('validated', 'merged', 'rejected')
    and new.submitted_by is not null
  )
  execute function public.notify_item_moderation();

-- ─── 7. Le battement du travail planifié ─────────────────────────────────
--
-- Appelé toutes les 5 minutes par `pg_cron`, installé au lot 3 (D10). Il ne
-- fait que prévenir le back-office, qui annonce les éditions sorties et relit
-- les accusés de réception.

create or replace function public.push_tick()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.push_webhook_post('/api/push/tick', jsonb_build_object('type', 'tick'));
$$;

revoke all on function public.push_tick() from public, anon, authenticated;

-- ─── Contrôle ────────────────────────────────────────────────────────────
-- Sur le Supabase local, après application :
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-push.sql
