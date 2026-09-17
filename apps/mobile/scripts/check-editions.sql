-- Contrôles « bento hebdomadaire », chantier 13, lots 1 et 5.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, et peut donc se relancer autant de fois qu'on
-- veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-editions.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué.
--
-- **Il construit ses propres données**, contrairement à
-- `check-bentos-multi.sql` qui part d'un bento publié existant : après un
-- `supabase db reset`, la base locale est vide. Un script de contrôle qui
-- exige un état qu'on vient d'effacer ne se rejoue pas, et un contrôle qui ne
-- se rejoue pas ne garde rien.
--
-- Ce que ces contrôles gardent, et pourquoi chacun a été écrit :
--
--   1. une édition programmée est invisible **en base**, ses cases aussi :
--      c'est ce qui rend vraie la promesse d'annoncer la suivante sans la
--      dévoiler, sans compter sur un écran pour la tenir ;
--   2. deux cases du même type dans une édition sont acceptées. C'est la
--      question que la roadmap croyait bloquante, et le contrôle 3 prouve
--      qu'elle ne l'est pas ;
--   3. le contrôle 6 vise un défaut qu'aucun test d'application ne verrait :
--      avant correctif, la création d'une seule édition suffisait à refuser
--      **toute première publication de tout nouveau compte** ;
--   4. le contrôle 7 vise l'autre défaut du même genre : un plafond atteint
--      en vingt semaines.

begin;

do $$
declare
  v_ok      int := 0;
  v_ko      int := 0;
  v_uid     uuid := gen_random_uuid();
  v_autre   uuid := gen_random_uuid();
  v_edition smallint;
  v_future  smallint;
  v_film1   uuid;
  v_film2   uuid;
  v_serie   uuid;
  v_case1   smallint;
  v_case2   smallint;
  v_case3   smallint;
  v_bento   uuid;
  v_tmp     uuid;
  v_n       int;
begin
  -- ── Données du contrôle ─────────────────────────────────────────────
  -- Deux comptes, trois items, une édition sortie à deux cases « film » et
  -- une case « série », plus une édition programmée pour plus tard.

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_uid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'controle-editions@exemple.test', now(), now()),
    (v_autre, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'controle-editions-2@exemple.test', now(), now());

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_uid, 'controle.editions', now());

  insert into public.items (type_id, external_source, title, status)
  values
    ((select id from public.item_types where key = 'film'),   'admin', 'Film de contrôle A', 'validated'),
    ((select id from public.item_types where key = 'film'),   'admin', 'Film de contrôle B', 'validated'),
    ((select id from public.item_types where key = 'series'), 'admin', 'Série de contrôle',  'validated'),
    -- Les trois types restants, pour que le contrôle 6 publie vraiment un
    -- bento complet plutôt que d'échouer pour une autre raison.
    ((select id from public.item_types where key = 'person'), 'admin', 'Personne de contrôle', 'validated'),
    ((select id from public.item_types where key = 'song'),   'admin', 'Chanson de contrôle',  'validated'),
    ((select id from public.item_types where key = 'place'),  'admin', 'Lieu de contrôle',     'validated');

  select id into v_film1 from public.items where title = 'Film de contrôle A';
  select id into v_film2 from public.items where title = 'Film de contrôle B';
  select id into v_serie from public.items where title = 'Série de contrôle';

  insert into public.editions (slug, title, released_at)
  values ('semaine-controle', 'La semaine de contrôle', now() - interval '1 hour')
  returning id into v_edition;

  insert into public.editions (slug, title, released_at)
  values ('semaine-suivante', 'La semaine suivante', now() + interval '7 days')
  returning id into v_future;

  -- Deux cases « film » dans la même édition : c'est le cœur du chantier.
  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('ctrl-film-pleurer', 'Film, pleurer', 'Le film qui t''a fait pleurer', 'FILM', 'm', 1,
     'admin', (select id from public.item_types where key = 'film'), v_edition),
    ('ctrl-film-surcote', 'Film, surcoté', 'Le film que tu trouves surcoté', 'FILM', 'm', 2,
     'admin', (select id from public.item_types where key = 'film'), v_edition),
    ('ctrl-serie', 'Série de la semaine', 'La série que tu caches', 'SÉRIE', 'f', 3,
     'admin', (select id from public.item_types where key = 'series'), v_edition);

  select id into v_case1 from public.bento_categories where key = 'ctrl-film-pleurer';
  select id into v_case2 from public.bento_categories where key = 'ctrl-film-surcote';
  select id into v_case3 from public.bento_categories where key = 'ctrl-serie';

  insert into public.bento_categories
    (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
  values
    ('ctrl-future-film', 'Film à venir', 'Le film de la semaine prochaine', 'FILM', 'm', 1,
     'admin', (select id from public.item_types where key = 'film'), v_future);

  -- ── 1. Une édition programmée est invisible de l'anonyme ────────────
  perform set_config('request.jwt.claims', null, true);
  set local role anon;

  select count(*) into v_n from public.editions where id = v_future;
  if v_n = 0 then
    raise notice 'ok  1a édition programmée invisible';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1a édition programmée visible de l''anonyme';
    v_ko := v_ko + 1;
  end if;

  select count(*) into v_n from public.bento_categories where edition_id = v_future;
  if v_n = 0 then
    raise notice 'ok  1b cases d''une édition programmée invisibles';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  1b cases d''une édition programmée visibles : elle est dévoilée';
    v_ko := v_ko + 1;
  end if;

  -- ── 2. Une édition sortie est visible, ses cases aussi ──────────────
  select count(*) into v_n from public.editions where id = v_edition;
  if v_n = 1 then
    raise notice 'ok  2a édition sortie visible';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2a édition sortie invisible';
    v_ko := v_ko + 1;
  end if;

  select count(*) into v_n from public.bento_categories where edition_id = v_edition;
  if v_n = 3 then
    raise notice 'ok  2b les trois cases de l''édition sortie sont lisibles';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2b % cases lisibles au lieu de 3', v_n;
    v_ko := v_ko + 1;
  end if;

  -- Les six cases du bento principal restent lisibles : une version déployée
  -- ne doit rien perdre.
  select count(*) into v_n from public.bento_categories where edition_id is null;
  if v_n = 6 then
    raise notice 'ok  2c les six cases du bento principal restent lisibles';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  2c % cases principales lisibles au lieu de 6', v_n;
    v_ko := v_ko + 1;
  end if;

  reset role;

  -- ── 3. Deux cases du même type, et deux items distincts ─────────────
  -- La question que la roadmap croyait bloquante.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );

  begin
    v_bento := public.create_edition_bento(v_edition);
    raise notice 'ok  3a bento d''édition créé';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  3a création du bento d''édition refusée : %', sqlerrm;
    v_ko := v_ko + 1;
    v_bento := null;
  end;

  if v_bento is not null then
    begin
      insert into public.bento_items (bento_id, category_id, item_id) values
        (v_bento, v_case1, v_film1),
        (v_bento, v_case2, v_film2);
      raise notice 'ok  3b deux cases du même type, deux items distincts';
      v_ok := v_ok + 1;
    exception when others then
      raise warning 'KO  3b deux cases « film » refusées : %', sqlerrm;
      v_ko := v_ko + 1;
    end;

    -- ── 4. Une case n'accepte que son type ────────────────────────────
    begin
      insert into public.bento_items (bento_id, category_id, item_id)
      values (v_bento, v_case3, v_film1);
      raise warning 'KO  4  une série a accepté un film';
      v_ko := v_ko + 1;
    exception when others then
      raise notice 'ok  4  une case refuse un item d''un autre type';
      v_ok := v_ok + 1;
    end;

    -- ── 5. Un seul bento par personne et par édition ──────────────────
    begin
      perform public.create_edition_bento(v_edition);
      raise warning 'KO  5  deux bentos pour la même édition et la même personne';
      v_ko := v_ko + 1;
    exception when others then
      raise notice 'ok  5  deuxième composition de la même édition refusée';
      v_ok := v_ok + 1;
    end;

    -- ── 5b. L'adresse est celle de l'édition ──────────────────────────
    if (select slug from public.bentos where id = v_bento) = 'semaine-controle' then
      raise notice 'ok  5b le bento d''édition porte l''adresse de l''édition';
      v_ok := v_ok + 1;
    else
      raise warning 'KO  5b adresse inattendue : %', (select slug from public.bentos where id = v_bento);
      v_ko := v_ko + 1;
    end if;
  end if;

  -- ── 5c. Une édition non sortie ne se compose pas ────────────────────
  begin
    perform public.create_edition_bento(v_future);
    raise warning 'KO  5c une édition programmée a pu être composée';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  5c une édition programmée ne se compose pas';
    v_ok := v_ok + 1;
  end;

  -- ── 5d. Son adresse est réservée à `create_bento` ───────────────────
  begin
    perform public.create_bento('semaine-suivante');
    raise warning 'KO  5d l''adresse d''une édition à venir a pu être prise';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  5d l''adresse d''une édition est réservée, même avant sa sortie';
    v_ok := v_ok + 1;
  end;

  -- ── 6. ⚠️ La première publication d'un compte neuf ──────────────────
  -- Le contrôle qui compte. Avant correctif, `publish_first_bento` comparait
  -- le nombre de cases envoyées à TOUTES les cases actives, éditions
  -- comprises : trois cases d'édition existent maintenant, donc la
  -- publication demandait neuf cases et refusait les six. **Aucun test
  -- d'application n'aurait vu ce défaut**, et il ferme l'inscription.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_autre, 'role', 'authenticated')::text,
    true
  );

  begin
    -- Chaque case principale reçoit un item de SON type : la publication doit
    -- aboutir pour de bon, et non échouer pour une autre raison que celle
    -- qu'on mesure.
    perform public.publish_first_bento(
      'controle.neuf',
      now(),
      (select jsonb_agg(jsonb_build_object(
                'category_id', c.id,
                'item_id', (select i.id from public.items i
                             where i.type_id = c.type_id limit 1)))
         from public.bento_categories c
        where c.edition_id is null and c.is_active)
    );
    raise notice 'ok  6  la première publication aboutit malgré les cases d''édition';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  6  la première publication d''un compte neuf est refusée : % (%)', sqlerrm, sqlstate;
    v_ko := v_ko + 1;
  end;

  -- ── 7. ⚠️ Le plafond ne compte que les bentos libres ────────────────
  -- Avant correctif, une édition par semaine atteignait le plafond de 20 en
  -- vingt semaines, et la personne ne pouvait plus rien composer.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );

  -- Vingt bentos libres, soit le plafond exact, plus celui d'édition déjà
  -- créé au contrôle 3a.
  for v_n in 1..20 loop
    perform public.create_bento('libre-' || lpad(v_n::text, 2, '0'));
  end loop;

  select count(*) into v_n from public.bentos where user_id = v_uid and edition_id is null;
  if v_n = 20 then
    raise notice 'ok  7a le compte porte 20 bentos libres, plafond atteint';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  7a % bentos libres au lieu de 20', v_n;
    v_ko := v_ko + 1;
  end if;

  begin
    perform public.create_bento('libre-de-trop');
    raise warning 'KO  7b le plafond des bentos libres ne s''applique pas';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  7b le plafond des bentos libres s''applique';
    v_ok := v_ok + 1;
  end;

  -- Le plafond atteint sur les bentos libres n'empêche pas de composer une
  -- édition de plus : c'est tout l'objet du correctif.
  insert into public.editions (slug, title, released_at)
  values ('semaine-controle-2', 'Encore une semaine', now() - interval '1 hour');

  begin
    perform public.create_edition_bento((select id from public.editions where slug = 'semaine-controle-2'));
    raise notice 'ok  7c une édition se compose malgré le plafond des bentos libres';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  7c le plafond des bentos libres bloque une édition : %', sqlerrm;
    v_ko := v_ko + 1;
  end;

  -- ── 8. La base et l'app disent la même chose des six cases ──────────
  -- `bento-categories-vs-app.test.ts` le vérifie côté application ; ici on
  -- garde la forme, pour qu'une case principale ne puisse pas perdre son
  -- tampon ou son genre au détour d'une migration.
  reset role;
  select count(*) into v_n
  from public.bento_categories
  where edition_id is null
    and prompt is not null and stamp is not null and gender in ('m', 'f');
  if v_n = 6 then
    raise notice 'ok  8a les six cases principales ont prompt, tampon et genre';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  8a seulement % cases principales complètes', v_n;
    v_ko := v_ko + 1;
  end if;

  -- Un rang ne se double pas dans une édition.
  begin
    insert into public.bento_categories
      (key, label_fr, prompt, stamp, gender, display_order, api_source, type_id, edition_id)
    values ('ctrl-doublon', 'Doublon', 'Doublon de rang', 'FILM', 'm', 1,
            'admin', (select id from public.item_types where key = 'film'), v_edition);
    raise warning 'KO  8b deux cases au même rang dans une édition';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  8b deux cases ne partagent pas un rang dans une édition';
    v_ok := v_ok + 1;
  end;

  -- Un titre d'édition tient en 30 caractères : c'est ce que le composer
  -- affiche entier sur un iPhone SE. Arbitrage du 16 septembre 2026.
  begin
    insert into public.editions (slug, title, released_at)
    values ('titre-trop-long', repeat('x', 31), null);
    raise warning 'KO  8c un titre de 31 caractères est accepté';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  8c un titre de plus de 30 caractères est refusé';
    v_ok := v_ok + 1;
  end;

  -- ── 9. La purge de landing ne casse rien sans secret de coffre ──────
  -- Le déclencheur appelle la landing quand le titre d'une édition change.
  -- Sans `landing_base_url` en coffre, il doit sortir en silence : corriger
  -- un titre ne peut pas dépendre d'une landing joignable.
  begin
    -- Un titre court : la borne est de 30 caractères depuis le 16 septembre.
    update public.editions set title = 'Titre corrigé' where id = v_edition;
    raise notice 'ok  9a le titre se corrige sans coffre configuré';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  9a corriger un titre lève : %', sqlerrm;
    v_ko := v_ko + 1;
  end;

  select count(*) into v_n from pg_trigger where tgname = 'editions_revalidate_landing';
  if v_n = 1 then
    raise notice 'ok  9b le déclencheur de purge est posé';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  9b déclencheur de purge absent';
    v_ko := v_ko + 1;
  end if;

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
  if v_ko > 0 then
    raise exception '% contrôles manqués', v_ko;
  end if;
end $$;

rollback;
