-- Contrôles « profil d'un compte », chantier 21, lot 1.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, ni compte, ni bento, ni motif interdit, ni appel
-- en file, et peut se relancer autant de fois qu'on veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-profile.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué. Le script construit ses propres
-- données, à des pseudos qu'aucun autre compte ne porte.
--
-- Le jeu de données, quatre comptes :
--
--   A : deux bentos publiés, cp-a et cp-a2, qui partagent un item avec B
--   B : un bento publié, cp-b
--   C : un compte sans bento publié
--   D : un compte qui change de pseudo, puis se supprime
--
-- Ce que ces contrôles gardent, §6.1 et §10 de la spécification :
--
--   1. le nom affiché : une ligne, 30 caractères, les motifs interdits (D4) ;
--   2. le Popy : une des six clés, ou rien (D7) ;
--   3. le pseudo : les règles de la création, 30 jours entre deux
--      changements, le Popy figé au changement (D5, D7) ;
--   4. la réserve des anciens pseudos, à la création comme au changement, et
--      leur reprise par leur titulaire (D6) ;
--   5. les lectures : la redirection, la reprise des blocages, ce que
--      l'écran peut dire d'un pseudo, l'historique fermé aux clients (D6,
--      D8, D16) ;
--   6. la recherche et les matchs rendent le compte et son Popy (D14) ;
--   7. les pages web suivent le pseudo, le nom et le Popy (D15) ;
--   8. supprimer un compte libère ses anciens pseudos (D12).

begin;

-- Le compte au nom duquel l'appel part, comme PostgREST le pose pour un
-- appel avec session.
create function pg_temp.as_account(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

do $$
declare
  v_ok      int := 0;
  v_ko      int := 0;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
  v_f uuid := gen_random_uuid();
  v_tag     text := substr(md5(random()::text), 1, 6);
  v_pa      text;
  v_pb      text;
  v_pc      text;
  v_pd      text;
  v_pn      text;
  v_forbid  text;
  v_item    uuid;
  v_ba uuid; v_ba2 uuid; v_bb uuid;
  v_got     text;
  v_n       int;
  v_file    int;
  v_body    jsonb;
  v_when    timestamptz;
  v_hint    text;
begin
  v_pa := 'cp_a_' || v_tag;
  v_pb := 'cp_b_' || v_tag;
  v_pc := 'cp_c_' || v_tag;
  v_pd := 'cp_d_' || v_tag;
  v_pn := 'cp_n_' || v_tag;
  -- Un motif interdit propre au contrôle, retiré avec lui.
  v_forbid := 'zq' || v_tag;

  -- ── Données du contrôle ─────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'controle-profil-' || n || '-' || v_tag || '@exemple.test', now(), now()
  from unnest(array[v_a, v_b, v_c, v_d, v_f]) with ordinality as t(u, n);

  insert into public.users (id, pseudo, terms_accepted_at) values
    (v_a, v_pa, now()), (v_b, v_pb, now()), (v_c, v_pc, now()), (v_d, v_pd, now());

  insert into public.blocked_pseudo_patterns (pattern, label)
  values (v_forbid, 'contrôle du chantier 21');

  insert into public.items (category_id, type_id, external_source, external_id, title, status)
  values (1, 1, 'controle', 'cp-' || v_tag, substr(md5(random()::text), 1, 16), 'validated')
  returning id into v_item;

  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_a, 'cp-a', true, now() - interval '3 days') returning id into v_ba;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_a, 'cp-a2', false, now() - interval '2 days') returning id into v_ba2;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_b, 'cp-b', true, now() - interval '1 day') returning id into v_bb;

  insert into public.bento_items (bento_id, category_id, item_id) values
    (v_ba, 1, v_item), (v_bb, 1, v_item);

  -- Les secrets de la landing, pour voir partir les rafraîchissements.
  if not exists (select 1 from vault.secrets where name = 'landing_base_url') then
    perform vault.create_secret('http://landing.test', 'landing_base_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'landing_revalidate_token') then
    perform vault.create_secret('jeton-de-controle', 'landing_revalidate_token');
  end if;

  -- ════ 1. Le nom affiché (D4) ══════════════════════════════════════════

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  v_got := public.set_display_name('  Alice Martin  ');
  reset role;
  if v_got = 'Alice Martin' and (select display_name from public.users where id = v_a) = 'Alice Martin' then
    raise notice 'ok  1a le nom, débarrassé de ses blancs';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1a nom : %', v_got;
    v_ko := v_ko + 1;
  end if;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_display_name(repeat('n', 30));
  reset role;
  if (select display_name from public.users where id = v_a) = repeat('n', 30) then
    raise notice 'ok  1b trente caractères passent';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1b trente caractères refusés';
    v_ko := v_ko + 1;
  end if;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.set_display_name(repeat('n', 31));
    reset role;
    raise warning 'KO  1c trente et un caractères passent';
    v_ko := v_ko + 1;
  exception when sqlstate '22001' then
    reset role;
    raise notice 'ok  1c trente et un caractères sont refusés';
    v_ok := v_ok + 1;
  end;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.set_display_name('Alice' || chr(10) || 'Martin');
    reset role;
    raise warning 'KO  1d un nom sur deux lignes passe';
    v_ko := v_ko + 1;
  exception when sqlstate '22023' then
    reset role;
    raise notice 'ok  1d un nom sur deux lignes est refusé';
    v_ok := v_ok + 1;
  end;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.set_display_name('Le ' || upper(v_forbid));
    reset role;
    raise warning 'KO  1e un nom qui touche un motif interdit passe';
    v_ko := v_ko + 1;
  exception when sqlstate '23514' then
    reset role;
    raise notice 'ok  1e un nom qui touche un motif interdit est refusé, casse comprise';
    v_ok := v_ok + 1;
  end;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_display_name('   ');
  reset role;
  if (select display_name from public.users where id = v_a) is null then
    raise notice 'ok  1f un nom vide l''efface';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1f un nom vide reste en base';
    v_ko := v_ko + 1;
  end if;

  begin
    set local role anon;
    perform public.set_display_name('Personne');
    reset role;
    raise warning 'KO  1g un visiteur sans session écrit un nom';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  1g un visiteur sans session n''écrit pas de nom';
    v_ok := v_ok + 1;
  end;

  -- ════ 2. Le Popy (D7) ═════════════════════════════════════════════════

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_avatar('nani');
  reset role;
  if (select avatar from public.users where id = v_a) = 'nani' then
    raise notice 'ok  2a un Popy des six s''enregistre';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2a Popy non enregistré';
    v_ko := v_ko + 1;
  end if;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.set_avatar('licorne');
    reset role;
    raise warning 'KO  2b un Popy inconnu passe';
    v_ko := v_ko + 1;
  exception when sqlstate '22023' then
    reset role;
    raise notice 'ok  2b un Popy inconnu est refusé';
    v_ok := v_ok + 1;
  end;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_avatar(null);
  reset role;
  if (select avatar from public.users where id = v_a) is null then
    raise notice 'ok  2c sans Popy, on revient à celui du pseudo';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2c le Popy reste';
    v_ko := v_ko + 1;
  end if;

  -- ════ 3. Le pseudo (D5, D7) ═══════════════════════════════════════════

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.change_pseudo('a b', null);
    reset role;
    raise warning 'KO  3a un pseudo à espace passe';
    v_ko := v_ko + 1;
  exception when sqlstate '22023' then
    reset role;
    raise notice 'ok  3a un pseudo hors du format est refusé';
    v_ok := v_ok + 1;
  end;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.change_pseudo(upper(v_pb), null);
    reset role;
    raise warning 'KO  3b A prend le pseudo de B';
    v_ko := v_ko + 1;
  exception when sqlstate '23505' then
    reset role;
    raise notice 'ok  3b le pseudo d''un autre est pris, casse ignorée';
    v_ok := v_ok + 1;
  end;

  select count(*) into v_file from net.http_request_queue;
  perform pg_temp.as_account(v_a);
  set local role authenticated;
  v_got := public.change_pseudo(v_pn, 'gene');
  reset role;
  if v_got = v_pn
     and (select pseudo from public.users where id = v_a) = v_pn
     and (select pseudo_changed_at from public.users where id = v_a) > now() - interval '1 minute'
     and exists (select 1 from public.pseudo_history where user_id = v_a and pseudo = v_pa) then
    raise notice 'ok  3c le pseudo change, l''ancien part à l''historique, la date est posée';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3c changement : %', v_got;
    v_ko := v_ko + 1;
  end if;

  if (select avatar from public.users where id = v_a) = 'gene' then
    raise notice 'ok  3d sans Popy choisi, celui qu''affichait l''app est figé';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3d Popy : %', (select avatar from public.users where id = v_a);
    v_ko := v_ko + 1;
  end if;

  -- ════ 7. Les pages web, au changement de pseudo (D15) ═════════════════

  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and v_body -> 'paths' @> jsonb_build_array(
       '/u/' || v_pn, '/u/' || v_pn || '/cp-a', '/u/' || v_pn || '/cp-a2',
       '/u/' || v_pa, '/u/' || v_pa || '/cp-a', '/u/' || v_pa || '/cp-a2', '/sitemap.xml')
     and jsonb_array_length(v_body -> 'paths') = 7 then
    raise notice 'ok  7a changer de pseudo rafraîchit l''ancienne adresse, la nouvelle et le sitemap';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7a revalidation : % appel(s), %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  v_when := (select pseudo_changed_at from public.users where id = v_a);
  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.change_pseudo('cp_m_' || v_tag, null);
    reset role;
    raise warning 'KO  3e un second changement passe dans les 30 jours';
    v_ko := v_ko + 1;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_hint = pg_exception_hint;
    reset role;
    if v_hint = to_char((v_when + interval '30 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') then
      raise notice 'ok  3e un second changement attend 30 jours, et la date est dite';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  3e date du prochain changement : %', v_hint;
      v_ko := v_ko + 1;
    end if;
  end;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  v_got := public.change_pseudo(v_pn, null);
  reset role;
  if v_got = v_pn and (select pseudo_changed_at from public.users where id = v_a) = v_when then
    raise notice 'ok  3f rendre son pseudo actuel ne change rien et ne compte pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3f son pseudo actuel compte comme un changement';
    v_ko := v_ko + 1;
  end if;

  -- Le délai passé, sans rien rafraîchir : la date ne s'affiche nulle part.
  select count(*) into v_file from net.http_request_queue;
  update public.users set pseudo_changed_at = now() - interval '31 days' where id = v_a;
  if (select count(*) from net.http_request_queue) = v_file then
    raise notice 'ok  7b la date du dernier changement ne rafraîchit rien';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7b la date du dernier changement rafraîchit les pages';
    v_ko := v_ko + 1;
  end if;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.change_pseudo('cp_bentopop', null);
    reset role;
    raise warning 'KO  3g un pseudo de la marque passe';
    v_ko := v_ko + 1;
  exception when sqlstate '23514' then
    reset role;
    raise notice 'ok  3g un pseudo réservé à la marque est refusé';
    v_ok := v_ok + 1;
  end;

  begin
    perform pg_temp.as_account(v_a);
    set local role authenticated;
    perform public.change_pseudo('x' || v_forbid, null);
    reset role;
    raise warning 'KO  3h un pseudo qui touche un motif interdit passe';
    v_ko := v_ko + 1;
  exception when sqlstate '23514' then
    reset role;
    if (select pseudo from public.users where id = v_a) = v_pn
       and (select count(*) from public.pseudo_history where user_id = v_a) = 1 then
      raise notice 'ok  3h un pseudo qui touche un motif interdit est refusé, rien ne change';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  3h refusé, mais l''historique ou le pseudo ont bougé';
      v_ko := v_ko + 1;
    end if;
  end;

  begin
    set local role anon;
    perform public.change_pseudo('cp_z_' || v_tag, null);
    reset role;
    raise warning 'KO  3i un visiteur sans session change un pseudo';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  3i un visiteur sans session ne change aucun pseudo';
    v_ok := v_ok + 1;
  end;

  -- ════ 4. La réserve des anciens pseudos (D6) ══════════════════════════

  begin
    perform pg_temp.as_account(v_b);
    set local role authenticated;
    perform public.change_pseudo(upper(v_pa), null);
    reset role;
    raise warning 'KO  4a B prend l''ancien pseudo de A';
    v_ko := v_ko + 1;
  exception when sqlstate '23505' then
    reset role;
    raise notice 'ok  4a l''ancien pseudo de A reste à A, casse ignorée';
    v_ok := v_ok + 1;
  end;

  begin
    insert into public.users (id, pseudo, terms_accepted_at) values (v_f, v_pa, now());
    raise warning 'KO  4b un compte neuf prend l''ancien pseudo de A';
    v_ko := v_ko + 1;
  exception when sqlstate '23505' then
    raise notice 'ok  4b un compte neuf ne prend pas non plus l''ancien pseudo de A';
    v_ok := v_ok + 1;
  end;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  v_got := public.change_pseudo(v_pa, 'diable');
  reset role;
  if v_got = v_pa
     and not exists (select 1 from public.pseudo_history where pseudo = v_pa)
     and exists (select 1 from public.pseudo_history where user_id = v_a and pseudo = v_pn)
     and (select avatar from public.users where id = v_a) = 'gene' then
    raise notice 'ok  4c A reprend son ancien pseudo, et son Popy choisi ne bouge pas';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4c reprise : %', v_got;
    v_ko := v_ko + 1;
  end if;

  begin
    perform pg_temp.as_account(v_b);
    set local role authenticated;
    perform public.change_pseudo(v_pn, null);
    reset role;
    raise warning 'KO  4d B prend le pseudo que A vient de quitter';
    v_ko := v_ko + 1;
  exception when sqlstate '23505' then
    reset role;
    raise notice 'ok  4d le pseudo que A vient de quitter lui est réservé à son tour';
    v_ok := v_ok + 1;
  end;

  -- ════ 5. Les lectures (D6, D8, D16) ═══════════════════════════════════

  set local role anon;
  v_got := coalesce(public.resolve_pseudo(upper(v_pn)), '∅') || ' '
        || coalesce(public.resolve_pseudo('cp_inconnu_' || v_tag), '∅') || ' '
        || coalesce(public.resolve_pseudo(v_pa), '∅');
  reset role;
  if v_got = v_pa || ' ∅ ∅' then
    raise notice 'ok  5a l''ancien pseudo mène à l''actuel, à la clé anonyme ; rien pour un inconnu ni un actuel';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5a résolution : %', v_got;
    v_ko := v_ko + 1;
  end if;

  set local role anon;
  select string_agg(r.pseudo || '>' || r.current_pseudo, ' ' order by r.pseudo) into v_got
  from public.resolve_accounts(array[v_pa, v_pn, v_pb, 'cp_inconnu_' || v_tag]) r
  where r.user_id in (v_a, v_b);
  select count(*) into v_n
  from public.resolve_accounts(array[v_pa, v_pn, v_pb, 'cp_inconnu_' || v_tag]);
  reset role;
  if v_n = 3 and v_got = v_pa || '>' || v_pa || ' ' || v_pb || '>' || v_pb || ' ' || v_pn || '>' || v_pa then
    raise notice 'ok  5b chaque pseudo, actuel ou ancien, mène à son compte ; l''inconnu à rien';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5b comptes : % ligne(s), %', v_n, v_got;
    v_ko := v_ko + 1;
  end if;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  v_got := public.pseudo_status(v_pa) || ' ' || public.pseudo_status(v_pn) || ' '
        || public.pseudo_status(v_pb) || ' ' || public.pseudo_status('cp_bento.pop') || ' '
        || public.pseudo_status('a b') || ' ' || public.pseudo_status('y' || v_forbid) || ' '
        || public.pseudo_status('cp_libre_' || v_tag);
  reset role;
  if v_got = 'current available taken reserved invalid forbidden available' then
    raise notice 'ok  5c ce que l''écran dit d''un pseudo, pour A';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5c statuts pour A : %', v_got;
    v_ko := v_ko + 1;
  end if;

  perform pg_temp.as_account(v_b);
  set local role authenticated;
  v_got := public.pseudo_status(v_pn) || ' ' || public.pseudo_status(v_pa);
  reset role;
  set local role anon;
  v_got := v_got || ' ' || public.pseudo_status(v_pn);
  reset role;
  if v_got = 'taken taken taken' then
    raise notice 'ok  5d pour B comme sans session, l''ancien pseudo de A est pris';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5d statuts pour B : %', v_got;
    v_ko := v_ko + 1;
  end if;

  begin
    set local role anon;
    perform count(*) from public.pseudo_history;
    reset role;
    raise warning 'KO  5e l''historique se lit sans session';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  5e l''historique ne se lit pas sans session';
    v_ok := v_ok + 1;
  end;

  begin
    perform pg_temp.as_account(v_b);
    set local role authenticated;
    perform count(*) from public.pseudo_history;
    reset role;
    raise warning 'KO  5f l''historique se lit avec une session';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  5f ni avec une session';
    v_ok := v_ok + 1;
  end;

  perform pg_temp.as_account(v_a);
  set local role authenticated;
  select string_agg(h.pseudo, ' ') into v_got from public.my_pseudo_history() h;
  reset role;
  perform pg_temp.as_account(v_b);
  set local role authenticated;
  select count(*) into v_n from public.my_pseudo_history();
  reset role;
  if v_got = v_pn and v_n = 0 then
    raise notice 'ok  5g chacun lit ses anciens pseudos, et seulement les siens';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5g historique : A %, B % ligne(s)', v_got, v_n;
    v_ko := v_ko + 1;
  end if;

  -- ════ 6. La recherche et les matchs (D14) ═════════════════════════════

  set local role anon;
  select s.user_id::text || ' ' || coalesce(s.avatar, '∅') into v_got
  from public.search_bentos(v_pa, 5) s
  where s.pseudo = v_pa and s.is_primary;
  reset role;
  if v_got = v_a::text || ' gene' then
    raise notice 'ok  6a la recherche rend le compte et son Popy, à la clé anonyme';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6a recherche : %', v_got;
    v_ko := v_ko + 1;
  end if;

  set local role anon;
  select m.user_id::text || ' ' || coalesce(m.avatar, '∅') into v_got
  from public.bento_matches(v_bb, 5) m
  where m.bento_id = v_ba;
  reset role;
  if v_got = v_a::text || ' gene' then
    raise notice 'ok  6b les matchs rendent le compte et son Popy, à la clé anonyme';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6b matchs : %', v_got;
    v_ko := v_ko + 1;
  end if;

  -- ════ 7. Les pages web, au nom et au Popy (D15) ═══════════════════════

  select count(*) into v_file from net.http_request_queue;
  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_display_name('Alice');
  reset role;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and v_body -> 'paths' @> jsonb_build_array('/u/' || v_pa, '/u/' || v_pa || '/cp-a', '/u/' || v_pa || '/cp-a2')
     and jsonb_array_length(v_body -> 'paths') = 3 then
    raise notice 'ok  7c changer de nom rafraîchit ses adresses, sans le sitemap';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7c revalidation au nom : % appel(s), %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  select count(*) into v_file from net.http_request_queue;
  perform pg_temp.as_account(v_a);
  set local role authenticated;
  perform public.set_avatar('fille');
  reset role;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and jsonb_array_length(v_body -> 'paths') = 3
     and not v_body -> 'paths' @> '["/sitemap.xml"]'::jsonb then
    raise notice 'ok  7d changer de Popy rafraîchit ses adresses, sans le sitemap';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7d revalidation au Popy : % appel(s), %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  -- Un compte sans bento publié n'a pas de page : rien à rafraîchir.
  select count(*) into v_file from net.http_request_queue;
  perform pg_temp.as_account(v_c);
  set local role authenticated;
  perform public.set_display_name('Carla');
  reset role;
  if (select count(*) from net.http_request_queue) = v_file
     and (select display_name from public.users where id = v_c) = 'Carla' then
    raise notice 'ok  7e un compte sans bento publié change de nom sans appel à la landing';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7e compte sans page : un appel est parti';
    v_ko := v_ko + 1;
  end if;

  -- Un correctif de données écrit le pseudo sans passer par `change_pseudo`,
  -- et sans toucher au Popy : les pages suivent quand même.
  select count(*) into v_file from net.http_request_queue;
  update public.users set pseudo = 'cp_r_' || v_tag where id = v_b;
  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and v_body -> 'paths' @> jsonb_build_array(
       '/u/cp_r_' || v_tag, '/u/cp_r_' || v_tag || '/cp-b', '/u/' || v_pb, '/u/' || v_pb || '/cp-b', '/sitemap.xml')
     and jsonb_array_length(v_body -> 'paths') = 5 then
    raise notice 'ok  7f un pseudo écrit directement rafraîchit aussi les deux adresses et le sitemap';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7f écriture directe : % appel(s), %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;
  update public.users set pseudo = v_pb where id = v_b;

  -- ════ 8. Supprimer un compte libère ses pseudos (D12) ═════════════════

  perform pg_temp.as_account(v_d);
  set local role authenticated;
  perform public.change_pseudo('cp_e_' || v_tag, null);
  reset role;
  delete from public.users where id = v_d;
  if not exists (select 1 from public.pseudo_history where pseudo = v_pd) then
    perform pg_temp.as_account(v_b);
    set local role authenticated;
    v_got := public.change_pseudo(v_pd, null);
    reset role;
    if v_got = v_pd then
      raise notice 'ok  8a supprimé, D libère ses anciens pseudos, que B peut prendre';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  8a B n''a pas pris l''ancien pseudo de D : %', v_got;
      v_ko := v_ko + 1;
    end if;
  else
    raise warning 'KO  8a l''historique de D survit à sa suppression';
    v_ko := v_ko + 1;
  end if;

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
end $$;

rollback;
