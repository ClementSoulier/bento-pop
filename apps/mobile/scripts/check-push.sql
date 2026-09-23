-- Contrôles « notifications push », chantier 17, lots 1 à 3.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, ni compte, ni jeton, ni secret de coffre, ni appel
-- en file, et peut donc se relancer autant de fois qu'on veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-push.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué.
--
-- **Aucun appel ne part.** `net.http_post` ne fait que mettre une requête en
-- file dans `net.http_request_queue`, que le travailleur de `pg_net` ne lit
-- qu'après validation de la transaction. Le script compte cette file, puis
-- annule tout.
--
-- Ce que ces contrôles gardent, et pourquoi chacun a été écrit (§7.2 de la
-- spécification) :
--
--   1. un client ne lit que ses propres appareils ;
--   2. il ne règle que ses deux interrupteurs, et seulement les siens ;
--   3. un item saisi au back-office, sans auteur, ne prévient personne ;
--   4. sans secret de coffre, rien ne part et la modération passe : c'est ce
--      qui rend la migration inerte en production avant l'envoi (D11) ;
--   5. deux appareils du même compte font deux lignes ;
--   6. ⚠️ un jeton qu'un autre compte détenait change de propriétaire au lieu
--      d'échouer, et l'accord éditorial ne le suit pas ;
--   7. avec les secrets, valider, fusionner ou refuser un item proposé met
--      exactement un appel en file, avec le bon type (D12) ;
--   8. ⚠️ proposer un item comme le fait la 1.1 passe toujours ;
--   9. aucune fonction d'envoi ni table de tickets n'est ouverte aux clients ;
--  10. ⚠️ sans profil, on propose un item et on enregistre son appareil : le
--      profil ne naît qu'à la première publication depuis le chantier 9, et
--      les deux le réclamaient (D13) ;
--  11. supprimer un profil efface toujours ses traces : ses propositions
--      perdent leur auteur, ses appareils disparaissent ;
--  12. `pg_cron` programme le battement toutes les 5 minutes et la purge
--      chaque nuit, et rien d'autre (D10) ;
--  13. la purge efface les tickets relus depuis plus de 30 jours et garde les
--      autres (D18), et l'historique de `pg_cron` de plus de 7 jours ;
--  14. `push_health` n'a qu'une ligne, qu'aucun client ne lit, et aucun
--      client n'exécute la purge ;
--  15. un ticket porte son item ou son édition, et survit à leur suppression.

begin;

do $$
declare
  v_ok       int := 0;
  v_ko       int := 0;
  v_a        uuid := gen_random_uuid();
  v_b        uuid := gen_random_uuid();
  v_c        uuid := gen_random_uuid();
  v_d        uuid := gen_random_uuid();
  v_prop_c   uuid;
  v_prop_d   uuid;
  v_tok_a1   text := 'ExponentPushToken[controle-push-a-iphone]';
  v_tok_a2   text := 'ExponentPushToken[controle-push-a-ipad]';
  v_tok_b    text := 'ExponentPushToken[controle-push-b-pixel]';
  v_film     smallint;
  v_type     smallint;
  v_admin    uuid;
  v_canon    uuid;
  v_prop1    uuid;
  v_prop2    uuid;
  v_prop3    uuid;
  v_row      public.push_tokens;
  v_n        int;
  v_file     int;
  v_body     jsonb;
  v_url      text;
  v_auth     text;
  v_posted   boolean;
  v_token_id uuid;
  v_item     uuid;
  v_edition  smallint;
  v_job      bigint;
begin
  -- ── Données du contrôle ─────────────────────────────────────────────
  -- Deux comptes avec profil, et deux items saisis au back-office : l'un en
  -- attente sans auteur, l'autre validé, qui servira d'item conservé à une
  -- fusion.

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'controle-push-a@exemple.test', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'controle-push-b@exemple.test', now(), now());

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_a, 'controle.push.a', now()), (v_b, 'controle.push.b', now());

  select id, type_id into v_film, v_type
  from public.bento_categories
  where key = 'film' and edition_id is null;

  insert into public.items (category_id, type_id, external_source, title, status)
  values (v_film, v_type, 'admin', 'Film du back-office en attente', 'pending')
  returning id into v_admin;

  insert into public.items (category_id, type_id, external_source, title, status)
  values (v_film, v_type, 'admin', 'Film conservé', 'validated')
  returning id into v_canon;

  -- ── 8. ⚠️ Proposer un item comme le fait la 1.1 ─────────────────────
  -- Forme exacte de `submitItem` dans la 1.1 (`src/lib/items.ts`, commit
  -- `6426779`) : trois colonnes, puis relecture de l'identifiant.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  begin
    insert into public.items (category_id, external_source, title)
    values (v_film, 'user', 'Proposition de contrôle 1') returning id into v_prop1;
    insert into public.items (category_id, external_source, title)
    values (v_film, 'user', 'Proposition de contrôle 2') returning id into v_prop2;
    insert into public.items (category_id, external_source, title)
    values (v_film, 'user', 'Proposition de contrôle 3') returning id into v_prop3;
    raise notice 'ok  8a proposer un item comme la 1.1 passe';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  8a proposer un item comme la 1.1 échoue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  reset role;

  select count(*) into v_n
  from public.items
  where id in (v_prop1, v_prop2, v_prop3)
    and status = 'pending'
    and submitted_by = v_a;
  if v_n = 3 then
    raise notice 'ok  8b les propositions sont en attente, au nom de leur auteur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  8b % propositions en attente au nom de leur auteur au lieu de 3', v_n;
    v_ko := v_ko + 1;
  end if;

  select count(*) into v_file from net.http_request_queue;
  if v_file = 0 then
    raise notice 'ok  8c une proposition ne met rien en file';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  8c % appels en file après des propositions', v_file;
    v_ko := v_ko + 1;
  end if;

  -- ── Enregistrement des appareils ────────────────────────────────────
  -- A a deux appareils, B un seul.
  set local role authenticated;
  begin
    perform public.register_push_token(v_tok_a1, 'ios');
    perform public.register_push_token(v_tok_a2, 'ios');
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', v_b, 'role', 'authenticated')::text,
      true
    );
    perform public.register_push_token(v_tok_b, 'android');
  exception when others then
    raise warning 'KO  enregistrement des appareils : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;

  -- ── 5. Deux appareils du même compte, deux lignes ───────────────────
  select count(distinct id) into v_n from public.push_tokens where user_id = v_a;
  if v_n = 2 then
    raise notice 'ok  5  deux appareils du même compte font deux lignes';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5  % lignes pour les deux appareils de A', v_n;
    v_ko := v_ko + 1;
  end if;

  -- ── 1. Un client ne lit que ses propres appareils ───────────────────
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  select count(*) into v_n from public.push_tokens;
  if v_n = 2 and not exists (select 1 from public.push_tokens where user_id <> v_a) then
    raise notice 'ok  1  un client ne lit que ses propres appareils';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1  A lit % appareils, dont ceux d''un autre compte', v_n;
    v_ko := v_ko + 1;
  end if;

  -- ── 2. Il ne règle que ses deux interrupteurs ───────────────────────
  begin
    update public.push_tokens set revoked_at = now() where token = v_tok_a1;
    raise warning 'KO  2a un client a pu poser revoked_at';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  2a un client ne peut pas poser revoked_at';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  2a erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  begin
    update public.push_tokens set user_id = v_b where token = v_tok_a1;
    raise warning 'KO  2b un client a pu donner son appareil à un autre compte';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  2b un client ne peut pas changer le propriétaire';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  2b erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  begin
    update public.push_tokens set editorial = true where token = v_tok_a1;
    get diagnostics v_n = row_count;
    if v_n = 1 then
      raise notice 'ok  2c un client règle l''interrupteur éditorial de son appareil';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  2c % lignes réglées au lieu de 1', v_n;
      v_ko := v_ko + 1;
    end if;
  exception when others then
    raise warning 'KO  2c régler son interrupteur échoue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  update public.push_tokens set transactional = false where token = v_tok_b;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise notice 'ok  2d un client ne règle pas l''appareil d''un autre compte';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2d A a réglé l''appareil de B';
    v_ko := v_ko + 1;
  end if;

  -- ── 6. ⚠️ Un jeton change de propriétaire au lieu d'échouer ─────────
  -- Même compte d'abord : réenregistrer garde les réglages et rafraîchit.
  update public.push_tokens set transactional = false where token = v_tok_a2;
  reset role;
  update public.push_tokens set last_seen_at = now() - interval '10 days' where token = v_tok_a2;
  set local role authenticated;
  v_row := public.register_push_token(v_tok_a2, 'ios');
  if v_row.user_id = v_a and v_row.transactional = false and v_row.last_seen_at > now() - interval '1 minute' then
    raise notice 'ok  6a réenregistré par son compte, l''appareil garde ses réglages et se rafraîchit';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6a réenregistrement : propriétaire %, transactionnel %, vu %',
      v_row.user_id, v_row.transactional, v_row.last_seen_at;
    v_ko := v_ko + 1;
  end if;

  -- Puis un autre compte : l'appareil de A, accord éditorial donné en 2c et
  -- révoqué entre-temps, passe à B.
  reset role;
  update public.push_tokens set revoked_at = now() where token = v_tok_a1;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_b, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  begin
    v_row := public.register_push_token(v_tok_a1, 'ios');
    if v_row.user_id = v_b and v_row.editorial = false and v_row.transactional = true
       and v_row.revoked_at is null then
      raise notice 'ok  6b un jeton repris par un autre compte change de propriétaire, réglages remis à défaut';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  6b reprise : propriétaire %, éditorial %, transactionnel %, révoqué %',
        v_row.user_id, v_row.editorial, v_row.transactional, v_row.revoked_at;
      v_ko := v_ko + 1;
    end if;
  exception when others then
    raise warning 'KO  6b reprendre un jeton connu échoue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  begin
    perform public.register_push_token('pas-un-jeton', 'ios');
    raise warning 'KO  6c un jeton mal formé a été accepté';
    v_ko := v_ko + 1;
  exception when invalid_parameter_value then
    raise notice 'ok  6c un jeton mal formé est refusé';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  6c erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  perform set_config('request.jwt.claims', null, true);
  begin
    perform public.register_push_token('ExponentPushToken[sans-session]', 'ios');
    raise warning 'KO  6d un appareil s''est enregistré sans session';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  6d sans session, aucun appareil ne s''enregistre';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  6d erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;

  -- ── 9. Rien d'autre n'est ouvert aux clients ────────────────────────
  set local role anon;
  begin
    perform public.register_push_token(v_tok_b, 'android');
    raise warning 'KO  9a l''anonyme peut enregistrer un appareil';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  9a l''anonyme ne peut pas enregistrer d''appareil';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  9a erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  begin
    select count(*) into v_n from public.push_tokens;
    raise warning 'KO  9b l''anonyme lit les appareils';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  9b l''anonyme ne lit pas les appareils';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  9b erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  begin
    perform public.push_tick();
    raise warning 'KO  9c un client peut déclencher le travail planifié';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  9c un client ne peut pas déclencher le travail planifié';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  9c erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  begin
    perform public.push_webhook_post('/api/push', '{}'::jsonb);
    raise warning 'KO  9d un client peut appeler le back-office';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  9d un client ne peut pas appeler le back-office';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  9d erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  begin
    select count(*) into v_n from public.push_tickets;
    raise warning 'KO  9e un client lit les tickets';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  9e un client ne lit pas les tickets';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  9e erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  -- ── 4. Sans secret de coffre, rien ne part ──────────────────────────
  if exists (select 1 from vault.secrets where name in ('push_webhook_url', 'push_webhook_token')) then
    raise warning 'KO  4  des secrets push existent déjà sur cette base : contrôle impossible';
    v_ko := v_ko + 1;
  else
    begin
      update public.items set status = 'validated' where id = v_prop1;
      select count(*) into v_file from net.http_request_queue;
      if v_file = 0 then
        raise notice 'ok  4a sans secret, une validation passe et ne met rien en file';
        v_ok := v_ok + 1;
      else
        raise warning 'KO  4a % appels en file sans secret', v_file;
        v_ko := v_ko + 1;
      end if;
    exception when others then
      raise warning 'KO  4a sans secret, la validation lève : % (%)', sqlerrm, sqlstate;
      v_ko := v_ko + 1;
    end;

    v_posted := public.push_tick();
    select count(*) into v_file from net.http_request_queue;
    if v_posted = false and v_file = 0 then
      raise notice 'ok  4b sans secret, le travail planifié ne poste rien';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  4b sans secret, push_tick rend % et la file compte %', v_posted, v_file;
      v_ko := v_ko + 1;
    end if;
  end if;

  -- ── Les secrets, le temps du contrôle ───────────────────────────────
  -- Avec une barre oblique finale, pour vérifier qu'elle ne double pas.
  perform vault.create_secret('http://back-office.test/', 'push_webhook_url');
  perform vault.create_secret('jeton-de-controle', 'push_webhook_token');

  -- ── 3. Un item sans auteur ne prévient personne ─────────────────────
  update public.items set status = 'validated' where id = v_admin;
  select count(*) into v_file from net.http_request_queue;
  if v_file = 0 then
    raise notice 'ok  3  valider un item du back-office, sans auteur, ne met rien en file';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3  % appels en file pour un item sans auteur', v_file;
    v_ko := v_ko + 1;
  end if;

  -- ── 7. Avec les secrets, un appel par modération ────────────────────
  -- Refus.
  update public.items set status = 'rejected', rejected_reason = 'Doublon de contrôle'
  where id = v_prop2;

  select count(*) into v_file from net.http_request_queue;
  select convert_from(q.body, 'UTF8')::jsonb, q.url, q.headers ->> 'Authorization'
    into v_body, v_url, v_auth
  from net.http_request_queue q
  order by q.id desc
  limit 1;

  if v_file = 1
     and v_url = 'http://back-office.test/api/push'
     and v_auth = 'Bearer jeton-de-controle'
     and v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_prop2, 'status', 'rejected') then
    raise notice 'ok  7a un refus met un appel en file, adresse, jeton et corps exacts';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7a refus : % en file, adresse %, corps %', v_file, v_url, v_body;
    v_ko := v_ko + 1;
  end if;

  -- Fusion, par la fonction du back-office (D12).
  perform public.admin_merge_items(v_canon, array[v_prop3]);
  select count(*) into v_file from net.http_request_queue;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q
  order by q.id desc
  limit 1;
  if v_file = 2
     and v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_prop3, 'status', 'merged') then
    raise notice 'ok  7b une fusion met un appel en file, au nom de l''item fusionné';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7b fusion : % en file, corps %', v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  -- Validation, puis une écriture qui ne change pas le statut.
  update public.items set status = 'pending' where id = v_prop1;
  update public.items set status = 'validated' where id = v_prop1;
  update public.items set subtitle = 'Sous-titre de contrôle' where id = v_prop1;
  select count(*) into v_file from net.http_request_queue;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q
  order by q.id desc
  limit 1;
  if v_file = 3
     and v_body = jsonb_build_object('type', 'item_moderated', 'item_id', v_prop1, 'status', 'validated') then
    raise notice 'ok  7c une validation met un appel en file, une écriture sans changement de statut aucun';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7c validation : % en file au lieu de 3, corps %', v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  -- Le battement.
  v_posted := public.push_tick();
  select count(*) into v_file from net.http_request_queue;
  select q.url, convert_from(q.body, 'UTF8')::jsonb into v_url, v_body
  from net.http_request_queue q
  order by q.id desc
  limit 1;
  if v_posted and v_file = 4
     and v_url = 'http://back-office.test/api/push/tick'
     and v_body = jsonb_build_object('type', 'tick') then
    raise notice 'ok  7d avec les secrets, le travail planifié poste son battement';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7d battement : rendu %, % en file, adresse %', v_posted, v_file, v_url;
    v_ko := v_ko + 1;
  end if;

  -- ── 10. ⚠️ Sans profil, on propose et on enregistre son appareil ────
  -- Le défaut du chantier 9 (D13) : le profil ne naît qu'à la première
  -- publication, et la proposition comme l'appareil le réclamaient. Un compte
  -- anonyme, sans ligne dans `public.users`, comme juste après l'installation.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'controle-push-d@exemple.test', now(), now());

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_d, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  begin
    insert into public.items (category_id, external_source, title)
    values (v_film, 'user', 'Proposition sans profil') returning id into v_prop_d;
    raise notice 'ok  10a sans profil, proposer un item passe';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  10a sans profil, la proposition est refusée : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  begin
    v_row := public.register_push_token('ExponentPushToken[controle-push-d-sans-profil]', 'ios');
    if v_row.user_id = v_d then
      raise notice 'ok  10b sans profil, l''appareil s''enregistre au nom du compte';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  10b appareil enregistré au nom de %', v_row.user_id;
      v_ko := v_ko + 1;
    end if;
  exception when others then
    raise warning 'KO  10b sans profil, l''appareil est refusé : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  reset role;

  -- ── 11. Supprimer un profil efface toujours ses traces ──────────────
  -- Un compte avec profil, une proposition et un appareil, puis le profil
  -- supprimé comme le fait `admin_delete_user`.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'controle-push-c@exemple.test', now(), now());
  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_c, 'controle.push.c', now());

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_c, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  insert into public.items (category_id, external_source, title)
  values (v_film, 'user', 'Proposition d''un profil supprimé') returning id into v_prop_c;
  perform public.register_push_token('ExponentPushToken[controle-push-c-pixel]', 'android');
  reset role;
  perform set_config('request.jwt.claims', null, true);

  delete from public.users where id = v_c;

  if (select submitted_by from public.items where id = v_prop_c) is null
     and not exists (select 1 from public.push_tokens where user_id = v_c) then
    raise notice 'ok  11  supprimer un profil retire l''auteur de ses propositions et ses appareils';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  11  après suppression du profil : auteur %, % appareils',
      (select submitted_by from public.items where id = v_prop_c),
      (select count(*) from public.push_tokens where user_id = v_c);
    v_ko := v_ko + 1;
  end if;

  -- ── 12. Les deux travaux planifiés ──────────────────────────────────
  select count(*) into v_n
  from cron.job
  where active
    and ((jobname = 'push-tick' and schedule = '*/5 * * * *'
          and command = 'select public.push_tick()')
      or (jobname = 'push-purge' and schedule = '30 3 * * *'
          and command = 'select public.push_purge()'));
  if v_n = 2 and (select count(*) from cron.job) = 2 then
    raise notice 'ok  12 pg_cron programme le battement toutes les 5 minutes et la purge chaque nuit, rien d''autre';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  12 travaux planifiés : % conformes sur %', v_n, (select count(*) from cron.job);
    v_ko := v_ko + 1;
  end if;

  -- ── 13. La purge ────────────────────────────────────────────────────
  -- Quatre tickets d'âges différents sur un appareil du compte A, et deux
  -- passages du battement dans l'historique de `pg_cron`.
  select id into v_token_id from public.push_tokens where token = v_tok_a1;

  insert into public.push_tickets (ticket_id, token_id, kind, created_at, checked_at, receipt_status)
  values
    ('controle-relu-il-y-a-31-jours', v_token_id, 'item_moderated',
     now() - interval '32 days', now() - interval '31 days', 'ok'),
    ('controle-relu-il-y-a-29-jours', v_token_id, 'item_moderated',
     now() - interval '30 days', now() - interval '29 days', 'DeviceNotRegistered'),
    ('controle-jamais-relu-recent', v_token_id, 'edition_released',
     now() - interval '10 minutes', null, null),
    ('controle-jamais-relu-32-jours', v_token_id, 'edition_released',
     now() - interval '32 days', null, null);

  -- Numéros de passage négatifs et explicites : `postgres` n'a pas le droit
  -- d'avancer la séquence de `pg_cron`, dont seul son travailleur se sert.
  -- La purge, elle, ne fait qu'effacer.
  select jobid into v_job from cron.job where jobname = 'push-tick';
  insert into cron.job_run_details
    (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
  values
    (v_job, -1, 0, 'postgres', 'postgres', 'select public.push_tick()', 'succeeded', 'controle-8-jours',
     now() - interval '8 days', now() - interval '8 days'),
    (v_job, -2, 0, 'postgres', 'postgres', 'select public.push_tick()', 'succeeded', 'controle-1-jour',
     now() - interval '1 day', now() - interval '1 day');

  perform public.push_purge();

  if (select array_agg(ticket_id order by ticket_id) from public.push_tickets
      where ticket_id like 'controle-%')
       = array['controle-jamais-relu-recent', 'controle-relu-il-y-a-29-jours']
     and (select array_agg(return_message order by return_message) from cron.job_run_details
          where return_message like 'controle-%')
       = array['controle-1-jour'] then
    raise notice 'ok  13 la purge efface les tickets relus depuis plus de 30 jours et l''historique de plus de 7 jours, rien d''autre';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  13 après la purge : tickets %, historique %',
      (select array_agg(ticket_id order by ticket_id) from public.push_tickets where ticket_id like 'controle-%'),
      (select array_agg(return_message order by return_message) from cron.job_run_details where return_message like 'controle-%');
    v_ko := v_ko + 1;
  end if;

  -- ── 14. La ligne de santé, et ce qu'aucun client ne touche ──────────
  begin
    insert into public.push_health (id) values (false);
    raise warning 'KO  14a une seconde ligne de santé est acceptée';
    v_ko := v_ko + 1;
  exception when check_violation then
    if (select count(*) from public.push_health) = 1 then
      raise notice 'ok  14a push_health n''a qu''une ligne';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  14a push_health compte % lignes', (select count(*) from public.push_health);
      v_ko := v_ko + 1;
    end if;
  when others then
    raise warning 'KO  14a erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_a, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
  begin
    select count(*) into v_n from public.push_health;
    raise warning 'KO  14b un client lit la ligne de santé';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  14b un client ne lit pas la ligne de santé';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  14b erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  begin
    perform public.push_purge();
    raise warning 'KO  14c un client peut lancer la purge';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  14c un client ne peut pas lancer la purge';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  14c erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;
  perform set_config('request.jwt.claims', null, true);

  set local role anon;
  begin
    select count(*) into v_n from public.push_health;
    raise warning 'KO  14d l''anonyme lit la ligne de santé';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    raise notice 'ok  14d l''anonyme ne lit pas la ligne de santé';
    v_ok := v_ok + 1;
  when others then
    raise warning 'KO  14d erreur inattendue : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;
  reset role;

  -- ── 15. Un ticket porte son item ou son édition ─────────────────────
  insert into public.items (category_id, type_id, external_source, title, status)
  values (v_film, v_type, 'admin', 'Item supprimé après envoi', 'validated')
  returning id into v_item;
  insert into public.editions (slug, title, released_at)
  values ('edition-de-controle-push', 'Édition de contrôle', now() - interval '1 hour')
  returning id into v_edition;

  insert into public.push_tickets (ticket_id, token_id, kind, item_id)
  values ('controle-porte-un-item', v_token_id, 'item_moderated', v_item);
  insert into public.push_tickets (ticket_id, token_id, kind, edition_id)
  values ('controle-porte-une-edition', v_token_id, 'edition_released', v_edition);

  delete from public.items where id = v_item;
  delete from public.editions where id = v_edition;

  if (select count(*) from public.push_tickets
      where ticket_id in ('controle-porte-un-item', 'controle-porte-une-edition')
        and item_id is null and edition_id is null) = 2 then
    raise notice 'ok  15 un ticket porte son item ou son édition, et survit à leur suppression';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  15 tickets après suppression : %',
      (select array_agg(ticket_id) from public.push_tickets
       where ticket_id in ('controle-porte-un-item', 'controle-porte-une-edition'));
    v_ko := v_ko + 1;
  end if;

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
  if v_ko > 0 then
    raise exception '% contrôles manqués', v_ko;
  end if;
end $$;

rollback;
