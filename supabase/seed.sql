-- Seed Supabase Bento Pop.
--
-- Insère une semaine de vote courante pour la landing — sinon l'écran
-- "Thermomètre" affichera le `fallback` codé en dur dans
-- `apps/landing/src/content/thermometre.ts`.

insert into public.landing_vote_weeks (week_tag, question, options, ends_at, is_current)
values (
  'Vote · Semaine 19',
  'Quel jeu mérite le titre de GOTY 2026 ?',
  '[
    {"id": "gta", "label": "GTA VI"},
    {"id": "sc",  "label": "Star Citizen 1.0"},
    {"id": "ds",  "label": "Death Stranding 2"},
    {"id": "mh",  "label": "Monster Hunter Wilds"}
  ]'::jsonb,
  now() + interval '7 days',
  true
)
on conflict do nothing;
