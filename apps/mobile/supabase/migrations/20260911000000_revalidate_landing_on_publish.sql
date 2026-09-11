-- Migration : purge le cache de la page publique quand un bento change.
--
-- Contexte. La page `/u/[pseudo]` de la landing est servie en ISR avec une
-- revalidation de 5 minutes. C'est un compromis : sans elle, chaque robot
-- d'aperçu social et chaque partage viral paierait un aller-retour
-- Supabase. Mais l'utilisateur qui vient de publier son bento et partage
-- aussitôt le lien peut tomber sur la version d'avant.
--
-- Ce déclencheur supprime la fenêtre : à la publication, à la
-- dépublication ou à un changement de mise en avant, il appelle
-- l'endpoint de revalidation de la landing, qui existe déjà et accepte
-- `{ paths: string[] }`.
--
-- Asynchrone par construction : `net.http_post` met la requête en file et
-- rend la main immédiatement. La publication ne dépend donc pas de la
-- disponibilité de la landing, et toute erreur est avalée (cf. le bloc
-- `exception`) plutôt que de faire échouer l'écriture de l'utilisateur.
--
-- À appliquer sur le projet Supabase mobile (ggjgktbcqumfxrixcdyx) via le
-- SQL editor du dashboard. Cf. le runbook en fin de fichier pour les deux
-- secrets à créer AVANT.

create extension if not exists pg_net with schema extensions;

create or replace function public.revalidate_landing_bento()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_row     record;
  v_pseudo  text;
  v_base    text;
  v_token   text;
begin
  v_row := coalesce(new, old);

  -- Sur UPDATE, ne réagir qu'aux champs qui changent le rendu public.
  -- Sans ce filtre, chaque `updated_at` déclencherait un appel HTTP.
  if tg_op = 'UPDATE'
     and new.published_at is not distinct from old.published_at
     and new.is_featured  is not distinct from old.is_featured then
    return v_row;
  end if;

  -- Minuscules : c'est la forme canonique des URL côté web, la seule
  -- sous laquelle une entrée de cache existe.
  select lower(u.pseudo) into v_pseudo
  from public.users u
  where u.id = v_row.user_id;

  if v_pseudo is null then
    return v_row;
  end if;

  select decrypted_secret into v_base
  from vault.decrypted_secrets where name = 'landing_base_url';
  select decrypted_secret into v_token
  from vault.decrypted_secrets where name = 'landing_revalidate_token';

  -- Secrets absents : on ne fait rien. La revalidation périodique de
  -- 5 minutes reste le filet de sécurité, la migration peut donc être
  -- appliquée avant que les secrets soient posés.
  if v_base is null or v_token is null then
    return v_row;
  end if;

  perform net.http_post(
    url     := v_base || '/api/revalidate',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_token
    ),
    body    := jsonb_build_object(
      'paths', jsonb_build_array(
        '/u/' || v_pseudo,
        -- Le sitemap ne liste que les bentos mis en avant : un
        -- basculement de `is_featured` doit l'y faire entrer ou sortir.
        '/sitemap.xml'
      )
    ),
    timeout_milliseconds := 3000
  );

  return v_row;

exception when others then
  -- Jamais au détriment de l'utilisateur : une landing injoignable, une
  -- extension absente ou un secret mal formé ne doivent pas empêcher la
  -- publication d'un bento.
  raise warning 'revalidate_landing_bento: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

comment on function public.revalidate_landing_bento is
  'Purge le cache ISR de la page publique /u/<pseudo> de la landing '
  'quand un bento est publié, dépublié, ou (dé)mis en avant. '
  'Asynchrone via pg_net, silencieux en cas d''échec.';

drop trigger if exists bentos_revalidate_landing on public.bentos;
create trigger bentos_revalidate_landing
  after insert or update or delete on public.bentos
  for each row execute function public.revalidate_landing_bento();

-- ─────────────────────────────────────────────────────────────────────
-- RUNBOOK — à exécuter une fois, dans le SQL editor du projet mobile.
--
-- 1. Créer les deux secrets. Le jeton doit être IDENTIQUE à la variable
--    `REVALIDATE_TOKEN` du service landing sur Coolify ; sans quoi
--    l'endpoint répond 401 et le déclencheur échoue en silence.
--
--      select vault.create_secret('https://bento-pop.com', 'landing_base_url');
--      select vault.create_secret('<le jeton>',            'landing_revalidate_token');
--
--    Pour les faire évoluer ensuite :
--      select vault.update_secret(id, '<nouvelle valeur>')
--      from vault.secrets where name = 'landing_revalidate_token';
--
-- 2. Vérifier que l'appel part bien, après avoir publié un bento :
--
--      select id, url, status_code, error_msg, created
--      from net._http_response
--      order by created desc limit 5;
--
--    Un `status_code` 200 avec `{"revalidated":[...]}` confirme la
--    chaîne complète. Un 401 signale un jeton désaligné, un 503 que
--    `REVALIDATE_TOKEN` n'est pas défini côté landing.
-- ─────────────────────────────────────────────────────────────────────
