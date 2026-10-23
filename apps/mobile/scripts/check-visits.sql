-- Contrôles « visites et première publication », chantier 8, lot 1.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, ni compte, ni bento, ni visite, ni secret de
-- coffre, ni appel en file, et peut se relancer autant de fois qu'on veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-visits.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué. Le script construit ses propres
-- données : il tourne sur une base remise à zéro.
--
-- Ce que ces contrôles gardent, §6.1 et §7.1 de la spécification :
--
--   1. la date de première publication se pose à la publication, par
--      l'app comme par le back-office, survit à la dépublication, et aucun
--      client ne l'écrit (D16) ;
--   2. « Afficher mes visites » ne s'écrit que par son propriétaire, et le
--      changer rafraîchit les pages web de ses bentos publiés (D9) ;
--   3. une visite d'app compte une fois par compte, par jour et par bento
--      publié, jamais pour son propriétaire (D2, D13) ;
--   4. une visite web exige le secret du coffre, et compte une fois par
--      empreinte et par jour (D6, D15) ;
--   5. le compteur se lit par tous, sauf masqué ou dépublié, et toujours
--      par son propriétaire (D3, D9) ;
--   6. ⚠️ aucune identité n'est gardée : les clés sont hachées avec le sel
--      du jour, et la purge de la nuit efface clés et sels, pas les nombres ;
--   7. aucun client ne lit les tables ni n'appelle les fonctions internes,
--      et chaque fonction publique n'est ouverte qu'à son appelant ;
--   8. supprimer un bento emporte ses visites.

begin;

do $$
declare
  v_ok        int := 0;
  v_ko        int := 0;
  v_a         uuid := gen_random_uuid();  -- propriétaire, avec profil
  v_b         uuid := gen_random_uuid();  -- visiteur, compte anonyme sans profil
  v_c         uuid := gen_random_uuid();  -- second visiteur
  v_pseudo    text := 'controle.visites.a';
  v_slug      text := 'controle-' || substr(md5(random()::text), 1, 10);
  v_slug_brou text := 'controle-' || substr(md5(random()::text), 1, 10);
  v_bento     uuid;
  v_brouillon uuid;
  v_tmp       uuid;
  v_ret       int;
  v_n         int;
  v_file      int;
  v_first     timestamptz;
  v_bool      boolean;
  v_body      jsonb;
  v_url       text;
  v_hier      date := public.visit_day() - 1;
  v_sel       bytea;
  v_sel_hier  bytea;
  v_table     text;
  v_appel     text;
  v_role      text;
begin
  if exists (select 1 from vault.secrets where name = 'bento_visit_secret') then
    raise exception 'Un secret bento_visit_secret existe en local : ce script part d''un coffre sans lui.';
  end if;

  -- ── Données du contrôle ─────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'controle-visites-' || n || '@exemple.test', now(), now()
  from unnest(array[v_a, v_b, v_c]) with ordinality as t(u, n);

  insert into public.users (id, pseudo, terms_accepted_at) values (v_a, v_pseudo, now());

  insert into public.bentos (user_id, slug, is_primary)
  values (v_a, v_slug, true) returning id into v_bento;
  insert into public.bentos (user_id, slug, is_primary)
  values (v_a, v_slug_brou, false) returning id into v_brouillon;

  -- ════ 1. La date de première publication ══════════════════════════════

  -- 1a. Publier, comme `publishBento` dans les versions publiées.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.bentos set published_at = '2026-10-01 10:00+02' where id = v_bento;
  reset role;
  select first_published_at into v_first from public.bentos where id = v_bento;
  if v_first = '2026-10-01 10:00+02'::timestamptz then
    raise notice 'ok  1a publier pose la date de première publication';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1a première publication : %', v_first;
    v_ko := v_ko + 1;
  end if;

  -- 1b. Dépublier la garde.
  set local role authenticated;
  update public.bentos set published_at = null where id = v_bento;
  reset role;
  select first_published_at into v_first from public.bentos where id = v_bento;
  if v_first = '2026-10-01 10:00+02'::timestamptz then
    raise notice 'ok  1b dépublier garde la date de première publication';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1b après dépublication : %', v_first;
    v_ko := v_ko + 1;
  end if;

  -- 1c. Republier ne la change pas.
  set local role authenticated;
  update public.bentos set published_at = '2026-10-20 10:00+02' where id = v_bento;
  reset role;
  select first_published_at into v_first from public.bentos where id = v_bento;
  if v_first = '2026-10-01 10:00+02'::timestamptz then
    raise notice 'ok  1c republier ne change pas la date de première publication';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1c après republication : %', v_first;
    v_ko := v_ko + 1;
  end if;

  -- 1d. Un bento créé déjà publié, comme au back-office.
  insert into public.bentos (user_id, slug, is_primary, published_at)
  values (v_a, 'controle-' || substr(md5(random()::text), 1, 10), false, '2026-10-05 10:00+02')
  returning id, first_published_at into v_tmp, v_first;
  delete from public.bentos where id = v_tmp;
  if v_first = '2026-10-05 10:00+02'::timestamptz then
    raise notice 'ok  1d un bento créé publié porte sa date de première publication';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1d bento créé publié : %', v_first;
    v_ko := v_ko + 1;
  end if;

  -- 1e. Aucun client ne l'écrit.
  begin
    set local role authenticated;
    update public.bentos set first_published_at = null where id = v_bento;
    reset role;
    raise warning 'KO  1e un client écrit la date de première publication';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  1e un client n''écrit pas la date de première publication';
    v_ok := v_ok + 1;
  end;

  -- 1f. Le rattrapage a rendu `updated_at` à son déclencheur.
  select bool_and(tgenabled = 'O') and count(*) = 2 into v_bool
  from pg_trigger
  where tgrelid = 'public.bentos'::regclass
    and tgname in ('bentos_touch_updated_at', 'bentos_set_first_published_at');
  if v_bool then
    raise notice 'ok  1f le déclencheur de updated_at est réactivé, celui de la première publication actif';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1f déclencheurs de bentos désactivés ou absents';
    v_ko := v_ko + 1;
  end if;

  -- ════ 2. Masquer ses visites ═════════════════════════════════════════

  select show_visits into v_bool from public.users where id = v_a;
  if v_bool then
    raise notice 'ok  2a « Afficher mes visites » est allumé par défaut';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2a show_visits par défaut : %', v_bool;
    v_ko := v_ko + 1;
  end if;

  -- Les secrets de la landing, le temps de la transaction, pour voir partir
  -- la revalidation. Ceux d'un coffre local déjà garni servent tels quels.
  if not exists (select 1 from vault.secrets where name = 'landing_base_url') then
    perform vault.create_secret('http://landing.test', 'landing_base_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'landing_revalidate_token') then
    perform vault.create_secret('jeton-de-controle', 'landing_revalidate_token');
  end if;

  -- 2b. Le propriétaire l'éteint.
  select count(*) into v_file from net.http_request_queue;
  set local role authenticated;
  update public.users set show_visits = false where id = v_a;
  get diagnostics v_n = row_count;
  reset role;
  select show_visits into v_bool from public.users where id = v_a;
  if v_n = 1 and not v_bool then
    raise notice 'ok  2b le propriétaire masque ses visites';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2b masquer : % ligne(s), show_visits %', v_n, v_bool;
    v_ko := v_ko + 1;
  end if;

  -- 2c. La page web de son bento publié se rafraîchit, pas celle du brouillon.
  select convert_from(q.body, 'UTF8')::jsonb, q.url into v_body, v_url
  from net.http_request_queue q
  order by q.id desc limit 1;
  if (select count(*) from net.http_request_queue) = v_file + 1
     and v_url like '%/api/revalidate'
     and v_body -> 'paths' @> jsonb_build_array('/u/' || v_pseudo, '/u/' || v_pseudo || '/' || v_slug)
     and jsonb_array_length(v_body -> 'paths') = 2 then
    raise notice 'ok  2c masquer revalide les deux adresses du bento publié, et rien d''autre';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2c revalidation : % appel(s) de plus, %', (select count(*) from net.http_request_queue) - v_file, v_body;
    v_ko := v_ko + 1;
  end if;

  -- 2d. Une écriture qui ne change pas le réglage ne revalide rien.
  select count(*) into v_file from net.http_request_queue;
  set local role authenticated;
  update public.users set show_visits = false where id = v_a;
  update public.users set terms_accepted_at = now() where id = v_a;
  reset role;
  if (select count(*) from net.http_request_queue) = v_file then
    raise notice 'ok  2d une écriture sans changement du réglage ne revalide rien';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2d revalidation inutile';
    v_ko := v_ko + 1;
  end if;

  -- 2e. Un autre compte ne le change pas.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.users set show_visits = true where id = v_a;
  get diagnostics v_n = row_count;
  reset role;
  select show_visits into v_bool from public.users where id = v_a;
  if v_n = 0 and not v_bool then
    raise notice 'ok  2e un autre compte ne change pas le réglage';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2e un autre compte : % ligne(s), show_visits %', v_n, v_bool;
    v_ko := v_ko + 1;
  end if;

  -- 2f. Un visiteur sans session non plus.
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  begin
    set local role anon;
    update public.users set show_visits = true where id = v_a;
    reset role;
    raise warning 'KO  2f un visiteur écrit le réglage';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  2f un visiteur sans session n''écrit pas le réglage';
    v_ok := v_ok + 1;
  end;

  -- Le propriétaire le rallume pour la suite.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.users set show_visits = true where id = v_a;
  reset role;

  -- ════ 3. Les visites d'app ═══════════════════════════════════════════

  -- 3a. Sans session, pas de visite d'app.
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  begin
    set local role anon;
    perform public.record_bento_visit_app(v_bento);
    reset role;
    raise warning 'KO  3a un visiteur sans session appelle record_bento_visit_app';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  3a une visite d''app demande une session';
    v_ok := v_ok + 1;
  end;

  -- 3b. Un compte anonyme ouvre le bento publié.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.record_bento_visit_app(v_bento);
  reset role;
  if v_ret = 1 then
    raise notice 'ok  3b une page ouverte dans l''app compte une visite';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3b première visite d''app : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3c. Le même compte, le même jour.
  set local role authenticated;
  v_ret := public.record_bento_visit_app(v_bento);
  reset role;
  if v_ret = 1 then
    raise notice 'ok  3c le même compte ne compte qu''une fois par jour';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3c seconde visite du même compte : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3d. Le propriétaire ouvre son propre bento.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.record_bento_visit_app(v_bento);
  reset role;
  if v_ret = 1 then
    raise notice 'ok  3d le propriétaire ne compte pas, et voit son compteur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3d visite du propriétaire : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3e. Un second compte.
  perform set_config('request.jwt.claims', json_build_object('sub', v_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.record_bento_visit_app(v_bento);
  reset role;
  if v_ret = 2 then
    raise notice 'ok  3e un second compte compte une seconde visite';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3e second compte : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3f. Un bento jamais publié ne compte pas et ne se montre pas.
  set local role authenticated;
  v_ret := public.record_bento_visit_app(v_brouillon);
  reset role;
  if v_ret is null and not exists (select 1 from public.bento_visit_days where bento_id = v_brouillon) then
    raise notice 'ok  3f un bento non publié ne compte rien et ne montre rien';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3f bento non publié : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3g. Un bento inconnu.
  set local role authenticated;
  v_ret := public.record_bento_visit_app(gen_random_uuid());
  reset role;
  if v_ret is null then
    raise notice 'ok  3g un bento inconnu rend nul';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3g bento inconnu : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 3h. Ce qui reste en base : un nombre, source app.
  select coalesce(sum(visits), 0) into v_n
  from public.bento_visit_days where bento_id = v_bento and source = 'app' and day = public.visit_day();
  if v_n = 2 and (select count(*) from public.bento_visit_days where bento_id = v_bento) = 1 then
    raise notice 'ok  3h deux visites d''app du jour, sur une seule ligne';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  3h nombres du jour : %', v_n;
    v_ko := v_ko + 1;
  end if;

  -- ════ 4. Les visites web ═════════════════════════════════════════════

  perform set_config('request.jwt.claims', '{"role": "anon"}', true);

  -- 4a. Sans secret au coffre, le comptage web attend sa mise en service.
  begin
    set local role anon;
    perform public.record_bento_visit_web(v_bento, '203.0.113.1|Navigateur', 'peu importe');
    reset role;
    raise warning 'KO  4a une visite web passe sans secret au coffre';
    v_ko := v_ko + 1;
  exception when sqlstate '55000' then
    reset role;
    raise notice 'ok  4a sans secret au coffre, le web ne compte rien et le dit';
    v_ok := v_ok + 1;
  end;

  perform vault.create_secret('secret-de-controle', 'bento_visit_secret');

  -- 4b et 4c. Un secret faux, un secret absent.
  begin
    set local role anon;
    perform public.record_bento_visit_web(v_bento, '203.0.113.1|Navigateur', 'secret-faux');
    reset role;
    raise warning 'KO  4b un secret faux passe';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  4b un secret faux est refusé';
    v_ok := v_ok + 1;
  end;
  begin
    set local role anon;
    perform public.record_bento_visit_web(v_bento, '203.0.113.1|Navigateur', null);
    reset role;
    raise warning 'KO  4c un appel sans secret passe';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  4c un appel sans secret est refusé';
    v_ok := v_ok + 1;
  end;

  -- 4d. Le bon secret, une empreinte neuve.
  set local role anon;
  v_ret := public.record_bento_visit_web(v_bento, '203.0.113.1|Navigateur', 'secret-de-controle');
  reset role;
  if v_ret = 3 then
    raise notice 'ok  4d une page web ouverte compte une visite';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4d première visite web : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 4e. La même empreinte, le même jour.
  set local role anon;
  v_ret := public.record_bento_visit_web(v_bento, '203.0.113.1|Navigateur', 'secret-de-controle');
  reset role;
  if v_ret = 3 then
    raise notice 'ok  4e la même empreinte ne compte qu''une fois par jour';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4e seconde visite de la même empreinte : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 4f. Une autre empreinte.
  set local role anon;
  v_ret := public.record_bento_visit_web(v_bento, '198.51.100.7|Navigateur', 'secret-de-controle');
  reset role;
  if v_ret = 4 then
    raise notice 'ok  4f une autre empreinte compte une autre visite';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4f autre empreinte : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 4g. Une empreinte vide ou démesurée.
  v_n := 0;
  foreach v_appel in array array['', repeat('x', 1025)] loop
    begin
      set local role anon;
      perform public.record_bento_visit_web(v_bento, v_appel, 'secret-de-controle');
      reset role;
    exception when sqlstate '22023' then
      reset role;
      v_n := v_n + 1;
    end;
  end loop;
  if v_n = 2 then
    raise notice 'ok  4g une empreinte vide ou de plus de 1024 caractères est refusée';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4g empreintes refusées : % sur 2', v_n;
    v_ko := v_ko + 1;
  end if;

  -- 4h. Un bento jamais publié.
  set local role anon;
  v_ret := public.record_bento_visit_web(v_brouillon, '203.0.113.1|Navigateur', 'secret-de-controle');
  reset role;
  if v_ret is null and not exists (select 1 from public.bento_visit_days where bento_id = v_brouillon) then
    raise notice 'ok  4h un bento non publié ne compte aucune visite web';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4h bento non publié : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 4i. La voie web est celle de la landing, pas celle de l'app.
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    perform public.record_bento_visit_web(v_bento, '192.0.2.9|Navigateur', 'secret-de-controle');
    reset role;
    raise warning 'KO  4i un compte connecté appelle record_bento_visit_web';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  4i un compte connecté n''appelle pas la voie web';
    v_ok := v_ok + 1;
  end;

  select coalesce(sum(visits), 0) into v_n
  from public.bento_visit_days where bento_id = v_bento and source = 'web';
  if v_n = 2 then
    raise notice 'ok  4j deux visites web, à part des visites d''app';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4j visites web : %', v_n;
    v_ko := v_ko + 1;
  end if;

  -- ════ 5. Le compteur et qui le voit ══════════════════════════════════

  -- 5a. Tout le monde lit le compteur d'un bento publié.
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  if v_ret = 4 then
    raise notice 'ok  5a un visiteur sans session lit le compteur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5a compteur public : %', v_ret;
    v_ko := v_ko + 1;
  end if;

  -- 5b. Masqué : ni le visiteur ni un autre compte ; le propriétaire, si.
  update public.users set show_visits = false where id = v_a;
  set local role anon;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  v_bool := v_ret is null;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  v_bool := v_bool and v_ret is null;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  if v_bool and v_ret = 4 then
    raise notice 'ok  5b masqué, seul le propriétaire voit son compteur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5b compteur masqué : propriétaire %, autres masqués %', v_ret, v_bool;
    v_ko := v_ko + 1;
  end if;

  -- 5c. Masqué, une visite compte encore, et rend nul au visiteur.
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;
  v_ret := public.record_bento_visit_web(v_bento, '192.0.2.44|Navigateur', 'secret-de-controle');
  reset role;
  select coalesce(sum(visits), 0) into v_n from public.bento_visit_days where bento_id = v_bento;
  if v_ret is null and v_n = 5 then
    raise notice 'ok  5c masqué, les visites se comptent toujours sans se montrer';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5c visite masquée : rendu %, total %', v_ret, v_n;
    v_ko := v_ko + 1;
  end if;
  update public.users set show_visits = true where id = v_a;

  -- 5d. Dépublié : plus personne d'autre ; le propriétaire garde son total.
  update public.bentos set published_at = null where id = v_bento;
  set local role anon;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  v_bool := v_ret is null;
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ret := public.bento_visit_count(v_bento);
  reset role;
  if v_bool and v_ret = 5 then
    raise notice 'ok  5d dépublié, le compteur ne se lit plus que par son propriétaire';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5d compteur dépublié : propriétaire %, visiteur masqué %', v_ret, v_bool;
    v_ko := v_ko + 1;
  end if;
  update public.bentos set published_at = '2026-10-20 10:00+02' where id = v_bento;

  -- ════ 6. Ce qui se garde ═════════════════════════════════════════════

  -- 6a. Des empreintes de 32 octets, et aucune colonne d'identité.
  select count(*) into v_n from public.bento_visit_keys where bento_id = v_bento;
  if v_n = 5
     and not exists (select 1 from public.bento_visit_keys where octet_length(key_hash) <> 32)
     and (select array_agg(table_name || '.' || column_name order by table_name, column_name)
          from information_schema.columns
          where table_schema = 'public'
            and table_name in ('visit_salts', 'bento_visit_keys', 'bento_visit_days')
            and data_type in ('text', 'character varying', 'uuid', 'inet', 'jsonb'))
         = array['bento_visit_days.bento_id', 'bento_visit_days.source', 'bento_visit_keys.bento_id'] then
    raise notice 'ok  6a cinq clés de 32 octets, et aucune colonne qui nomme un visiteur';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6a clés : %', v_n;
    v_ko := v_ko + 1;
  end if;

  -- 6b. La clé d'aujourd'hui dépend du sel du jour : avec celui d'hier, la
  -- même identité donne une autre clé, introuvable.
  select salt into v_sel from public.visit_salts where day = public.visit_day();
  v_sel_hier := extensions.gen_random_bytes(32);
  insert into public.visit_salts (day, salt) values (v_hier, v_sel_hier)
  on conflict (day) do update set salt = excluded.salt;
  if exists (select 1 from public.bento_visit_keys
             where bento_id = v_bento
               and key_hash = extensions.digest(v_sel || convert_to('app:' || v_b::text, 'UTF8'), 'sha256'))
     and not exists (select 1 from public.bento_visit_keys
             where key_hash = extensions.digest(v_sel_hier || convert_to('app:' || v_b::text, 'UTF8'), 'sha256')) then
    raise notice 'ok  6b la clé d''un visiteur ne se recalcule qu''avec le sel de son jour';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6b dérivation des clés';
    v_ko := v_ko + 1;
  end if;

  -- 6c. La purge de la nuit : clés et sels d'hier effacés, nombres gardés.
  insert into public.bento_visit_keys (bento_id, day, key_hash)
  values (v_bento, v_hier, extensions.digest('controle-hier', 'sha256'));
  insert into public.bento_visit_days (bento_id, day, source, visits)
  values (v_bento, v_hier, 'web', 7);
  perform public.bento_visit_purge();
  if not exists (select 1 from public.bento_visit_keys where day < public.visit_day())
     and not exists (select 1 from public.visit_salts where day < public.visit_day())
     and (select count(*) from public.bento_visit_keys where bento_id = v_bento) = 5
     and exists (select 1 from public.visit_salts where day = public.visit_day())
     and (select visits from public.bento_visit_days
          where bento_id = v_bento and day = v_hier and source = 'web') = 7 then
    raise notice 'ok  6c la purge efface les clés et les sels passés, garde ceux du jour et tous les nombres';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6c purge';
    v_ko := v_ko + 1;
  end if;

  -- 6d. La purge est programmée chaque nuit.
  if exists (select 1 from cron.job
             where jobname = 'visits-purge' and active
               and schedule = '40 3 * * *'
               and command = 'select public.bento_visit_purge()') then
    raise notice 'ok  6d pg_cron purge les visites chaque nuit à 3 h 40 UTC';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  6d travail visits-purge absent ou différent';
    v_ko := v_ko + 1;
  end if;

  -- ════ 7. Ce qu'aucun client ne fait ══════════════════════════════════

  -- 7a. Lire les tables de visites.
  v_n := 0;
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_table in array array['visit_salts', 'bento_visit_keys', 'bento_visit_days'] loop
      begin
        execute format('set local role %I', v_role);
        execute format('select count(*) from public.%I', v_table);
        reset role;
      exception when insufficient_privilege then
        reset role;
        v_n := v_n + 1;
      end;
    end loop;
  end loop;
  if v_n = 6 then
    raise notice 'ok  7a ni un visiteur ni un compte ne lit les trois tables de visites';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7a lectures refusées : % sur 6', v_n;
    v_ko := v_ko + 1;
  end if;

  -- 7b. Écrire un nombre de visites.
  begin
    set local role authenticated;
    insert into public.bento_visit_days (bento_id, day, source, visits)
    values (v_bento, public.visit_day() + 1, 'app', 1000);
    reset role;
    raise warning 'KO  7b un compte écrit des visites';
    v_ko := v_ko + 1;
  exception when insufficient_privilege then
    reset role;
    raise notice 'ok  7b un compte n''écrit aucun nombre de visites';
    v_ok := v_ok + 1;
  end;

  -- 7c. Appeler les fonctions internes.
  v_n := 0;
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_appel in array array[
      'select public.visit_day()',
      'select public.visit_salt(current_date)',
      format('select public.count_bento_visit(%L, %L, %L)', v_bento, 'fabrique', 'web'),
      format('select public.bento_visits_visible(%L)', v_bento),
      'select public.bento_visit_purge()'
    ] loop
      begin
        execute format('set local role %I', v_role);
        execute v_appel;
        reset role;
      exception when insufficient_privilege then
        reset role;
        v_n := v_n + 1;
      end;
    end loop;
  end loop;
  if v_n = 10 then
    raise notice 'ok  7c aucune des cinq fonctions internes ne s''appelle d''un client';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7c appels refusés : % sur 10', v_n;
    v_ko := v_ko + 1;
  end if;

  -- 7d. Les droits eux-mêmes, au-delà des refus du corps des fonctions :
  -- `record_bento_visit_app` refuse aussi sans session, ce qui masquerait un
  -- droit accordé de trop.
  if not has_function_privilege('anon', 'public.record_bento_visit_app(uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.record_bento_visit_app(uuid)', 'execute')
     and has_function_privilege('anon', 'public.record_bento_visit_web(uuid, text, text)', 'execute')
     and not has_function_privilege('authenticated', 'public.record_bento_visit_web(uuid, text, text)', 'execute')
     and has_function_privilege('anon', 'public.bento_visit_count(uuid)', 'execute')
     and has_function_privilege('authenticated', 'public.bento_visit_count(uuid)', 'execute') then
    raise notice 'ok  7d l''app aux comptes connectés, le web aux visiteurs, le compteur à tous';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7d droits d''exécution des trois fonctions publiques';
    v_ko := v_ko + 1;
  end if;

  -- ════ 8. Un bento supprimé emporte ses visites ═══════════════════════
  delete from public.bentos where id = v_bento;
  if not exists (select 1 from public.bento_visit_keys where bento_id = v_bento)
     and not exists (select 1 from public.bento_visit_days where bento_id = v_bento) then
    raise notice 'ok  8  supprimer un bento efface ses clés et ses nombres';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  8  visites orphelines';
    v_ko := v_ko + 1;
  end if;

  perform set_config('request.jwt.claims', null, true);

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
  if v_ko > 0 then
    raise exception '% contrôles manqués', v_ko;
  end if;
end $$;

rollback;
