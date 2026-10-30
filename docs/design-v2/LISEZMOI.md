# Mon Bento Pop · refonte du design (dossier pour le développement)

Ce dossier contient tout ce qu'il faut pour implémenter la refonte visuelle de l'app Mon Bento Pop : le design system (tokens, polices, icônes, composants, éléments de marque) et les 75 écrans redessinés. **Aucune fonctionnalité ne change** : seuls l'apparence, la mise en page et quelques placements évoluent par rapport à la V2.0 (liste plus bas).

## Contenu

```
mon-bento-pop-design-v2/
├── LISEZMOI.md              ce fichier
├── design-system/
│   ├── README.md            le guide : principes, ton, couleurs, typo, icônes, Popy, mouvement, accessibilité, gabarits d'écran
│   ├── recettes.md          recettes d'écrans (code pour le canevas Design)
│   ├── tokens.json          LA source des valeurs : couleurs clair + sombre, styles de texte, espaces, rayons, ombres, tailles
│   ├── tokens.css           les mêmes valeurs en variables CSS, avec @font-face et classes de texte
│   ├── fonts/               polices web et natives
│   ├── icones/              les 72 icônes Phosphor utilisées, en SVG (bold, fill, regular)
│   ├── assets/Popy/         les humeurs de Popy (PNG 1000 × 1000, fond transparent)
│   ├── assets/Marque/       logo, icône d'app 1024 × 1024, petite icône Android
│   ├── components/          63 composants : README.md (règles), apercu.png (rendu), preview.html (exemple), index.d.ts (props), bundle.js et bundle.css (version web compilée)
│   └── code-source/         le code des composants web (React 18 + CSS)
└── ecrans/
    ├── visionneuse.html     les 75 écrans rendus en direct : ouvrir dans un navigateur, fonctionne hors connexion
    ├── png/                 les 75 écrans en PNG @2x (402 × 874 pt, soit 804 × 1748 px), rangés par parcours
    ├── ecrans.json          chaque écran décrit en arbre de composants, avec leurs props
    └── correspondance.md    écran refait ↔ captures V2.0 remplacées (les 104 captures sont couvertes)
```

## Par où commencer

1. Lire `design-system/README.md` : il fixe les règles de l'app (un seul jaune d'action par écran, une Popy au plus, zones tactiles de 44 pt…).
2. Brancher `tokens.json` dans le thème de l'app : couleurs par thème, styles de texte, espaces, rayons, ombres, tailles.
3. Installer les polices et les icônes.
4. Construire les composants de base avec `components/<Nom>/README.md`, `components/index.d.ts` et `apercu.png`. Les mesures exactes (marges, rayons, états) sont dans `code-source/src/bundle.css`.
5. Refaire les écrans parcours par parcours avec `ecrans/png/`, `ecrans/ecrans.json` et `ecrans/correspondance.md`.

## Tokens

- **Couleurs** : deux thèmes, `light` (Clair) et `dark` (Sombre). Chaque couleur a une valeur par thème et une note `usage` qui dit où l'employer. Dans le code, utiliser les tokens sémantiques (`bg-app`, `bg-surface`, `text-primary`, `accent`, `danger`, `cat-film`…) ; les primitives (`yolk-500`, `nori-900`, `rice-100`…) servent seulement à les définir.
- **Texte** : 22 styles en 4 groupes (Affiche, Bento, Titres, Texte), avec taille, interlignage, graisse et approche. `display-*`, `tile-*` et `eyebrow` s'écrivent en capitales (voir `tokens.css`).
- **Espaces** `space-*` sur une base de 4 ; **rayons** `radius-xs` (6) à `radius-xl` (28) et `radius-full` ; **tailles** fixes : `size-touch` 44, `size-topbar` 52, `size-tabbar` 56, boutons 52 / 44 / 32, champs 52, marge d'écran 16.
- **Ombres** `shadow-pop-sm`, `shadow-pop`, `shadow-pop-lg` : ombres franches sans flou, décalées de 2, 3 ou 5 px en x et en y, couleur encre `#0e0e0e` (jaune foncé en sombre). Une ombre système floue ne convient pas : dessiner un calque décalé derrière l'objet. Elles sont réservées au bouton principal, au plateau bento, au bouton Compose, aux boîtes de dialogue, aux médailles et à la bannière de notification.
- **Mouvement** (variables en tête de `bundle.css`) : 120, 200, 320 et 600 ms ; courbes standard `cubic-bezier(.2, .8, .2, 1)`, rebond `cubic-bezier(.34, 1.56, .64, 1)`, sortie `cubic-bezier(.36, 0, .66, -.56)`. Avec le réglage système « réduire les animations », plus de dandinement, de confettis ni de rebond.

## Polices

| Usage | Police | Fichiers dans `design-system/fonts/` |
| --- | --- | --- |
| Moments de marque : accueil, mise à jour, maintenance, image partagée | Extenda 100 Yotta | `extenda-100-yotta.otf` (PostScript `Extenda-100Yotta`) |
| Titres, boutons, onglets, sur-titres | Fredoka 500 et 600 | `Fredoka-Medium.ttf`, `Fredoka-SemiBold.ttf` ; aussi `Fredoka-Bold.ttf` et `Fredoka-Variable.ttf` |
| Titres des cases du bento | Fredoka SemiCondensed Bold | `FredokaSemiCondensed-Bold.ttf` (PostScript `Fredoka-BoldSemiCondensed`) ; `fredoka-semicondensed-bold.woff2` pour le web |
| Texte courant | police du système | SF Pro sur iOS, Roboto sur Android : rien à embarquer |

- Fredoka est sous licence OFL (`Fredoka-OFL.txt`).
- Extenda est la police de la marque Bento Pop : **vérifier que sa licence couvre une app mobile** avant de l'embarquer.
- Les PNG des écrans ont été rendus avec Inter à la place de la police système. L'app réelle utilise SF Pro ou Roboto.

## Icônes

Phosphor Icons (licence MIT). Graisse `bold` par défaut, `fill` pour l'état actif (onglet courant, cœur aimé). Tailles : 24 (standard), 20 (lignes denses, puces), 26 (barre d'onglets, actions sous un bento). Les 72 icônes utilisées sont dans `design-system/icones/` (SVG 256 × 256 en `currentColor`), sous leur nom Phosphor ; en natif, `phosphor-react-native` ou `phosphor_flutter` fournissent les mêmes dessins.

## Composants

63 composants en 7 familles (Structure, Actions, Bento, Social, Listes et saisie, Calques et retours, Marque ; liste dans la section « Les composants » du guide). Pour chacun :

- `README.md` : ce que l'écran lui fournit, quand l'utiliser, ses règles ;
- `apercu.png` : le rendu de référence ;
- `preview.html` : un exemple d'usage (il s'affiche dans la page du design system en ligne) ;
- ses props dans `components/index.d.ts`.

`components/bundle.js` et `bundle.css` sont la version web compilée (React 18, `window.MonBentoPop`). Le code est dans `code-source/` : `npm install` puis `npm run build` régénère `dist/bundle.js` et `dist/bundle.css`. C'est la référence de dessin et de comportement : dans une app native, les composants se reconstruisent à partir de ce code et des tokens.

## Écrans

- **Cadre** : iPhone 17 Pro, 402 × 874 pt, zone sûre de 62 pt en haut et 34 pt en bas. La barre d'état du système n'est pas dessinée.
- **`visionneuse.html`** : ouvrir avec un double-clic ; l'inspecteur du navigateur donne les mesures exactes de chaque élément.
- **`ecrans.json`** : pour chaque écran, `id`, `parcours`, `titre`, `captures` (fichiers V2.0 remplacés), `image` (le PNG) et `arbre`, l'écran décrit en composants (`composant` + `props`) et en mise en page (`balise` + `attributs.style`).
- **Données** : les pseudos, items et visuels sont fictifs ; les affiches et photos sont remplacées par des dégradés abstraits (prop `art`). Les textes de l'interface reprennent ceux de la V2.0.
- **Boîtes du système** : demandes d'autorisation, feuille de partage, volet de notifications et clavier restent natifs et inchangés.

## Ce qui change par rapport à la V2.0

- **Barre d'onglets** : La table, Trouver, **Compose au centre** dans une pastille jaune, Notifs (avec pastille de compte), Profil (la Popy de la personne). Avant : Compose, La table, Trouver, Notifs, Profil.
- **Messages de confirmation (toasts)** : en bas, 8 pt au-dessus de la barre d'onglets ; ils ne couvrent plus le titre ni le bouton retour. Ils restent 4 s, 6 s quand ils proposent une action.
- **Demandes d'abonnement** : « Accepter » et « Refuser » sont sur la ligne, comme « Retirer ».
- **Mise à jour proposée** : le bandeau prend sa place en haut de l'écran au lieu de recouvrir l'en-tête.
- **Cases du bento** : chaque catégorie a sa couleur et une puce texte lisible sur toutes les cases.

## Règles à garder en tête

- Un seul bouton principal jaune par écran ; sur fond jaune, il passe en `on-brand` (encre).
- Une Popy par écran au plus, aucune dans les listes et les réglages en dehors des boîtes de dialogue.
- Zones tactiles de 44 pt minimum ; un libellé d'accessibilité sur chaque bouton qui n'a qu'une icône.
- Contraste AA dans les deux thèmes ; jamais une information portée par la couleur seule.
- Majuscule de phrase partout (sauf puces, sur-titres, titres de cases et titres d'affiche) ; pas d'émoji dans l'interface.
- Dans une confirmation, l'action qui engage vient en premier, « Annuler » en dernier.

## Thème sombre

Les tokens ont leurs valeurs sombres (thème `dark`), avec les mêmes exigences de contraste. Les écrans n'ont pas encore été déclinés ni relus en sombre : à faire valider avant de l'activer.

## Points ouverts

- Rôle des boutons « Recherche » (en-tête de Trouver) et « Notifications » (en-tête de « Quoi de neuf ? ») : gardés tels quels, à préciser.
- Popy « diable » : `popy-diable.webp` est provisoire (découpe d'une capture), fichier d'origine à retrouver.
- Licence d'Extenda pour une app mobile.
- Le message de blocage renvoie à « tes réglages », mais aucune capture ne montre d'écran de comptes bloqués.

## En ligne

- Design system : https://claude.ai/artifact/BtG2GdL2fUZdBNuWy3611A
- Canevas des écrans : https://claude.ai/artifact/EmdqHyQbfZ1oTk1GL97ZNt

Ces pages ne s'ouvrent que si elles ont été partagées depuis leur menu Partager. Si le canevas évolue après cet export, c'est lui qui fait foi.
