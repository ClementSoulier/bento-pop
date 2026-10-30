# Chantier 31 · La coque et les moments de marque

> Spécification écrite le 30 octobre 2026, à partir du dossier de la refonte
> versé dans [`docs/design-v2/`](./design-v2/LISEZMOI.md), l'export du 28
> octobre, et du code de `feat/ux-30-socle` (`19be67e`, la PR #110, elle-même
> sur la #109 et la #108). Le canevas en ligne ne s'ouvre pas depuis la
> session de développement : l'export fait foi, tant que Clément ne signale
> pas d'évolution du canevas. Lectures seules ; ce chantier n'écrit rien en
> production et n'en a pas besoin.
>
> **Arbitrages rendus le 30 octobre 2026 par Clément**, en QCM, D1 à D4
> (§13), chaque fois l'option recommandée : l'app **ouvre toujours Compose** ;
> Notifs coupé, **quatre onglets**, Compose en troisième ; le 31 construit
> **le bento vide**, que le 32 complète ; **la barre sur les écrans poussés
> vient avec leurs écrans**, les profils d'un compte au 33. D5 à D15 sont
> prises par la spécification.
>
> **La coque change dans toute l'app, les écrans seulement les cinq du 31**
> (D5) : la barre d'onglets, les toasts et le bandeau de mise à jour du design
> partout où ils paraissent ; l'accueil en trois écrans, la mise à jour
> requise et la maintenance refaits ; le lancement, l'icône d'app et la petite
> icône des notifications. Les autres écrans restent ceux d'aujourd'hui
> jusqu'à leur chantier, du 32 au 34. Même sortie store unique que tous les
> chantiers, qui attend la refonte entière (D25 du 29).

---

## 1. Ce que le design demande

Lu dans `docs/design-v2/` : le guide (`design-system/README.md`), les
composants `TabBar`, `Toast`, `Banner`, `Steps`, `Bento` et `Avatar`, la
marque (`design-system/assets/Marque/`), les six écrans du 31 et leurs
arbres (`ecrans/ecrans.json`), et la place de la coque dans les 75 écrans.

- **La barre d'onglets** (`TabBar`) : toujours les cinq onglets, dans cet
  ordre, libellés visibles : La table (`bowl-steam`), Trouver
  (`magnifying-glass`), Compose au centre, un `plus` dans sa pastille jaune
  sur son ombre, Notifs (`bell`) avec la pastille du nombre de nouveautés,
  Profil en avatar de la personne, 26 points, cerclé quand l'onglet est
  courant. L'onglet courant passe en icône pleine et en libellé gras. 56
  points, plus la zone sûre du bas. Une sélection légère, à l'haptique, sur
  un onglet. Le gabarit « Écran poussé » la garde visible ; elle se masque
  sous une feuille, une boîte de dialogue ou un parcours de compte.
- **Où la barre paraît** : 29 des 75 écrans la posent. Les profils d'un autre
  compte (`r04` à `r08`, `r14`, `r15`) la gardent, La table courante ; les
  Réglages, les Crédits, les listes d'abonnés, les commentaires et les
  pourquoi ne la montrent pas, contre le gabarit.
- **Les toasts** (`Toast`) : jamais en haut, où ils couvriraient le titre et
  le retour ; 8 points au-dessus de la barre, 12 au-dessus de la zone sûre
  sans elle ; encre, texte crème, icône et action jaunes. 4 s, 6 s avec une
  action (« Annuler ») ; ils s'effacent au toucher, se disent poliment au
  lecteur d'écran. Cinq écrans en montrent un : `c05`, `c07` (avec
  « Annuler »), `c08`, `r14`, et `a04`, sans barre ; avec l'icône
  `check-circle`, sauf la case remplacée (`arrows-clockwise`) et le rappel
  (`bell-ringing`).
- **Le bandeau de mise à jour** (`Banner tone="update"`) : posé dans le flux
  de l'écran, il pousse le contenu au lieu de le recouvrir ; une carte jaune
  pâle à 16 points des bords, Popy « surpris », « Nouvelle version dispo »,
  l'action « Mettre à jour » en petit bouton principal et la croix. `m01` le
  pose en tête de Compose, au-dessus de son grand titre.
- **Les moments de marque** suivent leur gabarit : `Screen tone="brand"`, le
  jaune et ses pois, Popy de 150 à 190 points qui se dandine, une affiche
  (`Display`), une phrase en `body-l`, un bouton `on-brand`.
  - `p01-accueil` : les étapes, 1 sur 3 ; le logo, 40 de haut ; Popy
    « content », 176 ; l'autocollant « L'app companion » ; l'affiche « Compose
    ton bento » et son contour « pop culture. » ; « Ton film, ta série, ton
    artiste, ton lieu de cœur : six cases, une carte de visite culturelle. » ;
    « Commencer », et « J'ai déjà un compte » en lien.
  - `p02-regles`, sur fond clair : les étapes, 2 sur 3 ; « Avant de
    commencer », « Les règles du jeu. », son introduction ; « Tolérance
    zéro », quatre règles ; « Ce qu'on fait », trois ; un pied collé en bas,
    la case « J'ai lu et j'accepte les règles ci-dessus, les CGU et la
    politique de confidentialité. » et « Continuer », éteint tant qu'elle
    n'est pas cochée. Aucun lien vers les CGU ni la politique.
  - `p03-six-cases` : les étapes, 3 sur 3 ; l'autocollant « 6 cases · 6
    choix » ; l'affiche « Une boîte. Six envies. » ; **un bento vide en
    composition** (`Bento mode="edit" density="compose"`), six cases à « + »
    et leur catégorie, avec deux autocollants, « Film préféré » et « Une
    chanson » ; « Touche une case, cherche, valide. Tu peux changer d'avis à
    tout moment. Quand le bento est plein, publie-le. » ; « Je m'y mets ».
  - `m02-maj-obligatoire` : Popy « surpris », 184 ; « Mise à jour requise » ;
    « Une nouvelle version de Mon Bento Pop est disponible. Mets l'app à jour
    pour continuer. » ; « Mettre à jour ».
  - `m03-maintenance` : Popy « malade », 184 ; « On revient vite » ; « Mon
    Bento Pop est en maintenance, on revient dans quelques minutes. » ; aucun
    bouton.
- **L'icône d'app** (`app-icon-1024.png`) : Popy « content », plus grande
  qu'aujourd'hui, sur `yolk-500` semé de pois `yolk-300`, carrée, les coins
  laissés au système. **La petite icône Android** des notifications
  (`notification-icon-96.png`) : la silhouette blanche de Popy sur fond
  transparent, seule forme qu'Android garde. Le dossier ne dessine ni le
  lancement de l'app ni l'icône adaptative d'Android.
- **L'avatar** pose la Popy d'un compte sur une teinte du garde-manger, et
  la maquette donne la même à chaque compte d'un écran à l'autre : « gene »
  sur `shiso` pour la personne qui tient le téléphone, « content » sur
  `yolk` pour un compte neuf (`r03`, `n02`).
- Les maquettes rendent le texte du système en Inter (D14 du 30).

## 2. Ce que le code dit

Relevé le 30 octobre 2026 sur `19be67e`, en lecture seule.

- **La barre** (`app/(tabs)/_layout.tsx`) : les `Tabs` d'expo-router, dans
  l'ordre Compose, La table, Trouver, Notifs, Profil ; six icônes dessinées à
  la main (`TabIcons.tsx`, 22 points) ; des libellés en Bungee 9, en
  capitales, réduits par `tabLabelScale` sur les métriques de Bungee ; 84
  points (`tab-bar.ts`), 108 sur Android en navigation à trois boutons. La
  pastille rouge de Notifs dit le nombre de nouveautés (`useNotificationBadge`,
  « 9+ » au-delà de 9).
- **Notifs disparaît** (`href: null`) quand l'interrupteur
  `app_config.notifications_enabled` est coupé depuis le back-office ; allumé
  si la configuration ne répond pas. Il reste alors quatre onglets, Profil
  « onglet 4 sur 4 ».
- **Profil** ouvre la page publique de la personne, ou, sans pseudo, une Popy,
  « Pas encore publié » et « Reprendre mon bento ».
- **L'arrivée** : aucun `initialRouteName`. `app/index.tsx` envoie au composer
  tout compte qui a un profil ou des règles acceptées sur l'appareil, à
  l'accueil sinon. 22 navigations nomment un onglet, dont 13 Compose. Le
  composer et le profil relisent la hauteur de la barre.
- **Les toasts** : un seul magasin global (`useToast`, Zustand) et un seul
  hôte, `ToastHost`, monté à la racine. `show(message, { variant, action,
  durationMs })` ; en haut, sous la zone sûre ; 3 s par défaut, de 3,5 à 5 s
  selon l'appel ; Bungee 12 en capitales, sur jaune, crème ou rouge selon la
  variante ; dit par `announceForAccessibility`, « Action disponible :
  Annuler. » compris. Le suivant remplace le précédent. **30 appels** : 11
  succès, 13 erreurs, 6 neutres, dont 2 avec « Annuler ». Aucun ne se ferme au
  toucher.
- **Le bandeau** (`UpdateBanner.tsx`) se pose par-dessus l'en-tête des racines
  d'onglets, en position absolue, encre et Bungee 10, quand la version
  installée est derrière `ios_latest_version` ou `android_latest_version`,
  sauf hors connexion. « Plus tard » est retenu pour cette version
  (`bp_update_dismissed`) ; « Mettre à jour » ouvre la fiche du store.
  `OfflineBanner` occupe la même place.
- **L'accueil** (`app/onboarding/`) : `splash.tsx` (l'accueil),
  `terms.tsx` (les règles, avec deux liens, les mentions légales et la
  confidentialité ; montrées seules, « Avant de continuer » et sans étapes, à
  un compte qui ne les a pas acceptées), `mechanics.tsx` (les six cases, sur
  le `BentoGrid` de l'app, vide, à 78 %). `YellowBg`, `Pagination`,
  `Sticker`, `StampButton`, `PageTitle`. « J'ai déjà un compte » ouvre
  `account/sign-in`.
- **Les blocages** (`AppBlocker.tsx`) se rendent à la place de toute l'app,
  hors de `SafeAreaProvider` et de `ThemeProvider` : la maintenance, avec le
  titre et le message du back-office, Popy « malade », aucun bouton ; la mise
  à jour requise, Popy « content », « Mettre à jour ». `YellowBg`, titres en
  Bungee 28. **Le lancement** côté JavaScript (`Splash.tsx`) : `YellowBg`, le
  logo, Popy, et « Mise à jour… » pendant un téléchargement à distance.
- **La notification reçue app ouverte** est la bannière du système
  (`setNotificationHandler`) ; `InAppNotice` ne sert qu'au catalogue.
- **Le natif** (`app.json`) : l'icône `assets/icon.png`, une petite Popy sur
  `#fbbf24` ; l'icône adaptative, Popy sur fond transparent devant `#fbbf24`,
  sans icône monochrome ; le lancement d'`expo-splash-screen` sur `#fbbf24`.
  `expo-notifications` n'a aucune option : **ni petite icône ni couleur pour
  Android**. `ios/` et `android/` se régénèrent à chaque prebuild : ces
  réglages demandent une build native et partent avec la 2.0.0 ; la barre,
  les toasts, le bandeau et les écrans pourraient partir à distance.
- **Les tests** : `tab-bar.test.ts` fige 84 et les métriques de Bungee ;
  quatre tests prennent 84 en entrée (`compose-layout`, `question-label`,
  `tile-pending`, `feed/layout`). Aucun ne nomme `Toast`, `UpdateBanner`,
  `AppBlocker` ni `app.json`.
- **Aucun écran de production n'importe encore le design system** ; seule la
  racine prend son `ThemeProvider`.

## 3. La coque change partout, les écrans pas (D5)

- La barre paraît sur les cinq racines, les toasts partout, le bandeau sur
  les racines. Les écrans qu'elle entoure restent ceux d'aujourd'hui jusqu'à
  leur chantier : seule leur hauteur utile change, la barre passant de 84
  points à 56 plus la zone sûre, soit 90 à l'iPhone 17 Pro, 56 à l'iPhone SE,
  80 sur Android en navigation par gestes et 104 en navigation à trois
  boutons.
- Cinq écrans sont refaits en entier : `p01` à `p03`, `m02` et `m03`. De
  `m01`, le 31 fait le bandeau ; l'écran dessous est le composer, refait au
  32.
- Ce que le 31 retire (D15) : Bungee, `YellowBg`, `StampButton` et `Sticker`
  des fichiers qu'il refait ; `TabIcons.tsx`, `tab-bar.ts` et son test,
  `UpdateBanner.tsx` et le `Toast` des primitives, qui n'auront plus
  d'emploi. `Pagination` et `PageTitle` restent pour le pseudo, refait au 32.

## 4. La barre d'onglets (D1, D2, D4, D6, D13)

- **La `TabBar` du 30 devient la barre des `Tabs`** (`tabBar`), dans l'ordre
  du design : La table, Trouver, Compose, Notifs, Profil. Les libellés sont
  ceux d'aujourd'hui, en `tab-label`, de la catégorie fixe : 130 % au plus
  (D8 du 30).
- **La pastille de Notifs** garde sa source, `useNotificationBadge`, ses
  relectures et sa remise à zéro.
- **Profil** montre l'avatar de la personne, 26 points : sa Popy, choisie ou
  tirée de son pseudo (`popyKeyFor`), sur la teinte de sa Popy (D6). Sans
  pseudo, « content » sur `yolk`, comme la maquette d'un compte neuf.
- **L'app ouvre toujours Compose** (D1) : `app/index.tsx` n'a pas à changer,
  et le retour d'Android y ramène (`initialRouteName` et `backBehavior`), comme
  il ramène aujourd'hui au premier onglet, qui était Compose.
- **Notifs coupé, quatre onglets** (D2) : La table, Trouver, Compose, Profil,
  dans l'ordre du design, Compose troisième dans sa pastille ; « onglet n sur
  4 ». La `TabBar` reçoit la liste de ses onglets.
- **Les écrans poussés gardent leur structure** (D4) : la barre reste aux cinq
  racines au 31. Le 33 met les profils d'un compte sous les onglets, barre
  visible, comme leurs maquettes ; les réglages, les crédits et les listes
  restent sans elle, comme les leurs.
- **Un retour de sélection** à chaque changement d'onglet (D13).
- Chaque onglet s'annonce comme aujourd'hui, « La table, onglet 1 sur 5 »,
  bouton sélectionné quand il est courant ; Notifs avec son nombre.

## 5. Les toasts (D7)

- **L'hôte change, pas les appels** : `ToastHost` rend le `Toast` du 30, et
  `useToast().show` garde sa forme. Les 30 appels ne bougent pas.
- **En bas** : 8 points au-dessus de la barre sur une racine d'onglet, 12
  au-dessus de la zone sûre ailleurs, au-dessus du clavier quand il est
  ouvert.
- **La durée** : au moins 4 s, 6 s avec une action ; un appel qui demande
  plus, 5 s pour les erreurs, le garde.
- **L'icône** dit ce que la couleur disait : `check-circle` pour un succès ou
  un message neutre, `warning-circle` pour une erreur, le toast restant encre
  dans les trois cas. `show` accepte une icône, que prennent les deux toasts
  que la maquette dessine autrement : la case remplacée (`arrows-clockwise`)
  et le rappel programmé (`bell-ringing`).
- Le toucher le ferme. Le lecteur d'écran l'entend poliment, son action
  comprise, comme aujourd'hui. Un seul à la fois, le suivant remplace le
  précédent, comme aujourd'hui.
- **Au-dessus d'une modale** : la recherche d'une case s'ouvre en modale
  native, et lève des toasts. À éprouver au lot 2 qu'ils s'y voient sur
  iOS ; sinon, l'hôte passe dans une `FullWindowOverlay` de
  react-native-screens.

## 6. Le bandeau de mise à jour (D8)

- **`Banner tone="update"` en tête des racines d'onglets, dans le flux** : il
  pousse l'écran, en-tête compris, au lieu de le recouvrir. Monté dans
  `app/(tabs)/_layout.tsx`, au-dessus des onglets : la zone sûre du haut
  passe au bandeau, et les écrans dessous la reçoivent nulle, par un
  `SafeAreaProvider` imbriqué, à éprouver au lot 2.
- Ses conditions, son « Plus tard » retenu par version et son lien au store
  ne changent pas. Il se lit le premier, avant l'en-tête.
- `UpdateBanner.tsx` sort. Le bandeau hors connexion garde sa place et son
  dessin jusqu'au 33 (`t07`).

## 7. Les moments de marque

### 7.1 L'accueil (D3, D9)

- **`p01`, l'accueil** : `Screen tone="brand"`, `Steps` 1 sur 3, `Logo` de
  40, `Popy` « content » de 176 qui se dandine, `Sticker` « L'app
  companion » penché de -3, `Display` xl « Compose ton bento » et son contour
  « pop culture. », la phrase en `body-l`, `Button on-brand` « Commencer »
  plein, `Button tertiary` « J'ai déjà un compte », qui ouvre toujours
  `account/sign-in`.
- **`p02`, les règles** : fond clair, `Steps` 2 sur 3, le sur-titre, le titre
  en `title-1`, l'introduction, « Tolérance zéro » et « Ce qu'on fait » en
  sept `Rule` à leurs icônes, le pied collé en bas : `Checkbox` et
  `Button` « Continuer », éteint tant que la case n'est pas cochée. **Les
  deux liens restent** (D9), sous « Ce qu'on fait ». Pour un compte qui ne
  les a pas acceptées : « Avant de continuer », sans étapes, comme
  aujourd'hui.
- **`p03`, les six cases** : `Screen tone="brand"`, `Steps` 3 sur 3,
  l'autocollant, `Display` l, le bento vide et ses deux autocollants penchés,
  la phrase, `Button on-brand` « Je m'y mets ». Le bento y est une
  illustration : il se lit d'un seul libellé, les six catégories dans
  l'ordre.
- **Le bento vide** (D3) : `Bento` et `BentoTile` du design, dans
  `src/design/bento/`, avec leur seul état vide de composition : le plateau à
  contour encre et ombre franche, six cases en pointillés, chacune son « + »
  et sa catégorie, aux mesures de `bundle.css`, en densité `compose`. Une page
  `bento` au catalogue le montre. Le 32 complète les deux composants : les
  cases remplies, en attente, la case à remplir maintenant, les densités
  `feed`, `mini` et `share`.
- Le parcours ne change pas : l'accueil, les règles, les six cases, le
  composer ; l'acceptation enregistrée comme aujourd'hui.

### 7.2 La mise à jour requise et la maintenance (D10)

- **`m02` et `m03`** : `Screen tone="brand"`, Popy de 184 qui se dandine,
  « surpris » pour la mise à jour, « malade » pour la maintenance, `Display`
  l centré, la phrase en `body-l` sur 30 caractères au plus ; « Mettre à
  jour » en `Button on-brand` plein, qui ouvre toujours la fiche du store ;
  aucun bouton pour la maintenance.
- `AppBlocker` se rend désormais dans `SafeAreaProvider` et `ThemeProvider`.
  La maintenance garde le titre et le message du back-office, ceux de la
  maquette restant ses textes par défaut.

### 7.3 Le lancement (D11)

- Le lancement natif (`expo-splash-screen`) passe sur `bg-brand`, avec la
  Popy de la nouvelle icône ; le lancement JavaScript (`Splash.tsx`) sur
  `BrandGround`, le logo et Popy, « Mise à jour… » en Fredoka. Le dossier
  n'en a pas de maquette : il est composé des éléments de `p01`, pour que
  l'app passe du lancement à l'accueil sans saut de jaune.

### 7.4 Les icônes (D12)

- **iOS** : l'icône du dossier, telle quelle.
- **Android** : l'icône adaptative, son fond `yolk-500` à pois et Popy dans
  la zone sûre (les 66 % du centre que tout masque garde), générés par un
  script depuis les mesures d'`AppIcon` (30) et l'original de Popy ; une icône
  monochrome, la silhouette de Popy, pour les icônes à thème d'Android 13.
- **La petite icône des notifications**, celle du dossier, et leur couleur,
  `yolk-700` (3,8:1 sur blanc et 4,9:1 sur le volet sombre, le seuil des
  icônes étant 3:1 ; `yolk-500` n'a que 2:1 sur blanc), par les options du
  plugin `expo-notifications`.
- Ces fichiers et `app.json` changent au 31, éprouvés sur des builds de
  développement refaites ; ils partent avec la build 2.0.0.

## 8. Ce que le 31 ne fait pas

- **Les écrans derrière la coque** : le composer (32), dont celui de `m01`
  sous son bandeau ; La table, Trouver et les profils (33) ; Notifs, les
  comptes et les réglages (34).
- **La notification reçue app ouverte** (`InAppNotice`) : au 34, avec ses
  écrans `n01` et `n02`, comme le veut la roadmap. La D22 du 30 l'annonçait
  au 31 pour sa place à la racine : le 34 l'y posera.
- **Le bandeau hors connexion** : au 33, avec `t07`.
- **Le reste du bento** (D3) : au 32.
- **La barre sur les écrans poussés** (D4) : avec leurs écrans, les profils
  d'un compte au 33.
- **Le fond de la racine** (`backgroundColor` de `app.json`, `#fbbf24`) : il
  reste jaune tant que des écrans jaunes restent, jusqu'au 34.
- **Bungee** : `fonts.ts` la charge jusqu'au dernier écran qui l'emploie.
- **Le thème sombre** (D3 de la refonte).

## 9. Tests

- Les règles de toute l'app restent vertes : `accessibilite.test.ts`,
  `font-scaling.test.ts`.
- **Nouveaux** : l'ordre des onglets et leurs annonces, à cinq et à quatre
  (D2) ; la teinte de chaque Popy (D6), les six couvertes ; la durée et
  l'icône d'un toast selon sa variante et son action (D7) ; sa distance au
  bas, avec la barre, sans elle et clavier ouvert ; `app.json`, qui pointe
  vers des fichiers présents, aux tailles et à la transparence attendues.
- **Retirés ou repris** : `tab-bar.test.ts` sort avec `tab-bar.ts` ; les
  quatre tests qui prennent 84 en entrée passent aux hauteurs de la nouvelle
  barre, pour rester des cas réels.
- `toastAnnouncement`, `shouldOfferUpdate`, `badgeText`,
  `notificationsTabLabel` et `checkboxA11y` gardent leurs tests.

## 10. Recette

Au simulateur iPhone 17 Pro, au simulateur iPhone SE et à l'émulateur
Pixel 8, sur la pile locale, comme le 30.

- **Les cinq écrans contre leur PNG**, à 100 % à l'iPhone 17 Pro, dont la
  maquette a le cadre (402 × 874), en tolérant l'écart de la police du
  système (D14 du 30) ; puis à 130 et au-delà de 200 %, jusqu'à l'iPhone SE,
  rien de coupé. **`m01`** : le bandeau contre sa maquette, poussant l'écran.
- **La barre** sur les cinq racines : l'ordre, la pastille, l'avatar d'un
  compte avec et sans pseudo, l'arrivée (D1), le retour d'Android, Notifs
  coupé sur la pile locale (D2), les annonces de VoiceOver et TalkBack.
- **Les toasts** : un succès, une erreur, un avec « Annuler », sur une racine,
  sur un écran poussé, dans la recherche d'une case, clavier ouvert ; la durée
  mesurée, le toucher, la voix.
- **Le bandeau** : une version en retard sur la pile locale ; il pousse
  l'écran, « Plus tard » tient, il s'efface hors connexion.
- **Les blocages** : `maintenance_mode`, puis une version minimale au-dessus
  de l'app, sur la pile locale.
- **Le lancement et les icônes**, sur des builds de développement refaites :
  l'écran d'accueil du téléphone, l'icône adaptative sous deux masques, une
  notification reçue à l'émulateur, sa petite icône et sa couleur.
- **Le mouvement réduit** : les Popys immobiles, les toasts en fondu.
- **Les autres écrans** : les racines et quelques écrans poussés, capturés
  avant et après ; seules la barre, leur hauteur utile et le toast changent.
- **La CI rejouée en local**.
- **La part du 29** : l'haptique d'un onglet (3-a), l'icône et la petite
  icône sur un vrai téléphone, Android 13 à thème compris, le lancement en
  build de production.

## 11. Les lots

1. **La barre** : la `TabBar` branchée, l'ordre, la pastille, l'avatar et sa
   teinte, l'arrivée, Notifs coupé, le retour d'Android, l'haptique ; la
   hauteur relue par le composer et le profil ; `TabIcons.tsx`,
   `tab-bar.ts` et son test retirés.
2. **Les toasts et le bandeau** : l'hôte, sa place et ses durées, au-dessus
   du clavier et des modales ; le bandeau en tête des racines, dans le flux ;
   `UpdateBanner.tsx` et le `Toast` des primitives retirés.
3. **L'accueil** : `p01` à `p03`, `Bento` et `BentoTile` vides et leur page
   au catalogue (D3), la variante des règles pour un compte.
4. **Les blocages, le lancement et les icônes** : `m02`, `m03`, les deux
   lancements, les icônes et `app.json` ; les builds de développement
   refaites.
5. **La recette** du §10, la roadmap et la part du 29.

## 12. Definition of Done

| # | Point | État |
| --- | --- | --- |
| 1 | La barre du design sur les cinq racines : l'ordre, Compose au centre, la pastille, l'avatar ; l'arrivée sur Compose (D1), quatre onglets quand Notifs est coupé (D2) | ⬜ |
| 2 | Les toasts en bas, au-dessus de la barre, de la zone sûre ou du clavier ; 4 s, 6 s avec une action ; dits poliment ; les 30 appels inchangés | ⬜ |
| 3 | Le bandeau de mise à jour en tête des racines, qui pousse l'écran ; « Plus tard » retenu par version | ⬜ |
| 4 | `p01` à `p03`, `m02` et `m03` identiques à leur PNG au simulateur et à l'émulateur, tenus à 130 et 200 % jusqu'à l'iPhone SE ; le bandeau de `m01` identique au sien | ⬜ |
| 5 | Le lancement sur le fond de marque, sans saut de jaune | ⬜ |
| 6 | L'icône d'app, l'icône adaptative et la petite icône des notifications vues au simulateur et à l'émulateur | ⬜ |
| 7 | Les lecteurs d'écran en français ; les onglets « onglet n sur 5 », ou sur 4 (D2) | ⬜ |
| 8 | Le mouvement réduit : Popys immobiles, toasts en fondu | ⬜ |
| 9 | Les autres écrans ne changent qu'à la barre, à leur hauteur utile et au toast | ⬜ |
| 10 | Bungee, `YellowBg`, `StampButton` et `Sticker` sortis des fichiers du 31 ; `TabIcons`, `tab-bar.ts`, `UpdateBanner` et le `Toast` des primitives retirés | ⬜ |
| 11 | Les tests de règles verts ; les tests figés sur 84 et sur Bungee repris | ⬜ |
| 12 | La CI rejouée en local, verte | ⬜ |

## 13. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | L'app **ouvre toujours Compose**, au centre de la barre ; le retour d'Android y ramène | Rendue par Clément en QCM, l'option recommandée. L'app envoie déjà au composer tout compte qui a un profil, et `m01` pose le bandeau de mise à jour sur Compose : aucune des 22 navigations vers un onglet n'est à reprendre, aucune habitude ne change |
| **D2** | Notifs coupé, **quatre onglets** dans l'ordre du design, Compose troisième | Rendue par Clément en QCM, l'option recommandée. Coupée, la zone de notifications disparaît, comme aujourd'hui, sans écran nouveau ; l'interrupteur est allumé en production depuis le 28 octobre |
| **D3** | Le 31 construit **`Bento` et `BentoTile` dans leur seul état vide** ; le 32 les complète | Rendue par Clément en QCM, l'option recommandée. Le bento du design vient au 32 (D2 du 30), mais `p03` en montre un, vide : deux composants sur les neuf du bento commencés, et les cinq écrans du 31 identiques à leur PNG |
| **D4** | **La barre sur les écrans poussés vient avec leurs écrans** : le 33 met les profils d'un compte sous les onglets ; les réglages, les crédits et les listes restent sans elle | Rendue par Clément en QCM, l'option recommandée. Le gabarit du design la garde partout, ses maquettes seulement sur les profils d'un compte. Le 31 ne déplace aucune route : une dizaine d'écrans pas encore refaits ne passent pas sous une barre neuve, et chaque chantier reprend ses liens avec ses écrans |
| **D5** | La coque change dans toute l'app ; les écrans, seulement les cinq du 31 | La barre, les toasts et le bandeau sont partout à la fois : les refaire écran par écran mélangerait deux coques jusqu'au 34 |
| **D6** | L'avatar prend la teinte de sa Popy : « content » `yolk`, « intello » `ramune`, « fille » `sakura`, « gene » `shiso`, « nani » `wasabi`, « diable » `ume` ; sans pseudo, « content » sur `yolk` | Aucune teinte n'est enregistrée, et en choisir une serait une fonctionnalité nouvelle. La maquette donne « gene » sur `shiso` ; les autres prennent la teinte la plus proche de la couleur que chaque Popy porte déjà aux médailles et aux auteurs de notifications, dans l'app et sur le web (`POPY_ACCENTS`), « nani », turquoise, passant au vert de `wasabi` pour ne pas partager `ramune` avec « intello » |
| **D7** | Les toasts gardent leur magasin, seul l'hôte change ; au moins 4 s, 6 s avec une action ; encre toujours, l'icône disant la variante | Les 30 appels n'ont pas à bouger. Le guide fixe la durée et interdit qu'une information tienne à la couleur seule |
| **D8** | Le bandeau de mise à jour monte dans les onglets, en tête et dans le flux ; ses conditions, son « Plus tard » et son lien ne changent pas | Il ne paraît que sur les racines : posé au-dessus d'elles, il pousse chaque écran sans qu'aucun ait à lui réserver de place |
| **D9** | Les règles gardent leurs deux liens, et leur variante pour un compte | La case fait accepter les CGU et la politique de confidentialité : il faut pouvoir les lire avant. La maquette n'a dessiné que le premier lancement |
| **D10** | Les blocages se rendent dans le thème et la zone sûre ; la maintenance garde les textes du back-office | Les composants du design lisent le thème et la zone sûre. Le back-office écrit la maintenance quand elle arrive |
| **D11** | Le lancement, natif et JavaScript, passe sur le fond de marque, composé des éléments de l'accueil | Sans maquette, il doit mener à l'accueil sans saut : le jaune de la marque est `#f2a82a`, celui d'aujourd'hui `#fbbf24` |
| **D12** | L'icône du dossier sur iOS ; sur Android, une icône adaptative générée depuis `AppIcon` et une monochrome ; la petite icône des notifications et sa couleur `yolk-700` ; avec la build 2.0.0 | Le dossier ne donne qu'une icône carrée, que le masque d'Android rognerait. Sans petite icône, Android en dessine une de l'icône d'app ; `yolk-500` ne tient pas 3:1 sur blanc |
| **D13** | Un retour de sélection à chaque changement d'onglet | Le guide le demande ; c'est l'écran qui joue l'haptique, pas le composant (D23 du 30) |
| **D14** | Les quatre tests qui prennent 84 en entrée passent aux hauteurs de la nouvelle barre | Ils décrivent des écrans réels ; 84 n'en sera plus un |
| **D15** | Bungee, `YellowBg`, `StampButton` et `Sticker` sortent des fichiers du 31 ; `TabIcons`, `tab-bar.ts`, `UpdateBanner` et le `Toast` des primitives sont retirés ; `Pagination` et `PageTitle` restent pour le pseudo | La D13 du 30 : une primitive part avec son dernier emploi |

## 14. Suivis

- **La licence d'Extenda** pour une app mobile : Clément (tâche 12 ter).
  L'accueil, la mise à jour et la maintenance l'emploient.
- **Les icônes des autres toasts**, au fil des écrans des 32 à 34, si leurs
  maquettes en dessinent.
- **`m01`** n'est entière qu'au 32, avec le composer sous son bandeau.
