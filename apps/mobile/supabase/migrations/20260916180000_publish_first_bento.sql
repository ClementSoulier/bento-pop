-- ─────────────────────────────────────────────────────────────────────────
-- Le pseudo au moment de publier : créer profil, bento et cases d'un geste
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 9, lot 5 du chantier 16. Cf. `docs/UX-16-PLUSIEURS-BENTOS.md` §5.6.
--
-- ─── Le problème ─────────────────────────────────────────────────────────
--
-- On veut qu'un nouveau venu remplisse ses six cases avant qu'on lui demande
-- un pseudo. Trois contraintes l'en empêchent aujourd'hui, et elles sont
-- toutes en base :
--
--   1. `users.pseudo` est `not null` avec un contrôle de forme : une ligne de
--      profil ne peut pas exister sans pseudo valide ;
--   2. `bentos.user_id` référence `users(id)` : aucune case ne peut être
--      écrite côté serveur sans ligne de profil ;
--   3. `terms_accepted_at` est posé dans l'`INSERT` du profil, donc au choix
--      du pseudo.
--
-- Mesuré le 16 septembre 2026 : **34 comptes sur 61, soit 56 %, portent un
-- pseudo unique et n'ont jamais rien publié**. Chacun a réservé une adresse
-- que personne d'autre ne peut prendre, pour une boîte que personne ne verra.
--
-- ─── La sortie ───────────────────────────────────────────────────────────
--
-- Le brouillon reste sur l'appareil jusqu'à la publication, et cette fonction
-- fait le reste en **une transaction** : profil, bento, cases, publication.
-- Ni profil orphelin si les cases échouent, ni cases orphelines si la
-- publication échoue. C'est précisément ce qu'une suite d'appels PostgREST ne
-- sait pas garantir.
--
-- `security definer` pour deux raisons : le profil se crée avant que la RLS
-- ait quoi que ce soit à quoi se raccrocher, et `slug` comme `is_primary`
-- restent hors des droits du client.

create or replace function public.publish_first_bento(
  p_pseudo text,
  p_terms_accepted_at timestamptz,
  -- [{ "category_id": 1, "item_id": "uuid" }, …]
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
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour publier.' using errcode = '42501';
  end if;

  -- Un profil existe déjà : ce n'est pas le chemin du premier bento. Le
  -- composer doit passer par `ensurePrimaryBento` et `publishBento`.
  if exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Ce compte a déjà un profil.' using errcode = '23505';
  end if;

  -- Même contrôle que la contrainte `pseudo_format`, pour rendre un message
  -- lisible plutôt qu'une violation de contrainte.
  if p_pseudo is null or p_pseudo !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Pseudo invalide : 3 à 20 caractères, lettres, chiffres, points et underscores.'
      using errcode = '22023';
  end if;

  -- Les CGU sont une obligation App Store Guideline 1.2 : elles doivent être
  -- acceptées AVANT toute contribution publique, et c'est ici que la
  -- contribution devient publique. La date vient de l'appareil, où
  -- l'acceptation a eu lieu ; bornée à maintenant, une horloge en avance ne
  -- doit pas inscrire une acceptation dans le futur.
  if p_terms_accepted_at is null then
    raise exception 'Les conditions d''utilisation doivent être acceptées.' using errcode = '42501';
  end if;

  -- Un bento se publie complet, comme dans le back-office. Le composer
  -- n'active son bouton qu'à six cases, ce contrôle est la ceinture.
  select count(*) into v_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));
  if v_count <> (select count(*) from public.bento_categories where is_active) then
    raise exception 'Un bento se publie complet.' using errcode = '22023';
  end if;

  insert into public.users (id, pseudo, terms_accepted_at)
  values (v_uid, p_pseudo, least(p_terms_accepted_at, now()));

  -- `slug` et `is_primary` prennent leurs valeurs par défaut, posées par
  -- `20260916160000_bentos_defaults_urgent.sql` : « mon-bento » et vrai.
  insert into public.bentos (user_id, published_at)
  values (v_uid, now())
  returning id into v_bento;

  -- Le déclencheur `bento_items_check_type` vérifie que chaque item est du
  -- type de sa case, et les clés étrangères qu'il existe. Une case invalide
  -- annule donc toute la transaction, profil compris.
  insert into public.bento_items (bento_id, category_id, item_id)
  select v_bento, (e ->> 'category_id')::smallint, (e ->> 'item_id')::uuid
  from jsonb_array_elements(p_items) e;

  return v_bento;

exception when unique_violation then
  -- Le pseudo est pris, ou le profil vient d'être créé par un autre appareil.
  raise exception 'Ce pseudo est déjà pris.' using errcode = '23505';
end;
$$;

revoke execute on function public.publish_first_bento(text, timestamptz, jsonb) from public, anon;
grant execute on function public.publish_first_bento(text, timestamptz, jsonb) to authenticated;

comment on function public.publish_first_bento(text, timestamptz, jsonb) is
  'Crée profil, bento principal, cases et publication en une transaction, pour '
  'le parcours « pseudo au moment de publier » du chantier 9. Refuse un compte '
  'qui a déjà un profil : ce chemin ne sert qu''au premier bento.';

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- 1. La fonction n'est appelable que par un client authentifié.
--
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'publish_first_bento';
--
-- 2. Le parcours complet, dans une transaction annulée : cf. le cas 7 de
--    `apps/mobile/scripts/check-bentos-multi.sql`.
