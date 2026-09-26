-- Contrôles « publication à la validation », chantier 18, lot 1.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, ni compte, ni bento, ni secret de coffre, ni
-- appel en file, et peut se relancer autant de fois qu'on veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-publication.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué. Le script construit ses propres
-- données : il tourne sur une base remise à zéro.
--
-- Ce que ces contrôles gardent, §7.1 de la spécification :
--
--   1. la marque ne se pose que sur un bento complet, non publié, à
--      l'appelant, dont un item attend et qu'aucun refus ne bloque ;
--   2. valider le dernier item en attente publie, à la date de la
--      validation ; l'avant-dernier, non ;
--   3. la fusion vaut validation, et une fusion qui vide une case ne publie
--      pas ;
--   4. un refus lève la marque ;
--   5. l'auteur qui remplace l'item en attente ou vide une case lève la
--      marque ; une réécriture du back-office, non (D2) ;
--   6. ⚠️ un bento non marqué ne sort jamais : c'est ce qui laisse les
--      versions publiées telles quelles (D5) ;
--   7. une publication à la main lève la marque ;
--   8. une édition compte ses propres cases ;
--   9. l'événement de modération porte le bento publié, et seulement dans ce
--      cas : sinon, il reste identique à celui du chantier 17 ;
--  10. `publish_first_bento` marque quand un item attend, publie sinon, et
--      refuse un item qui n'est plus disponible (D3) ;
--  11. aucun client n'écrit les deux colonnes ni n'appelle les fonctions
--      internes, et l'anonyme ne marque rien.

begin;

-- Deux fonctions de travail, dans le schéma temporaire de la session : elles
-- disparaissent avec elle, et ne servent qu'en `postgres`.

-- Un bento non publié à `p_user`, rempli dans l'ordre des six cases
-- principales ; une entrée nulle laisse sa case vide.
create function pg_temp.bento_de(p_user uuid, p_items uuid[], p_edition smallint default null)
returns uuid
language plpgsql
as $$
declare
  v_bento uuid;
  v_cases smallint[];
begin
  select array_agg(id order by display_order) into v_cases
  from public.bento_categories
  where is_active and edition_id is not distinct from p_edition;

  insert into public.bentos (user_id, slug, is_primary, edition_id)
  values (p_user, 'controle-' || substr(md5(random()::text), 1, 10), false, p_edition)
  returning id into v_bento;

  insert into public.bento_items (bento_id, category_id, item_id)
  select v_bento, v_cases[i], p_items[i]
  from generate_subscripts(p_items, 1) as i
  where p_items[i] is not null;

  return v_bento;
end;
$$;

-- Une proposition de `p_user` pour la case principale de rang `p_rang` :
-- en attente, à son nom.
create function pg_temp.proposition(p_user uuid, p_rang int)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.items (category_id, external_source, title, submitted_by)
  values (
    (select id from public.bento_categories
      where is_active and edition_id is null
      order by display_order offset p_rang - 1 limit 1),
    'user',
    'Proposition de contrôle ' || substr(md5(random()::text), 1, 6),
    p_user
  )
  returning id into v_id;
  return v_id;
end;
$$;

do $$
declare
  v_ok      int := 0;
  v_ko      int := 0;
  v_a       uuid := gen_random_uuid();  -- avec profil
  v_b       uuid := gen_random_uuid();  -- avec profil, l'intrus
  v_c       uuid := gen_random_uuid();  -- sans profil, un item en attente
  v_d       uuid := gen_random_uuid();  -- sans profil, tout validé
  v_e       uuid := gen_random_uuid();  -- sans profil, un item refusé
  v_cases   smallint[];
  v_val     uuid[] := '{}';
  v_alt     uuid[] := '{}';
  v_tmp     uuid;
  v_bento   uuid;
  v_bento2  uuid;
  v_p1      uuid;
  v_p2      uuid;
  v_row     public.bentos;
  v_mark    boolean;
  v_n       int;
  v_body    jsonb;
  v_edition smallint;
  v_items   jsonb;
begin
  if exists (select 1 from vault.secrets where name in ('push_webhook_url', 'push_webhook_token')) then
    raise exception 'Des secrets push_* existent en local : ce script compte la file de pg_net et part d''un coffre sans eux.';
  end if;

  -- ── Données du contrôle ─────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'controle-publication-' || n || '@exemple.test', now(), now()
  from unnest(array[v_a, v_b, v_c, v_d, v_e]) with ordinality as t(u, n);

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_a, 'controle.pub.a', now()), (v_b, 'controle.pub.b', now());

  select array_agg(id order by display_order) into v_cases
  from public.bento_categories where is_active and edition_id is null;

  -- Deux items validés par case principale : le second sert aux
  -- remplacements et à la fusion.
  for i in 1..6 loop
    insert into public.items (category_id, external_source, title, status)
    values (v_cases[i], 'admin', 'Validé de contrôle ' || i, 'validated')
    returning id into v_tmp;
    v_val := v_val || v_tmp;
    insert into public.items (category_id, external_source, title, status)
    values (v_cases[i], 'admin', 'Autre validé de contrôle ' || i, 'validated')
    returning id into v_tmp;
    v_alt := v_alt || v_tmp;
  end loop;

  -- ── 1. La marque ────────────────────────────────────────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);

  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento);
  reset role;
  if not v_mark and (select publish_on_validation_at is null from public.bentos where id = v_bento) then
    raise notice 'ok  1a un autre compte ne marque pas le bento';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1a un autre compte a marqué le bento';
    v_ko := v_ko + 1;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento);
  reset role;
  if v_mark and (select publish_on_validation_at is not null from public.bentos where id = v_bento) then
    raise notice 'ok  1b l''auteur marque son bento complet dont un item attend';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1b marque refusée à l''auteur : %', v_mark;
    v_ko := v_ko + 1;
  end if;

  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento);
  reset role;
  if v_mark then
    raise notice 'ok  1c marquer deux fois rend vrai, sans erreur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1c la seconde marque rend faux';
    v_ko := v_ko + 1;
  end if;

  -- Incomplet, tout validé, déjà publié, bloqué par un refus.
  v_p2 := pg_temp.proposition(v_a, 6);
  v_bento2 := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], null, v_p2]);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento2);
  reset role;
  if not v_mark then
    raise notice 'ok  1d un bento incomplet ne se marque pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1d un bento incomplet s''est marqué';
    v_ko := v_ko + 1;
  end if;

  v_bento2 := pg_temp.bento_de(v_a, v_val);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento2);
  reset role;
  if not v_mark then
    raise notice 'ok  1e un bento où rien n''attend ne se marque pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1e un bento où rien n''attend s''est marqué';
    v_ko := v_ko + 1;
  end if;

  v_p2 := pg_temp.proposition(v_a, 6);
  v_bento2 := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p2]);
  update public.bentos set published_at = now() where id = v_bento2;
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento2);
  reset role;
  if not v_mark then
    raise notice 'ok  1f un bento déjà publié ne se marque pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1f un bento publié s''est marqué';
    v_ko := v_ko + 1;
  end if;

  v_p2 := pg_temp.proposition(v_a, 5);
  update public.items set status = 'rejected' where id = v_p2;
  v_tmp := pg_temp.proposition(v_a, 6);
  v_bento2 := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_p2, v_tmp]);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento2);
  reset role;
  if not v_mark then
    raise notice 'ok  1g un bento qui porte un refus ne se marque pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1g un bento qui porte un refus s''est marqué';
    v_ko := v_ko + 1;
  end if;

  perform set_config('request.jwt.claims', null, true);
  begin
    set local role anon;
    perform public.mark_publish_on_validation(v_bento);
    reset role;
    raise warning 'KO  1h l''anonyme a pu appeler la marque';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  1h l''anonyme ne marque rien';
    v_ok := v_ok + 1;
  end;

  -- ── 2. La validation du dernier item en attente publie ──────────────
  v_p1 := pg_temp.proposition(v_a, 5);
  v_p2 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_p1, v_p2]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  update public.items set status = 'validated' where id = v_p1;
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is null and v_row.publish_on_validation_at is not null then
    raise notice 'ok  2a l''avant-dernier item validé ne publie pas, la marque tient';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2a après l''avant-dernier : publié %, marque %', v_row.published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  update public.items set status = 'validated' where id = v_p2;
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is not null
     and v_row.auto_published_at = v_row.published_at
     and v_row.publish_on_validation_at is null then
    raise notice 'ok  2b le dernier item validé publie le bento, et la trace le note';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2b après le dernier : publié %, trace %, marque %',
      v_row.published_at, v_row.auto_published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  if v_row.published_at = (select validated_at from public.items where id = v_p2) then
    raise notice 'ok  2c le bento sort à la date de la validation';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2c publié %, validé %', v_row.published_at,
      (select validated_at from public.items where id = v_p2);
    v_ko := v_ko + 1;
  end if;

  -- ── 3. La fusion vaut validation ────────────────────────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  perform public.admin_merge_items(v_alt[6], array[v_p1]);
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is not null and v_row.auto_published_at is not null
     and exists (select 1 from public.bento_items where bento_id = v_bento and item_id = v_alt[6]) then
    raise notice 'ok  3a la fusion de l''item en attente publie le bento';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3a après la fusion : publié %, marque %', v_row.published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  -- Artiste et créateur partagent le type personne : un bento qui porte déjà
  -- l'item conservé perd la case du perdant.
  v_p1 := pg_temp.proposition(v_a, 5);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_p1, v_val[6]]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  perform public.admin_merge_items(v_val[3], array[v_p1]);
  select * into v_row from public.bentos where id = v_bento;
  select count(*) into v_n from public.bento_items where bento_id = v_bento;
  if v_n = 5 and v_row.published_at is null and v_row.publish_on_validation_at is null then
    raise notice 'ok  3b une fusion qui vide une case ne publie pas, et la marque tombe';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3b % cases, publié %, marque %', v_n, v_row.published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  -- ── 4. Un refus lève la marque ──────────────────────────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  update public.items set status = 'rejected', rejected_reason = 'Refus de contrôle' where id = v_p1;
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is null and v_row.publish_on_validation_at is null then
    raise notice 'ok  4  un refus lève la marque, sans publier';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4  après le refus : publié %, marque %', v_row.published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  -- ── 5. Ce que l'auteur change pendant l'attente (D2) ────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  update public.bento_items set item_id = v_alt[6] where bento_id = v_bento and category_id = v_cases[6];
  reset role;
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is null and v_row.publish_on_validation_at is null then
    raise notice 'ok  5a l''auteur remplace l''item en attente : la marque tombe, rien ne sort';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5a après le remplacement : publié %, marque %', v_row.published_at, v_row.publish_on_validation_at;
    v_ko := v_ko + 1;
  end if;

  v_p1 := pg_temp.proposition(v_a, 6);
  perform set_config('request.jwt.claims', null, true);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  delete from public.bento_items where bento_id = v_bento and category_id = v_cases[1];
  reset role;
  if (select publish_on_validation_at is null from public.bentos where id = v_bento) then
    raise notice 'ok  5b l''auteur vide une case : la marque tombe';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5b la marque tient sur un bento incomplet';
    v_ko := v_ko + 1;
  end if;

  v_p1 := pg_temp.proposition(v_a, 6);
  perform set_config('request.jwt.claims', null, true);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  update public.bento_items set item_id = v_alt[1] where bento_id = v_bento and category_id = v_cases[1];
  reset role;
  if (select publish_on_validation_at is not null from public.bentos where id = v_bento) then
    raise notice 'ok  5c l''auteur change une autre case : la marque tient';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5c la marque est tombée sur un changement sans effet';
    v_ko := v_ko + 1;
  end if;

  -- Le back-office, sans session d'auteur : la marque tient, la modération
  -- tranchera.
  perform set_config('request.jwt.claims', null, true);
  update public.bento_items set item_id = v_alt[6] where bento_id = v_bento and category_id = v_cases[6];
  if (select publish_on_validation_at is not null from public.bentos where id = v_bento) then
    raise notice 'ok  5d une réécriture du back-office ne lève pas la marque';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5d une réécriture du back-office a levé la marque';
    v_ko := v_ko + 1;
  end if;

  -- ── 6. ⚠️ Un bento non marqué ne sort jamais (D5) ───────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  update public.items set status = 'validated' where id = v_p1;
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is null and v_row.auto_published_at is null then
    raise notice 'ok  6  un bento non marqué reste non publié à la validation';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6  un bento non marqué est sorti : %', v_row.published_at;
    v_ko := v_ko + 1;
  end if;

  -- ── 7. Une publication à la main lève la marque ─────────────────────
  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  update public.bentos set published_at = now() where id = v_bento;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  select * into v_row from public.bentos where id = v_bento;
  if v_row.published_at is not null and v_row.publish_on_validation_at is null
     and v_row.auto_published_at is null then
    raise notice 'ok  7  publier à la main lève la marque, sans trace automatique';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7  publié %, marque %, trace %', v_row.published_at,
      v_row.publish_on_validation_at, v_row.auto_published_at;
    v_ko := v_ko + 1;
  end if;

  -- ── 8. Une édition compte ses propres cases ─────────────────────────
  insert into public.editions (slug, title, released_at)
  values ('controle-publication', 'Édition de contrôle', now() - interval '1 hour')
  returning id into v_edition;
  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('ctrl-pub-film', 'Film', 'Le film de contrôle', 'FILM', 'm', 1, 'admin',
     (select id from public.item_types where key = 'film'), v_edition),
    ('ctrl-pub-serie', 'Série', 'La série de contrôle', 'SÉRIE', 'f', 2, 'admin',
     (select id from public.item_types where key = 'series'), v_edition);

  -- Un compte n'a qu'un bento par édition (`bentos_one_per_edition`) :
  -- l'édition incomplète est celle de l'autre compte.
  v_p1 := pg_temp.proposition(v_a, 2);
  v_p2 := pg_temp.proposition(v_b, 2);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_p1], v_edition);
  v_bento2 := pg_temp.bento_de(v_b, array[null, v_p2], v_edition);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_mark := public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if v_mark and not public.mark_publish_on_validation(v_bento2) then
    reset role;
    raise notice 'ok  8a une édition complète sur ses deux cases se marque, pas à une case';
    v_ok := v_ok + 1;
  else
    reset role;
    raise warning 'KO  8a édition : deux cases %', v_mark;
    v_ko := v_ko + 1;
  end if;
  perform set_config('request.jwt.claims', null, true);

  update public.items set status = 'validated' where id in (v_p1, v_p2);
  if (select published_at is not null from public.bentos where id = v_bento)
     and (select published_at is null from public.bentos where id = v_bento2) then
    raise notice 'ok  8b l''édition complète sort à la validation, l''incomplète non';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  8b édition après validation';
    v_ko := v_ko + 1;
  end if;

  -- ── 9. L'événement de modération ────────────────────────────────────
  perform vault.create_secret('http://back-office.test/', 'push_webhook_url');
  perform vault.create_secret('jeton-de-controle', 'push_webhook_token');

  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_publish_on_validation(v_bento);
  reset role;
  perform set_config('request.jwt.claims', null, true);

  update public.items set status = 'validated' where id = v_p1;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_p1,
                                 'status', 'validated', 'published_bento_id', v_bento) then
    raise notice 'ok  9a l''événement porte le bento que la validation a publié';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  9a corps %', v_body;
    v_ko := v_ko + 1;
  end if;

  v_p1 := pg_temp.proposition(v_a, 6);
  v_bento := pg_temp.bento_de(v_a, array[v_val[1], v_val[2], v_val[3], v_val[4], v_val[5], v_p1]);
  update public.items set status = 'validated' where id = v_p1;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_p1, 'status', 'validated') then
    raise notice 'ok  9b sans publication, l''événement reste celui du chantier 17';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  9b corps %', v_body;
    v_ko := v_ko + 1;
  end if;

  v_p1 := pg_temp.proposition(v_a, 6);
  update public.items set status = 'rejected' where id = v_p1;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_p1, 'status', 'rejected') then
    raise notice 'ok  9c un refus garde l''événement du chantier 17';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  9c corps %', v_body;
    v_ko := v_ko + 1;
  end if;

  -- ── 10. La première publication (D3) ────────────────────────────────
  v_p1 := pg_temp.proposition(v_c, 6);
  v_items := (select jsonb_agg(jsonb_build_object('category_id', v_cases[i], 'item_id',
                case when i = 6 then v_p1 else v_val[i] end))
              from generate_series(1, 6) i);
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    v_bento := public.publish_first_bento('controle.pub.c', now(), v_items);
  exception when others then
    v_bento := null;
    raise warning 'KO  10a première publication refusée : %', sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if v_bento is not null then
    select * into v_row from public.bentos where id = v_bento;
    if v_row.published_at is null and v_row.publish_on_validation_at is not null
       and exists (select 1 from public.users where id = v_c) then
      raise notice 'ok  10a sans profil, un item en attente : profil et bento marqué, non publié';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  10a publié %, marque %', v_row.published_at, v_row.publish_on_validation_at;
      v_ko := v_ko + 1;
    end if;
    update public.items set status = 'validated' where id = v_p1;
    if (select published_at is not null from public.bentos where id = v_bento) then
      raise notice 'ok  10b ce bento sort à la validation, sans que l''auteur revienne';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  10b le premier bento marqué n''est pas sorti';
      v_ko := v_ko + 1;
    end if;
  else
    v_ko := v_ko + 2;
  end if;

  v_items := (select jsonb_agg(jsonb_build_object('category_id', v_cases[i], 'item_id', v_val[i]))
              from generate_series(1, 6) i);
  perform set_config('request.jwt.claims', json_build_object('sub', v_d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    v_bento := public.publish_first_bento('controle.pub.d', now(), v_items);
  exception when others then
    v_bento := null;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);
  if v_bento is not null
     and (select published_at is not null and publish_on_validation_at is null
            from public.bentos where id = v_bento) then
    raise notice 'ok  10c sans profil, tout validé : publié tout de suite, comme avant';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  10c première publication tout validé';
    v_ko := v_ko + 1;
  end if;

  v_p1 := pg_temp.proposition(v_e, 6);
  update public.items set status = 'rejected' where id = v_p1;
  v_items := (select jsonb_agg(jsonb_build_object('category_id', v_cases[i], 'item_id',
                case when i = 6 then v_p1 else v_val[i] end))
              from generate_series(1, 6) i);
  perform set_config('request.jwt.claims', json_build_object('sub', v_e, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.publish_first_bento('controle.pub.e', now(), v_items);
    reset role;
    raise warning 'KO  10d un bento portant un refus a été créé';
    v_ko := v_ko + 1;
  exception when invalid_parameter_value then
    reset role;
    if not exists (select 1 from public.users where id = v_e) then
      raise notice 'ok  10d un item refusé est refusé, et aucun profil ne naît';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  10d un profil est né malgré le refus';
      v_ko := v_ko + 1;
    end if;
  end;
  perform set_config('request.jwt.claims', null, true);

  -- ── 11. Les droits ──────────────────────────────────────────────────
  v_bento := (select id from public.bentos where user_id = v_a limit 1);
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    update public.bentos set publish_on_validation_at = now() where id = v_bento;
    reset role;
    raise warning 'KO  11a un client a écrit la marque';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  11a un client n''écrit pas la marque';
    v_ok := v_ok + 1;
  end;

  begin
    set local role authenticated;
    update public.bentos set auto_published_at = now() where id = v_bento;
    reset role;
    raise warning 'KO  11b un client a écrit la trace';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  11b un client n''écrit pas la trace';
    v_ok := v_ok + 1;
  end;

  begin
    set local role authenticated;
    perform public.bento_is_complete(v_bento);
    reset role;
    raise warning 'KO  11c un client appelle bento_is_complete';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  11c un client n''appelle pas les fonctions internes';
    v_ok := v_ok + 1;
  end;
  perform set_config('request.jwt.claims', null, true);

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
  if v_ko > 0 then
    raise exception '% contrôles manqués', v_ko;
  end if;
end $$;

rollback;
