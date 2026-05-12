-- ╔═══════════════════════════════════════════════════════════════════════╗
-- ║  Bento Pop Mobile — extension blocked_pseudo_patterns                ║
-- ║  Objectif : durcir le seed avant review App Store. Apple peut tester  ║
-- ║  rapidement les pseudos offensants courants ; mieux vaut couvrir.     ║
-- ║  ON CONFLICT DO NOTHING : idempotent, peut être rejoué.               ║
-- ╚═══════════════════════════════════════════════════════════════════════╝

insert into public.blocked_pseudo_patterns (pattern, label) values
  -- ─── Slurs racistes FR ────────────────────────────────────
  ('b[o0]ugn[o0]ule', 'slur RA-FR'),
  ('b[il1]c[o0]t', 'slur RA-FR'),
  ('y[o0]up[il1]n', 'slur antisémite-FR'),
  ('ch[il1]net[o0]que', 'slur RA-FR (asiat)'),
  ('n[ée]gr[oe]?s?$', 'slur RN-FR'),

  -- ─── Slurs LGBT FR / EN supplémentaires ───────────────────
  ('g[o0]u[il1]ne', 'slur LGBT-FR'),
  ('tarl[o0]uz[e3]', 'slur LGBT-FR'),
  ('tr[a@]nn[yi]', 'slur LGBT-EN'),

  -- ─── Slurs racistes EN supplémentaires ────────────────────
  ('k[il1]ke', 'slur antisémite-EN'),
  ('ch[il1]nk', 'slur RA-EN'),
  ('sp[il1]c', 'slur RA-EN (latino)'),

  -- ─── Termes extrémistes / hate groups ─────────────────────
  ('kkk+', 'hate group KKK'),
  ('[il1]s[il1]s', 'terroriste ISIS'),
  ('da[ée]sh', 'terroriste Daesh'),
  ('14.?88', 'symbole néo-nazi'),
  ('h[ée]r[il1]l hitler', 'apologie nazi'),
  ('s?[il1]eg ?h?e?[il1]l', 'apologie nazi'),

  -- ─── Vulgarités sexuelles supplémentaires ─────────────────
  ('sal[o0]p[ea]', 'vulgarité-FR'),
  ('n[il1]qu[ée]', 'vulgarité-FR'),
  ('b[a@]ise', 'vulgarité-FR'),

  -- ─── Self-harm / contenu sensible ─────────────────────────
  ('su[il1]c[il1]de', 'contenu sensible'),

  -- ─── Usurpation marques / staff supplémentaires ───────────
  ('staff', 'usurpation-staff'),
  ('support', 'usurpation-support'),
  ('twitch', 'usurpation-marque'),
  ('y[o0]utube', 'usurpation-marque'),
  ('bent[o0].?pop$', 'usurpation-marque (sans suffixe)')
on conflict (pattern) do nothing;
