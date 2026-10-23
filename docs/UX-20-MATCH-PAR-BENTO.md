# Chantier 20 · Recherche « match » par bento

> Spécification écrite le 23 octobre 2026, à partir du code de la branche du
> chantier 19 (`2b313b3`) et de lectures sur la production, en lecture seule :
> la base mobile et les pages de la landing. Aucune écriture en production.
>
> **Arbitrages proposés le 23 octobre 2026, en l'absence de Clément**, qui a
> demandé d'enchaîner ce chantier après le 19. Chaque question que la roadmap
> laissait « à trancher », celles du 20 comme celles du 26 qu'il porte, prend
> ici l'option recommandée, chiffres à l'appui. **Toutes sont à confirmer à
> son retour, avant la fusion** : §11 les marque une par une. En résumé : un
> match, c'est un même item dans deux bentos de deux comptes, un seul
> suffit, rangés par rareté ; le réglage « Apparaître dans la recherche »,
> allumé par défaut, retire un compte de « Trouver » et des matchs, appliqué
> par les fonctions SQL ; l'entrée est une pastille « Mêmes goûts » dans la
> barre du haut de la page d'un bento.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantiers 20 et 26,
> [le chantier 6](./UX-06-TROUVER.md) pour `search_bentos` et
> [le chantier 8](./UX-08-SIGNAUX-DE-RETOUR.md) pour le modèle du réglage
> « Afficher mes visites ». Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

« Une recherche « match » par bento. » Proposition : depuis un bento, « Ils
ont les mêmes goûts », les bentos qui partagent le plus d'items, un item rare
pesant plus qu'un item que tout le monde a ; une fonction SQL. Son réglage de
confidentialité part avec lui, la visibilité dans la recherche, appliquée en
base.

Fait quand : depuis n'importe quel bento, un tap montre ceux qui lui
ressemblent le plus en disant pourquoi, dans le budget de latence de
« Trouver », et un compte retiré de la recherche n'apparaît ni dans
« Trouver » ni dans les matchs, vérifié à la clé anonyme.

### 1.2 Mesuré le 23 octobre 2026, en production

- **28 bentos publiés**, de 28 comptes ; aucun bento secondaire, aucune
  édition publiée.
- **138 items distincts**, dont **118 choisis par une seule personne**, 12 par
  deux, 6 par trois, 2 par quatre (« Joyca » et « Angers »).
- **38 paires de bentos partagent au moins un item**, 3 en partagent deux,
  une seule en partage trois. Aucune paire ne partage un item posé dans deux
  cases différentes.
- **23 bentos sur 28 ont au moins un match** : 3 en ont un, 7 deux, 6 trois,
  2 quatre, 2 cinq, 2 sept et 1 neuf. Le signal reste mince, comme au
  15 septembre (31 paires sur 27 bentos), mais il existe pour presque tous.

---

## 2. Objectif et critères de succès

- Depuis la page de n'importe quel bento publié, un tap montre les bentos
  qui lui ressemblent le plus, chacun avec les items qu'ils ont en commun.
- La réponse tient dans le budget de « Trouver » : 200 ms à chaud, au p50.
- Un compte qui s'est retiré de la recherche n'apparaît plus ni dans
  « Trouver », pseudo, items et suggestions compris, ni dans les matchs ; la
  règle est tenue par la base, prouvée à la clé anonyme.

---

## 3. Périmètre

**Dans le chantier** : la fonction de match ; le réglage « Apparaître dans la
recherche » et son application à `search_bentos`, `shared_items` et au
match ; la pastille et l'écran des matchs ; le réglage au profil ; le
`noindex` d'un bento mis en avant d'un compte retiré ; l'accessibilité.

**Hors du chantier** :

- le compte privé, visible des seuls abonnés : il attend les abonnements du
  chantier 23 (D8) ;
- un écran de réglages à part : la section « Confidentialité » du profil en
  tient lieu tant qu'elle porte deux réglages (D9) ;
- les matchs dans « La table » ou dans « Trouver » : ils partent de la page
  d'un bento, comme la roadmap le propose ;
- une notification « quelqu'un a les mêmes goûts que toi » ;
- les versions publiées, 1.1 et 0.1.0, qui n'appelleront jamais la fonction
  de match ; elles voient seulement « Trouver » se plier au réglage.

---

## 4. Ce que disent le code et la base

### 4.1 La recherche

- **`search_bentos(q, lim)`**, migration `20260916140000_bentos_lift_unique.sql`
  : pseudos et items d'un seul appel, bentos publiés seulement, un bento au
  plus une fois. `security invoker` : la RLS s'applique. p50 de 48 ms au
  chantier 6.
- **`shared_items(lim)`**, même migration : les items choisis par au moins
  deux personnes, le bloc « on retrouve souvent » de « Trouver ».
- **La RLS** : `users_read_all` est `using (true)`, et la lecture de `users`
  n'est pas limitée par colonne, seules l'insertion et la mise à jour le sont
  (`20260915000000_close_privilege_gaps.sql`). Les bentos publiés et leurs
  items se lisent par tous.

### 4.2 Le modèle du réglage

- **`users.show_visits`**, chantier 8 : une colonne booléenne, allumée par
  défaut, écrite par son seul propriétaire (`grant update (show_visits)` et
  la politique `users_update_own`), appliquée par la fonction qui rend le
  compteur.
- **`src/components/PrivacySettings.tsx`** : la section « Confidentialité » du
  profil, un `SettingSwitch`, l'écriture par `writeShowVisits`, l'état rendu
  si l'écriture échoue. Le type `Database` est écrit à la main, dans
  `packages/supabase-mobile/src/types.ts`.

### 4.3 La page d'un bento dans l'app

- **`app/u/[pseudo].tsx`** tient dans un écran par un modèle de géométrie :
  l'en-tête, la bande des autres bentos du compte et la barre de boutons
  réservent leur hauteur, et l'échelle de la boîte en découle. Une rangée de
  plus sous la boîte changerait cette échelle à l'arrivée des matchs.
- **La barre du haut** a une hauteur fixe : « Retour » à gauche, « Options »
  à droite, qui apparaît à l'arrivée du bento sans que rien ne bouge.

### 4.4 La landing

- **Les pages de bento sont déjà en `noindex`**, sauf les bentos mis en avant
  par l'équipe (`bentoRobots(bento.isFeatured)`), et seuls ceux-là entrent au
  sitemap (`listFeaturedPseudos`).

---

## 5. Design

### 5.1 Ce qu'est un match (D1 à D3)

- **Un même item dans deux bentos publiés de deux comptes**, où qu'il soit
  posé : dans le bento principal, la case est le type d'item, et aucune paire
  ne partage aujourd'hui un item dans deux cases différentes.
- **Un item commun suffit.** Exiger deux items ne laisserait que trois paires.
- **Rangés par rareté** : chaque item commun pèse `1 / n`, `n` le nombre de
  comptes visibles qui l'ont choisi. Un item de deux personnes pèse deux fois
  plus qu'un item de quatre. À score égal, le plus d'items communs, puis le
  bento le plus récent.
- **Tous les bentos publiés**, principal, secondaires et éditions, comparés
  un à un ; jamais deux bentos du même compte.

### 5.2 La pastille (D10, D12)

- **Dans la barre du haut de la page d'un bento**, entre « Retour » et
  « Options » : « Mêmes goûts » et le nombre de bentos, dès un match. Rien
  sans match, rien tant que la réponse n'est pas arrivée : la barre garde sa
  hauteur, rien ne bouge.
- **Sur son propre bento aussi** : « Ils ont les mêmes goûts que toi ».

### 5.3 L'écran « Ils ont les mêmes goûts » (D11, D13)

- **Une liste**, au plus 20 bentos, du plus ressemblant au moins : le Popy et
  le pseudo, le nom affiché, puis ce qu'ils ont en commun, les items les plus
  rares d'abord, trois au plus : « Dune, Arcane et 1 autre en commun ».
- **Le tap** ouvre la page de ce bento, d'où l'on peut rebondir.
- **Les comptes bloqués sur l'appareil** sont écartés, comme dans le fil.
- **L'accessibilité** : chaque ligne, un seul élément, « Bento de @alice : 2
  items en commun, Dune et Arcane. ».

### 5.4 Le réglage (D5 à D7)

- **« Apparaître dans la recherche »**, sous « Afficher mes visites » dans la
  section « Confidentialité » du profil, allumé par défaut.
- **Éteint** : le compte disparaît de « Trouver », pseudo, items et
  suggestions, et des matchs des autres ; sa page reste ouverte à qui a le
  lien, et ses propres matchs restent visibles sur ses bentos. Un bento mis
  en avant de ce compte passe en `noindex` et sort du sitemap.
- **La note sous l'interrupteur éteint** : « Retiré de la recherche : ta page
  reste ouverte à qui a le lien. »

---

## 6. Contrat technique

### 6.1 La base

- **`users.searchable boolean not null default true`**, écrite par son seul
  propriétaire (`grant update (searchable)`), comme `show_visits`.
- **`bento_matches(p_bento uuid, lim int default 20)`**, `security invoker`,
  `stable`, ouverte à `anon` et `authenticated` :

```sql
returns table (
  bento_id uuid, slug text, is_primary boolean, pseudo text,
  display_name text, edition_title text, shared int, score real,
  items jsonb  -- [{ "id", "title", "category_id" }], les plus rares d'abord
)
```

  Vide si `p_bento` n'est pas publié. Les candidats : les bentos publiés des
  autres comptes, `searchable`. `lim` plafonné à 50.
- **`search_bentos` et `shared_items`** gardent leur signature et ne voient
  plus que les comptes `searchable` : les versions publiées les appellent
  sans changement.
- **Compatibilité** : la 1.1 et la 0.1.0 lisent `users` en `select('*')` et
  reçoivent `searchable`, qu'elles ignorent.

### 6.2 L'app

- **`src/lib/matches.ts`**, pur et testé sous `node:test` : le chargement à
  client injecté, la validation de chaque ligne, le libellé « en commun » et
  le libellé accessible.
- **`writeSearchable`**, à côté de `writeShowVisits`, et le type `Database`
  complété.
- **`app/u/[pseudo].tsx`** : la pastille dans `TopBar`, par une requête à
  part, `['bento-matches', bentoId]`, partagée avec l'écran.
- **`app/matches/[bentoId].tsx`** : l'écran.

### 6.3 La landing

- **`bentoRobots(isFeatured && searchable)`** et `listFeaturedPseudos`
  limité aux comptes `searchable`.

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **`apps/mobile/scripts/check-matches.sql`**, sur le Supabase local, en
  transaction annulée, comme `check-visits.sql` : le match et son ordre, la
  rareté, le même compte écarté, le brouillon écarté, le réglage tenu par
  `search_bentos`, `shared_items` et `bento_matches` sous le rôle `anon`, et
  l'écriture du réglage par son seul propriétaire.
- **L'app** : `matches.test.ts`.
- **La landing** : le `noindex` en e2e.
- **La latence**, mesurée contre le Supabase local.

### 7.2 Recette

Au simulateur iPhone 17 Pro et SE et à l'émulateur Pixel 8, sur le Supabase
local garni de bentos qui se recoupent :

1. La pastille sur un bento qui a des matchs, rien sur un bento qui n'en a
   pas, rien qui bouge dans la page à son arrivée.
2. L'écran : l'ordre, les items en commun, le tap qui ouvre le bento.
3. Le réglage éteint : le compte disparaît de « Trouver » et des matchs d'un
   autre compte ; rallumé, il revient.
4. VoiceOver et TalkBack sur une ligne, lus dans les arbres.
5. Les grandes tailles de police, sur la pastille et l'écran.

---

## 8. Plan de développement

Effort **M**, comme à la roadmap.

### Lot 1 · La base

La colonne, `bento_matches`, le réglage appliqué à `search_bentos` et
`shared_items`, `check-matches.sql`, la latence.

### Lot 2 · L'app : les données

`src/lib/matches.ts`, `writeSearchable`, le type `Database`, leurs tests.

### Lot 3 · L'app : la pastille, l'écran et le réglage

`TopBar`, `app/matches/[bentoId].tsx`, `PrivacySettings`, l'accessibilité.

### Lot 4 · La landing

Le `noindex` et le sitemap, l'e2e.

### Lot 5 · Recette et documents

La recette de §7.2, la DoD point par point, la roadmap, la liste du
chantier 29.

---

## 9. Livraison

- **Une PR** pour les cinq lots, après la confirmation des arbitrages par
  Clément.
- **La migration** s'applique en production à la fusion, comme les
  précédentes, par Clément : compatible avec la 1.1 et la 0.1.0.
- **À la sortie store** : la pastille, l'écran et le réglage.

---

## 10. Definition of Done

- [ ] Depuis la page de n'importe quel bento publié, un tap montre les
      bentos qui lui ressemblent, chacun avec ses items en commun
- [ ] Un item rare pèse plus qu'un item que beaucoup ont choisi
- [ ] Jamais deux bentos du même compte, jamais un brouillon
- [ ] La fonction de match tient dans 200 ms à chaud, au p50
- [ ] Le réglage éteint retire le compte de « Trouver » et des matchs,
      prouvé à la clé anonyme ; seul son propriétaire peut l'écrire
- [ ] La page d'un compte retiré reste ouverte par son lien
- [ ] Un bento mis en avant d'un compte retiré est servi en `noindex` et
      sort du sitemap
- [ ] Rien ne bouge dans la page d'un bento à l'arrivée des matchs
- [ ] VoiceOver et TalkBack lisent une ligne de match en un seul élément
- [ ] Les versions publiées ne cassent pas : `search_bentos` et
      `shared_items` gardent leur signature
- [ ] Tests, typage, lint et build verts, CI rejouée en local

---

## 11. Décisions

Toutes proposées le 23 octobre 2026, en l'absence de Clément, **à confirmer
avant la fusion**.

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | Un match, c'est le même item n'importe où dans le bento | Question de la roadmap. Dans le bento principal, la case est le type d'item ; aucune des 38 paires ne partage un item posé dans deux cases différentes. Pour les éditions, le même film reste un goût commun, quelle que soit la question |
| **D2** | Tous les bentos publiés, principal, secondaires et éditions, comparés un à un ; jamais deux bentos du même compte | Question de la roadmap. Le bento est l'unité de la recherche depuis le chantier 16 ; aucun secondaire ni aucune édition en production aujourd'hui |
| **D3** | Un item commun suffit, et chaque item pèse `1 / n`, `n` les comptes qui l'ont choisi | Question de la roadmap. 16 bentos sur 23 n'ont qu'un à trois matchs ; à deux items minimum, il ne resterait que 3 paires |
| **D4** | Ne pas attendre les éditions hebdomadaires | Question de la roadmap. Aucune édition ne se compose en production avant la sortie store (13, D8), avec laquelle ce chantier sort ; la fonction les prendra sans changement |
| **D5** | « Apparaître dans la recherche », un interrupteur du profil, allumé par défaut, pour tout le compte | Question du 26, les valeurs par défaut. C'est le comportement d'aujourd'hui ; éteint par défaut, il viderait « Trouver » |
| **D6** | Éteint, le compte disparaît de « Trouver », suggestions comprises, et des matchs des autres ; appliqué par les fonctions SQL ; sa page reste ouverte par son lien | Principe du 26 : un réglage tenu par l'écran seul ne protège rien, l'API se lit avec la clé anonyme |
| **D7** | Les moteurs : éteint, un bento mis en avant passe en `noindex` et sort du sitemap | Question du 26. Les autres bentos sont déjà en `noindex` ; le choix de l'utilisateur passe avant la mise en avant de l'équipe |
| **D8** | Le compte privé, visible des seuls abonnés, hors du chantier | Question du 26. Il suppose les abonnements du chantier 23 |
| **D9** | Les réglages restent dans la section « Confidentialité » du profil ; un écran à part quand elle grandira | La roadmap faisait naître l'écran ici. Deux réglages tiennent dans une section, et « au même endroit » est tenu ; les 22, 23 et 25 en ajouteront |
| **D10** | L'entrée : une pastille « Mêmes goûts » dans la barre du haut de la page d'un bento, avec le nombre, dès un match | La barre du haut a une hauteur fixe ; une rangée sous la boîte changerait l'échelle de la page à l'arrivée des matchs |
| **D11** | L'écran liste au plus 20 bentos, chacun avec trois items communs au plus, les plus rares d'abord | Le bento le plus fourni en a 9 aujourd'hui ; trois noms suffisent à dire pourquoi |
| **D12** | La pastille aussi sur son propre bento | Voir qui partage ses goûts est la moitié de l'intérêt |
| **D13** | Les comptes bloqués sur l'appareil sont écartés à l'écran | Comme dans le fil et « Trouver » : la liste est locale à l'appareil |
| **D14** | Le budget de « Trouver », 200 ms à chaud au p50 | La roadmap le demande |

---

## 12. Suivis

- **Après quelques éditions hebdomadaires**, remesurer le signal : la roadmap
  supposait qu'une même case posée à tous rapprocherait les choix.
- **Un écran de réglages à part**, quand les 22, 23 et 25 ajouteront les
  leurs.
- **Les matchs dans « Trouver »**, en suggestion, si les taps sur la pastille
  le justifient.
