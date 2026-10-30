# Chantier 30 · Socle du design system v2

> Spécification écrite le 28 octobre 2026, à partir du dossier de la refonte,
> versé dans [`docs/design-v2/`](./design-v2/LISEZMOI.md), et du code de
> `chore/refonte-design-v2` (`76bc053`, la PR #109, elle-même sur la #108).
> Lectures seules ; ce chantier n'écrit rien en production et n'en a pas
> besoin.
>
> **Arbitrages rendus le 28 octobre 2026 par Clément**, en QCM, D1 à D4
> (§12), chaque fois l'option recommandée : le texte suit la taille du
> système **jusqu'à 200 %** ; le socle construit **les 39 composants
> transverses**, ceux du bento et du social venant avec leurs écrans ;
> **les 72 icônes du dossier**, dans un composant maison ; un thème lu par
> **`useTheme()`**, NativeWind retiré. D5 à D16 sont pris par la
> spécification, D17 à D19 au lot 3, D20 à D23 au lot 4, D24 au lot 5.
>
> **Le socle ne se voit pas** (D5) : à la fin du 30, chaque écran de l'app
> est identique au pixel à ce qu'il était. Il pose ce que les chantiers 31
> à 34 emploieront pour refaire les écrans : les tokens, les polices, la
> taille de texte, les icônes, les ombres, le mouvement, l'haptique et 39
> composants, chacun vérifié dans un catalogue réservé au développement.
> Même sortie store unique que tous les chantiers, qui attend la refonte
> entière (D25 du 29).

---

## 1. Ce que le design demande

Lu dans `docs/design-v2/design-system/` : `README.md`, `tokens.json`,
`components/`, `code-source/src/bundle.css`.

- **Les couleurs** : 105 tokens, 48 primitives (yolk, rice, nori, neutral,
  et les six teintes du garde-manger : ume, thon, sakura, shiso, ramune,
  wasabi) et 57 sémantiques, chacune avec une valeur claire et une sombre :
  les fonds, les textes, les contours, l'action et les états, les six
  catégories et leurs teintes profondes. Le code n'emploie que les
  sémantiques ; les primitives servent à les définir.
- **Le texte** : 22 styles en quatre groupes. *Affiche* en Extenda
  (`display-xl` 44/40 à `display-m` 24/24), *Bento* en Fredoka
  SemiCondensed Bold (`tile-xl` 28 à `tile-s` 11), *Titres* en Fredoka 500
  et 600 (`title-1` 30/36 à `tab-label` 11/14, dont les libellés de boutons
  et l'`eyebrow`), *Texte* dans la police du système (`body-l` 17/24 à
  `caption` 12/16).
- **Les mesures** : une grille de 4 (`space-0` à `space-16`), cinq rayons
  (6, 10, 14, 20, 28) et la pilule, trois contours (1, 1,5 et 2), des
  tailles fixes (zone tactile 44, barre du haut 52, barre d'onglets 56,
  boutons 52, 44 et 32, champs 52, marge d'écran 16).
- **Les ombres** : trois ombres franches, décalées de 2, 3 ou 5 en x et en
  y, **sans aucun flou**, encre en clair et jaune profond en sombre ;
  réservées au bouton principal, au plateau, à Compose, aux boîtes de
  dialogue, aux médailles et à la bannière de notification.
- **Les icônes** : Phosphor, bold par défaut, fill pour l'état actif ; 24,
  20 et 26.
- **Le mouvement** : 120, 200, 320 et 600 ms et trois courbes ; avec
  « réduire les animations », plus de dandinement, de confettis ni de
  rebond, et les apparitions en fondus de 120 ms.
- **L'haptique** : une sélection légère (onglet, puce, interrupteur), un
  impact moyen (le cœur), « succès » (publication, code validé),
  « avertissement » (ouverture d'une confirmation destructive), « erreur »
  (code faux).
- **L'accessibilité** : contraste AA dans les deux thèmes, 44 pt, le texte
  jusqu'à 200 % (les boutons passent à la ligne dès 130 %, les titres de
  cases s'arrêtent à 130 %, les lignes de liste empilent leur détail), les
  toasts annoncés poliment, 4 s et 6 s avec une action, la boîte de dialogue
  qui garde le focus, jamais une information portée par la couleur seule,
  les pseudos lus lettre à lettre.
- **Les composants** : 63, en sept familles (§5).

## 2. Ce que le code dit

Relevé le 28 octobre 2026 sur `76bc053`, dans les 65 fichiers `.tsx` de
`apps/mobile/app` et `apps/mobile/src`, tests exclus.

- **Aucun thème.** 676 `style={` en ligne et 6 `StyleSheet.create` ; 349
  couleurs hexadécimales pour 12 valeurs, dont `#0a0a0a` 185 fois,
  `#ffffff` 67, `#fbbf24` 37, `#fbf3de` 29 et `#e63946` 20 ; 49 `rgba(`.
  Les seules constantes partagées sont `primitives/shadow.ts`, dans 28
  fichiers, et `primitives/ink.ts`.
- **NativeWind est branché, jamais employé** : `jsxImportSource:
  'nativewind'` et `nativewind/babel` dans `babel.config.js`,
  `withNativeWind` dans `metro.config.js`, `src/styles/global.css` importé
  par `app/_layout.tsx`, et aucun `className`.
- **Les polices** se chargent au lancement par `useFonts`
  (`src/lib/fonts.ts`) : Fredoka 400 à 700 et Bungee
  d'`@expo-google-fonts`, Extenda de `packages/brand`. Une police de plus ne
  demande donc aucune build native. Bungee porte 71 styles dans 36 fichiers,
  Extenda 30, Fredoka 9.
- **La taille de texte** est plafonnée par
  `src/components/bento/font-scaling.ts` (chantiers 7 et 11) : 1,4 pour la
  lecture, 1,2 pour les contrôles, les titres en Extenda et les cases. 198
  textes posent `allowFontScaling={false}` et appliquent eux-mêmes la taille
  plafonnée (`scaledType`), 56 passent `maxFontSizeMultiplier` : React
  Native 0.86 ne plafonne pas `lineHeight` sur Android, et Android 14
  grossit le texte selon une courbe, mesuré au chantier 7.
  `font-scaling.test.ts` vérifie que chaque texte porte un plafond.
- **Aucune bibliothèque d'icônes** : `@expo/vector-icons` est déclaré et
  jamais importé ; six icônes dessinées à la main dans `TabIcons.tsx`,
  quelques SVG en ligne, et des caractères Unicode (‹, ✕, ›, ↗, ✓, ★).
  `react-native-svg` 15.15.4 est installé.
- **Les ombres** : `stampShadow` pose une ombre franche sur iOS
  (`shadowRadius: 0`), mais `elevation` sur Android, donc une ombre floue,
  ce que le design exclut.
- **Le mouvement** : rien ne lit le réglage « réduire les animations ».
  `react-native-reanimated` 4.5.1 et `expo-haptics` sont installés ;
  `src/lib/haptics.ts` sert 4 fichiers.
- **L'accessibilité** : `accessibilite.test.ts` exige de chaque `Pressable`
  (73) un rôle, un libellé et un état désactivé, et un libellé à chaque
  `TextInput` (13) ; `src/lib/a11y-states.ts` porte les états en français
  sur iOS (D18 du 29). 19 confirmations passent par `Alert.alert`.

## 3. Le socle ne se voit pas (D5)

- Le 30 **ajoute sans rien changer** : aucun écran n'emploie le système à
  sa fin. Les écrans changent au 31 (la coque et les moments de marque),
  puis aux 32 à 34, chacun passant ses écrans au système et retirant ce
  qu'il remplace.
- **La seule chose retirée est NativeWind** (D4), sans effet attendu à
  l'écran puisqu'aucun `className` n'existe : prouvé au pixel, avant et
  après, sur les écrans de référence (§9).
- Le système vit dans **`apps/mobile/src/design/`** : `tokens.ts` et
  `icons.ts` générés, `theme.tsx`, `type.ts`, `Text.tsx`, `Icon.tsx`,
  `PopShadow.tsx`, `motion.ts`, `useMotion.ts` et `useAnnouncement.ts` ; les
  composants rangés par famille, comme les pages du catalogue :
  `structure/`, `actions/`, `brand/`, `inputs/` pour les listes et la
  saisie, et `overlays/` pour les calques et les retours.
  `src/components/primitives/` (`StampButton`, `Toast`, `YellowBg`,
  `Sticker`…) et Bungee restent tant qu'un écran les emploie ; le chantier
  qui refait le dernier les retire (D13).
- `packages/brand` ne bouge pas : la landing, le back-office et le quiz
  emploient ses tokens.

## 4. Les fondations

### 4.1 Les tokens et le thème (D4, D6, D16)

- `apps/mobile/scripts/design-tokens.ts` lit
  `docs/design-v2/design-system/tokens.json` et écrit
  `src/design/tokens.ts` : les deux palettes résolues (chaque sémantique
  remplacée par sa valeur claire ou sombre), les 22 styles de texte en
  nombres, les espaces, les rayons, les ombres, les contours et les tailles.
  Le fichier généré le dit en tête ; un test régénère en mémoire et compare,
  pour qu'aucune retouche à la main ne s'y glisse.
- `useTheme()` rend `{ scheme, colors, type, space, radius, border, size,
  shadow }`. Un `ThemeProvider` à la racine fournit le clair ; le sombre est
  dans `tokens.ts`, choisi nulle part (D3 de la refonte) ; `userInterfaceStyle`
  reste `light` dans `app.json`.
- **Un test de contraste** calcule les rapports des couples que le design
  nomme (chaque texte sur chaque fond, les teintes `-700` sous du blanc, les
  `-300` sous `nori-900`, `on-accent` sur `accent`…) : 4,5:1 pour le texte,
  3:1 pour les icônes, les contours de contrôles et l'anneau de focus, dans
  les deux thèmes.

### 4.2 Les polices (D7)

- **Fredoka 500, 600 et 700** viennent déjà d'`@expo-google-fonts/fredoka`.
  **Fredoka SemiCondensed Bold** est copiée de
  `docs/design-v2/design-system/fonts/FredokaSemiCondensed-Bold.ttf` dans
  `apps/mobile/assets/fonts/`, avec sa licence OFL, et chargée par
  `useFonts`. **Extenda** reste celle de `packages/brand`, identique à celle
  du dossier.
- Une famille par graisse (`Fredoka-Medium`, `Fredoka-SemiBold`,
  `FredokaSemiCondensed-Bold`) : Android ne choisit pas une graisse dans une
  famille chargée à la main.
- La hauteur de ligne naturelle de Fredoka SemiCondensed s'ajoute à
  `NATURAL_LINE_EM`, relevée dans sa table `hhea`, pour que la boîte d'un
  texte soit la même sur iOS et Android (chantier 7).
- **La licence d'Extenda pour une app mobile** reste à vérifier par Clément
  (tâche 12 ter). Elle ne bloque pas le 30 : la 1.1 l'embarque déjà pour ses
  titres.

### 4.3 La taille de texte (D1, D8)

Trois catégories, chacune avec son plafond, posées dans
`src/design/type.ts` :

| Catégorie | Styles | Plafond | Au-delà de 130 % |
| --- | --- | --- | --- |
| Lecture | `body-l`, `body`, `body-strong`, `subhead`, `subhead-strong`, `footnote`, `caption`, `title-1` à `title-3`, `eyebrow` | 200 % | le texte passe à la ligne ; une ligne de liste empile son détail sous son titre |
| Action | `label-l`, `label-m`, `label-s` | 200 % | le bouton passe à la ligne et grandit en hauteur, jamais sous 52, 44 ou 32 |
| Fixe | `tile-*`, `display-*`, `tab-label` | 130 % | rien : la hauteur est décidée par la grille, la barre ou le moment de marque |

- La catégorie *Fixe* étend la règle des cases aux deux autres textes posés
  dans une hauteur qu'ils ne décident pas : les titres en Extenda, qui
  coûtaient déjà une ligne par point au chantier 11 (« COMPOS / E »), et
  les libellés de la barre d'onglets, haute de 56.
- **Le mécanisme reste celui du chantier 7** : `allowFontScaling={false}`
  et la taille appliquée par le texte lui-même, par `scaledType`, sur les
  deux plateformes. `maxFontSizeMultiplier` seul laisserait Android agrandir
  les hauteurs de ligne.
- **Un seul composant `Text`** dans le système : `<Text variant="body">`.
  Il pose la famille, la taille, la hauteur de ligne, l'approche, la casse
  et le plafond de son style ; le reste du système n'écrit aucune taille de
  police.
- Les écrans actuels gardent leurs plafonds de 1,4 et 1,2 jusqu'à ce que
  leur chantier les refasse et les recette à 200 %.
- Le test des plafonds s'étend à `src/design/` : chaque texte y passe par
  `Text`, et `Text` tire chaque plafond de `type.ts`.

### 4.4 Les icônes (D3)

- `apps/mobile/scripts/design-icons.ts` (`pnpm design:icons`) lit les 72
  icônes de `docs/design-v2/design-system/icones/`, en bold et en fill, et
  écrit `src/design/icons.ts` : le nom Phosphor et ses deux tracés, 57 Ko. La
  graisse regular, que le design n'emploie pas, n'y entre pas ; un SVG qui
  ne serait pas un seul tracé de 256 en `currentColor` est refusé.
- `<Icon name="heart" weight="fill" size={24} color="like" />` dessine le
  tracé dans un `Svg` de 256 de côté, à `size-icon` (24) par défaut.
  Décorative par défaut, cachée aux lecteurs d'écran ; c'est le bouton qui la
  porte qui a un libellé (`IconButton label`). Avec `label`, que le design
  prévoit quand l'icône porte seule un sens, elle devient une image nommée.
- Une icône de plus : son SVG Phosphor ajouté au dossier, le script
  relancé. Un test vérifie qu'`icons.ts` est à jour ; un nom inconnu est
  arrêté au typage, `Icon` n'acceptant qu'un `IconName`.

### 4.5 Les ombres (D9)

- Les ombres franches passent par **un calque décalé derrière l'objet**,
  `PopShadow`, comme le dossier le demande (`LISEZMOI.md`) : un calque de la
  couleur de l'ombre et de la forme de l'objet, placé par la mise en page, qui
  déborde de son décalage sans prendre de place. L'objet est son enfant
  unique, opaque.
- `boxShadow`, prévu d'abord, est écarté au lot 2 (D9) : React Native 0.86 ne
  le dessine sur Android qu'à partir de la 9 (API 28,
  `MIN_OUTSET_BOX_SHADOW_SDK_VERSION`), quand l'app accepte la 7 (API 24, le
  `minSdk` de React Native). Le calque se dessine partout pareil, et le
  bouton principal s'enfoncera dans son ombre en glissant sa face sur le
  calque (lot 3).
- `stampShadow` reste aux écrans actuels, jusqu'à leur chantier.

### 4.6 Le mouvement et l'haptique (D10, D11)

- `src/design/motion.ts` porte les quatre durées et les trois courbes du
  dossier, et `motionFor()`, le mouvement réduit ou non : réduit, les
  changements d'état qui déplacent sont immédiats, les apparitions et les
  départs deviennent des fondus de 120 ms, ni dandinement, ni confettis, ni
  pulsation, ni rebond, et le `Spinner` ralentit au tiers ; les couleurs et
  les opacités gardent leur durée. Sans `react-native`, il se teste sous
  `node:test`.
- `useMotion()` (`useMotion.ts`) suit le réglage du système **en direct**, par
  `AccessibilityInfo`, une seule écoute pour l'app : `useReducedMotion` de
  Reanimated ne le lit qu'au lancement. `timingConfig()` donne la
  configuration de `withTiming` d'une animation du système, les courbes en
  `Easing.bezier`, et dit à Reanimated de ne pas réappliquer le réglage.
- `src/lib/haptics.ts` reçoit les cinq retours du design :
  `selectionFeedback` (sélection légère), `likeFeedback` (impact moyen),
  `successFeedback`, `warningFeedback`, `errorFeedback`. Les écrans les
  adoptent avec leur chantier ; la D17 du 29, qui décrit l'haptique actuelle,
  se met à jour à chacun.

## 5. Les 39 composants (D2)

Chacun est reconstruit d'après son `README.md`, son `apercu.png`, ses props
dans `components/index.d.ts` et les mesures de `code-source/src/bundle.css`,
sur les tokens et le `Text` du système. Chacun a un rôle, un libellé et un
état pour les lecteurs d'écran, une zone tactile de 44 au moins, et tient à
200 %.

| Famille | Composants | Ce qu'ils remplaceront |
| --- | --- | --- |
| Structure (6) | `Screen`, `TopBar`, `TabBar`, `Tabs`, `Steps`, `SectionHeader` | `YellowBg`, `PageTitle`, `SectionTitle`, `Pagination`, la barre de `tab-bar.ts` (au 31) |
| Actions (3) | `Button` (huit variantes, trois tailles), `IconButton`, `Chip` | `StampButton`, `TopChip`, les boutons écrits dans chaque écran |
| Listes et saisie (9) | `List`, `ListRow`, `Switch`, `Checkbox`, `RadioRow`, `TextField`, `SearchField`, `CodeField`, `Rule` | `SettingSwitch`, les 13 `TextInput` nus |
| Calques et retours (14) | `Sheet`, `SheetFooter`, `AskSheet`, `ActionSheet`, `Dialog`, `Toast`, `Banner`, `InAppNotice`, `EmptyState`, `PromptCard`, `Confetti`, `Spinner`, `Skeleton`, `Badge` | `Toast` (au 31), `social/ActionSheet`, `UpdateBanner` et `OfflineBanner`, les confirmations par `Alert.alert` |
| Marque (7) | `Popy`, `Avatar`, `Logo`, `AppIcon`, `Sticker`, `Display`, `Icon` | `Sticker`, les Popys posées à la main |

- **Hors du socle**, construits par leur chantier contre leurs vrais
  écrans : le bento au 32 (`Bento`, `BentoTile`, `Tag`, `Progress`,
  `Thumb`, `ItemCard`, `ItemGrid`, `ProposeRow`, `ShareCard`), le social au
  33 (`Post`, `PostHeader`, `ActionBar`, `ProfileHeader`, `StatusPill`,
  `Achievements`, `Achievement`, `WhyEntry`, `WhyField`, `Comment`,
  `CommentComposer`, `AccountRow`) et au 34 (`NotificationRow`,
  `Medallion`, `PopyPick`).
- **`Dialog`** est une boîte d'alerte qui garde le focus de VoiceOver et de
  TalkBack ; l'action qui engage vient en premier, « Annuler » en dernier.
  Le sort des alertes du système qu'elle remplace se décide au 34.
- **`Toast`** : en bas, annoncé poliment, 4 s, 6 s avec une action, effacé
  au toucher ; branché seulement au 31.
- **`Confetti`** : 600 ms, une fois par événement, rien avec le mouvement
  réduit (D20).
- **`Display`** ne coupe jamais un mot : quand le plus long dépasse sa
  largeur, toute l'affiche rapetisse juste assez (D24).
- **Les feuilles et `Dialog`** se posent dans une `Modal`, qui couvre la
  barre d'onglets et garde le focus ; `Toast` et `InAppNotice` se posent
  dans leur parent (D22).
- **`Avatar`** et **`Popy`** emploient les Popys de
  `packages/brand/assets/mascot/`, dont l'original de `popy-diable.png`
  (1000 × 1000), et non la découpe provisoire du dossier (D15).
- **`AppIcon`** ne fait que dessiner l'icône dans l'app ; l'icône du système
  et la petite icône Android des notifications changent au 31, avec la build
  de la 2.0.0.

## 6. Le catalogue (D12)

- Une route `app/dev/catalogue.tsx`, ouverte par le lien profond
  `bentopop://dev/catalogue`, seulement en développement (`__DEV__`) : en
  build de production, elle renvoie à l'accueil, éprouvé au lot 5 sur des
  builds Release locales. Aucun écran n'y mène, pour
  que les écrans restent identiques au pixel (D5).
- Une page par famille ; chaque composant dans les états de son aperçu
  (variantes, désactivé, chargement, erreur), sous le nom de son
  `apercu.png`. La première, posée au lot 2, montre les fondations : les 72
  icônes dans leurs deux graisses, les trois ombres, le mouvement et
  l'haptique. Au lot 3, `bentopop://dev/catalogue` mène aux pages
  `fondations`, `structure`, `actions` et `marque` ; `?only=Button` n'y montre
  qu'un composant, en haut, pour le capturer d'un seul écran. Le garde-fou
  de la production est dans `app/dev/_layout.tsx`. Le lot 4 y ajoute
  `saisie` et `calques`, dans l'ordre du README. Les calques s'y posent dans
  le cadre de leur aperçu, sans `Modal` (`inline`, aux marges d'écran du
  design, 62 et 34), et un bouton sous chacun l'ouvre pour de vrai.
- Les chantiers 31 à 34 y ajoutent les leurs et s'en servent pour leurs
  recettes.

## 7. Ce que le 30 ne fait pas

- Aucun écran refait, aucune barre d'onglets ni aucun toast déplacé : 31 à
  34.
- Pas de thème sombre (D3 de la refonte).
- Pas d'icône d'app : 31.
- Pas de composant du bento ni du social : 32 à 34.
- Bungee et les primitives actuelles restent (D13).

## 8. Tests

Sous `node:test`, comme les tests existants :

- les générateurs : `tokens.ts` et `icons.ts` identiques à ce que donnent
  `tokens.json` et les SVG ;
- les contrastes des couples nommés, dans les deux thèmes (D16) ;
- les plafonds par catégorie, et `scaledType` à 100, 130 et 200 % ;
- les règles de `accessibilite.test.ts` et de `font-scaling.test.ts`,
  étendues à `src/design/` ;
- les durées et les courbes du mouvement, comparées à celles de
  `bundle.css`, et ses variantes réduites ;
- tous les tests actuels, inchangés : aucun écran ne bouge.

## 9. Recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur une
build de développement et une pile Supabase locale :

1. **Avant tout changement**, les écrans de référence capturés : l'accueil,
   le composer, La table, Trouver, Notifs, le profil, les réglages, la page
   d'un compte, la feuille de recherche. Puis, NativeWind retiré et le socle
   posé, les mêmes écrans comparés au pixel : identiques (D5).
2. **Le catalogue** : chaque composant comparé à son `apercu.png`. Les
   aperçus sont rendus avec Inter à la place de la police du système (D14) :
   la comparaison tolère l'écart de métrique du texte courant, pas celui
   d'une couleur, d'un rayon, d'une ombre ou d'un espace.
3. **La taille de texte** : le catalogue à 100 %, 130 % et 200 %, sur iOS
   et sur Android (`font_scale` 1,0, 1,3 et 2,0) ; aucun texte coupé, les
   boutons à la ligne dès 130 %, les cases, les titres en Extenda et les
   libellés d'onglets arrêtés à 130 %.
4. **Les lecteurs d'écran** : rôles, libellés et états lus dans l'arbre
   d'accessibilité, en français ; `Dialog` garde le focus.
5. **Le mouvement réduit** allumé : ni rebond, ni confettis, des fondus.
6. **Les ombres** au pixel sur l'émulateur : franches, sans flou.

## 10. Les lots

| Lot | Contenu | Fait quand |
| --- | --- | --- |
| 1 | Les tokens et `useTheme`, les polices, `Text` et ses plafonds ; NativeWind retiré | tests verts ; les écrans de référence identiques au pixel |
| 2 | Les icônes, les ombres, le mouvement, l'haptique | `Icon` dessine les 72 ; l'ombre franche mesurée sur l'émulateur |
| 3 | Structure, actions et marque (16 composants), et le catalogue | chaque composant identique à son aperçu, à 100, 130 et 200 % |
| 4 | Listes et saisie, calques et retours (23 composants, dont `Badge` et `Spinner`, faits au lot 3) | idem ; `Dialog` garde le focus |
| 5 | La recette complète (§9), la roadmap et la part du 29 | la DoD |

### 10.1 Lot 1 · fait le 28 octobre 2026

- **Les tokens** : `scripts/design-tokens.ts` (`pnpm design:tokens`) écrit
  `src/design/tokens.ts`, 57 couleurs sémantiques par thème, 48 primitives,
  22 styles de texte, les mesures et les ombres ; `tokens.test.ts` le compare
  au caractère près à ce que le dossier donne. Une couleur retouchée à la main
  le fait tomber, essayé. Prettier l'ignore, comme les types générés de
  Supabase.
- **Le thème** : `ThemeProvider` monté à la racine, `useTheme()` ; le clair
  seul.
- **Les contrastes** (D16) : les 37 couples que nomment les notes d'usage, 30
  de texte et 7 de contours, de focus et de coche, plus les teintes du
  garde-manger, tous au-dessus du seuil dans les deux thèmes. Le plus bas :
  `text-tertiary` sur `bg-sunken`, 4,67:1 en clair.
- **Les polices** : Fredoka SemiCondensed Bold et sa licence OFL dans
  `apps/mobile/assets/fonts/`, chargée par `useFonts` ; sa hauteur de ligne
  naturelle est celle de Fredoka, 1,21 em (`hhea` 974 / −236 / 0).
- **La taille de texte** : `type.ts` range les 22 styles en trois catégories,
  avec les plafonds `READING_`, `ACTION_` et `FIXED_MAX_FONT_MULTIPLIER` (2,
  2 et 1,3) posés dans `font-scaling.ts` ; `Text` les applique lui-même.
  `font-scaling.test.ts` reconnaît le texte du système et vérifie qu'il est le
  seul de `src/design/`.
- **NativeWind retiré** : Babel, Metro, le CSS global, la configuration de
  Tailwind, ses déclarations et trois dépendances ; 21 modules de moins dans
  le bundle iOS. Il avait coûté au chantier 11 un bouton inerte : sous son
  runtime, le style d'un `Pressable` écrit en fonction n'était pas appliqué.
  Aucun ne restait dans l'app, et cette forme remarche.
- **Les écrans de référence identiques** (D5) : neuf écrans, relancés à froid,
  capturés avant et après, au simulateur iPhone 17 Pro et à l'émulateur
  Pixel 8. Seize sur dix-huit identiques au pixel, hors bruit mesuré à l'avance
  (une photo de case, le clavier de la feuille de recherche) ; les deux autres
  ne diffèrent que par des données, « 2 visites » devenu « 3 visites » sur la
  page d'un compte que chaque série ouvre, et « il y a 5 h » devenu
  « il y a 6 h ».

### 10.2 Lot 2 · fait le 29 octobre 2026

- **Les icônes** : `scripts/design-icons.ts` (`pnpm design:icons`) écrit
  `src/design/icons.ts`, les 72 icônes en bold et en fill, 57 Ko ;
  `icons.test.ts` le compare au caractère près aux SVG du dossier. `Icon` les
  dessine dans un carré de 256, décorative par défaut, nommée avec `label`.
- **Comparées à leurs SVG** : les 144 dessins capturés au simulateur
  iPhone 17 Pro et à l'émulateur Pixel 8, chacun recadré par son cadre
  d'accessibilité, comparés à l'original rendu par Chrome : IoU moyen 0,989
  sur les deux appareils, et chaque dessin plus proche de son SVG que de celui
  de toute autre icône, même pour les paires voisines (`info` et
  `warning-circle`, `user-plus` et `user-minus`). Les plus bas, de 0,89 à
  0,93, sont des bords droits posés à un demi-pixel, que le seuil fait
  basculer : l'écart moyen de couverture reste sous 2 % pour les 144. Sans
  `label`, l'icône n'est pas un élément d'accessibilité : absente de l'arbre
  d'iOS, ni focalisable ni retenue parmi les vues utiles sur Android.
- **Les ombres** (D9) : `PopShadow`, un calque décalé. Mesurées au pixel, une
  bande d'encre exacte de 6, 9 et 15 pixels à l'iPhone (2, 3 et 5 points), de
  5, 8 et 13 au Pixel 8 (2,625 pixels par point, arrondis par la mise en
  page), à droite comme dessous, sans aucun pixel intermédiaire au bord :
  aucun flou. Avec un contour d'encre de 2, le seul pixel intermédiaire, sur
  Android, est le bord intérieur du contour (5,25 pixels), pas l'ombre.
- **Le mouvement** (D10) : `motion.ts` et `useMotion()`. Le réglage suit en
  direct sur les deux appareils, dans les deux sens, l'app restée ouverte
  (« Réduire les animations » sur iOS, « Supprimer les animations » sur
  Android). Filmée au Pixel, l'apparition d'une case de 168 pixels passe par
  122, 136 et 172 avant de se poser, de translucide à opaque : le pop et son
  rebond ; réduite, la case garde ses 168 pixels et ne fait que passer de
  translucide à opaque.
- **L'haptique** (D11) : les cinq retours, appelés depuis le catalogue sans
  erreur. Ni le simulateur ni l'émulateur n'ont de moteur : ils se sentiront
  à la recette sur appareil (29).
- **Le catalogue** (D12) : `app/dev/catalogue.tsx`, ouvert par
  `bentopop://dev/catalogue`, sa page des fondations. Son renvoi à l'accueil
  en production n'est pas encore éprouvé, faute de build de production ; il
  l'est au lot 5.
- **Les écrans actuels ne changent pas** (D5) : le lot ajoute des fichiers et
  cinq fonctions à `haptics.ts`, sans toucher au code d'un écran.

### 10.3 Lot 3 · fait le 29 octobre 2026

- **Les 15 composants** de la structure, des actions et de la marque, `Icon`
  étant du lot 2 : `Screen`, `TopBar`, `TabBar`, `Tabs`, `Steps`,
  `SectionHeader` ; `Button`, `IconButton`, `Chip` ; `Popy`, `Avatar`, `Logo`,
  `AppIcon`, `Sticker`, `Display`. Avec eux `BrandGround`, le jaune à pois des
  moments de marque, et deux composants de la famille des calques dont ils
  ont besoin, `Badge` et `Spinner`. `Text` prend une graisse d'état
  (`weight`), et `ThemeProvider` un thème par sous-arbre, pour le sombre du
  catalogue.
- **Identiques à leurs aperçus**, à 100 %, au simulateur iPhone 17 Pro et à
  l'émulateur Pixel 8 : chaque composant capturé seul et posé à côté de son
  `apercu.png`, un point de l'app pour un pixel de l'aperçu. Mesures : 26
  cadres d'accessibilité sur 27 aux dimensions du design (boutons de 52, 44 et
  32, boutons-icônes de 44, puces de 36 et 40, onglets de 56 et 44, logo de
  30 sur 130) ; le 27e, un onglet réparti de 198 au lieu de 199, tient au
  filet du cadre du catalogue. Chaque bouton est à 2 points au plus de la
  largeur de son aperçu, chaque suggestion à 1 : même Fredoka, mêmes marges.
- **Les écarts voulus** : les tailles que le CSS du dossier écrit hors des 22
  styles prennent le plus proche (D17) ; les puces de filtre en sont 6 à 10
  points plus larges. `Display` cerne sa fin de copies d'encre décalées,
  React Native ne traçant pas le contour d'un texte, et la passe à la ligne.
  Le petit bouton tertiaire n'est pas souligné, comme dans l'aperçu de
  `SectionHeader` (D19). Le `diable` est l'original de `packages/brand` (D15).
  `TabBar` n'est branchée sur la navigation qu'au 31.
- **Deux écarts manqués**, relevés au lot 4 : `Popy`, `Avatar` et `AppIcon`
  dessinaient Popy à 81 à 90 % de son aperçu, les originaux de
  `packages/brand` gardant des marges transparentes que les découpes du
  dossier n'ont pas (D21) ; et au Pixel, à 130 % tout juste, boutons, puces,
  onglets et grand titre restaient comme à 100 %, Android donnant 1,3 en
  1,2999999523. Corrigés au lot 4.

### 10.4 Lot 4 · fait le 29 octobre 2026

- **Les 21 composants** des deux dernières familles : `List`, `ListRow`,
  `Switch`, `Checkbox`, `RadioRow`, `TextField`, `SearchField`, `CodeField`,
  `Rule` dans `inputs/` ; `Sheet`, `SheetFooter`, `AskSheet`, `ActionSheet`,
  `Dialog`, `Toast`, `Banner`, `InAppNotice`, `EmptyState`, `PromptCard`,
  `Confetti`, `Skeleton` dans `overlays/`, avec `Badge` et `Spinner` du
  lot 3. Avec eux `useAnnouncement`, qui dit au lecteur d'écran l'erreur
  d'un champ, un toast, une notification ; `reachesWrapScale`, le seuil de
  130 % comparé au centième ; `IconButton` prend une taille d'icône et une
  couleur, pour l'effacement d'une recherche. Le catalogue gagne les pages
  `saisie` et `calques`.
- **Identiques à leurs aperçus**, à 100 %, au simulateur iPhone 17 Pro et à
  l'émulateur Pixel 8 : 33 cadres d'accessibilité sur 33 aux mesures du CSS
  (lignes de 52, interrupteurs de 52 sur 32, champs de 50 dans un cadre de
  53, recherche de 42 dans 46, code de 370 sur 60, options de 56, boutons de
  dialogue de 296 sur 44, pastille de 14). Les écarts voulus : la puce de
  catégorie et la ligne de proposition de l'aperçu de `Sheet`, qui arrivent
  au 32 ; les chiffres du code et le titre de `Dialog` en `title-2` (D17) ;
  les confettis de l'aperçu d'`AskSheet`, saisis en pleine chute.
- **Ouverts pour de vrai**, sur les deux appareils : chaque feuille et la
  boîte de dialogue dans sa `Modal` (D22), dont l'arbre d'accessibilité ne
  garde plus qu'elle. La feuille se ferme à la croix, au voile, à la poignée
  tirée et au retour d'Android ; la boîte de dialogue à un bouton ou au
  retour, jamais au voile ; une option du menu le ferme avant d'agir ; le
  toast part de lui-même au bout de 6 s, la notification au glissé vers le
  haut. Au Pixel, le clavier soulève la feuille, son pied posé sur lui.
- **Le mouvement réduit**, filmé au Pixel : la feuille monte de sa hauteur
  en temps normal, et paraît sinon d'un coup à sa place, translucide puis
  opaque ; les confettis tombent puis s'effacent, ou ne paraissent dans
  aucune image ; le squelette pulse, ou reste fixe.
- **Les rôles**, lus par un compagnon `idb` neuf à chaque relevé (le sien
  garde le rôle des vues recyclées) : la case à cocher se dit bouton
  « coché » ou « non coché », le choix unique bouton sélectionné, la ligne à
  interrupteur interrupteur avec sa description en indication, l'attente
  « en cours », chaque champ son libellé, son aide et son erreur.
- **Cinq défauts trouvés et corrigés** : Popy trop petite depuis le lot 3
  (D21) ; au Pixel, le champ caché du code montrait le code sur la première
  case, Android lisant `transparent` comme une couleur absente ; la poignée
  d'une feuille et la notification ne recevaient jamais le glissé, React
  Native 0.86 ne le proposant qu'à qui a pris le toucher au contact ; le pied
  d'une feuille se faisait rogner quand la place manquait ; le seuil de
  130 %, manqué au Pixel.
- **À 130 et 200 %**, sur les deux appareils (iPhone en plus grande taille
  standard puis au-delà de 200 %, Pixel à 1,3 puis 2,0) : boutons et puces
  passent à la ligne, onglets, cases, titres d'affiche et pastilles s'arrêtent
  à 130 %. Trois défauts trouvés et corrigés (D18) : les `Tabs` coupaient
  « Abonnements » en son milieu, une longue suggestion finissait en points de
  suspension, et sur Android le grand titre serré contre sa pilule coupait
  « neuf » en deux.
- Aucun avertissement de React Native dans la console de l'app, relue par son
  débogueur après les trois pages.

### 10.5 Lot 5 · fait le 30 octobre 2026

La recette complète du §9, aux trois appareils qu'elle nomme : le simulateur
iPhone 17 Pro, le simulateur iPhone SE, que les lots 3 et 4 n'avaient pas
couvert, et l'émulateur Pixel 8.

- **Le socle ne se voit toujours pas** (D5) : les neuf écrans de référence,
  aux trois appareils, capturés sur la base d'avant le 30 (`76bc053`, la tête
  de la PR #109, copiée hors du dépôt avec ses dépendances, NativeWind compris)
  puis sur la tête du lot 4, Metro servant tour à tour l'une et l'autre, chaque
  app relancée à froid. Deux séries de la tête mesurent ce qui bouge seul. Les
  27 écrans sont identiques au pixel, hors ce bruit : le curseur qui clignote
  dans la recherche, une touche du clavier d'Android, le compteur de visites
  d'une page. Deux écarts venaient de la première série de la base elle-même,
  l'avatar et le dégradé d'une publication au Pixel, deux pixels d'un niveau au
  profil de l'iPhone : une seconde série les donne identiques à la tête, à
  2 pixels près. Les corrections du lot 5 ne touchent que des composants
  qu'aucun écran ne rend, le catalogue et des tests : la preuve vaut pour sa
  tête, seule la racine de l'app important le design system, pour son
  `ThemeProvider`.
- **L'iPhone SE**, 375 points de large : les 38 composants à texte capturés
  seuls à 100 %, à la plus grande taille standard (135 %) et au-delà de 200 %.
  Deux mots coupés en deux, corrigés :
  - `Display` coupait « COMPOSE » dès 130 %, son mot le plus long ne tenant
    plus dans 295 points ; l'affiche rapetisse désormais juste assez pour
    qu'il tienne, 4 % au SE, rien à 100 % ni sur un écran plus large (D24) ;
  - `InAppNotice` coupait « Proposition » au-delà de 200 %, à côté de
    l'heure ; l'heure passe sous le titre dès 130 % (D18).

  Et un oubli du lot 4, au catalogue seulement : le cadre d'`ActionSheet`
  cachait « Annuler » sous la marge du bas de la feuille, que l'aperçu montre
  coupé à son bord ; le cadre passe de 340 à 400 points. Ce qui défile au-delà
  de 200 % est voulu (D18) : les puces et les onglets.
- **Les lecteurs d'écran, en français** : les arbres d'accessibilité des 38
  composants relus aux deux plateformes. Sur iOS, un seul mot anglais :
  l'action `activate` de la notification, que la nouvelle architecture de
  React Native offre telle quelle à VoiceOver ; libellée « Ouvrir ». Une règle
  de `accessibilite.test.ts` exige désormais un libellé à chaque action, et la
  faisait tomber avant la correction. Sur Android, tout est en français : le
  « busy » que montre l'émulateur, réglé en anglais, devient « opération en
  cours » quand l'app passe en français, React Native embarquant ses
  traductions pour Android.
- **Le clavier à l'écran de l'iPhone sous une feuille**, suivi du lot 4 : le
  clavier matériel du simulateur débranché par CoreSimulator
  (`apps/mobile/scripts/clavier-simulateur.swift`, cf. `RECETTE-MOBILE.md`),
  la feuille « Tes pourquoi » ouverte pour de vrai à l'iPhone SE, son champ
  touché : la feuille monte avec le clavier, son pied « Enregistrer » posé sur
  lui, le champ visible.
- **Le catalogue en production** (D12), suivi du lot 2 : une build Release
  d'iOS pour le simulateur et un APK release d'Android, construits sur ce Mac
  comme EAS le ferait, branchés sur la pile locale et jamais sur la production
  (la cible compilée ne porte que `127.0.0.1:54391`). Depuis les réglages,
  ouverts par leur lien, `bentopop://dev/catalogue` et ses pages ramènent à
  l'accueil, à l'iPhone SE comme au Pixel 8 ; aucune erreur JavaScript au
  journal d'Android.
- **La part du 29** : deux points de plus à sa liste de sortie, 30-a (le
  catalogue fermé en production) et 30-b (le mouvement réduit suivi en direct,
  sur un écran refait) ; les cinq retours du design versés à 3-a ; la boîte de
  dialogue, la feuille, la notification et le toast à 11-a, à la voix.
- **La console** : aucun avertissement des composants. Au Pixel, animations du
  système coupées, LogBox montre celui de Reanimated, réservé au
  développement, et deux fois sur une trentaine de lancements une erreur
  d'expo-router, née à sa racine, pas reproduite ensuite (§13).
- **La CI rejouée en local** sur l'arbre du lot 5, sans cache : verte, lint
  et typage 8 sur 8, tests (mobile 1 127, landing 202, back-office 251),
  builds 3 sur 3, e2e 65 sur 65.

## 11. Definition of Done

| # | Point | État |
| --- | --- | --- |
| 1 | `tokens.ts` généré depuis `tokens.json`, gardé par un test | ✅ lot 1 |
| 2 | `useTheme()` : le clair actif, le sombre présent et éteint | ✅ lot 1 |
| 3 | Les contrastes AA des couples nommés, dans les deux thèmes, prouvés par un test | ✅ lot 1 |
| 4 | Fredoka SemiCondensed chargée ; une famille par graisse | ✅ lot 1 |
| 5 | `Text` et ses trois plafonds (D1, D8) | ✅ lot 1 ; à 200 % au catalogue, lot 3 |
| 6 | Les 72 icônes générées, et `Icon` | ✅ lot 2 |
| 7 | Les ombres franches identiques sur iOS et Android | ✅ lot 2 |
| 8 | Le mouvement et sa variante réduite ; les cinq retours haptiques | ✅ lot 2 ; l'haptique ressentie à la recette sur appareil (29) |
| 9 | Les 39 composants identiques à leur aperçu au simulateur et à l'émulateur, à 100, 130 et 200 % | ✅ lot 4 : les 39, les écarts voulus aux §10.3 et 10.4 ; Popy et le seuil de 130 % du Pixel corrigés au lot 4 ; à l'iPhone SE au lot 5, deux mots coupés corrigés (D24, D18) |
| 10 | Les tests de règles verts sur `src/design/` | ✅ lot 4, la règle des textes étendue aux trois champs ; au lot 5, un libellé exigé de chaque action d'accessibilité |
| 11 | NativeWind retiré, les écrans de référence identiques au pixel | ✅ lot 1 ; refait au lot 5 sur la tête du 30, aux trois appareils |
| 12 | La CI rejouée en local, verte | ✅ à chaque lot, du 1 au 5 |

## 12. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Le texte suit la taille du système jusqu'à **200 %** | Rendue par Clément en QCM, l'option recommandée. Le design le demande, et c'est le seuil du critère 1.4.4 des WCAG. Les écrans refaits (31 à 34) se recettent à 200 % ; les plafonds de 1,4 et 1,2 du chantier 11 restent aux écrans actuels jusqu'à leur tour |
| **D2** | Le socle construit les **39 composants transverses** | Rendue par Clément en QCM, l'option recommandée. Les 9 du bento et les 15 du social se construisent mieux contre leurs vrais écrans et leurs vraies données, aux 32, 33 et 34 ; le 30 reste un L |
| **D3** | Les icônes sont **les 72 du dossier**, dans un composant maison | Rendue par Clément en QCM, l'option recommandée, plutôt que `phosphor-react-native` (1 500 icônes, 23,5 Mo installés) que proposait la roadmap : 52 Ko de tracés, aucune dépendance, `react-native-svg` déjà là |
| **D4** | Les tokens se lisent par **`useTheme()`** ; **NativeWind est retiré** | Rendue par Clément en QCM, l'option recommandée. Le hook prépare le sombre sans réécrire les écrans ; NativeWind transformait chaque fichier sans qu'aucun `className` n'existe |
| **D5** | Le socle ne change aucun écran | Les 31 à 34 refont les écrans, chacun recetté ; un socle visible mélangerait deux designs dans l'app jusqu'à leur fin |
| **D6** | `tokens.ts` est généré depuis `tokens.json`, jamais écrit à la main ; `packages/brand` ne bouge pas | Le dossier fait foi, et un test arrête toute dérive. La landing, le back-office et le quiz emploient les tokens de `packages/brand` |
| **D7** | Fredoka SemiCondensed entre dans `apps/mobile/assets/fonts/`, chargée au lancement ; une famille par graisse | Aucune build native ; Android ne choisit pas une graisse dans une famille chargée à la main |
| **D8** | Trois catégories de texte : lecture et action jusqu'à 200 %, fixe à 130 % ; le mécanisme du chantier 7 garde la main | Les cases, les titres en Extenda et la barre d'onglets ont une hauteur qu'ils ne décident pas ; React Native 0.86 ne plafonne pas `lineHeight` sur Android |
| **D9** | Les ombres franches par **un calque décalé derrière l'objet** (`PopShadow`) ; `boxShadow`, prévu d'abord, écarté au lot 2 | Le design exclut le flou, qu'`elevation` impose sur Android. React Native 0.86 ne dessine `boxShadow` sur Android qu'à partir de l'API 28, quand l'app accepte l'API 24 ; le calque, que le dossier propose, se dessine partout pareil, mesuré au pixel |
| **D10** | Le mouvement suit le réglage du système **en direct**, par `AccessibilityInfo` ; ses animations passent par Reanimated | Rien ne le lisait ; le design le demande. `useReducedMotion` de Reanimated ne le lit qu'au lancement |
| **D11** | Les cinq retours haptiques du design entrent dans `haptics.ts` ; les écrans les adoptent avec leur chantier | Changer l'haptique des écrans actuels se sentirait ; la D17 du 29 suivra |
| **D12** | Un catalogue réservé au développement, ouvert par un lien profond | Comparer chaque composant à son aperçu sans toucher aux écrans ; rien n'en sort en production |
| **D13** | Bungee et les primitives actuelles restent jusqu'au chantier qui refait leur dernier écran, qui les retire | Les retirer au 30 casserait les écrans pas encore refaits |
| **D14** | Les aperçus se comparent en tolérant l'écart de métrique de la police du système | Ils sont rendus avec Inter ; l'app emploie SF Pro et Roboto |
| **D15** | `Avatar` et `Popy` emploient les Popys de `packages/brand`, dont l'original de `popy-diable` | Le dossier n'en a qu'une découpe provisoire de 256 px |
| **D16** | Le contraste des couples nommés se prouve par un test, dans les deux thèmes | Le design l'annonce ; le test le garde quand un token change |
| **D17** | Une taille que le CSS du dossier écrit hors des 22 styles prend le style le plus proche : onglets 16/20 et puces 14 en `label-m`, compte d'onglet et autocollant en `label-s`, sur-titre de `TopBar` 13/18 en `label-s`, pastille en `tab-label` 700. Au lot 4 : texte saisi 17/22 et options d'`ActionSheet` en `body-l` (17/24 ; le champ garde sa hauteur de 53, ses marges passant de 14 à 13), case à cocher, invite et sous-titre de feuille 15/21 en `subhead`, sur-titre de feuille 13/18 en `label-s`, bannière 14/20 en `subhead`, chiffres du code 26/26 et titre de `Dialog` 20/26 en `title-2` | Prise au lot 3, étendue au lot 4. Le README du design range tout texte dans ses 22 styles ; un style de plus écrirait une taille hors du système, que `Text` ne plafonnerait pas. À égalité de taille, la hauteur de ligne départage, comme au lot 3 ; pour le titre de `Dialog`, à égalité des deux, le rang d'un titre de feuille |
| **D18** | Dès 130 %, ce qui serait coupé passe à la ligne ou défile : libellés de puces et titre en ligne à la ligne, `Tabs` à la largeur de leurs libellés et défilants, actions du grand titre sous lui ; au lot 5, l'heure d'une notification sous son titre | Prise au lot 3, après trois coupures relevées à 200 %. Le design le demande des boutons ; les autres composants n'en disaient rien. Étendue au lot 5, après « Proposition » coupé en deux à l'iPhone SE |
| **D19** | Quand le CSS du dossier et son aperçu divergent, l'aperçu fait foi | Prise au lot 3 : le CSS souligne le petit bouton tertiaire, mais son `overflow: hidden` coupe le trait, et aucun aperçu ne le montre |
| **D20** | Les confettis suivent leurs trajectoires du dossier, leurs durées de chute de 2 à 2,9 s ramenées à 600 ms écarts gardés (500 à 725 ms), puis s'effacent en 120 ms | Prise au lot 4. Le README et le token `celebrate` donnent 600 ms aux confettis ; le CSS du canevas les fait tomber 2,4 s en moyenne et les laisse à l'écran, ce qu'une app ne peut garder sur ses boutons |
| **D21** | Popy se dessine depuis les originaux de `packages/brand` cadrés comme les découpes du dossier : un carré de la plus grande dimension du dessin, centré sur lui (`popy-crops.ts`, recalculé par un test depuis les PNG) | Prise au lot 4, après un écart manqué au lot 3 : sans ce cadrage, `Popy`, `Avatar` et `AppIcon` dessinaient Popy à 81 à 90 % de leurs aperçus. Refaites ainsi, les découpes coïncident au pixel avec celles du dossier (IoU 1,000), sauf le `diable` (D15) |
| **D22** | Les feuilles et `Dialog` se posent dans une `Modal` ; `Toast` et `InAppNotice` dans leur parent, la racine de l'app au 31 ; au catalogue, tous dans le cadre de leur aperçu (`inline`) | Prise au lot 4. La `Modal` couvre la barre d'onglets, que le design veut sous le voile, se ferme au retour d'Android, et garde le focus : dans les arbres d'accessibilité des deux appareils, il ne reste qu'elle. Un toast ou une notification ne prennent pas le focus |
| **D23** | Aucun composant ne joue d'haptique : le succès des confettis, l'avertissement d'une confirmation destructive, la sélection d'un interrupteur reviennent à l'écran | Prise au lot 4, dans la ligne de D11 et des composants du lot 3, qui n'en jouent pas. L'écran sait si l'événement en mérite un ; le catalogue, lui, n'en joue aucun |
| **D24** | Quand le mot le plus long d'une affiche (`Display`) dépasse sa largeur, toute l'affiche rapetisse juste assez pour qu'il tienne ; ses mots sont mesurés dans une copie invisible, à la taille du style (`displayFit`) | Prise au lot 5 : à l'iPhone SE, dès 130 %, « COMPOSE » passait à la ligne en deux morceaux. Une affiche ne peut ni défiler ni passer à la ligne au milieu d'un mot ; l'écart reste petit, 4 % au SE à 130 %, nul à 100 % et sur les écrans plus larges |

## 13. Suivis

- **La licence d'Extenda** pour une app mobile : Clément (tâche 12 ter).
- **La D17 du 29**, l'haptique attendue à la recette, à reprendre à mesure
  que les écrans adoptent les retours du design.
- **Les types du 15** (jeux vidéo, livres, plats, activités) n'ont pas de
  couleur dans le design : à trancher au 32, avant qu'ils entrent dans un
  bento.
- **`Tag` et `ProposeRow`**, que l'aperçu de `Sheet` pose dans sa feuille,
  arrivent au 32 ; `Sheet` reçoit déjà la puce par `eyebrowLeading`.
- **Le toast au 31** : au-delà de 200 % à l'iPhone SE, un toast qui porte une
  action garde son message dans une colonne étroite, sur quatre lignes, sans
  couper de mot ; passer l'action dessous, comme la bannière, si l'écran le
  demande. Au catalogue, les cadres du toast et de la notification rognent
  alors leur contenu, ouverts pour de vrai ils tiennent en entier.
- **Une erreur de développement d'expo-router**, deux fois sur une trentaine
  de lancements au Pixel, animations du système coupées : « Can't perform a
  React state update on a component that hasn't mounted yet », née à sa racine
  (`ContextNavigator`). Pas reproduite en seize lancements ciblés ; React ne la
  dit qu'en développement. À relever si elle revient aux recettes des 31 à 34.
