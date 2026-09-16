-- ─────────────────────────────────────────────────────────────────────────
-- Composer une édition : créer son bento, d'un geste
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 13, lot 1. Cf. `docs/UX-13-BENTO-HEBDOMADAIRE.md` §5.1 et §6.3.
--
-- Même raison d'être que `create_bento` : les droits colonne n'accordent au
-- client que `insert (user_id)` (`20260915000000_close_privilege_gaps.sql`),
-- donc ni `slug`, ni `is_primary`, ni `edition_id`. La création passe par une
-- fonction, en `security definer`.
--
-- Ce qu'elle garantit, et que le client ne peut pas garantir seul :
--
--   1. l'édition existe et **est sortie** : on ne compose pas une édition
--      annoncée mais non dévoilée, et la RLS seule ne suffirait pas, puisque
--      c'est ici qu'on décide ;
--   2. un seul bento par personne et par édition, par `bentos_one_per_edition` ;
--   3. une adresse qui ne collisionne avec rien, y compris avec un bento
--      libre que la personne aurait créé avant que l'édition n'existe.

create or replace function public.create_edition_bento(p_edition smallint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_base      text;
  v_slug      text;
  v_id        uuid;
  v_suffixe   int := 1;
begin
  if v_uid is null then
    raise exception 'Il faut être connecté pour composer une édition.' using errcode = '42501';
  end if;

  -- Le profil doit exister : `bentos.user_id` le référence. Une personne qui
  -- n'a pas encore publié passe par `publish_first_bento`, et composera les
  -- éditions ensuite.
  if not exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Publie d''abord ton bento.' using errcode = '42501';
  end if;

  -- Sortie, et sortie seulement. Un brouillon ou une édition programmée ne se
  -- compose pas : c'est ce qui rend l'annonce de la suivante sans danger.
  select e.slug into v_base
  from public.editions e
  where e.id = p_edition
    and e.released_at is not null
    and e.released_at <= now();

  if v_base is null then
    raise exception 'Cette édition n''est pas encore sortie.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.bentos b
    where b.user_id = v_uid and b.edition_id = p_edition
  ) then
    raise exception 'Tu composes déjà cette édition.' using errcode = '23505';
  end if;

  -- L'adresse est celle de l'édition. `create_bento` refuse désormais les
  -- slugs d'édition, donc la collision ne peut venir que d'un bento libre créé
  -- **avant** que l'édition n'existe. Boucle bornée plutôt qu'échec : la
  -- personne n'a rien fait de mal, et perdre sa composition sur un conflit
  -- d'adresse serait absurde.
  v_slug := v_base;
  loop
    begin
      insert into public.bentos (user_id, slug, is_primary, edition_id)
      values (v_uid, v_slug, false, p_edition)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      v_suffixe := v_suffixe + 1;
      if v_suffixe > 9 then
        raise exception 'Impossible de trouver une adresse libre pour cette édition.'
          using errcode = '23505';
      end if;
      -- `bentos_slug_format` plafonne à 40 caractères, le suffixe en prend
      -- deux : on tronque la base pour que le tout reste valide.
      v_slug := left(v_base, 38) || '-' || v_suffixe::text;
    end;
  end loop;
end;
$$;

revoke execute on function public.create_edition_bento(smallint) from public, anon;
grant execute on function public.create_edition_bento(smallint) to authenticated;

comment on function public.create_edition_bento(smallint) is
  'Crée le bento d''une édition sortie pour auth.uid(), non principal, à '
  'l''adresse de l''édition. Refuse une édition non sortie et un doublon. '
  'Cf. docs/UX-13-BENTO-HEBDOMADAIRE.md §5.1.';

notify pgrst, 'reload schema';

-- ─── Contrôles, à passer après application ───────────────────────────────
--
-- Cf. les cas 4 à 7 de `apps/mobile/scripts/check-editions.sql`.
