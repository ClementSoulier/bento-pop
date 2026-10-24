# Chantier 20 · Recherche « match » par bento

> Spécification écrite le 23 octobre 2026, à partir du code de la branche du
> chantier 19 (`2b313b3`) et de lectures sur la production, en lecture seule :
> la base mobile et les pages de la landing. Aucune écriture en production.
>
> **Arbitrages proposés le 23 octobre 2026, en l'absence de Clément**, qui a
> demandé d'enchaîner ce chantier après le 19. Chaque question que la roadmap
> laissait « à trancher », celles du 20 comme celles du 26 qu'il porte, prend
> ici l'option recommandée, chiffres à l'appui. **Toutes confirmées par
> Clément le 24 octobre 2026**, une par une, sans changement (§11). En résumé : un
> match, c'est un même item dans deux bentos de deux comptes, un seul
> suffit, rangés par rareté ; le réglage « Apparaître dans la recherche »,
> allumé par défaut, retire un compte de « Trouver » et des matchs, appliqué
> par les fonctions SQL ; l'entrée est une pastille « Mêmes goûts » dans la
> barre du haut de la page d'un bento.
>
> **Migration appliquée en production le 24 octobre 2026**, par Clément, dans
> l'éditeur SQL du projet « My Bento Pop », et contrôlée le même jour, en
> lecture seule, dans la base et par l'API (§9). La DoD est à 11 sur 11 (§10).
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

> **Fait le 23 octobre 2026**, sur la branche `feat/ux-20-match-par-bento`,
> partie de celle du chantier 19, qui touche aussi la roadmap.
>
> - **`supabase/migrations/20261023200000_bento_matches.sql`** : la colonne
>   `users.searchable` et son droit d'écriture par colonne ; `bento_matches` ;
>   `search_bentos` et `shared_items`, à signature inchangée, qui ne voient
>   plus que les comptes `searchable` ; le déclencheur du chantier 8, qui
>   suit aussi ce réglage et rafraîchit alors le sitemap. Appliquée au
>   Supabase local seulement.
> - **`scripts/check-matches.sql`** : 17 contrôles en transaction annulée,
>   sur sept bentos construits pour l'occasion : l'ordre exact des matchs et
>   leurs scores, les items communs du plus rare au plus commun, un item posé
>   deux fois qui compte une fois, le même compte et le brouillon écartés, la
>   limite, le réglage tenu sous la clé anonyme par les trois fonctions, le
>   compte retiré qui voit ses propres matchs, l'écriture du réglage par son
>   seul propriétaire et le rafraîchissement de ses pages et du sitemap.
>
> **Deux choix que la spécification laissait ouverts** :
>
> 1. **Le déclencheur du chantier 8 étendu, plutôt qu'un second** : un
>    changement de réglage ne fait qu'un appel à la landing, ses deux
>    adresses et, pour celui-ci, le sitemap.
> 2. **`popular_items`, les suggestions du composer, ne suit pas le
>    réglage** : elle compte des choix sans montrer de compte, et ne mène à
>    personne.
>
> **Défauts introduits exprès** : douze, tous attrapés. Le réglage oublié
> par le match, par la recherche ou par les suggestions ; le même compte en
> match ; les scores sans la rareté ; un item compté deux fois ; un brouillon
> au départ ; la limite sans plancher ; le déclencheur sourd au réglage ; le
> sitemap oublié ; le réglage refusé à son propriétaire ; la rareté comptée
> en bentos et non en comptes.
>
> **Non-régression** : `check-visits.sql`, 43 sur 43, le déclencheur partagé
> compris ; `check-privileges.ts`, conforme.
>
> **La latence**, mesurée en production en lecture seule, la colonne
> n'existant pas encore : le corps de la fonction exécuté comme une requête,
> sur le bento qui a le plus de matchs, 9 : 12 ms d'exécution et 11 ms de
> planification. Le budget de 200 ms laisse la place au réseau ; la mesure
> par l'API viendra après l'application en production.
>
> **Pour le lot 2** : `check-privileges.ts` gagnera la section du réglage,
> par les fonctions de l'app. La CI ne lit pas le SQL : elle sera rejouée au
> lot 2.

### Lot 2 · L'app : les données

`src/lib/matches.ts`, `writeSearchable`, le type `Database`, leurs tests.

> **Fait le 23 octobre 2026**, sur la même branche. Rien encore à l'écran.
>
> - **`src/lib/matches.ts`**, pur : `loadMatches` à client injecté, vingt
>   matchs au plus, et ses options de requête, la même clé pour la pastille
>   et l'écran, 5 s de délai, 5 minutes de fraîcheur, aucun réessai ; la
>   validation de chaque ligne, un match sans item lisible écarté, les titres
>   nettoyés par `cleanTitle` ; les comptes bloqués écartés ; l'adresse du
>   bento ; les libellés, « Dune, Arcane et Severance en commun », celui de
>   VoiceOver et TalkBack, qui dit tous les items, et ceux de la pastille.
> - **`writeSearchable`**, dans `search.ts` : « Apparaître dans la
>   recherche » est un réglage de la recherche.
> - **Le type `Database`** : `users.searchable` et `bento_matches`.
> - **`check-privileges.ts`** gagne la section du chantier 20, par les
>   fonctions de l'app contre l'API locale : les matchs lus sans session ;
>   retirée de la recherche, une personne sort de « Trouver » et garde sa
>   page ; un autre compte et un visiteur sans session ne l'y remettent pas ;
>   rallumée, elle revient. Conforme.
>
> **Tests** : 17 de plus, 10 unitaires et 7 contre le bouchon PostgREST, 776
> pour l'app. Sept défauts introduits exprès, tous attrapés : un match sans
> item gardé, le blocage sensible à la casse, « 1 autres », moins d'items
> communs que d'items lus, tous les items nommés à l'écran, son propre bento
> annoncé comme un autre, la limite de vingt oubliée.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226 pour
> l'admin, 192 pour la landing, 776 pour l'app ; e2e 38 sur 38 ; build 3 sur
> 3.

### Lot 3 · L'app : la pastille, l'écran et le réglage

`TopBar`, `app/matches/[bentoId].tsx`, `PrivacySettings`, l'accessibilité.

> **Fait le 23 octobre 2026**, sur la même branche.
>
> - **La pastille**, dans `TopBar` de `app/u/[pseudo].tsx` : « Mêmes goûts ·
>   2 », crème, bordure et ombre stamp, 30 pt de haut dans une barre de 44,
>   groupée avec « Options » à droite. Une requête à part, par le client sans
>   session, sans les comptes bloqués ; rien tant qu'elle n'a pas répondu,
>   rien sans match.
> - **`app/matches/[bentoId].tsx`** : le titre « Ils ont les mêmes goûts »,
>   « que toi » ou « que @alice », puis une carte par bento, le Popy, le
>   pseudo, l'édition ou le nom affiché et ce qu'ils ont en commun ; le tap
>   ouvre le bento. Les états de chargement, d'erreur et de liste vide. Un
>   `ScrollView` et non une `FlatList` : vingt lignes au plus, et pas de vues
>   recyclées dont les rôles se mélangeraient, le défaut trouvé au chantier
>   19.
> - **`PrivacySettings`** : « Apparaître dans la recherche » sous « Afficher
>   mes visites », sa note quand il est éteint. Changé, il invalide les
>   matchs en cache sur l'appareil, valables 5 minutes sinon.
>
> **Recette au simulateur iPhone 17 Pro**, sur le Supabase local, où les
> bentos de recette se recoupent :
>
> - **La pastille** sur le bento de @recettese, « 2 bentos ont les mêmes
>   goûts que celui-ci », un bouton avec son indication ; sur son propre
>   bento, « 1 bento a les mêmes goûts que toi » (D12).
> - **Rien ne bouge** : sans matchs, les deux autres comptes retirés le temps
>   d'une mesure, l'en-tête de la page est à y = 196 pt et la boîte à
>   y = 266,7 pt, au point près comme avec la pastille.
> - **L'écran** : @recette_proprio, trois items en commun, avant
>   @recette_visites, deux, comme le veulent les scores ; chaque ligne un
>   seul bouton, « Bento de @recette_proprio : 3 items en commun, Get Lucky,
>   Kyoto et Squeezie. », indication « Ouvre son bento » ; le titre en tête
>   de section, ses accents entiers. Le tap ouvre le bento.
> - **Le réglage** : éteint depuis le profil, la ligne passe à
>   `searchable = false`, @recette_proprio sort des matchs de @recettese, et
>   « Trouver » ne le rend plus pour « recette » ; rallumé, il revient.
>
> **Tests** : rien de plus en unitaire, 776 pour l'app ; les tests qui lisent
> le code couvrent les rôles, les libellés et les plafonds de police du
> nouvel écran.
>
> **Pour le lot 5** : l'iPhone SE, le Pixel 8, les grandes tailles de police
> sur la pastille et l'écran.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226, 192 et
> 776 ; e2e 38 sur 38 ; build 3 sur 3.

### Lot 4 · La landing

Le `noindex` et le sitemap, l'e2e.

> **Fait le 23 octobre 2026**, sur la même branche.
>
> - **`bentoRobots(isFeatured, searchable)`** : un bento mis en avant d'un
>   compte retiré passe en `noindex` ; les deux pages de bento, `/u/<pseudo>`
>   et `/u/<pseudo>/<slug>`, le lui passent.
> - **`listFeaturedPseudos`** écarte les comptes retirés : ils sortent du
>   sitemap, et des pages rendues d'avance par `generateStaticParams`.
> - **`lookupPublicBento`** lit `users.searchable` dans sa requête.
>
> **Un écart à la spécification, le repli d'avant la migration.** La
> landing se redéploie d'elle-même à la fusion. Partie avant la migration,
> elle demanderait une colonne que PostgREST ne connaît pas encore (`42703`)
> et toutes les pages de bento rendraient 404 dans l'intervalle. Sur ce
> refus, la lecture se refait sans la colonne, et le compte se lit « dans la
> recherche », la valeur par défaut de la migration ; de même pour la liste
> des bentos mis en avant. L'ordre des deux gestes ne casse donc plus rien
> (§9).
>
> **Tests** : 1 unitaire de plus, 193 pour la landing ; 3 e2e de plus, 41 sur
> 41 : le `noindex` d'un bento mis en avant d'un compte retiré, le sitemap
> sans lui, et la page rendue quand la base refuse la colonne. Quatre défauts
> introduits exprès, tous attrapés : le repli d'avant la migration oublié, le
> sitemap qui garde un compte retiré, la page qui oublie de passer le
> réglage, `bentoRobots` qui l'ignore.
>
> **Le banc e2e repart d'un dossier vide** : une page rendue à la demande par
> une exécution survivait dans `.next-e2e` à la suivante, et faussait le
> verdict d'un défaut. `smoke.test.ts` efface le dossier avant de
> construire.
>
> **Un diff sans bruit** : cinq des fichiers touchés n'étaient pas au format
> Prettier ; les changements y sont écrits dans leur style, et le diff ne
> porte que le lot.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226, 193 et
> 776 ; e2e 41 sur 41 ; build 3 sur 3.

### Lot 5 · Recette et documents

La recette de §7.2, la DoD point par point, la roadmap, la liste du
chantier 29.

> **Fait le 23 octobre 2026**, sur la même branche, sur le Supabase local, où
> les bentos de recette se recoupent : l'app servie par le Metro de ce
> worktree, à l'iPhone 17 Pro, à l'iPhone SE et à l'émulateur Pixel 8.
>
> **§7.2, point par point** :
>
> 1. **La pastille** : « Mêmes goûts · 2 », 30 pt de haut dans la barre de
>    44, sur les trois appareils ; à côté d'« Options » sur le bento d'un
>    autre, seule sur le sien, « 2 bentos ont les mêmes goûts que toi » au
>    SE. TalkBack y lit un bouton, « 2 bentos ont les mêmes goûts que
>    celui-ci ». Rien sans match, et rien qui bouge à son arrivée : mesuré au
>    lot 3.
> 2. **L'écran** : le même ordre sur les trois, @recette_proprio et ses trois
>    items avant @recette_visites et ses deux ; « que toi » sur son propre
>    bento. Le tap ouvre le bento, au simulateur (lot 3) comme à
>    l'émulateur. L'émulateur coupé du Supabase local, l'écran dit qu'il
>    n'arrive pas à charger, et « Réessayer » rend les matchs une fois la
>    connexion revenue.
> 3. **Le réglage** : de bout en bout au lot 3, à l'iPhone 17 Pro. À
>    l'émulateur, « Apparaître dans la recherche » sous « Afficher mes
>    visites », avec sa phrase ; TalkBack lit la carte comme un seul
>    interrupteur, coché.
> 4. **VoiceOver et TalkBack**, lus dans les arbres : sur iOS, chaque ligne un
>    seul bouton, son libellé et son indication (lot 3) ; sur Android, un seul
>    nœud `android.widget.Button` par ligne, tapable, au libellé complet, sans
>    enfant dans l'arbre réduit aux nœuds qu'atteint TalkBack. La voix passe
>    au chantier 29.
> 5. **Les grandes tailles de police**, la plus grande d'iOS et 2,0 sur
>    Android : la pastille garde ses 30 pt de haut, le titre de l'écran passe
>    sur deux lignes, accents entiers. Et trois défauts de l'écran.
>
> **Trois défauts trouvés et corrigés**, dans les textes de l'écran, que le
> lot 3 laissait grandir par `maxFontSizeMultiplier` :
>
> 1. **À 2,0 sur Android, des lignes écartées** : 32 dp d'une ligne à l'autre
>    pour les items en commun, au lieu des 27 du modèle, parce qu'Android ne
>    plafonne pas la hauteur de ligne (chantier 7, `fontScaleFor`). Les
>    textes de l'écran appliquent désormais eux-mêmes la taille système,
>    plafonnée, « Réessayer » compris, comme l'en-tête de la page d'un bento :
>    27 dp, et la carte passe de 146 à 130 dp.
> 2. **Sur iOS, une taille changée écran ouvert rognait les textes.** Passés à
>    la plus grande taille, ils grandissaient dans des boîtes restées à leur
>    ancienne hauteur, « que @recettese », le nom affiché et les items en
>    commun coupés par le bas, jusqu'à ce qu'on rouvre l'écran ; dans l'autre
>    sens, les cartes restaient trop hautes. Le même correctif le règle : les
>    cartes passent de 99 et 80 pt à 128 et 128, puis reviennent à 99 et 80,
>    sans rouvrir l'écran. La page d'un bento et « La table », éprouvées de
>    même, se remettaient déjà en page.
> 3. **Sur Android, l'ellipse d'un pseudo tronqué perdait la moitié de son
>    dernier point** : Android la mesure plus étroite qu'Extenda ne la
>    dessine. Ni l'espacement des lettres à zéro ni 4 dp de marge à droite n'y
>    changent rien, la marge tronquant même « @RECETTE_VISITES », qui tenait.
>    Et un pseudo de 20 caractères, le maximum, se tronque dès la taille par
>    défaut. Le pseudo reste désormais entier sur sa ligne, quitte à
>    rétrécir, comme dans l'en-tête de la page d'un bento : éprouvé au pire
>    cas, vingt caractères finis par des W, à la taille par défaut et à la
>    plus grande d'iOS, et à 2,0 sur Android. Les items en commun, en Fredoka
>    sur deux lignes, gardent une ellipse entière sur Android, éprouvée avec
>    des titres trop longs.
>
> **Tests** : 3 de plus dans `font-scaling.test.ts`, 779 pour l'app : chaque
> texte de l'écran applique lui-même la police système, et le pseudo
> rétrécit plutôt que d'être tronqué. Cinq défauts introduits exprès, tous
> attrapés : les items en commun rendus à la plateforme comme au lot 3, puis
> agrandis deux fois ; le sous-titre rendu à la plateforme, puis figé à la
> taille par défaut ; le pseudo tronqué.
>
> **Ailleurs dans l'app, hors du chantier** : sept textes laissent encore leur
> hauteur de ligne à la plateforme, dans le composer, « Trouver », « La
> table » et l'étiquette d'un post, `FeedLabel`, que la règle de la page
> publique, appliquée à toute l'app, désigne. Et cette étiquette tronque un
> pseudo trop long pour elle : la même ellipse rognée est à attendre sur
> Android, qu'aucun pseudo de la base locale n'est assez long pour montrer.
> Une suite, §12.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226 pour
> l'admin, 193 pour la landing, 779 pour l'app ; e2e 41 sur 41 ; build 3 sur
> 3.

---

## 9. Livraison

- **Une PR** pour les cinq lots, après la confirmation des arbitrages par
  Clément. **Au 24 octobre 2026, les cinq lots sont commités sur
  `feat/ux-20-match-par-bento`, partie de celle du chantier 19, ni poussés
  ni proposés** : ses arbitrages confirmés le 24 octobre, la PR n'attend
  plus que la fusion de celle du 19, la #93, ouverte le même jour.
- **La migration** s'applique en production à la fusion, comme les
  précédentes, par Clément : compatible avec la 1.1 et la 0.1.0. **De
  préférence juste avant de fusionner** : la landing, redéployée à la
  fusion, lit `users.searchable`. Elle sait s'en passer (lot 4), et personne
  ne peut se retirer de la recherche avant la sortie store ; l'ordre ne
  casse donc rien, mais la migration d'abord laisse la landing sur son
  chemin normal. **Appliquée le 24 octobre 2026**, avant la fusion, dans
  l'éditeur SQL du projet « My Bento Pop », ref `ggjgktbcqumfxrixcdyx`.
- **Après application**, contrôlé le 24 octobre 2026, en lecture seule :
  - **dans la base** : les 64 comptes dans la recherche ; les commentaires,
    accents compris, intacts ; le déclencheur qui suit les deux réglages et
    rafraîchit le sitemap ; `bento_matches` ouvert à la clé anonyme et
    `searchable` écrit par un compte connecté ; `search_bentos` et
    `shared_items` qui suivent le réglage, à signature inchangée ;
  - **par l'API, à la clé anonyme** : `bento_matches` sur les 28 bentos
    publiés, sans erreur ; 23 ont au moins un match, et 38 paires partagent
    un item, 35 un seul, 2 deux et 1 trois, les chiffres de §1.2 ; jamais le
    même compte ; à chaud, 57 ms au p50, 103 au p90 et 136 au pire ;
  - **`check-search-bentos.mjs`** : tout vert, la recherche à 55 ms au p50.
- **À la sortie store** : la pastille, l'écran et le réglage.

---

## 10. Definition of Done

- [x] Depuis la page de n'importe quel bento publié, un tap montre les
      bentos qui lui ressemblent, chacun avec ses items en commun
- [x] Un item rare pèse plus qu'un item que beaucoup ont choisi
- [x] Jamais deux bentos du même compte, jamais un brouillon
- [x] La fonction de match tient dans 200 ms à chaud, au p50
- [x] Le réglage éteint retire le compte de « Trouver » et des matchs,
      prouvé à la clé anonyme ; seul son propriétaire peut l'écrire
- [x] La page d'un compte retiré reste ouverte par son lien
- [x] Un bento mis en avant d'un compte retiré est servi en `noindex` et
      sort du sitemap
- [x] Rien ne bouge dans la page d'un bento à l'arrivée des matchs
- [x] VoiceOver et TalkBack lisent une ligne de match en un seul élément
- [x] Les versions publiées ne cassent pas : `search_bentos` et
      `shared_items` gardent leur signature
- [x] Tests, typage, lint et build verts, CI rejouée en local

**Point par point au 24 octobre 2026** : 11 points sur 11. Dix au lot 5, le
23 octobre, en local, au simulateur et à l'émulateur ; le point 4 le 24, par
l'API de production, la migration appliquée. Le point 9 est lu dans les
arbres d'accessibilité, la voix passant au chantier 29 ; le point 11 par la
CI rejouée en local, les Actions du dépôt étant désactivées.

| # | État | Preuve, ou ce qui manque |
| --- | --- | --- |
| 1 | Fait | La pastille sur la page d'un bento publié et l'écran de ses matchs, chacun avec ses items en commun, à l'iPhone 17 Pro, au SE et au Pixel 8 (lots 3 et 5) ; `bento_matches` pour tout bento publié, en base (lot 1) |
| 2 | Fait | Les scores en `1 / n` et l'ordre exact de `check-matches.sql`, du plus rare au plus commun ; les scores sans la rareté, défaut introduit exprès, attrapés (lot 1) |
| 3 | Fait | `check-matches.sql` écarte le même compte et le brouillon ; les deux défauts introduits exprès, attrapés (lot 1) |
| 4 | Fait | 57 ms au p50, 103 au p90 et 136 au pire, à chaud, par l'API de production à la clé anonyme, sur les 28 bentos publiés, le 24 octobre (§9) ; le corps de la fonction en 12 ms d'exécution (lot 1) |
| 5 | Fait | Le réglage tenu sous le rôle `anon` par les trois fonctions, `check-matches.sql` (lot 1), et par l'API, `check-privileges.ts`, son écriture refusée à un autre compte et à un visiteur (lot 2) ; de bout en bout au simulateur (lot 3) |
| 6 | Fait | `check-privileges.ts` : retirée de la recherche, une personne garde sa page (lot 2) ; la landing la sert, en `noindex` (lot 4) |
| 7 | Fait, à revoir en production | En e2e, le `noindex` et le sitemap sans le compte, et le repli si la landing part avant la migration (lot 4) ; sur bento-pop.com au chantier 29 |
| 8 | Fait | L'en-tête à y = 196 pt et la boîte à y = 266,7 pt, avec et sans pastille, au point près (lot 3) |
| 9 | Fait, la voix au chantier 29 | Un seul élément par ligne dans les arbres d'iOS et d'Android, son libellé entier (lots 3 et 5) |
| 10 | Fait | `search_bentos` et `shared_items` recréées à signature inchangée (lot 1) ; `check-privileges.ts` conforme (lot 2) |
| 11 | Fait, CI rejouée en local | Les six étapes de `ci.yml`, sans cache, à chaque lot, la dernière au lot 5 : lint et typage 8 sur 8, tests 226, 193 et 779, e2e 41 sur 41, build 3 sur 3 |

---

## 11. Décisions

Toutes proposées le 23 octobre 2026, en l'absence de Clément, et
**confirmées par lui le 24 octobre 2026**, une par une, sans changement.

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
- **Les textes d'Android hors de cet écran**, relevés à la recette du lot 5 :
  les sept qui laissent leur hauteur de ligne à la plateforme, dans le
  composer, « Trouver », « La table » et `FeedLabel`, et la règle de la page
  publique étendue à toute l'app ; l'ellipse d'Extenda rognée, à éprouver
  dans l'étiquette d'un post avec un pseudo de 20 caractères.
