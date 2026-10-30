> Le système de l'app Mon Bento Pop (iOS et Android) : une app sociale où le bento est le contenu, et où la marque Bento Pop se sent sans jamais gêner la lecture.

Ce système part de la marque Bento Pop (le jaune « yolk », la crème « riz », l'encre « nori », Popy) et la règle pour un usage mobile quotidien : écrans clairs, une seule couleur d'action, des contours encre réservés aux objets qui comptent. Tout ce qu'il faut pour dessiner un nouvel écran est ici : les tokens (`tokens.json`, `tokens.css`), les composants (`window.MonBentoPop`), les règles ci-dessous et les recettes d'écrans à la fin.

## Les cinq principes

1. **Le bento d'abord.** Le contenu (bentos, affiches, pseudos) porte la couleur ; l'interface reste calme sur `bg-app`, `bg-surface` et `bg-sunken`. Pas de fond jaune sur un écran d'usage courant : `bg-brand` est réservé aux moments de marque (accueil, mise à jour, maintenance, image partagée).
2. **Un seul jaune pour agir.** `accent` (yolk-300) signale ce qu'on peut faire : le bouton principal, le bouton Compose, les segments remplis, le halo de focus. Un seul `Button variant="primary"` par écran. Sur un fond jaune, le bouton principal devient `variant="on-brand"` (encre).
3. **Popy parle pour l'app.** Attente, vide, erreur, succès, célébration : Popy prend l'humeur du moment. Jamais d'émoji dans l'interface, jamais deux Popy sur un même écran.
4. **Des stickers, pas des ombres floues.** Les ombres franches `shadow-pop*` et le contour `ink` sont réservés au bouton principal, au plateau bento, au bouton Compose, aux boîtes de dialogue, aux médailles et à la bannière de notification. Tout le reste est à plat : filets `border-subtle`, surfaces, voile `scrim`. Aucun flou, aucun dégradé décoratif.
5. **Lisible par tout le monde.** Contraste AA dans les deux thèmes, zones tactiles de 44 pt, texte qui grandit jusqu'à 200 %, jamais une information portée par la couleur seule.

## Voix et ton

- **Tutoiement, phrases courtes, chaleur sans forcer.** On garde la voix de l'app : « Garde ton bento », « Touche une case, cherche, valide. », « On revient vite ».
- **Majuscule de phrase partout** : titres, boutons, onglets, toasts. Les capitales sont réservées aux puces de catégorie (`Tag`), aux sur-titres (`eyebrow`), aux titres de cases (`tile-*`) et aux titres `Display` des moments de marque.
- **Un bouton commence par un verbe** et dit ce qui va se passer : « Publier mon bento », « Recevoir un code », « Garder mon compte ». Évite « OK », « Valider », « Continuer » quand un verbe plus précis existe.
- **Un toast dit ce qui vient de se passer** : « Compte gardé », « Demande envoyée à @mika.lit », « On te le rappelle demain à 18 h. ». Avec une action réversible, ajoute `action="Annuler"`.
- **Une erreur dit ce qui s'est passé et comment s'en sortir**, sans s'excuser : « Ce pseudo est déjà pris. Essaie @bento_culture. »
- **Typographie française** : espace insécable avant `? ! : ;`, guillemets « », apostrophe ’, heures « 18 h », dates « 28 oct. 2026 », durées « il y a 4 semaines ».
- **Écriture inclusive** au point médian quand le texte parle des gens : « utilisateur·rice·s ».

| À faire | À éviter |
| --- | --- |
| « Commence par ton film » | « Commencer » |
| « Supprimer » (dans la boîte qui demande « Supprimer mon compte ? ») | « Oui » |
| « Aucun résultat trouvé » + la ligne pour proposer l'item | Un écran vide sans issue |
| Popy gêné dans une confirmation délicate | Un émoji 😅 |

## Couleurs

### Les fonds

- `bg-app` : fond de tous les écrans standard (blanc riz en clair, encre en sombre).
- `bg-surface` : cartes, groupes de réglages, barre d'onglets, cellules.
- `bg-sunken` : champs de recherche, puces, boutons secondaires, segments vides.
- `bg-elevated` : feuilles, menus d'actions, boîtes de dialogue.
- `bg-brand` (+ `bg-brand-dots` pour le motif pois) : moments de marque uniquement, avec `text-on-brand`.
- `bg-plate` : fond du plateau bento entre les cases.
- `scrim` : voile sous une feuille ou une boîte de dialogue.

### Le texte

- `text-primary` sur tous les fonds ci-dessus (18,9:1 en clair, 16,8:1 en sombre).
- `text-secondary` pour les métadonnées et descriptions (6,2:1 au moins).
- `text-tertiary` pour les horodatages, les textes d'exemple des champs et les compteurs (4,7:1 au moins).
- `text-on-media` (blanc) uniquement sur une image, au-dessus du dégradé `media-scrim`.
- `text-danger`, `text-success` pour les messages d'état, toujours avec une icône ou un mot.

### L'action et les états

- `accent` / `on-accent` : bouton principal, bouton Compose, segments de `Progress`. `accent-pressed` à l'appui.
- `accent-soft` / `on-accent-soft` : mise en avant douce (bannière de mise à jour, case suivante à remplir, halo d'un champ actif).
- `control-on` / `control-on-fg` : interrupteur allumé, case cochée, bouton radio. En clair c'est encre + pastille jaune, en sombre c'est l'inverse.
- `danger` / `on-danger` : bouton destructif, pastille de compteur. `danger-soft` / `on-danger-soft` : fond des interdits.
- `like` : cœur aimé. `success` : coche de validation, point « En ligne » sur `status-live-bg`.
- `focus-ring` (2 px) entouré de `focus-halo` (4 px) : tout élément au clavier ou au contacteur. Jamais le bleu système.

### Le garde-manger : six cases, six couleurs

Chaque case du bento a sa couleur, son icône et son libellé court. La couleur n'est jamais seule : la puce `Tag` écrit toujours la catégorie.

| Case | Libellé de puce | Token | Icône Phosphor |
| --- | --- | --- | --- |
| Film | FILM | `cat-film` (ume) | `film-slate` |
| Série | SÉRIE | `cat-serie` (shiso) | `television-simple` |
| Artiste | ARTISTE | `cat-artiste` (sakura) | `star` |
| Chanson | SON | `cat-son` (ramune) | `music-notes` |
| Créateur de contenu | CRÉA | `cat-crea` (thon) | `monitor-play` |
| Lieu | LIEU | `cat-lieu` (wasabi) | `map-pin` |

- Une case sans image prend `cat-<case>` en fond, son initiale géante en `cat-<case>-deep` et son titre en `nori-900`.
- Les avatars utilisent les mêmes teintes `-300` (yolk, ume, thon, sakura, shiso, ramune, wasabi) : `<Avatar color="shiso">`.
- Les teintes `-700` portent du texte blanc (au moins 4,5:1) ; les teintes `-300` portent du texte `nori-900` (au moins 8,4:1).

### Thème sombre

Le thème sombre est complet : mets `data-theme="dark"` sur l'écran (`<Screen theme="dark">`). Le plateau passe sur `neutral-850`, les ombres franches deviennent jaune profond (`yolk-600`), l'interrupteur s'inverse. Les cases et les puces gardent leurs couleurs : le contenu ne change pas de thème.

## Typographie

Quatre familles, chacune avec un rôle et un seul.

| Famille | Token | Rôle |
| --- | --- | --- |
| Extenda 100 Yotta | `--font-display` | Moments de marque uniquement : `display-xl`, `display-l`, `display-m`, en capitales, 4 mots au plus, une fois par écran. |
| Fredoka | `--font-heading` | La voix de l'app : titres (`title-1` à `title-3`), boutons (`label-*`), onglets (`tab-label`), sur-titres (`eyebrow`). |
| Fredoka SemiCondensed Bold | `--font-tile` | Titres des cases du bento (`tile-*`), en capitales. |
| Police du système (SF Pro, Roboto) | `--font-text` | Tout ce qui se lit : `body-l`, `body`, `subhead`, `footnote`, `caption`. |

- Titre d'un écran racine ou d'un parcours : `title-1` (30/36). Titre d'une feuille, pseudo du profil, titre d'état vide : `title-2`. Section : `title-3`.
- Texte courant : `body` (16/22). Lecture longue (règles, explications) : `body-l` (17/24). Le plus petit texte autorisé est `caption` (12/16) ; seul le crédit photo posé sur une image descend à 10 px.
- Les titres de cases se coupent à 2 lignes (grande case) ou 3 lignes (petites cases), jamais en dessous de `tile-s` (11 px, bento miniature).
- **Taille de texte du système** : tout le texte suit le réglage d'accessibilité jusqu'à 200 %. À partir de 130 %, les boutons passent à la ligne (`.mbp-btn--wrap`), les titres de cases s'arrêtent à 130 % et les lignes de liste empilent leur détail sous le titre.
- Les nombres qui se comparent (compteurs, codes) utilisent les chiffres tabulaires.

## Espace et mise en page

- Grille de 4 pt : `space-1` (4) à `space-16` (64). Marge latérale de tout écran : `screen-margin` (16). Entre deux blocs : `space-6` (24). Entre deux sections : `space-8` (32).
- Référence iPhone 17 Pro, 402 × 874 pt : `safe-top` (62) et `safe-bottom` (34) ne contiennent rien d'interactif. Sur Android (Pixel 8, 412 × 915 dp) la mise en page est la même, seules les zones sûres changent.
- Un écran se lit de haut en bas en quatre bandes : la barre du haut (`TopBar`, 52), le contenu qui défile, la zone d'action collée en bas (bouton principal, 16 au-dessus de la barre d'onglets ou de `safe-bottom`), la barre d'onglets (`TabBar`, 56 + zone sûre).
- Zone tactile minimale `size-touch` (44) partout, même pour un petit bouton (sa zone est étendue).
- Rayons : `radius-full` pour boutons, puces, avatars ; `radius-md` (14) pour les champs ; `radius-lg` (20) pour les cases et les groupes ; `radius-xl` (28) pour le plateau, les feuilles et les boîtes de dialogue.

## Icônes

- **Phosphor Icons** (licence MIT), graisse `bold` par défaut, `fill` pour l'état actif ou choisi (onglet courant, cœur aimé). Tailles : 24 (standard), 20 (ligne dense, puce), 26 (barre d'onglets et actions sous un bento). Paquets : `phosphor-react-native`, `phosphor_flutter`. Dans le système : `<Icon name="heart" weight="fill" />`.
- Actions de référence : retour `caret-left`, fermer `x`, options `dots-three`, réglages `gear-six`, modifier le profil `pencil-simple-line`, modifier le bento `squares-four`, partager `share-fat`, j'aime `heart`, commenter `chat-circle`, signaler `flag`, bloquer `prohibit`, en attente `hourglass-medium`, lien externe `arrow-up-right`, hors connexion `wifi-slash`.
- Onglets : La table `bowl-steam`, Trouver `magnifying-glass`, Compose `plus` dans la pastille jaune, Notifs `bell`, Profil = l'avatar de la personne.
- Un bouton qui n'a qu'une icône porte toujours un libellé pour les lecteurs d'écran (`label` sur `IconButton`).

## Popy et le design émotionnel

Popy est le système d'émotions de l'app. Choisis l'humeur selon le moment :

| Moment | Humeur (`mood`) | Exemple |
| --- | --- | --- |
| Accueil, succès, demande bienveillante | `content` | Onboarding, « On te prévient quand une édition sort ? » |
| Célébration, attachement | `bisou` (fichier `fille`) | « Garde ton bento » après la publication |
| Explication, compte, sérieux | `intello` | « Garde ton compte », « Dis pourquoi ces choix » |
| Moment délicat, perte possible | `gene` | « Supprimer mon compte ? », « Reconnecte-toi » |
| Surprise, rien trouvé, nouveauté | `surpris` (fichier `nani`) | « Aucun résultat trouvé », « Mise à jour requise » |
| Blocage, refus | `enerve` | « Bloquer cet utilisateur ? » |
| Panne, maintenance | `malade` | « On revient vite » |

- **Taille** : 52 à 64 dans une carte ou une invite, 76 dans une boîte de dialogue, 88 à 120 dans un parcours ou un état vide, 150 à 190 dans un moment de marque.
- **Une Popy par écran au plus**, et aucune dans les écrans denses (listes, réglages) en dehors de leurs boîtes de dialogue.
- **Fichiers** : chaque humeur existe en PNG 1000 × 1000 sur fond transparent dans le groupe d'éléments « Popy ». `diable` n'a pas encore de fichier d'origine : l'image actuelle est une découpe provisoire d'une capture de la 2.0.
- **Avatars** : chaque compte choisit une Popy (`content`, `intello`, `bisou`, `gene`, `surpris`, `diable`) posée sur une teinte du garde-manger.
- **Célébrations** : publication du bento, bento complet (6/6), succès débloqué. Jouer `Confetti` (600 ms) + retour haptique de succès, une seule fois par événement.
- **Micro-interactions** : le cœur saute à l'appui (`--ease-pop`), une case remplie « tombe » dans le plateau (pop de 320 ms), le bouton principal s'enfonce dans son ombre, Popy se dandine doucement au repos (`wiggle`).

## Mouvement et retours haptiques

- Durées : `--dur-fast` 120 ms (appui), `--dur-base` 200 ms (toast, interrupteur), `--dur-slow` 320 ms (feuille, case qui arrive), `--dur-celebrate` 600 ms (confettis). Courbes : `--ease-standard` pour les déplacements, `--ease-pop` (léger rebond) pour ce qui apparaît, `--ease-exit` pour ce qui part.
- Haptique iOS / Android : sélection légère sur un onglet, une puce, un interrupteur ; impact moyen sur le cœur ; notification « succès » à la publication et à la validation d'un code ; « avertissement » à l'ouverture d'une confirmation destructive ; « erreur » sur un code faux.
- **Mouvement réduit** : plus de dandinement, de confettis ni de rebond ; les apparitions deviennent des fondus de 120 ms.

## Accessibilité

- Chaque couple texte/fond nommé dans `tokens.json` tient 4,5:1 (3:1 pour les icônes, contours de contrôles et anneaux de focus) dans les deux thèmes.
- Chaque case du bento s'annonce en entier : « Film : Inception, 2010 », « Lieu : Le Pont Neuf, en attente de validation ».
- Les champs ont un libellé visible (`TextField label`) ; le texte d'exemple n'en tient jamais lieu.
- Les toasts sont annoncés poliment (`role="status"`) et restent au moins 4 s, 6 s quand ils proposent une action ; la boîte de dialogue est un `alertdialog` qui garde le focus.
- L'état ne repose jamais sur la couleur seule : interrupteur (position + couleur), case en attente (sablier + libellé), erreur (icône + texte).
- L'app déclare la langue française pour la synthèse vocale ; les pseudos se lisent lettre à lettre (« arobase lea point cine »).

## Plateformes

- Le même dessin sur iOS et Android. Restent natifs : les demandes d'autorisation du système, la feuille de partage, le volet de notifications, le clavier, le retour (geste sur iOS, bouton ou geste sur Android).
- Avant chaque demande d'autorisation du système, une `AskSheet` explique pourquoi avec Popy ; la boîte du système suit si la personne accepte.
- Quand le clavier s'ouvre, la zone d'action collée en bas monte au-dessus du clavier.
- Une notification reçue pendant que l'app est ouverte s'affiche avec `InAppNotice` en haut de l'écran pendant 4 s ; app fermée, c'est la notification du système (icône d'app, titre, texte).
- Icône d'app : Popy content sur `yolk-500` ; petite icône Android de la barre d'état : la silhouette blanche de Popy. Les deux fichiers sont dans le groupe d'éléments « Marque », avec le logo.

## Les composants

Tous les composants vivent sur `window.MonBentoPop` et se règlent par des données (texte, nombres, listes), jamais par du style : la mise en page d'un écran reste dans l'écran.

- **Structure** : `Screen` (le cadre d'un écran, thème et fond), `TopBar` (barre du haut : en ligne, grand titre, marque), `TabBar` (les cinq onglets), `Tabs` (onglets soulignés en haut d'une liste), `Steps` (étapes de l'accueil), `SectionHeader`.
- **Actions** : `Button` (primary, secondary, outline, tertiary, tertiary-danger, danger, inverse, on-brand), `IconButton`, `Chip` (filtre, ajout d'édition, suggestion avec compteur).
- **Bento** : `Bento` (le plateau de six cases, en lecture ou en composition), `BentoTile`, `Tag` (puce de catégorie), `Progress` (six segments), `Thumb`, `ItemCard` et `ItemGrid` (résultats de recherche), `ProposeRow` (proposer un item au catalogue), `ShareCard` (image partagée 1080 × 1920).
- **Social** : `Post` et `PostHeader` (un bento dans La table), `ActionBar` (j'aime, commenter), `ProfileHeader` (avatar, pseudo, statistiques, actions), `StatusPill`, `Achievements` et `Achievement` (succès), `WhyEntry` et `WhyField` (les pourquoi), `Comment`, `CommentComposer`, `NotificationRow` et `Medallion`, `AccountRow`, `PopyPick`.
- **Listes et saisie** : `List`, `ListRow`, `Switch`, `Checkbox`, `RadioRow`, `TextField`, `SearchField`, `CodeField`, `Rule`.
- **Calques et retours** : `Sheet` et `SheetFooter`, `AskSheet` (demande avec Popy), `ActionSheet`, `Dialog`, `Toast`, `Banner` (hors connexion, mise à jour), `InAppNotice`, `EmptyState`, `PromptCard`, `Confetti`, `Spinner`, `Skeleton`, `Badge`.
- **Marque** : `Popy`, `Avatar`, `Logo`, `AppIcon`, `Sticker`, `Display`, `Icon`.

## Construire un nouvel écran

1. **Choisis le gabarit** dans le tableau ci-dessous. Chaque écran de l'app en suit un.
2. **Compose avec les composants**, place-les avec des piles flex (`.mbp-stack`, `--stack-gap`) et `screen-margin` sur les côtés. Aucune couleur, taille ou ombre écrite à la main : seulement des tokens.
3. **Une action principale**, en bas de l'écran ou dans l'en-tête du profil. Les autres actions sont `secondary`, `tertiary` ou dans un `ActionSheet` (bouton `dots-three`).
4. **Prévois les états** : vide (`EmptyState`), chargement (`Spinner` dans le bouton, `Skeleton` pour le fil et les listes), hors connexion (`Banner tone="offline"`), erreur (`TextField error`, `Toast`), succès (`Toast`, célébration).
5. **Relis la liste de contrôle** avant de livrer : un seul jaune d'action, une seule Popy, zones de 44 pt, libellés des boutons-icônes, thème sombre vérifié, texte à 200 % sans coupure.

| Gabarit | Quand | Composition |
| --- | --- | --- |
| Racine d'onglet | La table, Trouver, Compose, Notifs, Profil | `Screen` › `TopBar variant="large"` (ou `brand` pour La table) › contenu › `TabBar active="…"` |
| Écran poussé | Profil d'un compte, Réglages, Crédits, listes | `TopBar back` (grand titre si l'écran en a besoin, en ligne s'il défile) › contenu ; la `TabBar` reste visible |
| Parcours | Garder son compte, se reconnecter, choisir son pseudo | `TopBar back` › Popy 88 facultative › `title-1` › `body-l` › champ › bouton principal plein largeur › liens `tertiary` |
| Feuille | Chercher une case, commentaires, pourquoi, signaler | `Sheet height="full"` ou `"large"`, titre `title-2`, fermeture en haut à droite, `SheetFooter` pour l'action |
| Demande | Notifications, garder son bento, éditions | `AskSheet` : Popy, question, une phrase, « Oui… » en principal, « Plus tard » en `tertiary` |
| Choix | Options d'un compte, annuler une demande | `ActionSheet` : un titre discret, des lignes icône + libellé, la destructive en `tertiary-danger`, « Annuler » à part |
| Confirmation | Supprimer, retirer, se déconnecter, bloquer | `Dialog` : Popy 76, question, conséquence en une phrase, action en `danger` ou `primary`, « Annuler » en `secondary` |
| Moment de marque | Accueil, mise à jour, maintenance | `Screen tone="brand"` › Popy 150 à 190 › `Display` › `body-l` › `Button variant="on-brand"` |
| État vide | Notifications, profil sans bento, recherche sans résultat | `EmptyState` (Popy, message, une action) à la place de la liste |

Les recettes détaillées, avec le code à copier, sont dans `recettes.md`.

## Utiliser le système

- **Fichiers** : `tokens.css` (variables et polices), `components/bundle.css` (styles des composants, charge Fredoka depuis Google Fonts), `components/bundle.js` (définit `window.MonBentoPop`, demande React 18 sur `window.React`). Charge-les dans cet ordre.
- **Dans un canevas Design** : installe le système, puis dans chaque plan de travail, après la ligne `support.js` : `<link rel="stylesheet" href="ds/monbentopop/tokens.css">`, `<link rel="stylesheet" href="ds/monbentopop/components/bundle.css">`, `<script src="ds/monbentopop/components/bundle.js"></script>`. Un composant se pose avec `<x-import component-from-global-scope="MonBentoPop.Button" variant="primary" block="true">Publier mon bento</x-import>`. Les textes et nombres se passent en attributs ; les listes (cases d'un bento, actions d'une barre) passent par un trou `{{ … }}` rempli dans `renderVals()`. Le canevas enveloppe chaque composant dans un élément `display: contents` : les styles du système en tiennent compte ; dans tes propres styles, n'écris pas de sélecteur d'enfant direct ou de voisin (`>`, `+`, `:first-child`) entre deux composants.
- **Dans l'app** (React Native, Flutter) : `tokens.json` est la source des valeurs (couleurs par thème, styles de texte, espaces, rayons, ombres) ; les composants HTML servent de référence de dessin et de comportement. Les fichiers de police sont dans `fonts/` ; Fredoka se télécharge sur Google Fonts (licence OFL).
- **Polices** : Extenda appartient à la marque Bento Pop ; avant de l'embarquer dans l'app, vérifie que la licence couvre une application mobile.
