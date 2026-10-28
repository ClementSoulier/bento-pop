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
> spécification.
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
  `shadow.ts`, `motion.ts`, et un dossier par composant.
  `src/components/primitives/` (`StampButton`, `Toast`, `YellowBg`,
  `Sticker`…) et Bungee restent tant qu'un écran les emploie ; le chantier
  qui refait le dernier les retire (D13).
- `packages/brand` ne bouge pas : la landing, le back-office et le quiz
  emploient ses tokens.

## 4. Les fondations

### 4.1 Les tokens et le thème (D4, D6, D16)

- `apps/mobile/scripts/design-tokens.mjs` lit
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

- `apps/mobile/scripts/design-icons.mjs` lit les 72 icônes de
  `docs/design-v2/design-system/icones/`, en bold et en fill, et écrit
  `src/design/icons.ts` : le nom Phosphor et ses deux tracés, 52 Ko. La
  graisse regular, que le design n'emploie pas, n'y entre pas.
- `<Icon name="heart" weight="fill" size={24} color={…} />` dessine le
  tracé dans un `Svg` de 256 de côté. Décorative par défaut, cachée aux
  lecteurs d'écran ; c'est le bouton qui la porte qui a un libellé
  (`IconButton label`).
- Une icône de plus : son SVG Phosphor ajouté au dossier, le script
  relancé. Un test vérifie qu'`icons.ts` est à jour et que chaque nom
  employé dans `src/design/` existe.

### 4.5 Les ombres (D9)

- Les ombres franches passent par **`boxShadow`** (`3px 3px 0 0 <encre>`),
  que React Native dessine sur iOS comme sur Android en nouvelle
  architecture : le même dessin sur les deux plateformes, sans le flou
  d'`elevation`. À mesurer au lot 2 sur l'émulateur, au pixel, et à
  vérifier sur les versions d'Android que l'app accepte ; à défaut, un
  calque décalé derrière l'objet, comme le design le propose.
- `stampShadow` reste aux écrans actuels, jusqu'à leur chantier.

### 4.6 Le mouvement et l'haptique (D10, D11)

- `src/design/motion.ts` porte les quatre durées et les trois courbes
  (`Easing.bezier` de Reanimated), et `useMotion()`, qui lit le réglage du
  système (`useReducedMotion` de Reanimated) et rend les variantes réduites :
  les apparitions en fondus de 120 ms, ni dandinement, ni confettis, ni
  rebond.
- `src/lib/haptics.ts` reçoit les cinq retours du design : `selection`,
  `impact('medium')`, `success`, `warning`, `error`. Les écrans les adoptent
  avec leur chantier ; la D17 du 29, qui décrit l'haptique actuelle, se met
  à jour à chacun.

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
  réduit.
- **`Avatar`** et **`Popy`** emploient les Popys de
  `packages/brand/assets/mascot/`, dont l'original de `popy-diable.png`
  (1000 × 1000), et non la découpe provisoire du dossier (D15).
- **`AppIcon`** ne fait que dessiner l'icône dans l'app ; l'icône du système
  et la petite icône Android des notifications changent au 31, avec la build
  de la 2.0.0.

## 6. Le catalogue (D12)

- Une route `app/dev/catalogue.tsx`, ouverte par le lien profond
  `bentopop://dev/catalogue`, seulement en développement (`__DEV__`) : en
  build de production, elle renvoie à l'accueil. Aucun écran n'y mène, pour
  que les écrans restent identiques au pixel (D5).
- Une page par famille ; chaque composant dans les états de son aperçu
  (variantes, désactivé, chargement, erreur), sous le nom de son
  `apercu.png`.
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
- les variantes réduites du mouvement ;
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
| 4 | Listes et saisie, calques et retours (23 composants) | idem ; `Dialog` garde le focus |
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

## 11. Definition of Done

| # | Point | État |
| --- | --- | --- |
| 1 | `tokens.ts` généré depuis `tokens.json`, gardé par un test | ✅ lot 1 |
| 2 | `useTheme()` : le clair actif, le sombre présent et éteint | ✅ lot 1 |
| 3 | Les contrastes AA des couples nommés, dans les deux thèmes, prouvés par un test | ✅ lot 1 |
| 4 | Fredoka SemiCondensed chargée ; une famille par graisse | ✅ lot 1 |
| 5 | `Text` et ses trois plafonds (D1, D8) | ✅ lot 1 ; à 200 % au catalogue, lot 3 |
| 6 | Les 72 icônes générées, et `Icon` | ⬜ |
| 7 | Les ombres franches identiques sur iOS et Android | ⬜ |
| 8 | Le mouvement et sa variante réduite ; les cinq retours haptiques | ⬜ |
| 9 | Les 39 composants identiques à leur aperçu au simulateur et à l'émulateur, à 100, 130 et 200 % | ⬜ |
| 10 | Les tests de règles verts sur `src/design/` | ⬜ |
| 11 | NativeWind retiré, les écrans de référence identiques au pixel | ✅ lot 1 |
| 12 | La CI rejouée en local, verte | ⬜ |

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
| **D9** | Les ombres franches par `boxShadow`, un calque décalé en repli | Le design exclut le flou, qu'`elevation` impose sur Android |
| **D10** | Le mouvement lit le réglage du système, par Reanimated | Rien ne le lisait ; le design le demande |
| **D11** | Les cinq retours haptiques du design entrent dans `haptics.ts` ; les écrans les adoptent avec leur chantier | Changer l'haptique des écrans actuels se sentirait ; la D17 du 29 suivra |
| **D12** | Un catalogue réservé au développement, ouvert par un lien profond | Comparer chaque composant à son aperçu sans toucher aux écrans ; rien n'en sort en production |
| **D13** | Bungee et les primitives actuelles restent jusqu'au chantier qui refait leur dernier écran, qui les retire | Les retirer au 30 casserait les écrans pas encore refaits |
| **D14** | Les aperçus se comparent en tolérant l'écart de métrique de la police du système | Ils sont rendus avec Inter ; l'app emploie SF Pro et Roboto |
| **D15** | `Avatar` et `Popy` emploient les Popys de `packages/brand`, dont l'original de `popy-diable` | Le dossier n'en a qu'une découpe provisoire de 256 px |
| **D16** | Le contraste des couples nommés se prouve par un test, dans les deux thèmes | Le design l'annonce ; le test le garde quand un token change |

## 13. Suivis

- **La licence d'Extenda** pour une app mobile : Clément (tâche 12 ter).
- **La D17 du 29**, l'haptique attendue à la recette, à reprendre à mesure
  que les écrans adoptent les retours du design.
- **Les types du 15** (jeux vidéo, livres, plats, activités) n'ont pas de
  couleur dans le design : à trancher au 32, avant qu'ils entrent dans un
  bento.
