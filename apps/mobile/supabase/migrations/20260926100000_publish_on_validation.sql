-- ─────────────────────────────────────────────────────────────────────────
-- Publication à la validation : un bento complet sort quand son dernier
-- item en attente est validé
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 18, lot 1. Cf. `docs/UX-18-PUBLICATION-AUTOMATIQUE.md` §6.1.
--
-- ─── Le problème ─────────────────────────────────────────────────────────
--
-- Mesuré le 26 septembre 2026 : sur 24 bentos portant une proposition de
-- leur auteur, 15 ne sont jamais sortis, dont 12 complets que rien ne
-- bloque ; les 8 autres sont sortis 5 jours après la validation en médiane.
-- La modération tombe chaque semaine, 6,9 jours en médiane. Le blocage
-- n'existe que dans l'app : « En attente de validation », désactivé.
--
-- ─── La sortie ───────────────────────────────────────────────────────────
--
-- La nouvelle app **marque** un bento complet dont un item attend
-- (`publish_on_validation_at`). À la validation, ou à la fusion, du dernier
-- item en attente, la base le publie dans la même transaction et le note
-- (`auto_published_at`). La notification de modération du chantier 17, qui
-- part juste après, dit alors quel bento vient de sortir (D1, D4).
--
-- La marque tient tant qu'un item attend (D2). Elle tombe au refus, quand
-- l'auteur remplace lui-même l'item en attente ou vide une case, et quand
-- le bento est publié à la main. Un compte sans profil y arrive par
-- `publish_first_bento`, qui marque au lieu de publier quand un item attend
-- (D3).
--
-- ─── Compatibilité avec la 1.1 et la 0.1.0 (D5) ──────────────────────────
--
-- Elles ne marquent jamais rien : aucun déclencheur n'agit sur leurs
-- bentos, qui gardent exactement le comportement d'aujourd'hui. Elles lisent
-- `bentos` par des listes de colonnes, jamais `select('*')` : les deux
-- colonnes leur restent invisibles. Elles n'appellent pas
-- `publish_first_bento`, arrivée après elles. Et l'événement de modération
-- reste identique à l'octet près tant qu'aucun bento ne sort.

-- ─── 1. La marque et la trace ────────────────────────────────────────────

alter table public.bentos
  add column if not exists publish_on_validation_at timestamptz,
  add column if not exists auto_published_at timestamptz;

comment on column public.bentos.publish_on_validation_at is
  'Chantier 18 : posée par la nouvelle app sur un bento complet, non publié, '
  'dont un item attend la modération ; levée par la base quand elle le publie '
  'ou quand plus rien n''attend. Aucun client ne l''écrit directement.';
comment on column public.bentos.auto_published_at is
  'Chantier 18 : la date à laquelle la base a publié ce bento à la validation '
  'de son dernier item. Gardée ensuite : elle compte les publications '
  'automatiques. Aucun client ne l''écrit.';

-- Aucun droit à ajouter : le client n'écrit que `published_at`
-- (`20260913200000_bentos_column_privileges.sql`), et la lecture de la table
-- couvre les deux colonnes, que son propriétaire doit pouvoir lire.

-- ─── 2. Complet, et où en est la modération ──────────────────────────────

-- Toutes les cases actives de son jeu sont remplies : les six du bento
-- principal, ou celles de son édition.
create or replace function public.bento_is_complete(p_bento uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.bentos b where b.id = p_bento)
     and not exists (
       select 1
       from public.bentos b
       join public.bento_categories c
         on c.is_active
        and c.edition_id is not distinct from b.edition_id
       where b.id = p_bento
         and not exists (
           select 1 from public.bento_items bi
           where bi.bento_id = b.id and bi.category_id = c.id
         )
     );
$$;

-- `ready` : tout est validé ; `waiting` : au moins un item attend, et tous
-- les autres sont validés ; `blocked` : un item est refusé, fusionné ou
-- autre, et le bento ne peut pas sortir tel quel.
create or replace function public.bento_moderation_state(p_bento uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce(bool_or(i.status not in ('validated', 'pending')), false) then 'blocked'
    when coalesce(bool_or(i.status = 'pending'), false) then 'waiting'
    else 'ready'
  end
  from public.bento_items bi
  join public.items i on i.id = bi.item_id
  where bi.bento_id = p_bento;
$$;

revoke all on function public.bento_is_complete(uuid) from public, anon, authenticated;
revoke all on function public.bento_moderation_state(uuid) from public, anon, authenticated;

-- ─── 3. La marque, posée par la nouvelle app ─────────────────────────────

-- Pose la marque si le bento est à l'appelant, non publié, complet, et
-- qu'un item y attend sans qu'aucun ne soit refusé. Sinon ne fait rien.
-- Rend vrai si le bento est marqué au retour : l'app peut l'appeler autant
-- qu'elle veut.
create or replace function public.mark_publish_on_validation(p_bento uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return false;
  end if;

  update public.bentos b
     set publish_on_validation_at = now()
   where b.id = p_bento
     and b.user_id = v_uid
     and b.published_at is null
     and b.publish_on_validation_at is null
     and public.bento_is_complete(b.id)
     and public.bento_moderation_state(b.id) = 'waiting';

  return exists (
    select 1 from public.bentos b
    where b.id = p_bento
      and b.user_id = v_uid
      and b.publish_on_validation_at is not null
  );
end;
$$;

revoke all on function public.mark_publish_on_validation(uuid) from public, anon;
grant execute on function public.mark_publish_on_validation(uuid) to authenticated;

comment on function public.mark_publish_on_validation(uuid) is
  'Chantier 18 : marque un bento complet dont un item attend, pour que la '
  'base le publie à la validation de son dernier item. Appelée par la '
  'nouvelle app seulement (D5). Idempotente.';

-- ─── 4. La publication à la validation, ou à la fusion ───────────────────

-- Nommé pour passer avant `items_notify_moderation` : les déclencheurs d'une
-- même table partent dans l'ordre alphabétique, et la notification doit voir
-- le bento déjà publié.
create or replace function public.publish_on_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Une fusion a déjà réécrit les cases vers l'item conservé
  -- (`admin_merge_items`, étape 1) quand le perdant change de statut.
  v_item uuid := case
    when new.status = 'merged' then coalesce(new.merged_into_id, new.id)
    else new.id
  end;
begin
  begin
    if new.status in ('validated', 'merged') then
      update public.bentos b
         set published_at             = now(),
             auto_published_at        = now(),
             publish_on_validation_at = null
       where b.publish_on_validation_at is not null
         and b.published_at is null
         and exists (
           select 1 from public.bento_items bi
           where bi.bento_id = b.id and bi.item_id = v_item
         )
         and public.bento_is_complete(b.id)
         and public.bento_moderation_state(b.id) = 'ready';

      -- Une fusion peut vider une case, quand le bento portait déjà l'item
      -- conservé : il ne sortira pas incomplet, et la marque tombe.
      update public.bentos b
         set publish_on_validation_at = null
       where b.publish_on_validation_at is not null
         and exists (
           select 1 from public.bento_items bi
           where bi.bento_id = b.id and bi.item_id = v_item
         )
         and (not public.bento_is_complete(b.id)
              or public.bento_moderation_state(b.id) = 'blocked');

    elsif new.status = 'rejected' then
      update public.bentos b
         set publish_on_validation_at = null
       where b.publish_on_validation_at is not null
         and exists (
           select 1 from public.bento_items bi
           where bi.bento_id = b.id and bi.item_id = new.id
         );
    end if;
  exception when others then
    -- Jamais au détriment de la modération : valider, fusionner ou refuser
    -- doit passer, même si la publication échoue.
    raise warning 'publish_on_moderation(%) : %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public.publish_on_moderation() from public, anon, authenticated;

drop trigger if exists items_moderation_publish on public.items;
create trigger items_moderation_publish
  after update of status on public.items
  for each row
  when (
    old.status is distinct from new.status
    and new.status in ('validated', 'merged', 'rejected')
  )
  execute function public.publish_on_moderation();

-- ─── 5. Ce que l'auteur change pendant l'attente ─────────────────────────

-- Seules les modifications de l'auteur comptent (D2) : la fusion réécrit
-- les cases au nom du back-office avant de changer le statut de l'item, et
-- c'est alors `publish_on_moderation` qui tranche. Un auteur qui remplace
-- l'item en attente ou vide une case est dans l'app : il publiera d'un tap.
create or replace function public.unmark_bento_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bento uuid;
begin
  if tg_op = 'DELETE' then
    v_bento := old.bento_id;
  else
    v_bento := new.bento_id;
  end if;

  update public.bentos b
     set publish_on_validation_at = null
   where b.id = v_bento
     and b.publish_on_validation_at is not null
     and b.user_id = (select auth.uid())
     and (not public.bento_is_complete(b.id)
          or public.bento_moderation_state(b.id) <> 'waiting');
  return null;
end;
$$;

revoke all on function public.unmark_bento_on_edit() from public, anon, authenticated;

drop trigger if exists bento_items_unmark_on_edit on public.bento_items;
create trigger bento_items_unmark_on_edit
  after insert or update or delete on public.bento_items
  for each row
  execute function public.unmark_bento_on_edit();

-- ─── 6. Une publication à la main lève la marque ─────────────────────────

create or replace function public.unmark_bento_on_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.published_at is not null and old.published_at is null then
    new.publish_on_validation_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.unmark_bento_on_publish() from public, anon, authenticated;

drop trigger if exists bentos_unmark_on_publish on public.bentos;
create trigger bentos_unmark_on_publish
  before update of published_at on public.bentos
  for each row
  execute function public.unmark_bento_on_publish();

-- ─── 7. La première publication, qui peut marquer (D3) ───────────────────

-- Même signature, mêmes contrôles que `20260917100000_editions.sql`. Ce qui
-- change : l'état des items se lit avant de créer le bento, qui naît
-- publié si tout est validé, marqué si un item attend, et refusé si un item
-- ne peut plus y figurer. Une seule insertion : la landing n'est prévenue
-- qu'une fois.
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
  v_state text;
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
  if v_count <> (select count(*) from public.bento_categories
                  where is_active and edition_id is null) then
    raise exception 'Un bento se publie complet.' using errcode = '22023';
  end if;

  -- Un item inconnu échouera plus bas, sur sa clé étrangère.
  select case
    when coalesce(bool_or(i.status not in ('validated', 'pending')), false) then 'blocked'
    when coalesce(bool_or(i.status = 'pending'), false) then 'waiting'
    else 'ready'
  end into v_state
  from jsonb_array_elements(p_items) e
  join public.items i on i.id = (e ->> 'item_id')::uuid;

  if v_state = 'blocked' then
    raise exception 'Un item de ce bento n''est plus disponible : choisis-en un autre.'
      using errcode = '22023';
  end if;

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_uid, p_pseudo, least(p_terms_accepted_at, now()));

  insert into public.bentos (user_id, published_at, publish_on_validation_at)
  values (
    v_uid,
    case when v_state = 'ready' then now() end,
    case when v_state = 'waiting' then now() end
  )
  returning id into v_bento;

  insert into public.bento_items (bento_id, category_id, item_id)
  select v_bento, (e ->> 'category_id')::smallint, (e ->> 'item_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_bento;

exception when unique_violation then
  raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
end;
$$;

revoke execute on function public.publish_first_bento(text, timestamptz, jsonb) from public, anon;
grant execute on function public.publish_first_bento(text, timestamptz, jsonb) to authenticated;

comment on function public.publish_first_bento(text, timestamptz, jsonb) is
  'Crée profil, bento principal et cases en une transaction, pour le parcours '
  '« pseudo au moment de publier » du chantier 9. Publie si tout est validé, '
  'marque le bento pour la validation si un item attend (chantier 18, D3). '
  'Refuse un compte qui a déjà un profil.';

-- ─── 8. La notification dit le bento publié (D4) ─────────────────────────

-- Même fonction que `20260917140000_push_notifications.sql`, qui ajoute à
-- l'événement le bento que cette transaction vient de publier. La clé n'est
-- là que dans ce cas : sans publication, l'événement reste identique.
create or replace function public.notify_item_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_published uuid;
  v_body      jsonb;
begin
  if new.status in ('validated', 'merged') then
    select b.id into v_published
    from public.bentos b
    where b.user_id = new.submitted_by
      and b.auto_published_at = now()
      and exists (
        select 1 from public.bento_items bi
        where bi.bento_id = b.id
          and bi.item_id = case
            when new.status = 'merged' then coalesce(new.merged_into_id, new.id)
            else new.id
          end
      )
    order by b.is_primary desc, b.created_at
    limit 1;
  end if;

  v_body := jsonb_build_object(
    'type',    'item_moderated',
    'item_id', new.id,
    'status',  new.status
  );
  if v_published is not null then
    v_body := v_body || jsonb_build_object('published_bento_id', v_published);
  end if;

  perform public.push_webhook_post('/api/push', v_body);
  return null;

exception when others then
  -- Jamais au détriment de la modération : un back-office injoignable, une
  -- extension absente ou un secret mal formé ne doivent pas empêcher de
  -- valider, fusionner ou refuser un item.
  return null;
end;
$$;

revoke all on function public.notify_item_moderation() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- Sur Supabase local, dans une transaction annulée :
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-publication.sql
--
-- `check-push.sql`, `check-editions.sql` et `check-bentos-multi.sql` doivent
-- rester verts à côté.
