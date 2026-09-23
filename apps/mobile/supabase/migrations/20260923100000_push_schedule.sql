-- ─────────────────────────────────────────────────────────────────────────
-- Notifications push : le travail planifié, la purge, le contrôle de santé
-- ─────────────────────────────────────────────────────────────────────────
--
-- Chantier 17, lot 3. Cf. `docs/UX-17-NOTIFICATIONS-PUSH.md`, §6.1, §8,
-- D10 et D16 à D19.
--
-- ─── Ce que cette migration pose ─────────────────────────────────────────
--
--   1. `pg_cron`, installé dans `pg_catalog` comme le documente Supabase ;
--   2. `push_tickets` dit quel item ou quelle édition il portait (D18) ;
--   3. `push_health`, une ligne que le back-office tient à jour et que son
--      tableau de bord lit (D19) ;
--   4. `push_purge`, qui efface les tickets relus depuis plus de 30 jours et
--      l'historique de `pg_cron` de plus de 7 jours ;
--   5. deux travaux planifiés : `push-tick` toutes les 5 minutes (D10) et
--      `push-purge` chaque nuit.
--
-- ─── Inerte tant que les secrets manquent ────────────────────────────────
--
-- `push-tick` appelle `push_tick()`, qui ne poste rien sans les secrets de
-- coffre `push_webhook_url` et `push_webhook_token` (lot 1) : toutes les 5
-- minutes, il lit le coffre et rend `false`, jusqu'à la mise en service
-- (D11). `push-purge` n'a rien à effacer tant que rien n'est envoyé.
--
-- ─── Compatible avec les versions publiées ───────────────────────────────
--
-- La 1.1 de l'App Store et la 0.1.0 du Play Store ne lisent ni
-- `push_tickets` ni `push_health`, créées après elles, et n'ont aucun accès
-- au schéma `cron`. Rien de ce qu'elles lisent ou écrivent ne change.
-- Contrôles 12 à 15 de `scripts/check-push.sql`.

-- ─── 1. Le planificateur ─────────────────────────────────────────────────

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ─── 2. Ce que portait un ticket ─────────────────────────────────────────
--
-- De quoi répondre à « je n'ai rien reçu » pendant les 30 jours où un ticket
-- se garde (D18) : quel appareil, quel item ou quelle édition, et ce qu'Expo
-- a répondu. `on delete set null` : supprimer un item ne doit pas effacer la
-- trace de ce qu'on a envoyé à son sujet.

alter table public.push_tickets
  add column if not exists item_id uuid
    references public.items(id) on delete set null,
  add column if not exists edition_id smallint
    references public.editions(id) on delete set null;

-- Les clés étrangères s'indexent : supprimer un appareil parcourt ses
-- tickets, et une réclamation se lit par appareil ou par item.
create index if not exists push_tickets_token_id
  on public.push_tickets (token_id);
create index if not exists push_tickets_item_id
  on public.push_tickets (item_id) where item_id is not null;
create index if not exists push_tickets_edition_id
  on public.push_tickets (edition_id) where edition_id is not null;

comment on column public.push_tickets.item_id is
  'L''item proposé dont la modération a été notifiée (item_moderated).';
comment on column public.push_tickets.edition_id is
  'L''édition annoncée (edition_released).';

-- ─── 3. Le contrôle de santé ─────────────────────────────────────────────
--
-- Le back-office se redéploie à la main (D2) : une chaîne qui cesse de
-- tourner ne se verrait pas. Une seule ligne, que les routes d'envoi tiennent
-- à jour et que la carte du tableau de bord lit (D19).

create table if not exists public.push_health (
  -- Une seule ligne : la clé ne peut valoir que vrai.
  id boolean primary key default true check (id),
  -- Posé par chaque battement authentifié. La preuve que toute la chaîne
  -- tourne : `pg_cron`, le coffre, `pg_net`, le back-office et son jeton.
  last_tick_at timestamptz,
  -- Le dernier envoi qu'Expo a accepté, et ce qu'il portait.
  last_sent_at timestamptz,
  last_sent_kind text
    check (last_sent_kind in ('item_moderated', 'edition_released')),
  -- La dernière erreur, d'Expo ou du back-office, pour la carte.
  last_error_at timestamptz,
  last_error text
);

insert into public.push_health (id) values (true) on conflict (id) do nothing;

comment on table public.push_health is
  'Une ligne : dernier battement, dernier envoi réussi, dernière erreur. '
  'Écrite par le back-office, lue par son tableau de bord. Chantier 17.';

alter table public.push_health enable row level security;
revoke all on public.push_health from anon, authenticated;

-- ─── 4. La purge ─────────────────────────────────────────────────────────
--
-- Sans `security definer` : seul `pg_cron` l'appelle, au nom de celui qui a
-- programmé le travail. Aucun client ne l'exécute.

create or replace function public.push_purge()
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Un ticket relu ou expiré se garde 30 jours (D18). Un ticket jamais relu
  -- au bout de 31 jours ne le sera plus : Expo efface ses accusés à 24
  -- heures, et le back-office ne relit plus rien depuis un mois.
  delete from public.push_tickets
  where checked_at < now() - interval '30 days'
     or (checked_at is null and created_at < now() - interval '31 days');

  -- `pg_cron` garde une ligne par passage et ne vide jamais rien : 288 par
  -- jour avec le seul battement. Sept jours suffisent à lire une panne.
  delete from cron.job_run_details
  where end_time < now() - interval '7 days';
end;
$$;

revoke all on function public.push_purge() from public, anon, authenticated;

-- ─── 5. Les deux travaux planifiés ───────────────────────────────────────
--
-- `cron.schedule` remplace un travail du même nom : la migration se rejoue
-- sans doublon. Heures en UTC, celles de `pg_cron`.

select cron.schedule('push-tick', '*/5 * * * *', 'select public.push_tick()');
select cron.schedule('push-purge', '30 3 * * *', 'select public.push_purge()');

-- ─── Contrôle ────────────────────────────────────────────────────────────
-- Sur le Supabase local, après application :
--
--   docker exec -i supabase_db_bento-pop-mobile \
--     psql -U postgres -d postgres -q < apps/mobile/scripts/check-push.sql
