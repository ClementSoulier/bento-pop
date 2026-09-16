# Chantier 11 · Accessibilité et polish

> La liste « à glisser entre deux chantiers » de la roadmap, et ce que les
> chantiers 6 et 7 y ont versé.
>
> Spécification écrite le 15 septembre 2026 au soir, à partir du code de `main`
> (`70e36d5`) et de relevés sur appareils : simulateurs iPhone 17 Pro et
> iPhone SE, émulateur Pixel 8, contre un Supabase local construit depuis les
> migrations du dépôt, et quelques lectures `GET` sur la production. **Aucune
> écriture en production.**
>
> **Clément s'est absenté pendant la rédaction** et a demandé d'enchaîner les
> lots sans blocage. Les arbitrages de §11 ont donc été pris en provisoire, sur
> l'option recommandée, puis **relus et validés le 16 septembre 2026** : les
> vingt-quatre, dont les trois à effet visible, titres de case rétrécis, encres
> secondaires et bouton signature. Livraison retenue : une nouvelle build 1.2.0
> avant la mise en revue App Store. Rien n'est publié sans accord.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md), chantier 11.

---

## 1. Intention

La roadmap rangeait ce chantier en effort S : une loupe en emoji, des hauteurs
de ligne serrées, des plafonds de police oubliés, un blocage sans retour, un
bandeau mal placé, des libellés d'onglets tronqués et deux boutons muets pour
VoiceOver. Chaque point est vrai. La mesure en a changé l'ordre de grandeur.

### 1.1 Le défaut de fond

**L'app n'a été dessinée et vérifiée qu'à la taille de police par défaut, et à
la voix que personne n'active.** Les chantiers 6 et 7 ont traité leurs écrans
un par un. Tout le reste suit la police système sans plafond, et se casse :

- **l'inscription se ferme.** Sur iPhone 17 Pro, le bouton « Commencer » sort de
  l'écran dès la plus grande taille *standard* du réglage Taille du texte, sans
  défilement pour le rattraper ; aux tailles d'accessibilité, aucun des quatre
  écrans d'accueil n'expose plus son action (§4.2) ;
- **à la taille par défaut**, les accents des titres sont rognés, « LES REGLES »,
  « UNE BOITE » (§4.4), et le pseudo du profil se coupe au milieu, « @BENTO_CULTUR
  / E », pour un pseudo publié sur sept (§4.3) ;
- **VoiceOver** lit la case d'un bento en trois morceaux, lettre filigrane
  comprise, annonce les onglets en anglais et ne dit rien d'un toast (§4.5).

### 1.2 La règle qui tient le chantier

**Aucun texte ne suit la police sans plafond, aucun mot ne se coupe, aucune
action ne sort d'atteinte, et tout ce qui se touche se dit.** Un test lit le code
source et échoue sur tout texte sans plafond, comme le fait déjà
`font-scaling.test.ts` pour la page publique et les cases.

---

## 2. Objectif et critères de succès

**Objectif.** Que l'app se lise et se parcoure entièrement à toutes les tailles
de police, sur iOS comme sur Android, et au lecteur d'écran, sans rien changer à
la taille par défaut sur iOS hors des défauts qu'elle porte.

**Critères.** La liste complète et vérifiable est en §10.

1. **Chaque écran garde son action principale atteignable** à toutes les tailles
   de police : jusqu'à la plus grande d'accessibilité sur iOS, 2,0 sur Android.
2. **Aucun mot ne se coupe**, aucun texte ne sort de l'écran.
3. **Aucun texte de l'app ne suit la police sans plafond**, vérifié par test.
4. **Les accents des titres sont entiers** sur les deux plateformes.
5. **Le lecteur d'écran** lit une case en un élément, les onglets en français,
   annonce toasts et perte de connexion, et chaque élément tapable dit son rôle.
6. **Bloquer se défait** depuis le profil.
7. **Les parcours mesurés en défaut sont corrigés** : bandeau hors ligne, ligne
   « Ajouter » en doublon exact, messages d'erreur techniques, pseudo proposé puis
   refusé, bento vide pendant un chargement lent.
8. **À la taille par défaut sur iOS**, le fil, la page publique et l'image de
   partage restent identiques au pixel, hors titres de case que §5.5 fait tenir.

---

## 3. Périmètre

**Dans le chantier.**

- La police système sur tous les écrans : plafonds, écrans qui ne tiennent pas,
  hauteurs de ligne et accents, barre d'onglets.
- Le lecteur d'écran : regroupements, rôles, libellés, annonces, cibles tactiles.
- Les parcours mesurés en défaut : comptes bloqués, bandeau hors ligne, ligne
  « Ajouter », messages d'erreur, pseudos suggérés, composer en chargement lent.
- Les titres de case tronqués, et les contrastes de texte qui se corrigent dans
  la palette existante.
- La recette appareil, et la checklist que la roadmap accumule, pour ce qu'un
  simulateur peut en dire.

**Hors du chantier.**

- Les couleurs de marque : le rouge des boutons principaux, de « Supprimer mon
  compte », de « Vider » et du toast d'erreur restent tels quels, chiffres en §4.8
  (D18).
- Les proportions de la boîte du composer, écrasée par un calcul sur la seule
  hauteur (D8, §4.3).
- La modération côté serveur : le blocage reste une liste locale par pseudo,
  cf. la fondation 2 de la roadmap.
- `shared_items`, qui compte deux fois un bento portant le même item dans deux
  cases : défaut de base de données, latent en production, tâche séparée (§12).
- Toute écriture en production, toute build, toute mise à jour à distance.

---

## 4. Ce que disent le code et les appareils

### 4.1 Méthode

- **Code** : un audit par l'arbre syntaxique TypeScript de `apps/mobile/app` et
  `apps/mobile/src`, hors tests, qui relève pour chaque `<Text>` et `<TextInput>`
  sa police, sa taille, sa hauteur de ligne et son plafond, et pour chaque
  élément tapable son rôle et son libellé.
- **Appareils** : l'app compilée du 14 septembre, cible `127.0.0.1:8098`
  vérifiée dans le binaire avant tout lancement, servie par un relais local vers
  le Supabase local, jeu de données fixe du chantier 15 (sept profils, quarante
  items, six bentos publiés). Comptes anonymes et profils créés dans cette base
  locale seulement. Tailles : iOS par défaut, xLarge, xxLarge, xxxLarge et les
  tailles d'accessibilité ; Android 1,0, 1,3 et 2,0. Arbres d'accessibilité par
  `idb ui describe-all` et `uiautomator dump`, captures mesurées au pixel.
- **Production** : `GET` seulement, clé anonyme : titres des 27 bentos publiés,
  catalogue validé, pseudos. Stores et serveur de mises à jour interrogés comme
  le fait l'app.

### 4.2 La police système ferme l'inscription

L'accueil compte quatre écrans : splash, règles, pseudo, mécanique. Leur titre et
leurs textes suivent la police sans plafond, et leur action principale est posée
sous un contenu qui ne défile pas (splash, mécanique) ou sous un titre placé hors
du défilement (règles, pseudo, `PageTitle` dans `terms.tsx:62` et
`pseudo.tsx:77`).

Action principale présente dans l'arbre d'accessibilité, qui ne liste que ce qui
est à l'écran. À la plus grande taille, deux balayages vers le haut n'y changent
rien.

| Taille iOS | 17 Pro : splash | règles | pseudo | mécanique | SE : splash |
|---|---|---|---|---|---|
| Défaut à xxLarge | oui | oui | oui | oui | oui |
| **xxxLarge**, la plus grande standard | **non** | oui | oui | oui | oui |
| AX1 | non | oui | oui | oui | **non** |
| AX2 | non | oui | oui | **non** | |
| AX3 et au-delà | non | **non** | **non** | non | |

Une personne qui a poussé le curseur Taille du texte au maximum, sans même passer
par les tailles d'accessibilité, ne peut pas commencer sur un 17 Pro. Le splash
d'un SE résiste une taille de plus parce qu'il réduit déjà titre et mascotte sous
720 pt de hauteur (`splash.tsx:21`).

Les titres se coupent au milieu d'un mot dès xxLarge : « COMPOS / E / TON /
BENTO », puis « LES / RÈGLE / S », « CHOI / SIS / TON / PSEU / DO. », « UNE /
BOÎTE. / SIX / ENVIE / S. » au maximum. La mascotte recouvre « POP CULTURE » dès
xxLarge.

Sur Android, à 2,0, les quatre actions restent atteignables : la courbe
non linéaire d'Android 14 grossit bien moins que les tailles d'accessibilité
d'iOS. Restent la mascotte sur « CULTURE. » au splash, et sur les suggestions du
pseudo, où l'adresse « bento-pop.com/u/… » chevauche le compteur « 0 / 20 ».

### 4.3 Le composer, le profil, les crédits, la recherche

**Le composer.** Son budget vertical compte un en-tête de 88 pt et un bloc de
bouton de 66 pt, constants (`compose-layout.ts:22` et `:31`), alors que ses
textes suivent la police sans plafond.

Mesuré au pixel, sur une colonne du bouton, contre la bordure haute de la barre
d'onglets :

| Appareil | Taille | Bouton « Commence par ton film » |
|---|---|---|
| iPhone SE | défaut | sa bordure basse **touche** celle de la barre, 0 pt d'écart |
| iPhone SE | xLarge | **9 pt sous la barre** |
| iPhone SE | xxLarge | **17 pt dessous** |
| iPhone SE | xxxLarge | **58 pt dessous**, libellé sur deux lignes |
| iPhone SE, 17 Pro | AX5 | hors d'écran, « MON / BENT / O » sur 279 pt |
| Pixel 8, 411 dp | 1,0 | **sa bordure basse sous la barre** |
| Pixel 8 | 1,3 | à moitié dessous |
| Pixel 8 | 2,0 | entièrement dessous |

Le modèle compte 88 pt d'en-tête, et l'écran en rend 74 sur iPhone : c'est cet
écart de 14 pt qui fait tenir le SE à la taille par défaut. Sur SE, l'échelle est
déjà au plancher de 0,65 à la taille par défaut, et la barre y mesure 84 pt, pas
les 49 que supposent les tests de `compose-layout.test.ts`.

Sur Android, le défaut existe **dès la taille par défaut** : le libellé Bungee 15
d'un `StampButton` y occupe une boîte de 39 dp (`uiautomator`, 103 px), contre
20 pt environ sur iOS, et le bouton mesure 73 dp au lieu de 54. Mesuré au pixel
sur la colonne centrale : rouge du bouton jusqu'à la ligne 2179, bordure noire de
la barre d'onglets à 2180, aucune bordure basse du bouton.

**La boîte du composer est écrasée**, suivi du chantier 7 : sa largeur est celle
de l'écran, ses hauteurs suivent une échelle calculée sur la hauteur. Rapport des
deux échelles : 0,68 sur SE, 0,90 sur 17 Pro, 0,94 à 360 dp, 0,95 sur Pixel 8.
Hors chantier (D8).

**Le profil.** Le pseudo est en Extenda 36 sur toute la largeur, sans plafond ni
ligne unique (`profile.tsx:126`). Il se coupe au milieu **à la taille par
défaut** dès qu'il dépasse la ligne : « @BENTO_CULTUR / E » sur 17 Pro, mesuré.
Sur les 59 pseudos de la production, par la chasse d'Extenda : 8 débordent sur
17 Pro et Pixel 8 (14 %), 12 sur SE (20 %), 16 à 360 dp (27 %). À AX5, le
pseudo occupe 514 pt et chaque bouton 232.

**Les crédits** : « CRÉ / DITS », le chevron du bouton retour disparaît de sa
pastille, « Politique de confidential / ité » au maximum.

**La modale de recherche** : « CASE · FILM » et « VIDER » sortent de l'écran,
la croix déborde de son cercle, la loupe devient énorme, les titres des tuiles se
coupent au milieu, « YOU / R… », « DUN / E ».

**« Trouver »** : la puce « RECHERCHE » de `TopChip` sort du bord droit.

**La barre d'onglets.** Sur iOS 13 et plus, React Navigation fige ses libellés
(`allowFontScaling` à `false` pour la loupe système), ils ne bougent pas. Sur
Android ils suivent la police : « COMPO… », « LA TAB… », « TROUV… » à 2,0. Sa
hauteur est fixée à 84 (`(tabs)/_layout.tsx:25`) : en navigation à trois
boutons, où la marge basse passe de 24 à 48 dp, icônes et libellés passent sous
les boutons système, relevé du chantier 7.

**Dans le code** : 128 `<Text>` et `<TextInput>` dans 25 fichiers, **87 sans
plafond ni police figée**, dont 11 des 21 textes en Extenda. Seuls « Trouver »,
la page publique, les cases et l'image de partage sont traités.

| Fichier | textes sans plafond |
|---|---|
| `onboarding/terms.tsx` | 11 sur 11 |
| `(tabs)/profile.tsx`, `credits.tsx`, `search-modal.tsx` | 10 sur 10 chacun |
| `onboarding/pseudo.tsx` | 8 sur 8 |
| `(tabs)/table.tsx` | 6 sur 7, états vide et erreur |
| `(tabs)/compose.tsx` | 5 sur 5 |
| `onboarding/mechanics.tsx`, `splash.tsx` | 4 sur 4, 3 sur 3 |
| `PageTitle`, `ItemTile`, `UpdateBanner` | 3 chacun |
| `Toast`, `AppBlocker`, `(tabs)/search.tsx` | 2 chacun |
| `TopChip`, `StampButton`, `Sticker`, `OfflineBanner`, `Splash` | 1 chacun |

### 4.4 Des accents rognés à la taille par défaut

Six textes en Extenda ont une hauteur de ligne inférieure à leur taille :
`compose.tsx:165` (28 pour 26), `mechanics.tsx:24` (28 pour 26),
`PageTitle.tsx:33` (30 pour 28), `(tabs)/search.tsx:134` (28 pour 26),
`ItemTile.tsx:145` (64 pour 60, l'initiale en filigrane) et `ShareImage.tsx:115`
(104 pour 100, un pseudo sans accent).

Extenda place ses accents de capitales au-dessus de son ascendante : ascendante
0,743 em, capitales 0,664 em, sommet des glyphes jusqu'à 1,062 em (tables `hhea`,
`OS/2` et `head` de la police). Une première ligne dont la boîte ne contient pas
l'accent le perd, **même à hauteur de ligne égale à la taille**.

- **iOS, taille par défaut** : « LES REGLES » et « UNE BOITE. », accent grave et
  circonflexe invisibles, relevés sur les captures.
- **Android, taille par défaut et 2,0** : les mêmes accents tronqués à plat.

Le titre de « La table » (28 pour 30) ne montre rien parce que sa première
ligne, « TOUT LE MONDE », n'a pas d'accent.

### 4.5 Le lecteur d'écran

Relevé par `idb ui describe-all` sur iPhone 17 Pro, sur tous les écrans, et par
`uiautomator dump` sur Pixel 8.

- **Une case de consultation se lit en trois morceaux.** Sur la page publique, la
  case est une `View` de rôle `image` avec un libellé, mais sans `accessible`
  (`Tile.tsx:410`) : VoiceOver en lit les enfants. Six cases donnent 22
  éléments : « I », « FILM », « INCEPTION », « A », « SÉRIE », « ARCANE »… La
  lettre en filigrane (`Tile.tsx:216`) est lue comme un texte. Le fil n'est pas
  touché : un post y est un seul bouton, libellé complet.
- **L'écran de mécanique expose six boutons qui ne font rien** : « Ajouter film »
  et les autres, `EmptyTile` gardant son rôle de bouton sans `onPress`
  (`EmptyTile.tsx:122`).
- **La loupe se lit** : « 🔍 » est un texte statique de l'arbre, dans la modale
  (`search-modal.tsx:457`) comme dans « Trouver » (`(tabs)/search.tsx:164`). Son
  rendu diffère aussi : glyphe gris sur iOS, loupe bleutée sur Android.
- **Deux champs sans libellé** : la recherche de la modale et le pseudo de
  l'accueil sortent en `AXTextField` au libellé vide.
- **Les onglets sont annoncés en anglais** : « Compose, tab, 1 of 4 », valeur par
  défaut de React Navigation sur iOS (`BottomTabBar.js:286` d'expo-router).
  Android les expose en `android.view.View`, libellé en capitales, sans rôle.
- **Rien n'annonce un toast ni la perte de connexion.** Aucun
  `announceForAccessibility` ni `accessibilityLiveRegion` dans l'app. Choisir un
  item ferme la modale et affiche « FILM : INCEPTION · ANNULER » en silence.
- **Les titres d'écran ne sont pas des en-têtes**, sauf « La table » et les
  sections de « Trouver » et de la modale.
- **Les liens du profil déclarent `link`** pour des actions internes, « Crédits »,
  « Exporter mes données », « Retirer mon bento du fil » (`profile.tsx:310`).
- **Cibles tactiles sous 44 pt** : fermer la recherche et les boutons retour
  36 × 36, « Options » 83 × 25, les suggestions de pseudo 30 à 32 de haut,
  l'action d'un toast 63 × 15 (35 avec son `hitSlop`), les onglets 39 de haut sur
  17 Pro.
- **L'en-tête de la modale lit l'abréviation du tampon** : « Case · CRÉA ».

**Le rôle relevé varie d'un relevé à l'autre.** Le chantier 7 avait relevé
« Réessayer » et « Reprendre mon bento » en `AXGenericElement`, cause non établie.
Sur le code actuel, « Réessayer de charger le bento de @marcopolo » sort en
`AXButton` trois fois sur trois : à l'arrivée de l'état, après un nouvel essai, et
après un rechargement à chaud provoqué. Mais la carte « TMDb » des crédits, un
lien comme ses quatre voisines, est sortie **une fois** en `AXGenericElement`
avant de sortir en `AXLink` aux trois relevés suivants, et les liens du profil
sortent en boutons à la taille par défaut, en liens au maximum. Hypothèse : un
arbre relevé avant que les traits de l'élément ne soient posés. Elle ne se
tranche pas sans VoiceOver sur appareil réel, qui interroge les traits à la
lecture. La case à cocher des règles est générique par construction : iOS n'a
pas ce trait, et React Native l'annonce par sa valeur « checkbox, unchecked ».
Critère de recette : deux relevés espacés de chaque écran, aucun élément tapable
générique dans le second (§10).

### 4.6 Les parcours

**Bloquer est une porte à sens unique.** Mesuré sur 17 Pro : après « Bloquer »,
l'écran reste sur le bento bloqué, sans retour ni message ; la recherche et le fil
ne le montrent plus ; le profil n'a aucune liste. La confirmation promet pourtant
« Tu peux annuler à tout moment depuis ce menu » (`u/[pseudo].tsx:710`), sur une
page qu'on ne retrouve plus que par un lien.

**Le bandeau « Pas de connexion » recouvre le haut de chaque écran.** Posé en
absolu sur toute l'app (`OfflineBanner.tsx:23`). Pixel 8 en mode avion : rouge de
0 à 89 dp, bouton retour de la page publique de 58 à 94 dp, donc caché sauf
5 dp, « Options » caché, logo du composer caché. Sur iOS, la modale de recherche
est une feuille native posée au-dessus de la vue racine : le bandeau y serait
invisible, déduit du code, le simulateur ne sachant pas couper le réseau.

**« Ajouter « Squeezie » » reste proposé quand Squeezie est là.** Relevé en
production au chantier 15 sur iOS et Android, et reproduit sur 17 Pro en local :
« 1 RÉSULTAT », la tuile Squeezie, puis la ligne « Proposer Squeezie au
catalogue ». Le commentaire au-dessus de `canSubmitNew` promet que la ligne
n'apparaît « que quand on a pu vérifier que l'item n'existe pas »
(`search-modal.tsx:404`), et la condition ne compare jamais le texte tapé aux
titres trouvés (`:420`).

**Des messages techniques, en partie anglais, arrivent à l'écran.** Six
`Alert.alert` affichent `error.message` : `profile.tsx:34`, `:64`, `:92`,
`u/[pseudo].tsx:690`, `terms.tsx:43`, `pseudo.tsx:66`. Les messages levés par
`bento-actions.ts` sont « Unpublish failed: … », « Account deletion failed: … »,
et le bandeau d'erreur de la modale affiche « Search failed: … »
(`items.ts:52`, `search-modal.tsx:488`).

**L'accueil propose un pseudo qu'il refuse.** Sur SE, champ vide, la troisième
suggestion est « bento_pop » (`pseudo.ts:52`, base « bento » et suffixe « _pop »).
Le badge dit « Libre », puis la validation répond « Oups · Impossible de créer le
profil : Pseudo non autorisé. » : le motif `bent[o0].?pop$` de
`blocked_pseudo_patterns` le réserve à la marque, et l'app ne lit pas cette table.

**Sur un réseau très lent, le composer montre un bento vide.** Relais local
retardé, 17 Pro, compte au bento publié et complet :

| Retard par requête | Composer affiché | Cases remplies |
|---|---|---|
| aucun | 2,1 à 2,6 s | en même temps |
| 3 s | 9,4 s | en même temps |
| 5 s | 12,6 s, garde-fou de 12 s | en même temps |
| 10 s | 14,5 s | **22,2 s** |

Entre les deux, 8 s de « 0 / 6 », « Ajouter film » et « Commence par ton film »
pour quelqu'un dont le bento est en ligne.

**Deux tirets cadratins dans les textes de l'app** : `splash.tsx:95` et
`terms.tsx:97`, plus un tiret long après l'arobase quand le pseudo manque
(`compose.tsx:159`, `profile.tsx:135`).

### 4.7 Les titres de case tronqués

L'observation portée au prompt de reprise se corrige à la mesure : sur la page
publique du chantier 15, lot 3, **iOS et Android tronquent tous deux** « Bohemian
Rhapsody », « BOHEMIAN / RHAPSO… » sur iOS et « BOHEMIAN / RHAPSOD‥ » sur
Android. La règle du chantier 7 fait rétrécir un titre pour son **premier** mot ;
un mot trop large en dernière ligne se tronque, par construction.

Ampleur, par le modèle de mise en lignes de l'app (`tile-title.ts`,
`extenda-metrics.ts`), vérifié sur les captures du chantier 7 (« JOUEUR / DU
GREN… », « GLITCH / PRODUC… », « THE / DREAMI… ») :

| Écran | Cases publiées tronquées | Chansons | Catalogue validé |
|---|---|---|---|
| Fil et page publique, les quatre téléphones | **29 sur 162, 17,9 %** | 12 sur 27 | 15 à 16 % |
| Composer, 17 Pro | 18 sur 162 | 10 sur 27 | 9 % |
| Composer, SE | 8 sur 162 | 4 sur 27 | 3 % |

Si le titre rétrécit jusqu'à tenir entier en deux lignes, le facteur médian
nécessaire est de 0,79 à 0,83 sur le fil ; avec un plancher à 0,75, **13 cases**
restent tronquées, avec un plancher à 0,6, 3 à 5.

### 4.8 Contrastes

Rapports WCAG calculés sur la palette, texte normal attendu à 4,5 : 1.

| Texte | Fond | Rapport | Usages |
|---|---|---|---|
| encre à 55 % | jaune | **3,84** | 14 : pseudo du composer, sections du profil, « Options », suggestions… |
| encre à 55 % | crème, blanc | 4,29, 4,42 | « AU MENU » de la modale |
| encre à 40 % | blanc | **2,71** | onglets inactifs, placeholder de « Trouver » |
| encre à 35 % | crème | **2,32** | libellé d'une case vide |
| rouge `#e63946` | jaune | **2,50** | action « Annuler » d'un toast de succès |
| jaune | rouge | **2,50** | action d'un toast d'erreur |
| rouge | voile rouge sur crème | 3,29 | texte du bandeau d'erreur de la modale |
| rouge | crème | 3,77 | « Vider » |
| rouge | voile rouge sur jaune | **2,36** | « Supprimer mon compte » |
| crème | rouge | 3,77 | bouton principal, Bungee 15 |
| blanc | rouge | 4,17 | bandeau hors ligne, toast d'erreur |

### 4.9 La checklist appareil de la roadmap

| Point | Ce qu'un simulateur en dit | Reste |
|---|---|---|
| Haptique du chantier 3 | rien, aucun moteur | appareil réel |
| VoiceOver, TalkBack | l'arbre, les rôles, les libellés (§4.5) | la voix, l'ordre de lecture, sur appareil réel |
| Taille de police système | tout (§4.2 à §4.4) | |
| Fluidité du fil en build de production | rien de fiable : l'émulateur saccade de base, et la build de recette est de débogage | appareil réel, build TestFlight ou canal interne |
| Aperçus de partage | la landing, déjà vérifiée par `verify-prod.sh` | iMessage, WhatsApp, Discord sur appareil réel |
| Démarrage en réseau très lent | mesuré (§4.6) | |
| Démarrage en mode avion | rien : la build de développement charge son code depuis Metro, et le mode avion coupe `adb reverse` | build TestFlight ou canal interne |

### 4.10 Ce qui ne bouge pas

- La page publique, les cases, l'image de partage et « Trouver » tiennent déjà à
  la police maximale (chantiers 6 et 7) ; leurs tests restent.
- Le fil : posts regroupés en un bouton au libellé complet, titre plafonné.
- Rien côté base de données, rien de natif. Aucune dépendance ni configuration
  native n'a changé depuis la build 1.2.0 (`dc59a2b`).

---

## 5. Design

### 5.1 Trois plafonds, une règle et un garde-fou

Les plafonds vivent dans `font-scaling.ts`, avec celui des cases :

| Constante | Valeur | Pour |
|---|---|---|
| `CONTENT_MAX_FONT_MULTIPLIER` | 1,4 | textes de lecture, champs, lignes de liste |
| `CONTROL_MAX_FONT_MULTIPLIER` | 1,2 | libellés de boutons, puces, onglets, étiquettes dans une hauteur fixe |
| `TITLE_MAX_FONT_MULTIPLIER` | 1,2 | titres display en Extenda |
| `TILE_MAX_FONT_MULTIPLIER` | 1,2 | cases, inchangé |

`public-layout.ts` ré-exporte ses deux constantes actuelles depuis ce module :
la page publique ne change pas.

**Règles d'écriture.**

- **Un titre ne coupe jamais un mot** : autant de lignes que ses sauts de ligne
  explicites (`numberOfLines`), `adjustsFontSizeToFit`, `textBreakStrategy="simple"`
  pour qu'Android rétrécisse au lieu de couper (`u/[pseudo].tsx:605`). Un titre
  sans saut de ligne tient sur une ligne.
- **Un libellé de contrôle tient sur une ligne**, et rétrécit si sa largeur est
  contrainte.
- **Un glyphe décoratif ne suit pas la police** : chevrons, croix, « + »,
  initiale en filigrane (`allowFontScaling={false}`).
- **Un texte ne rétrécit que s'il peut déborder.** `adjustsFontSizeToFit` est un
  filet, pas une décoration : sur iOS, posé avec une hauteur de ligne de 13,33 pt,
  il a réduit le pseudo du composer à un trait, alors que le texte tenait dix fois.
  Mesuré au lot 1, retiré là où le texte tient toujours.
- **Un texte dont la hauteur compte dans un modèle** applique lui-même la police
  par `fontScaleFor`, comme la page publique.

**Le garde-fou.** `font-scaling.test.ts` étend à tous les fichiers `.tsx` de
`app/` et `src/` le test de la page publique : tout `<Text>` et `<TextInput>`
porte `maxFontSizeMultiplier` ou `allowFontScaling={false}`, jamais un nombre
recopié, et tout texte qui pose sa hauteur de ligne passe par `fontScaleFor`.

### 5.2 Les écrans qui ne tiennent pas

**L'accueil.** Chaque écran met son contenu dans un `ScrollView` et garde son
action principale **hors du défilement**, en bas, toujours visible. Le titre de
`PageTitle` entre dans le défilement. Titres plafonnés à 1,2 selon la règle des
titres, textes à 1,4, puces de suggestions et boutons à 1,2. La mascotte du
splash et celle du pseudo passent dans le flux : elles ne recouvrent plus rien.

**Le composer** reprend la méthode de la page publique : un modèle qui connaît la
police.

L'écart entre la boîte et le bouton devient compressible : 56 pt visés, 24 pt
garantis. Sur un iPhone SE, où la grille est à son plancher dès la taille par
défaut, les 56 pt garantis posaient le bouton bordure contre bordure avec la barre
d'onglets, puis 9 pt dessous à xLarge et 17 à xxLarge. À 24, le bouton reste
au-dessus à toutes les tailles, 12 pt de marge comprise.

- En-tête : pseudo sur une ligne qui rétrécit, titre sur une ligne à 1,2, ligne
  « En ligne » à 1,2 ; leurs hauteurs de ligne posées par l'écran et comptées par
  `compose-layout.ts`, qui reçoit `fontScale`.
- Bouton : libellé sur une ligne, plafond 1,2, **hauteur de ligne posée** dans
  `StampButton`. C'est ce qui rend sa hauteur identique sur les deux plateformes
  et corrige Android à la taille par défaut. Tous les `StampButton` d'Android
  passent de 73 à la hauteur d'iOS, mesurée au lot 1 avec leurs accents
  (« ÉDITER », « COMPLÉTER »).
- Quand l'échelle de la grille tomberait sous son plancher de 0,65, l'écran
  défile, bouton compris, au lieu de le pousser sous la barre d'onglets.
- **À la taille par défaut sur iOS, rien ne bouge**, vérifié au pixel.

**Le profil** : pseudo sur une ligne qui rétrécit, plafond 1,2 ; boutons à 1,2 ;
liens à 1,4.

**Les crédits** : titre sur une ligne, chevron figé comme celui de la page
publique, cartes à 1,4 sans coupure de mot.

**La modale de recherche** : en-tête et « Vider » à 1,2 sur une ligne, croix
figée, champ à 1,4 comme « Trouver », titres de tuiles à 1,2 avec la règle du
premier mot des cases, bandeau d'erreur à 1,4.

**`TopChip`, toasts, bandeaux, écran de blocage** : plafonnés selon §5.1.

**La barre d'onglets.** Libellé rendu par l'app : une ligne qui rétrécit, plafonnée
à 1,2, hauteur de ligne posée. Sans elle, Bungee prend sur Android une boîte de
23 dp pour 9 de police, et le libellé sortait coupé en deux de la barre en
navigation à trois boutons.

Hauteur `84 + max(0, marge basse − marge de référence)`, la référence valant 34 sur
iOS et 24 sur Android : inchangée sur iPhone à encoche, sur SE et sur Android en
gestes ; 108 en navigation à trois boutons, soit la même zone utile qu'en gestes.
Une barre d'Android a besoin de 10 dp de plus qu'un iPhone pour son icône et son
libellé, mesurés. Le composer lit déjà cette hauteur.

**Les accents.** Les titres display gardent leur interligne serré, et réservent
au-dessus de leur première ligne la hauteur des accents d'Extenda, en `paddingTop`
rendu en `marginTop` négative : la mise en page ne bouge pas, seul le dessin gagne
la place. Mesuré au lot 1, au pixel : le circonflexe de « BOÎTE » dépasse la boîte
de sa ligne de 4,0 pt sur iPhone 17 Pro et de 3,2 dp sur Pixel 8, l'accent grave de
« RÈGLES » de 4,3 et 3,1, soit 0,10 à 0,15 em. La réserve vaut **un quart d'em**,
et n'est posée que si la première ligne porte un accent : « MON BENTO » ne bouge
pas d'un point.

### 5.3 Le lecteur d'écran

- **Une case de consultation est un seul élément** : `accessible`, libellé
  « Film : Inception, 2010 », sans rôle d'image. L'initiale en filigrane est
  cachée au lecteur dans toutes les cases.
- **Une case vide sans action n'est pas un bouton** : l'écran de mécanique rend
  six emplacements décrits, « Case film ».
- **La loupe devient l'icône SVG** de la barre d'onglets (`TabIcons.tsx`),
  cachée au lecteur, identique sur les deux plateformes.
- **Chaque champ a un libellé** : « Chercher un film », selon la case ;
  « Pseudo ».
- **Les onglets en français** : « Compose, onglet 1 sur 4 », par
  `tabBarAccessibilityLabel`, sur les deux plateformes.
- **Les toasts s'annoncent** : `AccessibilityInfo.announceForAccessibility` à
  l'affichage. Leur action devient un bouton libellé, cible de 44 pt.
- **La perte et le retour de connexion s'annoncent** : « Pas de connexion »,
  « Connexion rétablie ».
- **Les titres d'écran sont des en-têtes** : composer, « Trouver », crédits,
  accueil, en-tête de la modale.
- **Rôle selon l'action** : lien pour une adresse externe, bouton pour le reste.
- **Cibles de 44 pt** par `hitSlop` : fermer, retour, « Options », suggestions,
  action d'un toast. Les onglets gardent la hauteur de la barre.
- **L'en-tête de la modale se lit en entier** : « Case Créateur de contenu ».

### 5.4 Les parcours

**Comptes bloqués.** Une section « Comptes bloqués » dans le profil, sous
« Compte », visible dès un compte bloqué : une ligne par pseudo, bouton
« Débloquer », toast « @x débloqué ». Bloquer depuis une page ramène à l'écran
précédent avec le toast « @x est bloqué. Tu peux le débloquer depuis ton profil. »,
et la confirmation le dit.

**Le bandeau hors ligne ne recouvre plus rien.** Il garde sa place et sa hauteur,
figée, et chaque écran descend son contenu d'autant quand l'appareil est hors
ligne, par un seul hook, `useOfflineInset()`. Les modèles de la page publique et
du composer comptent cette hauteur. Une modale native d'iOS, où le bandeau ne se
voit pas, ne descend rien.

**La ligne « Ajouter » disparaît sur un titre exact.** Fonction pure
`hasExactTitle(query, results)` : titres nettoyés par `cleanTitle`, casse,
accents, espaces et ponctuation ignorés. « squeezie », « Squeezie » et « SQUEEZIE »
masquent la ligne ; « Squeezie Fan » la laisse.

**Des messages pour des personnes.** `userErrorMessage(action, error)` rend une
phrase par action, « Le retrait n'a pas marché. Réessaie. », et « Pas de
connexion. Réessaie quand tu es en ligne. » sur une panne réseau. Le détail part
au journal. Le bandeau de la modale dit « La recherche n'a pas abouti. Vérifie ta
connexion. »

**Des suggestions de pseudo acceptables.** Les suggestions qui tombent sous les
deux motifs de marque de `blocked_pseudo_patterns` sont écartées, et le badge dit
« Réservé » au lieu de « Libre » ; un test relit ces motifs dans la migration. Le
refus serveur d'un autre motif devient « Ce pseudo n'est pas disponible. Choisis-en
un autre. »

**Le composer ne montre pas un bento vide pendant son chargement** : tant que la
première hydratation du démarrage n'a pas répondu, il rend le squelette de boîte
du fil (`BentoBoxSkeleton`) et un bouton inactif.

**Les tirets cadratins** deviennent virgule ou deux-points ; après l'arobase,
le tiret long d'un pseudo manquant devient « … ».

### 5.5 Les titres de case

**Un titre rétrécit jusqu'à tenir entier en deux lignes, jusqu'à 0,75 de sa
taille** ; au-delà, il se tronque comme aujourd'hui. `tileTitleScale` passe du
premier mot à la mise en lignes entière, avec la même mesure des glyphes et le
même arrondi d'Android. Le fil, la page publique, le composer et l'image de
partage en profitent. Attendu par le modèle : de 29 à 13 cases tronquées sur 162
sur le fil.

### 5.6 Contrastes, dans la palette

- Encre à 55 % portée à **65 %** : 5,16 sur jaune, 6,05 sur crème.
- Placeholders et onglets inactifs à **60 %** : 5,25 sur blanc.
- Libellé d'une case vide à **60 %** : 5,10 sur crème.
- Action d'un toast de succès **à l'encre**, soulignée : 11,86.
- Texte du bandeau d'erreur de la modale **à l'encre**, bordure rouge gardée.

Les rouges de marque ne changent pas (§3, D18).

---

## 6. Contrat technique

Rien en base, rien de natif. Modules touchés ou créés :

| Module | Rôle |
|---|---|
| `components/bento/font-scaling.ts` | les quatre plafonds |
| `components/bento/compose-layout.ts` | budget du composer avec `fontScale`, hauteurs de ligne, défilement sous le plancher |
| `components/bento/tile-title.ts` | mise en lignes entière et plancher de 0,75 |
| `lib/display-title.ts` | réserve des accents d'Extenda, règle des titres |
| `lib/exact-title.ts` | `hasExactTitle` |
| `lib/user-error-message.ts` | messages d'erreur par action |
| `lib/pseudo.ts` | suggestions filtrées, motifs de marque |
| `lib/use-offline-inset.ts` | hauteur du bandeau hors ligne à réserver |
| `lib/announce.ts` | annonces du lecteur d'écran |
| `state/blocked.ts` | liste triée pour le profil |

Chaque module pur a son test `node:test`. Les écrans suivent.

---

## 7. Stratégie de test et de recette

### 7.1 Tests unitaires, `node:test` + `tsx`

- Le garde-fou des plafonds sur tout le code (§5.1), avec un seuil qui empêche le
  test de passer à vide.
- Le budget du composer à cinq tailles de police et quatre écrans, dont Android
  à la taille par défaut.
- La règle des titres de case sur les titres relevés en §4.7.
- `hasExactTitle`, `userErrorMessage` (aucune chaîne technique ni anglaise ne
  sort), les suggestions de pseudo contre les motifs relus dans la migration, la
  réserve des accents, la hauteur de la barre d'onglets.
- Un test d'arbre syntaxique : aucune `Alert` n'affiche `error.message`, aucun
  `Pressable` sans rôle, aucun emoji dans un texte d'interface.

### 7.2 Recette, bloquante

Même montage qu'en §4.1. À chaque lot, les captures avant et après, et les arbres
d'accessibilité.

| Appareil | Tailles |
|---|---|
| iPhone SE | défaut, xxLarge, xxxLarge, AX1, AX5 |
| iPhone 17 Pro | défaut, xxxLarge, AX3, AX5 |
| Pixel 8, 411 dp | 1,0, 1,3, 2,0 ; gestes et trois boutons |
| Émulateur à 360 dp | 1,0, 2,0 |

Écrans : les quatre de l'accueil, composer vide et plein, modale, fil, « Trouver »
et ses résultats, profil avec et sans comptes bloqués, crédits, page publique et
ses états, bandeau hors ligne.

**Au pixel, à la taille par défaut sur iOS** : fil, page publique et image de
partage identiques avant et après, hors cases dont le titre rétrécit ; composer
identique hors bouton et squelette.

**Le lecteur d'écran** : arbre complet de chaque écran, relevé deux fois à
quelques secondes d'écart, zéro élément tapable générique au second, zéro emoji,
zéro champ sans libellé ; annonces vérifiées par test.

### 7.3 Ce qui reste à l'appareil réel, pour Clément

Dix minutes, sur une build installée, une fois le chantier accepté. Aucun
simulateur ne peut trancher ces cinq points.

1. **Haptique** : remplir une case dans le composer, puis en vider une. Le retour
   doit se sentir une fois, au moment de la validation, jamais en double. Un
   simulateur n'a pas de moteur.
2. **VoiceOver et TalkBack**, un parcours entier, écouteurs mis : accueil,
   composer, une case remplie, publication, page publique. Vérifier que l'ordre
   de lecture suit l'écran, que « Case Film » s'annonce avant son contenu, qu'un
   toast se dit tout seul, et qu'aucun libellé ne s'annonce en anglais. L'arbre
   d'accessibilité dit les rôles et les libellés ; la voix, l'ordre et le
   phrasé.
3. **Fluidité du fil**, sur une build de production : dérouler « La table » d'un
   bout à l'autre, deux fois. L'émulateur saccade de base et la build de recette
   est une build de débogage : ni l'un ni l'autre ne prouve quoi que ce soit.
4. **Aperçus de partage** : envoyer son lien de bento dans iMessage, WhatsApp et
   Discord, vérifier l'image et le titre. La landing est déjà validée par
   `verify-prod.sh` ; ce sont les messageries qui restent.
5. **Démarrage en mode avion**, deux fois : app fermée, avion activé, ouverture.
   L'app doit s'ouvrir, sans rester sur le jaune. Une build de développement ne
   peut pas le montrer, elle charge son code depuis Metro.

Relevé au passage, à ne pas confondre avec un défaut du chantier : **hors ligne,
un compte connu retombe sur l'accueil**, le profil n'étant pas gardé sur
l'appareil. Cf. §12.

---

## 8. Plan de développement

Effort réévalué : **L**, cinq lots.

### Lot 1 · La police système · livré

Plafonds et règles de §5.1 sur tous les écrans, garde-fou étendu. Accueil
défilant, composer au modèle, profil, crédits, modale, `TopChip`, toasts,
bandeaux. Barre d'onglets : libellés et navigation à trois boutons. Accents.

**Écarts au plan, tous mesurés** : l'écart du bouton du composer devient
compressible (§5.2) ; la barre d'onglets prend une marge de référence par
plateforme (§5.2) ; le rétrécissement automatique est retiré là où le texte tient
toujours (§5.1) ; la loupe SVG garde la boîte de l'emoji, 23 sur 19 pt, pour ne
déplacer ni le champ ni la barre.

**Vérifié.** 396 tests verts, dont 22 nouveaux ; typecheck et lint propres ; deux
défauts injectés attrapés par le garde-fou, avec leur ligne.

- **iPhone 17 Pro, taille par défaut, avant et après** : « La table », les crédits
  et la page publique identiques au pixel ; le composer identique hors le libellé
  de son bouton, redessiné un tiers de point plus bas par la hauteur de ligne
  posée ; la modale et « Trouver » ne changent que dans la boîte de la loupe ;
  l'accueil ne change que par ses accents ; le profil montre son pseudo sur une
  ligne, ce qui remonte le reste de 36 pt, le défaut corrigé.
- **iPhone 17 Pro à la plus grande taille d'accessibilité** : les quatre écrans
  d'accueil exposent leur action, aucun mot coupé, le bouton du composer reste
  au-dessus de la barre d'onglets.
- **iPhone SE**, taille par défaut, xLarge, xxLarge, xxxLarge et AX5 : action
  d'accueil toujours atteignable, bouton du composer toujours 12 pt au-dessus de
  la barre.
- **Pixel 8, 411 dp**, polices 1,0, 1,3 et 2,0 : bouton du composer entier
  au-dessus de la barre, libellés d'onglets entiers, `StampButton` ramené de 73 à
  54 dp, comme iOS. En navigation à trois boutons, la barre passe à 108 dp et son
  libellé n'est plus coupé. À 360 dp, mêmes résultats.

### Lot 2 · Le lecteur d'écran · livré

§5.3 : cases regroupées, filigrane caché, cases vides décrites, loupe SVG,
libellés, onglets en français, annonces, en-têtes, rôles, cibles de 44 pt.

**Écarts au plan** : les onglets en français et la loupe SVG sont partis avec le
lot 1, qui touchait les mêmes lignes. Les annonces se construisent dans un module
pur, testé, et l'appel au système reste dans les écrans : le module doit rester
chargeable sous `node:test`.

**Trouvé en chemin, par le garde-fou** : deux tapables désactivés qui ne le
disaient pas, « Proposer au catalogue » pendant l'envoi et une carte de crédits
sans lien.

**Vérifié.** 406 tests verts, dont 10 nouveaux ; typecheck et lint propres.
Arbres d'accessibilité relevés sur les deux plateformes :

- **page publique** : chaque case est un élément unique, « Film : Inception »,
  au lieu de trois textes dont la lettre en filigrane ;
- **écran de mécanique** : six cases décrites, plus aucun bouton qui ne fait
  rien ;
- **modale** : en-tête « Case Film » au lieu de « Case · FILM » lu tel quel,
  champ libellé « Cherche un film… » ;
- **profil** : pseudo en en-tête, « Crédits », « Exporter » et « Retirer »
  annoncés comme des boutons, les deux adresses externes comme des liens ;
- **toast** : « LIEU : KYOTO » annoncé à l'affichage, son action exposée en
  bouton « Annuler » sur une cible de 44 pt.

Un avertissement de développement d'expo-router apparaît sur Android quand un
lien profond arrive pendant le démarrage (`useLinking.native.js:127`) : il vient
de la bibliothèque, pas du chantier, et n'existe qu'en mode développement.

### Lot 3 · Les parcours · livré

§5.4 : comptes bloqués, bandeau hors ligne, ligne « Ajouter », messages
d'erreur, pseudos suggérés, squelette du composer, tirets cadratins.

**Écarts au plan** : le squelette ne suffisait pas. Pendant qu'il s'affiche, la
ligne de progression annonçait « 0 / 6 », soit exactement ce que le squelette
refuse de dire, et le bouton proposait « Commence par ton film ». La ligne est
donc muette et invisible tant que la première lecture n'a pas répondu, cachée au
lecteur d'écran comme à l'œil, et le bouton porte « Chargement… ».

**Trouvé en chemin** : le bouton de l'app, désactivé, se présentait comme actif.
Sous le runtime JSX de NativeWind, un `style={({ pressed }) => …}` sur un
`Pressable` **n'est pas appliqué du tout**. Mesuré sur le CTA du composer, sonde
bordure bleue de 6 pt : en forme fonction, bordure noire pleine et rouge
`#e63946` inchangé ; en forme tableau, bordure bleue à 50 % et rouge à
(240, 124, 53). `StampButton` avait ainsi perdu en silence les trois choses que
ce style portait : l'ombre stamp de la DA, l'enfoncement à l'appui et le grisé
de l'état désactivé. `FeedPost` avait relevé le même symptôme sur ses marges,
sans en tirer la règle. Corrigé, l'appui étant désormais suivi à la
main, et gardé par un test de source : aucun tapable ne confie plus son style à
une fonction.

**Vérifié.** 421 tests verts ; typecheck et lint propres. Relevés :

- **blocage** : depuis la page publique, retour à l'écran précédent et message ;
  le compte apparaît dans « Comptes bloqués » du profil, où le débloquer le
  retire de la liste et l'annonce ;
- **mode avion, Pixel 8** : le bandeau ne recouvre plus ni le bouton retour de
  la page publique, ni « Options », ni le logo du composer ; la boîte du bento
  reste au-dessus de la barre d'onglets ;
- **« Squeezie » dans la case Créateur** : la tuile trouvée, et plus de ligne
  « Ajouter « Squeezie » » ; « Squeezie Fan » la garde ;
- **pannes provoquées au relais** : « Pas de connexion. Réessaie quand tu es en
  ligne. » sur les deux plateformes, dont le message iOS réel, « fetch failed:
  UnexpectedException: The network connection was lost », relevé au journal
  Metro et ajouté à la reconnaissance ;
- **démarrage à 10 s par requête, iPhone 17 Pro** : le bento montre son
  squelette, la ligne de progression est absente de l'arbre d'accessibilité et
  de l'écran, le bouton annonce « Chargement… » et `enabled=false`, bordure
  mesurée à (130, 100, 23) et fond à (240, 124, 53), soit l'encre et le rouge à
  50 % sur le jaune. Même état sur Pixel 8, fond à (227, 114, 51) ;
- **ombre stamp retrouvée, iPhone 17 Pro** : sous le bouton, 3 pt de noir avant
  le correctif, 7 pt après, soit la bordure plus les 4 pt d'ombre ; à l'appui,
  le bouton descend de 2 pt et son ombre disparaît. Sur Pixel 8, l'élévation
  dessine 6 dp de dégradé sous le bouton.

### Lot 4 · Titres de case et contrastes · livré

§5.5 et §5.6.

**Écarts au plan** : les encres transparentes ne sont plus des littéraux
recopiés. Dix-huit `rgba(10,10,10,0.55)` vivaient dans onze fichiers, plus des
0,5, 0,4 et 0,35 ailleurs : elles tiennent maintenant dans
`primitives/ink.ts`, deux encres nommées par leur usage, avec leur rapport de
contraste en commentaire et un garde-fou de source qui refuse tout texte sous
60 % d'encre. « Vider », dans la modale, passe aussi à l'encre : le rouge sur le
crème n'y donnait que 3,77 : 1, et §5.6 veut les actions à l'encre.

**Trouvé en chemin, et c'était un blocage** : le squelette du lot 3 pouvait ne
jamais partir. `hydrateBentoFromRemote` posait `hydrated` **seulement** quand la
lecture rapportait des cases ; un compte sans bento, une ligne sans cases ou une
lecture en échec laissaient le composer sur son squelette et son bouton
« Chargement… » pour toujours, donc sans aucun moyen de composer. Relevé sur
l'émulateur Pixel 8, dont le compte n'avait pas encore de bento : bloqué au
démarrage suivant. La première lecture se déclare maintenant terminée quoi
qu'elle trouve, cf. `markHydrated`, et une lecture qui échoue n'efface plus ni
les cases ni le profil déjà connus. Six tests couvrent les six sorties.

**Vérifié.** 432 tests verts ; typecheck et lint propres.

- **titres de case, modèle sur les 162 cases publiées et les 364 du catalogue**,
  quatre téléphones :

  | Écran | Tronquées avant | Après | Catalogue, avant → après |
  |---|---|---|---|
  | Fil et page publique, les quatre | 29 sur 162, 17,9 % | **13, 8,0 %** | 15,1 à 16,2 % → 5,5 à 6,0 % |
  | Composer, SE | 8 | **1** | 3,0 % → 0,5 % |
  | Composer, 17 Pro | 18 | **7** | 9,1 % → 2,7 % |
  | Composer, Pixel 8 | 20 | **8** | 11,0 % → 3,0 % |
  | Composer, Android 360 dp | 19 | **8** | 10,4 % → 3,0 % |

  Le prix est de 14 à 18 cases écrites sous 80 % de leur taille sur le fil,
  contre 2 à 3 avant ;
- **A/B au pixel, page publique de @tomtom sur iPhone 17 Pro** : « JOUEUR / DU
  GREN… » devient « JOUEUR DU / GRENIER », et la seule zone de l'écran qui
  change fait 73 × 22 pt, la case Créateur. Même titre entier sur Pixel 8 ;
- **contrastes mesurés à l'écran** : le pseudo du composer rend exactement
  (94, 73, 19), soit l'encre à 65 % sur le jaune, 5,16 : 1 au lieu de 3,84 ; le
  libellé d'un onglet inactif rend (108, 108, 108), l'encre à 60 % sur le blanc,
  5,25 : 1 au lieu de 2,71 ; l'onglet actif reste à l'encre pleine ;
- **calculés** : libellé d'une case vide de consultation 5,02 : 1 au lieu de
  2,32 ; bandeau d'erreur de la modale 15,64 au lieu de 3,29 ; « Supprimer mon
  compte » 11,86 au lieu de 2,36 ; action d'un toast de succès 11,86 au lieu de
  2,50, d'un toast neutre 17,89 au lieu de 3,77, d'un toast d'erreur 4,17 au
  lieu de 2,50. Les cadres et fonds rouges ne bougent pas : c'est le texte qui
  passe à l'encre ;
- **démarrage réseau coupé** : la lecture échoue, le composer affiche ce qu'il a
  au lieu d'attendre ; le profil connu reste en place après un aller-retour
  d'onglet, 89 requêtes coupées au relais.

### Lot 5 · Recette et mesures · livré

La matrice, la mise à jour de `RECETTE-MOBILE.md` et de la roadmap, la liste pour
l'appareil réel.

**Trouvé en chemin** : sur un iPhone SE à la troisième taille d'accessibilité,
la fin de la phrase d'accroche du splash, « lieu de cœur : six cases, une carte
de visite culturelle », disparaissait sous le bouton, **et l'écran ne défilait
pas** : deux balayages ne changeaient rien à la capture. La cause est un ressort
à hauteur minimale dans une boîte de défilement en `flexGrow: 1` : l'enfant ne
peut plus se réduire, la boîte reste à la hauteur de l'écran, et ce qui dépasse
est rogné au lieu de défiler. La mascotte n'a plus de hauteur minimale et
s'efface quand la place descend sous la moitié de sa taille, cf. `splash.tsx` :
un décor cède la place à un texte. Vérifié identique **au pixel près** à la
taille par défaut, sur iPhone SE comme sur 17 Pro, `getbbox()` vide.

**Matrice parcourue**, onze écrans à chaque fois, capture et arbre
d'accessibilité : composer, fil, « Trouver », profil, modale, crédits, page
publique et les quatre écrans de l'accueil.

| Appareil | Tailles | Résultat |
|---|---|---|
| iPhone 17 Pro | défaut, AX5 | onze écrans, action principale présente partout, aucun texte coupé |
| iPhone SE | défaut, AX3 | idem, après le correctif du splash |
| Pixel 8, 411 dp | 1,0, 2,0 | idem, bouton du composer au-dessus de la barre |

- **Arbres, taille par défaut sur 17 Pro** : sur les onze écrans, aucun élément
  tapable générique, aucun emoji lu, aucun champ ni bouton sans libellé ;
- **captures** : les boutons désactivés se voient enfin, « Continuer » tant que
  les règles ne sont pas cochées et « Valider mon pseudo » sur un champ vide ;
- **avertissement de développement** : expo-router pose un bandeau LogBox
  pendant la navigation, « Can't perform a React state update on a component
  that hasn't mounted yet », dont la pile de composants ne cite que
  `ContextNavigator` et `ExpoRoot`. Il vient de la bibliothèque, n'existe pas en
  production, et masque la barre d'onglets pendant une recette : à fermer avant
  chaque série.

- **A/B au pixel contre `main`, iPhone 17 Pro à la taille par défaut**, seuil
  40 : sur le **fil**, seule la barre d'onglets change, de 810,3 à 843 pt ; sur
  la **page publique**, seule la case au titre rétréci, 73 × 22 pt ; sur le
  **composer**, seuls son bouton et sa barre, à partir de 745,3 pt. Tout le reste
  de ces trois écrans est identique au pixel près, en-têtes, grilles et cases
  comprises.

**Documents** : `RECETTE-MOBILE.md` reçoit six pièges de plus, tous rencontrés
ici ; la roadmap passe le chantier 11 en implémenté, réévalue son effort de S à L
et vide sa checklist appareil de ce qu'un simulateur a pu trancher.

---

## 9. Livraison

Relevé le 15 septembre 2026 à 23 h : l'App Store sert la 1.1, le Play Store la
0.1.0, la runtime `1.2.0` ne sert aucune mise à jour (204 sur iOS et Android), et
aucune dépendance native n'a changé depuis la build 1.2.0. Le chantier 11 est du
JavaScript seul : il peut partir en mise à jour à distance sur la runtime 1.2.0
comme dans une nouvelle build.

**Recommandé : une nouvelle build 1.2.0**, iOS build 11 et Android versionCode 13,
qui embarque les chantiers 6, 7 et 11, **avant la mise en revue App Store**. Les
testeurs et la revue voient l'app telle qu'elle sortira, et une inscription
impossible aux grandes tailles de police ne part pas en revue. La mise à jour à
distance reste la voie des correctifs d'après sortie. **Rien n'est lancé sans
l'accord de Clément.**

---

## 10. Definition of Done

État au 16 septembre 2026, les cinq lots implémentés, **rien commité ni
publié**. Les vingt-trois critères sont tenus au simulateur et à l'émulateur.
Restent les cinq points de §7.3, qu'aucun des deux ne peut trancher, et la CI,
qui tournera au commit.

| # | Critère | Vérifié par | État |
|---|---|---|---|
| 1 | Action principale atteignable sur les quatre écrans de l'accueil, à toutes les tailles, SE, 17 Pro, 411 et 360 dp | recette, arbres | ✅ onze écrans, SE et 17 Pro à leurs extrêmes, Pixel 8 à 1,0 et 2,0 |
| 2 | Composer : grille et bouton jamais sous la barre d'onglets, Android à la taille par défaut compris | recette, modèle testé | ✅ modèle testé, captures des deux plateformes |
| 3 | Aucun mot coupé ni texte hors de l'écran, sur tous les écrans, au maximum de chaque plateforme | captures | ✅ hors le splash du SE, corrigé au lot 5 |
| 4 | Aucun texte de l'app sans plafond ni police figée | garde-fou | ✅ garde-fou de source, 432 tests verts |
| 5 | Accents des titres entiers, taille par défaut et plafond, deux plateformes | captures | ✅ réserve d’accent mesurée, 4,0 pt sur 17 Pro, 3,2 dp sur Pixel 8 |
| 6 | Libellés d'onglets entiers à 2,0 ; barre au-dessus de la navigation à trois boutons | captures | ✅ 108 dp en trois boutons |
| 7 | Une case de consultation se lit en un élément ; aucun filigrane, aucun emoji lu | arbres | ✅ |
| 8 | Aucun élément tapable générique au second relevé, aucun champ sans libellé, onglets en français, titres d'écran en en-têtes | arbres | ✅ onze arbres relevés, aucun défaut |
| 9 | Toasts et connexion annoncés ; cibles relevées à 44 pt au moins | tests, arbres | ✅ |
| 10 | Débloquer depuis le profil ; retour et message après un blocage | parcours | ✅ parcours joué sur les deux plateformes |
| 11 | Le bandeau hors ligne ne recouvre aucun contrôle | mode avion, captures | ✅ mode avion sur Pixel 8 |
| 12 | Pas de ligne « Ajouter » sur un titre exact, toujours là sinon | test, recette | ✅ |
| 13 | Aucun message technique ni anglais à l'écran | test, pannes provoquées | ✅ pannes provoquées au relais, iOS et Android |
| 14 | Aucune suggestion de pseudo refusée à la validation | test, recette | ✅ |
| 15 | Pas de bento vide affiché pendant un chargement lent | relais retardé | ✅ relais à 10 s par requête |
| 16 | Cases tronquées sur le fil : 13 sur 162 au plus, par le modèle | test, captures | ✅ 13 sur 162, mesuré sur les quatre téléphones |
| 17 | Textes corrigés de §5.6 à 4,5 : 1 au moins | calcul | ✅ sept textes corrigés, deux mesurés à l’écran |
| 18 | Fil, page publique et image de partage identiques au pixel à la taille par défaut sur iOS, hors titres rétrécis | A/B | ✅ A/B au pixel : le fil ne change que dans sa barre d’onglets, la page publique que dans la case au titre rétréci, le composer que dans son bouton et sa barre |
| 19 | Suite verte : tests, typecheck, lint | CI | ✅ 432 tests, typecheck et lint propres ; CI à faire tourner au commit |
| 20 | Liste de l'appareil réel remise à Clément | §7.3 | ✅ §7.3, cinq points |
| 21 | Bouton désactivé visiblement désactivé ; ombre stamp et enfoncement rendus ; aucun tapable au style en fonction | captures, garde-fou | ✅ mesuré au pixel, iOS et Android |
| 22 | Le composer sort de son squelette quoi que dise la lecture : bento absent, vide, ou en échec | tests, émulateur | ✅ |
| 23 | Aucun texte ni icône sous 60 % d'encre | garde-fou de source | ✅ |

---

## 11. Décisions

### 11.1 Prises le 15 septembre en l'absence de Clément, validées le 16

Chaque ligne était l'option recommandée ; toutes ont été retenues telles quelles,
alternatives comprises dans la dernière colonne pour mémoire.

| # | Question | Retenu | Écarté, et pourquoi |
|---|---|---|---|
| D1 | Périmètre | la liste de la roadmap, la checklist, les deux observations du chantier 15 et les défauts nouveaux mesurés | la liste seule laisserait l'inscription fermée et les onglets en anglais |
| D2 | Ordre des lots | police, lecteur, parcours, titres et contrastes, recette | le lecteur d'abord : l'inscription fermée est le seul défaut bloquant |
| D3 | Plafonds | 1,4 lecture, 1,2 contrôles, titres et cases | un plafond unique à 1,4 : les boutons décident de hauteurs, déjà mesuré au chantier 7 |
| D4 | Titres display | pas de coupure de mot, rétrécissement, sauts de ligne explicites | tronquer : le titre d'un écran d'accueil perdrait son sens |
| D5 | Accueil aux grandes tailles | contenu défilant, action fixe en bas | tout défilant : l'action sortirait de l'écran ; réduire la police en dessous du plafond : illisible |
| D6 | Composer | modèle avec police et hauteurs de ligne posées, défilement sous le plancher | mesurer à l'exécution : un second rendu déplace la boîte |
| D7 | Hauteur des `StampButton` sur Android | celle d'iOS, par la hauteur de ligne posée | garder 73 dp : le composer resterait faux sur Android |
| D8 | Proportions du composer | inchangées | les corriger change l'écran principal pour tous, arbitrage produit |
| D9 | Barre d'onglets | libellés plafonnés sur Android, hauteur `84 + max(0, marge − 34)` | figer les libellés comme iOS : ils ne grossiraient plus du tout |
| D10 | Case de consultation | un élément, libellé complet, filigrane caché | garder le rôle d'image : VoiceOver dirait « image » |
| D11 | Loupe | icône SVG existante | emoji caché au lecteur : rendu toujours différent |
| D12 | Annonces | `announceForAccessibility` | région vivante Android seule : iOS resterait muet |
| D13 | Comptes bloqués | section du profil | écran dédié : une route pour une liste de quelques lignes |
| D14 | Bandeau hors ligne | le contenu descend, par un hook commun | bandeau en bas : il couvrirait les boutons collants de la page publique |
| D15 | Ligne « Ajouter » | masquée sur titre exact normalisé | la garder en second plan : elle invite encore au doublon |
| D16 | Pseudo suggéré | filtre des deux motifs de marque, message humain pour les autres | recopier les 41 motifs dans l'app : la table change depuis le back-office |
| D17 | Titres de case | rétrécir jusqu'à tenir entier, plancher 0,75 | 0,6 : 3 à 5 cases tronquées mais un texte trop petit ; laisser : 29 cases |
| D18 | Contrastes | opacités d'encre et actions à l'encre ; rouges de marque inchangés | changer le rouge : décision de marque, à trancher par l'équipe |
| D19 | Livraison | nouvelle build 1.2.0 avant la revue | mise à jour à distance : la revue verrait l'ancienne app |
| D20 | Commits | un par lot, après accord | un seul en fin de chantier : cinq lots impossibles à relire séparément |
| D21 | `StampButton` privé de style | style en tableau, appui suivi à la main, ombre stamp et grisé rendus | laisser la forme fonction : le bouton resterait sans ombre et un bouton inerte continuerait de se présenter comme actif |
| D22 | Encres transparentes | deux encres nommées dans `primitives/ink.ts`, 65 % et 60 %, garde-fou de source | corriger les dix-huit littéraux sur place : la prochaine couleur recopiée repasserait sous le seuil sans que rien ne le dise |
| D23 | Fin de la première lecture | `markHydrated` sur toutes les sorties, sans toucher aux cases ni au profil | garder la seule sortie heureuse : un compte sans bento restait bloqué sur « Chargement… » |
| D24 | Mascotte du splash quand la place manque | elle s'efface, mesure par `onLayout`, plus de hauteur minimale | la garder : la fin de l'accroche restait rognée et inaccessible sur un SE aux grandes tailles |

---

## 12. Suivis

- **`shared_items` compte deux fois un bento** qui porte le même item dans deux
  cases, possible depuis que Artiste et Créateur sont des Personnes : « Squeezie,
  présent dans 5 bentos » pour 4, mesuré en local ; 0 bento concerné en
  production. Tâche séparée proposée.
- **Les proportions de la boîte du composer** (D8).
- **Les rouges de marque sous 4,5 : 1** (D18).
- **Le blocage par pseudo** se contourne en changeant de pseudo, et aucun
  serveur ne le connaît : fondation 2 de la roadmap, chantier 22.
- **Hors ligne, un compte connu retombe sur l'accueil.** Le profil n'est pas
  gardé sur l'appareil : au démarrage sans réseau, la session ne se renouvelle
  pas, le profil reste nul, et l'app propose de s'inscrire à quelqu'un qui a déjà
  un bento. Mesuré au chantier 11, relais coupé, sur iPhone 17 Pro. Le composer,
  lui, ne se bloque plus (D23). Défaut ancien, hors périmètre ici : il demande de
  persister le profil, donc un arbitrage sur ce que l'app montre hors ligne.
- **Le libellé d'une case vide de consultation** passe à 60 % d'encre par le
  calcul (5,02 : 1) : aucun bento publié du jeu de recette n'a de case vide, donc
  rien ne l'a montré à l'écran. À regarder à la première page publique
  incomplète.
- **Les onglets inactifs de la barre** sont à 60 % d'encre sur blanc, 5,25 : 1.
  Le gris qui en résulte est plus sombre qu'avant : à valider à l'œil par Rob,
  DA, avant la mise en revue.
