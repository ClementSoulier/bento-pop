-- Contrôles « mêmes goûts et visibilité dans la recherche », chantier 20,
-- lot 1.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, ni compte, ni bento, ni item, ni appel en file,
-- et peut se relancer autant de fois qu'on veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-matches.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué. Le script construit ses propres
-- données, à des pseudos et des titres qu'aucun autre bento ne porte.
--
-- Le jeu de données, cinq comptes et sept bentos :
--
--   A : r1, r2, c4, m3      le bento de départ
--   A2: r1                  second bento de A, jamais un match de A
--   B : r1, c4, c4          2 items, 1/2 + 1/4 = 0,75 : c4 posé deux fois compte une
--   C : r2                  1 item,  1/2       = 0,5
--   D : c4, m3              2 items, 1/4 + 1/3 ≈ 0,583
--   E : c4, m3              comme D, publié plus tard : devant D
--   F : r1, brouillon       ni match, ni compté dans la rareté
--
-- `n` compte les comptes visibles : r1 et r2 deux (A et B, A et C), m3 trois
-- (A, D, E), c4 quatre (A, B, D, E). F ne compte pas : il n'est pas publié.
--
-- Ce que ces contrôles gardent, §6.1 et §10 de la spécification :
--
--   1. l'ordre des matchs, la rareté, les items communs du plus rare au plus
--      commun (D1 à D3) ;
--   2. jamais deux bentos du même compte, jamais un brouillon, ni comme
--      match, ni comme départ ;
--   3. la limite, plafonnée à 50 ;
--   4. le réglage éteint retire le compte de `search_bentos`,
--      `shared_items` et `bento_matches`, sous la clé anonyme (D6) ;
--   5. un compte retiré voit toujours ses propres matchs ;
--   6. seul son propriétaire écrit le réglage, et le changer rafraîchit ses
--      pages web et le sitemap (D7).

begin;

do $$
declare
  v_ok      int := 0;
  v_ko      int := 0;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
  v_d uuid := gen_random_uuid();
  v_e uuid := gen_random_uuid();
  v_f uuid := gen_random_uuid();
  v_tag     text := substr(md5(random()::text), 1, 6);
  -- Des titres d'items aléatoires, sans rien en commun entre eux ni avec
  -- les pseudos : la recherche par similarité de `search_bentos` les
  -- rapprocherait sinon, et chercher un pseudo ramènerait les items.
  v_t_r1 text := substr(md5(random()::text), 1, 16);
  v_t_r2 text := substr(md5(random()::text), 1, 16);
  v_t_c4 text := substr(md5(random()::text), 1, 16);
  v_t_m3 text := substr(md5(random()::text), 1, 16);
  v_ba uuid; v_ba2 uuid; v_bb uuid; v_bc uuid; v_bd uuid; v_be uuid; v_bf uuid;
  v_r1 uuid; v_r2 uuid; v_c4 uuid; v_m3 uuid;
  v_got     text;
  v_want    text;
  v_n       int;
  v_items   jsonb;
  v_file    int;
  v_body    jsonb;
begin
  -- ── Données du contrôle ─────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'controle-match-' || n || '-' || v_tag || '@exemple.test', now(), now()
  from unnest(array[v_a, v_b, v_c, v_d, v_e, v_f]) with ordinality as t(u, n);

  insert into public.users (id, pseudo, terms_accepted_at) values
    (v_a, 'cm_a_' || v_tag, now()), (v_b, 'cm_b_' || v_tag, now()),
    (v_c, 'cm_c_' || v_tag, now()), (v_d, 'cm_d_' || v_tag, now()),
    (v_e, 'cm_e_' || v_tag, now()), (v_f, 'cm_f_' || v_tag, now());

  -- Quatre items, un par case : film, série, artiste, son.
  insert into public.items (category_id, type_id, external_source, external_id, title, status)
  values (1, 1, 'controle', 'r1-' || v_tag, v_t_r1, 'validated')
  returning id into v_r1;
  insert into public.items (category_id, type_id, external_source, external_id, title, status)
  values (2, 2, 'controle', 'r2-' || v_tag, v_t_r2, 'validated')
  returning id into v_r2;
  insert into public.items (category_id, type_id, external_source, external_id, title, status)
  values (3, 3, 'controle', 'c4-' || v_tag, v_t_c4, 'validated')
  returning id into v_c4;
  insert into public.items (category_id, type_id, external_source, external_id, title, status)
  values (4, 4, 'controle', 'm3-' || v_tag, v_t_m3, 'validated')
  returning id into v_m3;

  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_a, 'cm-a', true, now() - interval '6 days') returning id into v_ba;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_a, 'cm-a2', false, now() - interval '5 days') returning id into v_ba2;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_b, 'cm-b', true, now() - interval '4 days') returning id into v_bb;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_c, 'cm-c', true, now() - interval '3 days') returning id into v_bc;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_d, 'cm-d', true, now() - interval '2 days') returning id into v_bd;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_e, 'cm-e', true, now() - interval '1 day') returning id into v_be;
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_f, 'cm-f', true, null) returning id into v_bf;

  insert into public.bento_items (bento_id, category_id, item_id) values
    (v_ba, 1, v_r1), (v_ba, 2, v_r2), (v_ba, 3, v_c4), (v_ba, 4, v_m3),
    (v_ba2, 1, v_r1),
    -- c4 deux fois chez B, en artiste et en créateur, qui partagent un type :
    -- il ne compte qu'une fois.
    (v_bb, 1, v_r1), (v_bb, 3, v_c4), (v_bb, 5, v_c4),
    (v_bc, 2, v_r2),
    (v_bd, 3, v_c4), (v_bd, 4, v_m3),
    (v_be, 3, v_c4), (v_be, 4, v_m3),
    (v_bf, 1, v_r1);

  -- ════ 1. L'ordre et la rareté ═════════════════════════════════════════

  set local role anon;
  select string_agg(pseudo || ':' || shared || ':' || round(score::numeric, 3), ' ' order by ord)
  into v_got
  from (select row_number() over () as ord, * from public.bento_matches(v_ba, 20)) m;
  reset role;
  v_want := 'cm_b_' || v_tag || ':2:0.750 cm_e_' || v_tag || ':2:0.583 cm_d_' || v_tag
         || ':2:0.583 cm_c_' || v_tag || ':1:0.500';
  if v_got = v_want then
    raise notice 'ok  1a B, E, D puis C : la rareté range, la date départage, à la clé anonyme';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1a ordre : % au lieu de %', v_got, v_want;
    v_ko := v_ko + 1;
  end if;

  select items into v_items from public.bento_matches(v_ba, 20) where bento_id = v_bb;
  if v_items -> 0 ->> 'id' = v_r1::text and v_items -> 1 ->> 'id' = v_c4::text
     and jsonb_array_length(v_items) = 2 then
    raise notice 'ok  1b les items communs, du plus rare au plus commun';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1b items de B : %', v_items;
    v_ko := v_ko + 1;
  end if;

  -- ════ 2. Même compte et brouillon ═════════════════════════════════════

  select count(*) into v_n from public.bento_matches(v_ba, 20) where bento_id in (v_ba2, v_bf);
  if v_n = 0 then
    raise notice 'ok  2a ni le second bento de A, ni le brouillon de F';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2a % bento(s) du même compte ou en brouillon', v_n;
    v_ko := v_ko + 1;
  end if;

  select string_agg(pseudo, ' ' order by pseudo) into v_got
  from public.bento_matches(v_ba2, 20);
  if v_got = 'cm_b_' || v_tag then
    raise notice 'ok  2b depuis le second bento de A : B seul, jamais A';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2b depuis A2 : %', v_got;
    v_ko := v_ko + 1;
  end if;

  select count(*) into v_n from public.bento_matches(v_bf, 20);
  if v_n = 0 then
    raise notice 'ok  2c un brouillon n''a pas de matchs';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2c le brouillon de F a % match(s)', v_n;
    v_ko := v_ko + 1;
  end if;

  -- ════ 3. La limite ════════════════════════════════════════════════════

  if (select count(*) from public.bento_matches(v_ba, 2)) = 2
     and (select count(*) from public.bento_matches(v_ba, 0)) = 1
     and (select count(*) from public.bento_matches(v_ba, 1000)) = 4
     and (select count(*) from public.bento_matches(v_ba, null)) = 4 then
    raise notice 'ok  3a la limite : 2 rend 2, 0 rend 1, 1 000 et nul rendent tout';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3a limites';
    v_ko := v_ko + 1;
  end if;

  -- ════ 4. Le réglage éteint ════════════════════════════════════════════

  -- Avant : C se trouve par son pseudo, par son item, et compte dans les
  -- suggestions.
  set local role anon;
  select count(*) into v_n from public.search_bentos('cm_c_' || v_tag, 20);
  reset role;
  if v_n = 1 then
    raise notice 'ok  4a allumé, C se trouve par son pseudo';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4a C introuvable avant le réglage : %', v_n;
    v_ko := v_ko + 1;
  end if;

  update public.users set searchable = false where id = v_c;

  set local role anon;
  select count(*) into v_n from public.search_bentos('cm_c_' || v_tag, 20);
  reset role;
  if v_n = 0 then
    raise notice 'ok  4b éteint, C ne se trouve plus par son pseudo, à la clé anonyme';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4b C encore trouvé par son pseudo';
    v_ko := v_ko + 1;
  end if;

  set local role anon;
  select string_agg(pseudo, ' ' order by pseudo) into v_got
  from public.search_bentos(v_t_r2, 20);
  reset role;
  if v_got = 'cm_a_' || v_tag then
    raise notice 'ok  4c ni par son item : la recherche de r2 ne rend plus que A';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4c recherche de r2 : %', v_got;
    v_ko := v_ko + 1;
  end if;

  set local role anon;
  select count(*) into v_n from public.shared_items(500) where id = v_r2;
  reset role;
  if v_n = 0 then
    raise notice 'ok  4d r2 sort des suggestions : il n''y reste qu''une personne visible';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4d r2 encore suggéré';
    v_ko := v_ko + 1;
  end if;

  set local role anon;
  select string_agg(pseudo, ' ' order by pseudo) into v_got
  from public.bento_matches(v_ba, 20);
  reset role;
  if v_got = 'cm_b_' || v_tag || ' cm_d_' || v_tag || ' cm_e_' || v_tag then
    raise notice 'ok  4e éteint, C sort des matchs de A, à la clé anonyme';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4e matchs de A : %', v_got;
    v_ko := v_ko + 1;
  end if;

  -- ════ 5. Un compte retiré voit ses propres matchs ═════════════════════

  select string_agg(pseudo, ' ' order by pseudo) into v_got
  from public.bento_matches(v_bc, 20);
  if v_got = 'cm_a_' || v_tag then
    raise notice 'ok  5a C, retiré, voit toujours A parmi ses matchs';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5a matchs de C : %', v_got;
    v_ko := v_ko + 1;
  end if;

  update public.users set searchable = true where id = v_c;
  if (select count(*) from public.bento_matches(v_ba, 20)) = 4 then
    raise notice 'ok  5b rallumé, C revient parmi les matchs de A';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5b C absent après rallumage';
    v_ko := v_ko + 1;
  end if;

  -- ════ 6. Qui écrit le réglage, et ce qu'il rafraîchit ═════════════════

  if not exists (select 1 from vault.secrets where name = 'landing_base_url') then
    perform vault.create_secret('http://landing.test', 'landing_base_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'landing_revalidate_token') then
    perform vault.create_secret('jeton-de-controle', 'landing_revalidate_token');
  end if;
  select count(*) into v_file from net.http_request_queue;

  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.users set searchable = false where id = v_c;
  reset role;
  if (select searchable from public.users where id = v_c) = false then
    raise notice 'ok  6a le propriétaire se retire de la recherche';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6a le propriétaire n''écrit pas son réglage';
    v_ko := v_ko + 1;
  end if;

  select convert_from(q.body, 'UTF8')::jsonb into v_body
  from net.http_request_queue q order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and v_body -> 'paths' @> jsonb_build_array('/u/cm_c_' || v_tag, '/u/cm_c_' || v_tag || '/cm-c', '/sitemap.xml')
     and jsonb_array_length(v_body -> 'paths') = 3 then
    raise notice 'ok  6b se retirer rafraîchit ses deux adresses et le sitemap';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6b revalidation : % appel(s), %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.users set searchable = true where id = v_c;
  get diagnostics v_n = row_count;
  reset role;
  if v_n = 0 and (select searchable from public.users where id = v_c) = false then
    raise notice 'ok  6c un autre compte ne change pas le réglage';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6c A a changé le réglage de C';
    v_ko := v_ko + 1;
  end if;

  begin
    set local role anon;
    update public.users set searchable = true where id = v_c;
    reset role;
    raise warning 'KO  6d un visiteur sans session écrit le réglage';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  6d un visiteur sans session n''écrit pas le réglage';
    v_ok := v_ok + 1;
  end;

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
end $$;

rollback;
