-- Contrôles « plusieurs bentos par compte », chantier 16.
--
-- À rejouer sur le Supabase LOCAL après avoir appliqué les migrations du
-- dépôt. Tout se passe dans une transaction annulée à la fin : le script ne
-- laisse rien derrière lui, et peut donc se relancer autant de fois qu'on
-- veut.
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-bentos-multi.sql
--
-- Chaque ligne « ok » est un comportement tenu, chaque « KO » un défaut. Le
-- décompte final doit annoncer zéro manqué.
--
-- Ce que ces contrôles gardent, et pourquoi chacun a été écrit :
--
--   1. l'index partiel remplace vraiment la contrainte levée ;
--   2. `create_bento` est la seule porte d'entrée du slug côté client ;
--   3. les slugs réservés le sont, `opengraph-image` en tête : Next expose
--      l'aperçu d'un bento à `/u/<pseudo>/opengraph-image/...` par convention
--      de fichier, et une route de convention l'emporte sur un segment
--      dynamique ; un bento portant ce slug serait inatteignable ;
--   4. les compteurs comptent des personnes. Mesuré avant correction : une
--      personne à deux bentos portant les mêmes items faisait passer Squeezie
--      de 4 à 6 et faisait entrer deux items de plus dans le top.

begin;

do $$
declare
  v_ok    int := 0;
  v_ko    int := 0;
  v_uid   uuid;
  v_main  uuid;
  v_second uuid;
  v_avant jsonb;
  v_apres jsonb;

  procedure_note text;

  -- Un cas tenu, un cas manqué.
  procedure_ok  text;
begin
  -- Un compte qui a déjà un bento publié complet, pour ne rien inventer.
  select b.user_id, b.id into v_uid, v_main
  from public.bentos b
  where b.published_at is not null
    and b.is_primary
    and (select count(*) from public.bento_items bi where bi.bento_id = b.id) >= 2
  limit 1;

  if v_uid is null then
    raise exception 'Aucun bento publié en local : applique les migrations et les données de départ.';
  end if;

  -- ── 1. L'index partiel ──────────────────────────────────────────────
  begin
    insert into public.bentos (user_id, slug, is_primary)
    values (v_uid, 'second-principal', true);
    raise warning 'KO  1a deux bentos principaux acceptés pour un même compte';
    v_ko := v_ko + 1;
  exception when unique_violation then
    raise notice 'ok  1a un seul bento principal par compte';
    v_ok := v_ok + 1;
  end;

  begin
    insert into public.bentos (user_id, slug, is_primary)
    values (v_uid, 'controle-16', false) returning id into v_second;
    raise notice 'ok  1b un bento secondaire s''insère';
    v_ok := v_ok + 1;
  exception when others then
    raise warning 'KO  1b secondaire refusé : %', sqlerrm;
    v_ko := v_ko + 1;
  end;

  begin
    insert into public.bentos (user_id, slug, is_primary)
    values (v_uid, 'controle-16', false);
    raise warning 'KO  1c deux bentos de même adresse acceptés pour un compte';
    v_ko := v_ko + 1;
  exception when unique_violation then
    raise notice 'ok  1c une adresse ne sert qu''une fois par compte';
    v_ok := v_ok + 1;
  end;

  -- ── 2 et 3. create_bento ────────────────────────────────────────────
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text,
    true
  );

  begin
    perform public.create_bento('Majuscules');
    raise warning 'KO  2a slug hors format accepté';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  2a slug hors format refusé';
    v_ok := v_ok + 1;
  end;

  begin
    perform public.create_bento('opengraph-image');
    raise warning 'KO  3  slug réservé accepté : le bento serait inatteignable';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  3  slug réservé refusé';
    v_ok := v_ok + 1;
  end;

  begin
    perform public.create_bento('controle-16');
    raise warning 'KO  2b adresse déjà prise acceptée';
    v_ko := v_ko + 1;
  exception when others then
    raise notice 'ok  2b adresse déjà prise refusée';
    v_ok := v_ok + 1;
  end;

  begin
    if public.create_bento('controle-16-bis') is null then
      raise warning 'KO  2c création valide sans identifiant';
      v_ko := v_ko + 1;
    elsif (select is_primary from public.bentos where slug = 'controle-16-bis') then
      raise warning 'KO  2d un bento créé par create_bento naît principal';
      v_ko := v_ko + 1;
    else
      raise notice 'ok  2c création valide, et le bento naît secondaire';
      v_ok := v_ok + 1;
    end if;
  exception when others then
    raise warning 'KO  2c création valide refusée : %', sqlerrm;
    v_ko := v_ko + 1;
  end;

  -- ── 4. Les compteurs comptent des personnes ─────────────────────────
  select jsonb_object_agg(title, picks) into v_avant from public.shared_items(20);

  -- Le secondaire reçoit les mêmes cases que le principal, et il est publié :
  -- une seule personne, deux fois les mêmes items.
  insert into public.bento_items (bento_id, category_id, item_id)
  select v_second, bi.category_id, bi.item_id
  from public.bento_items bi where bi.bento_id = v_main;
  update public.bentos set published_at = now() where id = v_second;

  select jsonb_object_agg(title, picks) into v_apres from public.shared_items(20);

  if v_avant is not distinct from v_apres then
    raise notice 'ok  4a shared_items ne bouge pas quand une personne duplique ses items';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4a shared_items gonflé : % puis %', v_avant, v_apres;
    v_ko := v_ko + 1;
  end if;

  -- Témoin : l'ancien calcul, sur les mêmes données, DOIT différer. Sans lui,
  -- un jeu de données trop pauvre ferait passer 4a sans rien prouver.
  if (
    select count(*) from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id and b.published_at is not null
    where bi.bento_id in (v_main, v_second)
  ) > (
    select count(distinct b.user_id) from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id and b.published_at is not null
    where bi.bento_id in (v_main, v_second)
  ) then
    raise notice 'ok  4b témoin : l''ancien calcul aurait bien gonflé';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  4b témoin muet : le jeu de données ne prouve rien';
    v_ko := v_ko + 1;
  end if;

  -- ── 5. La recherche sait dire quel bento ────────────────────────────
  if exists (
    select 1 from public.search_bentos(
      (select substr(u.pseudo, 1, 4) from public.users u where u.id = v_uid), 20
    ) r where r.slug is not null
  ) then
    raise notice 'ok  5  search_bentos rend le slug du bento trouvé';
    v_ok := v_ok + 1;
  else
    raise warning 'KO  5  search_bentos ne rend pas de slug';
    v_ko := v_ko + 1;
  end if;

  raise notice '════ % tenus, % manqués ════', v_ok, v_ko;
  if v_ko > 0 then
    raise exception '% contrôles manqués', v_ko;
  end if;
end $$;

rollback;
