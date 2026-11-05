# Chantier 32 · Composer et publier, refaits

> Spécification écrite le 5 novembre 2026, à partir du dossier de la refonte
> versé dans [`docs/design-v2/`](./design-v2/LISEZMOI.md), l'export du 28
> octobre, et du code de `feat/ux-31-coque` (`014256a`, la PR #112). Le canevas
> en ligne ne s'ouvre pas depuis la session de développement : l'export fait
> foi, tant que Clément ne signale pas d'évolution du canevas. Lectures seules
> en production ; ce chantier n'y écrit rien et n'a besoin d'aucune migration.
>
> **Arbitrages rendus le 5 novembre 2026 par Clément**, en QCM, D1 à D4 (§15),
> chaque fois l'option recommandée : **la page web garde ses dégradés**, une
> passe web étant notée pour après la sortie ; **la question reste sur une case
> d'édition remplie** ; **le nouveau bento se pose sur les écrans du 32**, La
> table et les profils l'ayant au 33 ; **les feuilles du profil au 32**, le
> profil lui-même au 33. D5 à D18 sont prises par la spécification.
>
> **13 écrans entiers, 2 feuilles, 2 écrans au 33** (D4) : `c01` à `c10`, `u01`,
> `u05` et `u07` en entier ; de `u02` et `u03`, leur feuille, posée sur le profil
> d'aujourd'hui ; `u04` et `u06` sont ce profil, et viennent avec lui. Même
> sortie store unique que tous les chantiers, qui attend la refonte entière (D25
> du 29) : rien ne part vers les téléphones à la fusion.

---

## 1. Ce que le design demande

Lu dans `docs/design-v2/` : le guide (`design-system/README.md`), les composants
`Bento`, `BentoTile`, `Tag`, `Progress`, `ItemCard`, `ItemGrid`, `ProposeRow`,
`StatusPill`, `ShareCard`, leur dessin dans `code-source/src/index.jsx` et
`bundle.css`, les 17 écrans et leurs arbres (`ecrans/ecrans.json`).

- **Le composer** (`c01`, `c06`, `c07`, `c08`, `c09`, `u05`) sort du jaune : le
  fond `bg-app`, la `TopBar` large, « Mon bento » ou le titre de l'édition en
  `title-1`, le pseudo au-dessus dès qu'il existe ; `Progress`, six segments et
  « 1 / 6 » ; les puces des bentos et des éditions ; le plateau ; le bouton
  principal, plein. Plus de logo, de Bungee ni d'Extenda. Le bouton dit
  « Commence par ton film », « Compléter (5 restants) », « Publier mon bento »,
  avec « Me le rappeler demain » en lien dessous, ou « Voir mon bento public ».
- **Le plateau** (`Bento`) : six cases, une grande, deux moyennes, trois petites,
  sans rotation ni rivets, le seul objet de l'écran à contour encre et ombre
  franche.
- **Une case remplie** (`BentoTile`) : avec image, le voile `media-scrim` et un
  texte blanc ; sans image, la couleur de sa catégorie (`cat-film`…), son
  initiale géante et des pois en `cat-…-deep` ; la puce `Tag` en haut à gauche,
  « FILM », « SÉRIE », « ARTISTE », « SON », « CRÉA », « LIEU », encre et texte
  de la couleur ; le titre en Fredoka SemiCondensed, le sous-titre, le crédit
  photo ; en attente, le sablier en haut à droite. Elle s'annonce en entier :
  « Lieu : Le Pont Neuf, en attente de validation ».
- **Une case vide** : les pointillés, le « + » et la catégorie, déjà faits au 31 ;
  la case à remplir maintenant (`next`), contour plein et `accent-soft` ; sur une
  édition, un point de couleur, « FILM », et la question.
- **Chercher une case** (`c02`, `c03`, `c04`, `c10`) : une feuille `full` sur le
  composer, sa poignée ; la puce, « Case », le titre en `title-2`, « Vider » et la
  croix ; `SearchField` actif ; « Au menu » ou « 1 résultat » ; la grille de trois
  colonnes, affiches 2/3, titre sur deux lignes et sous-titre ; `ProposeRow` en
  pointillés, « Ajouter « Doctor » », « Proposer au catalogue (validé par
  l'équipe) » ; sans résultat, Popy « surpris » de 64 et « Aucun résultat trouvé ».
- **Les demandes** (`c05`, `u02`, `u03`) : `AskSheet`, Popy et sa question, à la
  place des boîtes d'aujourd'hui. `c05` garde le toast au-dessus de la feuille ;
  `u02` a ses confettis et Popy « bisou ».
- **Le pseudo** (`u01`) : un parcours sur fond clair, `TopBar` retour, « Dernière
  étape », « Choisis ton pseudo. », `TextField` préfixé « @ », l'adresse et « 0 /
  20 », « Suggestions populaires » en puces, Popy « intello » de 104 penchée qui se
  dandine, « Publier mon bento » et « J'ai déjà un compte ».
- **En ligne** (`u05`) : `StatusPill` « En ligne » et « tes modifications sont
  visibles tout de suite », à la place de `Progress`.
- **L'image partagée** (`u07`, `ShareCard`) : 1080 × 1920, le jaune et ses pois, le
  logo et Popy, « Mon bento pop culture », le pseudo en Extenda, le plateau,
  l'icône d'app, l'adresse et « Compose le tien sur Mon Bento Pop », dans les zones
  sûres des stories, 120 en haut et 300 en bas.
- **Les célébrations** : la publication et le bento complet, `Confetti` de 600 ms et
  un retour de succès, une fois par événement.

## 2. Ce que le code dit

Relevé le 5 novembre 2026 sur `014256a`, en lecture seule. Les nombres de la
production, relevés le même jour, en lecture seule, sur « My Bento Pop » : 58
bentos dont 30 publiés, 302 cases remplies dont 49 sans image, 304 items validés
dont 58 sans image, 0 édition, 9 types d'items dont 5 actifs.

- **Le composer** (`app/(tabs)/compose.tsx`, 1 004 lignes) : `YellowBg`, le logo,
  le pseudo en Bungee, le titre en Extenda, `ProgressBar`, `BentoSelector` dans le
  même fichier, `BentoGrid` à une échelle calculée, `StampButton`, le lien du
  rappel. Sa mise en page tient dans `compose-layout.ts` (328 lignes), un budget
  vertical au point près, et sa logique n'a rien à voir avec le dessin : les
  éditions relues, le bento relu à chaque retour, les cibles de notification, la
  marque « publier à la validation », le rappel d'un bento prêt, `composeCta`, testé.
- **La case** (`Tile.tsx`, 533 lignes, avec `tile-text.ts`, 400, et `tile-title.ts`,
  331) : une teinte tirée de l'item (`paletteKeyForItem`), Extenda, un tampon en
  Bungee, un contour, une ombre et une rotation. `BentoGrid` sert le composer, le fil,
  la page d'un compte et l'image partagée.
- **Les éditions** : de 2 à 6 cases, dans les dispositions dessinées par Rob
  (`BOX_LAYOUTS`, `boxPlacements`), que l'app, le web et l'aperçu de lien partagent.
  Une case d'édition porte sa clé, sa question, son tampon, écrit librement au
  back-office, et son type (`type_id`), que l'app ne lit pas. Remplie, elle montre sa
  question dans son étiquette (`filledCaseLabel`, proposition A du 17 septembre).
- **Les types** : film, série, personne, chanson, lieu, actifs ; jeu vidéo, livre,
  plat, activité, inactifs, 0 item, 0 case. « Personne » sert deux cases du bento
  principal, Artiste et Créateur de contenu.
- **La recherche** (`app/search-modal.tsx`, 866 lignes) : une route, modale native sur
  iOS, écran de la pile sur Android, que le composer, les notifications et les liens
  profonds ouvrent. Toute la logique y reste juste : suggestions, recherche différée,
  choix en un toucher, annulation, proposition, vidage, perte d'un pourquoi, qui
  passe par `Alert.alert`. Le rendu : `ItemTile`, `search/layout.ts`, Bungee.
- **Les demandes** : trois `Alert.alert` dans `push-runtime.ts` (`offerPushAfterProposal`,
  `offerEditorialConsent`, `offerReadyReminder`), et une route en feuille native,
  `account/keep-offer`, ouverte par `offerKeepAccount`. L'accord des éditions attend
  que « Garde ton bento » soit fermée.
- **Le pseudo** (`app/onboarding/pseudo.tsx`, 348 lignes) : `YellowBg`, `PageTitle`,
  `StampButton`. La disponibilité se vérifie en différé, et dit « Libre », « Pris »,
  « Réservé »… dans le champ. Une erreur de publication passe par `Alert.alert`.
- **La publication** : `publishFirstBento` sans profil, `publishBento` avec, puis la
  page publique ; « Bento publié ! Partage-le 🍱 » en toast. Aucune célébration.
- **Le partage** : `ShareImage.tsx` (221 lignes) et `share-layout.ts`, rendus hors de
  l'écran par `u/[pseudo].tsx` (1 535 lignes), capturés par `shareBentoImage`.
- **Le socle** : `Sheet`, `AskSheet`, `Dialog`, `Confetti`, `TextField`, `SearchField`,
  `Chip`, `TopBar`, `Button`, `Toast` sont prêts depuis le 30, l'hôte des toasts et la
  barre depuis le 31 ; `Bento` et `BentoTile` n'ont que leur état vide. `Sheet` attend
  sa puce (`eyebrowLeading`). Restent à faire : `Tag`, `Progress`, `ItemCard`,
  `ItemGrid`, `ProposeRow`, `StatusPill`, `ShareCard`.

## 3. Le périmètre (D3, D4)

- **Le nouveau bento se pose sur les écrans du 32** : le composer, le pseudo n'en
  montrant pas, et l'image partagée. La table et la page d'un compte gardent
  `BentoGrid` et `Tile` jusqu'au 33, et restent prouvées inchangées au pixel. Le même
  bento a donc deux dessins en développement ; rien ne part vers les téléphones avant
  la sortie unique.
- **Le profil vient au 33** : `u04` et `u06` sont « Mon profil » (`r01`), son en-tête,
  son bento, son bouton « Préparation… ». Le 32 pose sur le profil d'aujourd'hui les
  feuilles de `u02` et `u03` et les confettis, comme le 31 a posé le bandeau de `m01`
  sur l'ancien composer.
- **`m01` est entière** avec ce chantier : son bandeau du 31, sur le composer du 32.
- **La page web ne bouge pas** (D1) : ni `PublicBentoTile`, ni l'aperçu de lien, ni
  `PALETTES`, que la landing lit toujours. Seules les 49 cases sans image sur 302
  montrent un dégradé, et toute la page web garde son dessin d'aujourd'hui.

## 4. Le bento (D2, D5, D6, D7)

- **`Tag`**, `Progress`, puis `BentoTile` et `Bento` complétés dans `src/design/bento/`,
  aux mesures de `bundle.css`, leurs règles pures et testées dans `bento-rules.ts`, une
  page `bento` au catalogue plus fournie.
- **Deux densités au 32**, `compose` et `share`, celles de ses écrans. `feed` et `mini`
  viennent au 33 avec les leurs, ce qui précise la D3 du 31.
- **Une case prend la catégorie de sa case** (D5), et non plus une teinte de son item :
  par sa clé pour le bento principal, par son type pour une édition (film, série,
  chanson, lieu ; « personne » donne Artiste, ou Créateur de contenu si son tampon est
  « CRÉA »). `loadEditionCases` lit ce type, qui existe en base : aucune migration. La
  puce écrit toujours le tampon de la case, que le back-office écrit.
- **Les types sans couleur** (D5) : jeu vidéo, livre, plat, activité sont inactifs. Si
  l'un entre un jour dans une case, elle prend un repli neutre, `bg-sunken` et le texte
  de l'écran, et sa puce dit ce qu'elle est : rien ne casse, mais la couleur est à
  dessiner par Rob avant d'ouvrir le type. Le septième pot du garde-manger, `yolk`, est
  celui des boutons.
- **Une case d'édition remplie garde sa question** (D2) : la puce grandit et la porte,
  en capitales, deux lignes au plus, sa taille mesurée comme aujourd'hui (`fitLabel`,
  avec la police de la puce). C'est le seul écart voulu au dessin du `Tag`, la maquette
  n'ayant dessiné aucune case d'édition remplie. L'icône de catégorie reste une option
  de `Tag` : aucune case du 32 ne la pose.
- **De 2 à 6 cases** (D6) : les dispositions de Rob, sur le plateau du design. Rangée
  d'une case `xl`, de deux `l`, de trois `s` ; le plateau garde sa hauteur, partagée
  selon `BOX_LAYOUTS`. À six, ce sont les proportions du dossier.
- **Rien ne se chevauche** (D7) : sur `c07` et `u07`, le « HOW TO » d'un titre de trois
  lignes passe sous la puce « SON ». Sur une petite case, le titre perd d'abord une
  ligne, puis le sous-titre s'efface ; le crédit reste, la licence le demande.
- **Une case qui arrive** tombe dans le plateau, un rebond de 320 ms, un fondu quand le
  système réduit les animations.
- **Les lecteurs d'écran** : « Film : Inception, 2010 », « Lieu : Le Pont Neuf, en attente
  de validation », « Ajouter : Film » ; sur une édition, la question avant le titre.

## 5. Le composer (D8, D13)

- **La logique ne bouge pas** : `composeCta` et ses états, les éditions, la marque de
  publication, le rappel, les cibles de notification, l'accord éditorial. Le fichier
  se partage : l'écran garde sa logique, le dessin passe aux composants, le sélecteur à
  part.
- **L'en-tête** : `Screen`, `TopBar` large, le pseudo en sur-titre s'il existe, le nom du
  bento en `title-1`, qui va à la ligne plutôt que de rétrécir. `Progress` tant que le
  bento n'est pas en ligne ; `StatusPill` « En ligne » et sa phrase ensuite ; `StatusPill`
  en attente, « Bientôt en ligne » et `validationHint`, quand la base publiera à la
  validation, en suivant `u05`, la maquette n'ayant pas dessiné cet état.
- **Les puces** : `Chip`, comme les maquettes, le bento courant choisi, les éditions à
  composer en `add` ; la bande défile, et garde la puce active à l'écran. L'édition
  annoncée par une notification pulse et vient à l'écran, comme aujourd'hui.
- **Le plateau tient sans défiler tant qu'il peut** (D8) : à l'iPhone 17 Pro, les
  mesures de la maquette, 370 de large ; il garde sa largeur et rend de la hauteur à ce
  qui l'entoure, jusqu'à 85 %, sur un écran court, avec les puces, le lien du rappel ou le
  bandeau ; au-delà, et au-delà de 130 % de texte, l'écran défile. Le budget au point de
  `compose-layout.ts` sort avec l'ancien écran, sauf ce que `StampButton` et les tests de
  l'ancienne case lisent, jusqu'au 33.
- **Le bouton** : `Button` plein, `Button tertiary` pour le rappel, comme `c07`. Le rappel
  tapé dans une notification le fait toujours pulser.
- **Le premier chargement** : le plateau, ses cases en `Skeleton`, et rien qui affirme un
  bento vide.
- **Le bento complet** (D13) : quand un choix ou une proposition remplit la dernière case,
  `Confetti` et un retour de succès, une fois. Ni à la lecture du bento, ni à une
  annulation, ni au remplacement d'une case d'un bento déjà complet.

## 6. La recherche (D9, D11)

- **La route reste** (D9) : la logique, les liens profonds et le retour au composer, qui
  relit le bento, ne changent pas. Elle passe en `transparentModal` et rend le `Sheet` du
  design en hauteur `full`, sans `Modal` de plus : le même dessin aux deux plateformes, 72
  du haut à l'iPhone 17 Pro, comme la maquette. La poignée la ferme, comme la croix et le
  retour d'Android. Le lot 3 éprouve d'abord le clavier et le retour au Pixel ; si le
  clavier ne tient pas, on y revient.
- **L'en-tête** : la puce de la case, « Case », ou « Case · Film » sur une édition, le
  titre, sa question entière sur une édition ; « Vider » si la case est remplie ; la croix.
- **La grille** : `ItemGrid`, trois colonnes, 16 sur 10 d'écart ; `ItemCard`, l'affiche 2/3
  ou sa couleur et son initiale, le titre sur deux lignes, le sous-titre. La retaille des
  images, `itemImageUrl`, est gardée. Les pendants d'aujourd'hui restent : le squelette
  d'une rangée, « Tape pour chercher », l'erreur réseau, en ligne.
- **Proposer** : `ProposeRow`, aux mêmes conditions qu'aujourd'hui ; sans résultat, Popy
  « surpris » de 64 et « Aucun résultat trouvé », au-dessus.
- **Remplacer ou vider une case expliquée** (D11) : `Dialog`, Popy « gene », « Son pourquoi
  sera effacé. », le gabarit de confirmation du guide, à la place de `Alert.alert`.

## 7. Les demandes et les célébrations (D10, D12, D13)

- **Une seule file, `useAsk`** (D10), comme les toasts : `ask({ mood, title, message,
  primary, secondary, confetti })` rend ce qu'on a répondu, et un hôte monté à la racine
  rend l'`AskSheet`. Une demande à la fois, dans l'ordre. Rien ne bloque l'app.
- **Elle remplace** les trois `Alert.alert` (la proposition, le rappel, l'accord des
  éditions) et la route `account/keep-offer`, retirée. Les textes ne changent pas. La
  question du rappel n'a pas de maquette, le dossier ne dessinant que son toast (`c08`) :
  elle suit le gabarit « Demande » du guide. La boîte du système vient toujours après
  « Oui », inchangée.
- **L'ordre ne change pas** : « Garde ton bento » d'abord, l'accord des éditions quand on la
  quitte. « Garder mon compte » ouvre toujours `account/keep`.
- **Le toast de `c05`** se voit au-dessus de la feuille (D12) : l'hôte des demandes monte
  son hôte de toasts, comme la recherche, et le pose à 8 de la feuille. La maquette le pose
  plus haut, à la main.
- **La publication** (D13) : « Bento publié. Partage-le ! », sans émoji ; `Confetti` et un
  retour de succès, une fois ; sur `u02`, ils tombent sur la feuille, Popy « bisou » ; sans
  feuille, sur la page publique. Ni au retour sur la page, ni à un bento déjà en ligne.

## 8. Le pseudo (D12)

- **`u01`** : `Screen`, `TopBar` retour, le sur-titre, le titre en `title-1`, la phrase en
  `body-l`, `TextField` préfixé, l'adresse à gauche, le compteur à droite, les suggestions
  en `Chip`, Popy « intello » de 104, `Button` et « J'ai déjà un compte ». La place de Popy
  reste réservée : quand le texte grossit, la page défile au lieu de la poser sur les puces.
- **La vérification** (D12) : sous le champ, à la place de l'adresse. En cours, « On
  vérifie… » ; libre, « Libre », en `text-success` et avec une icône, ce que `TextField`
  apprend (`success`) ; pris, en erreur, avec une suggestion : « Ce pseudo est déjà pris.
  Essaie @bento_culture. », la phrase du guide. « Réservé », « Non autorisé », « Trop
  court », « Trop long », « Invalide » suivent, le bouton restant éteint.
- **L'échec de la publication** passe en toast d'erreur, le pseudo restant saisi.

## 9. L'image partagée (D14)

- **`ShareCard`** remplace `ShareImage`, à la lettre de `bundle.css` : 1080 × 1920, le jaune à
  pois, les zones sûres, le plateau `share`. Elle reste rendue hors de l'écran et capturée
  par `shareBentoImage`, ses images chargées d'abord.
- **Le ruban d'une édition** : l'autocollant dit le titre de l'édition à la place de « Mon
  bento pop culture », comme aujourd'hui, sa taille mesurée. **Une édition de 2 à 5 cases** a
  sa disposition. **L'adresse** est celle du bento partagé (`publicBentoLabel`).
- **Le pseudo** tient sur une ligne, en rétrécissant : la maquette autorise la coupure, mais
  un pseudo de 20 caractères ne doit ni repousser le plateau ni se couper. Extenda reste une
  question de licence, tâche 12 ter.
- **Figée à la police par défaut** (D14) : l'image sort la même pour tout le monde, comme
  aujourd'hui. `Text` apprend à ignorer la taille du système (`fixed`), qui ne sert qu'ici.

## 10. Ce que le 32 ne fait pas

- **La table, Trouver et les profils** (33), `u04` et `u06` compris, et `feed` et `mini`.
- **`Tile`, `BentoGrid`, `EmptyTile`, `BentoBoxSkeleton`** : ils restent pour le 33, qui les
  retire. `PALETTES` reste pour la landing.
- **La page web et l'aperçu de lien** (D1) : une passe web après la sortie (§16).
- **Le compte et ses parcours** (34), `account/keep` compris.
- **Le bandeau hors connexion** : au 33, avec `t07`.
- **Le thème sombre** (D3 de la refonte).

## 11. Tests

- Les règles de toute l'app restent vertes : `accessibilite.test.ts`, `font-scaling.test.ts`,
  `contrast.test.ts`.
- **Nouveaux** : la catégorie d'une case, par clé et par type, tampon « CRÉA » et types sans
  couleur compris (D5) ; les hauteurs d'un plateau de 2 à 6 cases, la même hauteur totale
  (D6) ; ce qu'une case garde selon sa place, sans chevauchement (D7) ; les annonces d'une
  case ; la hauteur du plateau du composer (D8) ; quand une célébration part (D13) ; la file
  des demandes, une à la fois et dans l'ordre (D10) ; les textes de la vérification du
  pseudo (D12).
- **Gardés** : `compose-cta`, `publish-on-validation`, `ready-reminder`, `exact-title`, les
  tests de `Tile`, qui reste. **Retirés** avec leur code : ce qui ne sert plus de
  `compose-layout.test.ts` et de `search/layout.test.ts`, et `share-layout.test.ts`.

## 12. Recette

Au simulateur iPhone 17 Pro, au simulateur iPhone SE et à l'émulateur Pixel 8, sur la pile
locale, avec une édition de six cases et une de trois posées localement.

- **Les 13 écrans contre leur PNG**, à 100 % à l'iPhone 17 Pro, dont la maquette a le cadre, en
  tolérant la police du système (D14 du 30) et les écarts écrits ici ; à 130 et au-delà de
  200 %, jusqu'à l'iPhone SE, rien de coupé. **`u02`, `u03`** : la feuille contre sa maquette.
  **`m01`** : entière, sur le nouveau composer.
- **Le parcours de bout en bout**, un compte neuf : six cases, une proposition (`c05`, `c06`),
  le rappel (`c08`), le pseudo, la publication, `u02`, `u03`, le composer en ligne (`u05`) ;
  un compte qui publie un second bento ; une édition composée puis publiée.
- **Le partage** : l'image capturée pour de bon, contre `u07` ; un pseudo de 20 caractères ; une
  édition de trois cases ; ses zones sûres mesurées.
- **Les états** : case en attente, validée, refusée ; bento marqué, « Bientôt en ligne » ; hors
  connexion ; erreur réseau dans la recherche ; une écriture qui échoue et son toast.
- **Les célébrations** comptées : une seule par événement, aucune à une relance, à une annulation
  ni à un remplacement ; le mouvement réduit, sans confettis, mesuré.
- **Les lecteurs d'écran** : les arbres relus aux deux plateformes, dans l'ordre de lecture.
- **Les autres écrans**, La table, Trouver, Notifs, le profil, les réglages, les crédits, la page
  d'un compte, contre une copie du 31 : identiques au pixel, hors le bruit déjà connu.
- **La CI rejouée en local**.
- **La part du 29** : l'image partagée dans une vraie story, Instagram et TikTok, ses zones sûres ;
  le retour de succès ressenti ; une notification de validation ouvrant la bonne case ; la voix.

## 13. Les lots

1. **Le bento plein** : `Tag`, `Progress`, `BentoTile`, `Bento` en `compose` et `share`, la catégorie
   d'une case, la page au catalogue. Aucun écran ne change.
2. **Le composer** : `c01`, `c06`, `c07`, `c08`, `c09`, `u05` et `m01`, les puces, `StatusPill`, la
   hauteur du plateau, le bento complet.
3. **La recherche** : `c02`, `c03`, `c04`, `c10`, la route en feuille, `ItemGrid`, `ProposeRow`, le
   `Dialog` d'un pourquoi.
4. **Les demandes et le pseudo** : `useAsk`, `c05`, le rappel, `u02`, `u03`, `u01`, la célébration de la
   publication ; `account/keep-offer` retiré.
5. **L'image partagée** : `ShareCard`, `u07` ; `ShareImage` retiré.
6. **La recette** du §12, la roadmap et la part du 29.

Comme au 31, un compte rendu à la fin de chaque lot, et le feu vert de Clément avant le suivant.

## 14. Definition of Done

| # | Point | État |
| --- | --- | --- |
| 1 | `c01` à `c10`, `u01`, `u05`, `u07` identiques à leur PNG au simulateur et à l'émulateur, tenus à 130 et 200 % jusqu'à l'iPhone SE | ⬜ |
| 2 | Les feuilles de `u02` et `u03` identiques aux leurs, sur le profil d'aujourd'hui ; `m01` entière | ⬜ |
| 3 | Chaque case prend la couleur et la puce de sa catégorie, par clé ou par type ; de 2 à 6 cases ; la question sur une case d'édition remplie | ⬜ |
| 4 | Rien ne se chevauche dans une case ; le crédit photo toujours là | ⬜ |
| 5 | Le parcours de bout en bout, compte neuf, second bento et édition, inchangé dans sa logique | ⬜ |
| 6 | Les quatre demandes en `AskSheet`, une à la fois, dans l'ordre ; plus aucun `Alert.alert` dans les écrans du 32 | ⬜ |
| 7 | Une célébration par événement, aucune de trop ; le mouvement réduit respecté | ⬜ |
| 8 | L'image partagée capturée pour de bon, ses zones sûres mesurées, une édition et un long pseudo compris | ⬜ |
| 9 | Les lecteurs d'écran en français, les cases annoncées en entier | ⬜ |
| 10 | Les autres écrans inchangés au pixel | ⬜ |
| 11 | Bungee, Extenda hors de l'image, `YellowBg` et `StampButton` sortis des fichiers du 32 ; `ProgressBar`, `ItemTile`, `ShareImage`, `account/keep-offer` retirés | ⬜ |
| 12 | Les tests de règles verts, la CI rejouée en local, verte | ⬜ |

## 15. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | **La page web garde ses dégradés** ; une passe web après la sortie | Rendue par Clément en QCM, l'option recommandée. 49 cases remplies sur 302 (16 %) montrent un dégradé, et toute la page web garde son dessin. Changée au 32, elle serait en ligne dès la fusion, avant l'app |
| **D2** | **La question reste sur une case d'édition remplie**, portée par la puce | Rendue par Clément en QCM, l'option recommandée. C'est la proposition A du 17 septembre : sans elle, les deux cases de « Le duel du samedi » disent FILM et FILM. La maquette n'a dessiné aucune case d'édition remplie. 0 édition en production |
| **D3** | **Le nouveau bento se pose sur les écrans du 32** ; La table et les profils l'ont au 33 | Rendue par Clément en QCM, l'option recommandée. Partout dès le 32, deux écrans et 404 lignes de mise en page seraient à reprendre deux fois, et ces écrans ne se prouveraient plus inchangés |
| **D4** | **Les feuilles de `u02` et `u03` au 32 ; `u04` et `u06` au 33**, avec le profil | Rendue par Clément en QCM, l'option recommandée. `u/[pseudo].tsx`, 1 535 lignes, sert aussi les profils des autres. Le 31 a fait de même avec `m01` |
| **D5** | Une case prend la catégorie de sa case, par clé ou par type ; la puce écrit son tampon ; repli neutre pour un type sans couleur | Aucune migration : le type existe en base. « Personne » sert deux cases, d'où le tampon « CRÉA ». Les quatre types inactifs n'ont aucun item : la couleur est à dessiner par Rob avant de les ouvrir, ce que la roadmap laissait à trancher |
| **D6** | Les éditions de 2 à 5 cases gardent les dispositions de Rob, sur le plateau du design, à la même hauteur | Le dossier ne dessine que six cases. Validées le 16 septembre, elles se lisent aussi sur le web et dans l'aperçu de lien |
| **D7** | Dans une case, rien ne se chevauche : le titre perd une ligne, le sous-titre s'efface, le crédit reste | Sur `c07` et `u07`, le titre passe sous la puce. Le crédit est une obligation de licence |
| **D8** | Le plateau du composer rend de la hauteur jusqu'à 85 %, puis l'écran défile | Aujourd'hui, tout tient sans défiler tant qu'on peut. Au calcul, à l'iPhone SE, le bento seul tient ; les puces, le rappel ou le bandeau demandent jusqu'à 64 points, à mesurer au lot 2 |
| **D9** | La recherche reste une route, en `transparentModal`, et rend le `Sheet` du design | Le même dessin aux deux plateformes, sans toucher aux liens profonds ni au retour au composer, qui relit le bento. À éprouver d'abord au clavier du Pixel |
| **D10** | Une seule file de demandes, `useAsk`, à la place des `Alert.alert` et de `account/keep-offer` | Le guide met une `AskSheet` avant chaque autorisation. Les demandes partent de `lib`, sans écran sous la main, et peuvent arriver ensemble, comme aujourd'hui |
| **D11** | Remplacer ou vider une case expliquée passe par `Dialog` | Le gabarit « Confirmation » du guide ; aucune maquette ne le montre, le texte ne change pas |
| **D12** | Le toast de `c05` se pose à 8 de la feuille ; le pseudo dit son état sous le champ, avec une icône et la phrase du guide | La maquette pose ce toast à la main, à 139 de la feuille. L'état du pseudo n'a pas de maquette ; le guide écrit sa phrase, et interdit qu'une information tienne à la couleur seule |
| **D13** | Une célébration au choix qui remplit la dernière case et à la publication, jamais à une lecture, une annulation ou un remplacement ; le toast perd son émoji | Le guide : une seule fois par événement, jamais d'émoji dans l'interface |
| **D14** | `ShareCard` à la lettre du dossier, figée à la police par défaut ; le pseudo sur une ligne, le ruban au titre de l'édition | L'image sort la même pour tout le monde, comme aujourd'hui. La maquette ne dessine que le bento principal et un pseudo court |
| **D15** | `feed` et `mini` viennent au 33 | Ce qui précise la D3 du 31 : aucun écran du 32 ne les emploie |
| **D16** | La logique du composer et de la recherche ne bouge pas ; seul leur dessin change | « Aucune fonctionnalité ne change » (le dossier). `composeCta` et ses voisins sont testés, et le fruit de recettes |
| **D17** | Bungee, Extenda hors de l'image, `YellowBg` et `StampButton` sortent des fichiers du 32 ; `ProgressBar`, `ItemTile`, `SuggestionSkeleton`, `ShareImage`, `share-layout.ts` et `account/keep-offer` sont retirés ; `search/layout.ts` et `compose-layout.ts` perdent ce qui ne sert plus ; `Tile`, `BentoGrid`, `EmptyTile`, `TilePulse` et `BentoBoxSkeleton` restent pour le 33 | La D13 du 30 : une primitive part avec son dernier emploi |
| **D18** | Les retours haptiques du composer et de la recherche passent à `haptics.ts` du design | La D11 du 30 : les écrans les adoptent avec leur chantier |

## 16. Suivis

- **Une passe web après la sortie** (D1) : la page d'un bento, son aperçu de lien et leurs
  couleurs, à décider une fois l'app en service.
- **Les couleurs des types du 15** (D5) : à dessiner par Rob avant d'ouvrir jeu vidéo, livre, plat
  ou activité dans une édition.
- **La licence d'Extenda** pour une app mobile : Clément (tâche 12 ter). L'image partagée l'emploie.
- **Le jaune d'avant** (`#fbbf24`) reste sur les écrans pas encore refaits, jusqu'au 34.
