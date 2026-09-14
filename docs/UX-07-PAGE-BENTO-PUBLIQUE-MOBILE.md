# Chantier 7 · Page bento publique dans l'app

> Spécification écrite le 14 septembre 2026, à partir de mesures faites le jour
> même sur la production et sur trois tailles d'écran au simulateur. Chantier 7
> de [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
>
> Ne pas confondre avec [`UX-01-PAGE-BENTO-PUBLIQUE.md`](./UX-01-PAGE-BENTO-PUBLIQUE.md),
> qui décrit la page **web** `bento-pop.com/u/<pseudo>`. Ici il s'agit de
> l'écran `apps/mobile/app/u/[pseudo].tsx`.
>
> Hérite de [`UX-02-FIL-LA-TABLE.md`](./UX-02-FIL-LA-TABLE.md) §5.3 (l'échelle
> de la boîte se calcule sur la largeur, la boîte reçoit une marge et non une
> largeur) et de sa couche de données (client injecté, une seule requête).
> Hérite de [`UX-06-TROUVER.md`](./UX-06-TROUVER.md) le trafic : cette page est
> désormais le point d'arrivée de l'onglet « Trouver ».

---

## 1. Intention

Cette page est la seule chose que voit quelqu'un qui n'a pas l'app installée
sur son téléphone et à qui on a envoyé un bento, et depuis le chantier 6 c'est
aussi l'unique destination de la recherche. Tout ce que l'app produit de
partageable atterrit ici.

Elle est cassée sur tous les iPhone.

### 1.1 Le défaut de fond

`u/[pseudo].tsx:242` passe `scale={0.94}` en dur à `BentoGrid`. Cette valeur
ne vient d'aucun calcul : ni de la largeur de l'écran, ni de la place qui
reste. Elle a été choisie une fois, sur un écran, et elle est appliquée
partout.

Or `BentoGrid` ne met à l'échelle **que les hauteurs**. Sa largeur est celle
que lui donne son parent, les tuiles étant en `flex: 1`
(`BentoGrid.tsx:122-136`). Une échelle passée à ce composant n'est donc pas un
zoom : c'est une compression verticale. Le fil « La table » y échappe parce
qu'il dérive sa largeur de la même échelle (`feedSideInset`, §5.3 du chantier
2) ; la page publique, non.

Deux conséquences, mesurées en §4 :

- la boîte est **écrasée de 10 %** sur un iPhone 17 Pro, où elle fait 370 pt
  de large pour 482 de haut là où ses proportions natives en demandent 525 ;
- elle ne rentre nulle part. Sur les trois tailles d'écran mesurées, les
  boutons collants recouvrent le bas de la boîte : de 3 pt sur un 17 Pro, 18
  sur un 17e, **134 sur un iPhone SE**, où la moitié du bento est illisible et
  où rien ne permet de défiler.

La roadmap annonçait le défaut « sur un iPhone SE ». La mesure dit : partout.

### 1.2 La règle qui tient tout le chantier

> **La boîte a les mêmes proportions et la même taille que dans le fil, et
> rien ne la recouvre jamais.**

Un bento est un objet reconnaissable. Le voir dans « La table », puis le
retrouver dans la recherche, puis l'ouvrir en grand, ce doit être trois fois
le même objet. Aujourd'hui c'est trois géométries différentes.

Le corollaire technique est déjà écrit dans le dépôt, en commentaire de
`src/components/feed/layout.ts` : *« l'échelle se calcule sur la largeur (…)
la différence est notée ici pour qu'on ne "corrige" pas l'un avec l'autre »*.
Ce chantier étend cette règle à la page publique, et lui ajoute la seule
contrainte que le fil n'a pas : **la page tient en un écran, donc la hauteur
plafonne aussi**.

---

## 2. Objectif et critères de succès

| # | Critère | Mesure |
|---|---|---|
| 1 | Les six cases sont atteignables et lisibles sur iPhone SE | recette au point |
| 2 | Aucun bouton ne recouvre la boîte, sur aucune taille d'écran | modèle testé + trois captures |
| 3 | La boîte a les proportions natives 361 × 512 | rapport largeur / hauteur mesuré au pixel |
| 4 | Revenir sur un bento déjà consulté n'affiche aucun chargement | recette, requête réseau comptée |
| 5 | Un seul aller-retour réseau à l'ouverture | 89 ms → 46 ms mesurés en §4.4 |
| 6 | Une panne réseau ne dit plus « Bento introuvable » | recette en mode avion |
| 7 | L'écran tient à la plus grande taille de police système | capture |

---

## 3. Périmètre

**Dedans.**

- `apps/mobile/app/u/[pseudo].tsx` : géométrie, défilement, états, police.
- Un module de budget vertical testable, sur le modèle de `compose-layout.ts`.
- `loadPublicBentoByPseudo` : une requête au lieu de deux, client injecté,
  champs réduits à ce qui est rendu.
- `useQuery` et l'invalidation du cache par les mutations de `bento-actions.ts`.
- Le squelette de chargement de la boîte, partagé avec le fil.

**Dehors.**

- La page **web** `/u/[pseudo]` de la landing. Elle a sa propre géométrie
  (`DESIGN_HEIGHT`) et son propre chantier, le 1, livré.
- Le composer. Il calcule son échelle sur la hauteur et se retrouve à 0,67 sur
  un iPhone SE, donc probablement avec le même écrasement. Ce n'est pas cet
  écran-là qu'on livre aujourd'hui, et le corriger demande de rouvrir le
  budget vertical validé au chantier 2. **Suivi ouvert en §12.**
- Les 20 usages d'`Extenda` sans plafond de grossissement ailleurs dans l'app.
  Chantier 11. Seule cette page est traitée, parce qu'on ne livre pas un écran
  cassé.
- La liste des comptes bloqués. Chantier 11, versée par le chantier 6.
- Les compteurs de vues et réactions. Chantier 8.

### 3.1 Ce que la page fait déjà bien, et qu'on ne touche pas

- La pastille unique invité / coup de cœur, avec « invité » prioritaire, alignée
  sur `components/feed/ribbon.ts`.
- Le rendu hors écran de `ShareImage` par `translateX` et non par `opacity: 0`,
  avec le commentaire qui explique pourquoi. À déplacer, pas à modifier (§5.6).
- Le masquage du menu « Options » sur son propre bento.
- `readOnly` sur la grille, qui évite d'inviter à remplir la case d'autrui.

---

## 4. Ce que dit la production

Mesures du 14 septembre 2026. Corpus : **75 profils, 27 bentos publiés, 162
cases**.

### 4.1 Le cas que l'échelle devrait encaisser n'existe pas

Hypothèse de départ : des bentos publiés avec une case vide ou en modération,
qui changeraient la hauteur à prévoir. Vérifié sur les 27 bentos publiés,
en comparant la vue service-role et ce que la RLS laisse voir à un anonyme :

| Mesure | Valeur |
|---|---|
| Bentos publiés | 27 |
| Avec moins de 6 lignes `bento_items` | **0** |
| Avec au moins un item non `validated` | **0** |
| Avec 6 cases visibles par un anonyme | **27** |

La question était mal posée, pour une raison structurelle : `EmptyTile` reçoit
la **même hauteur** que `Tile` (`BentoGrid.tsx:76`). Une case vide ne change
pas d'un point la hauteur de la boîte. **La hauteur de la grille est une
constante, 512 pt à l'échelle 1, quel que soit son contenu.** Le problème de
place est donc purement géométrique, et il ne dépend d'aucune donnée.

Le cas reste atteignable : un item validé puis rejeté après publication
disparaîtrait de la vue anonyme. La fusion de doublons, elle, ne le produit
pas, `admin_merge_items` réécrivant `bento_items` vers l'item gagnant.

### 4.2 La géométrie réelle, mesurée sur trois écrans

Relevé par arbre d'accessibilité (`idb ui describe-all`, coordonnées en points)
et par analyse du pixel sur les captures, sur `bentopop://u/dark_hifus`.

Le haut de la page est une constante sur les trois appareils :

```
haut de la boîte = inset haut + 200
  barre du haut : paddingTop 8 + bouton 36            =  44
  en-tête       : 20 + avatar 70 + 8 + pseudo 24
                     + 4 + date 16 + paddingBottom 14 = 156
```

Vérifié à 0,1 pt près sur les trois : 261,9 sur un 17 Pro (inset 62), 247 sur
un 17e (inset 47), 219,9 sur un SE (inset 20).

Le bas aussi :

```
haut du bloc de boutons = hauteur écran − inset bas − 99
  padding 16 + bouton 51 + paddingBottom 32 = 99
```

Et la boîte, à l'échelle `s`, mesure `502 s + 10` (le cadre de 5 pt ne se met
pas à l'échelle en dessous de 3, `BentoGrid.tsx:69`). À 0,94 : **481,9 pt**,
retrouvé au pixel sur les captures après correction du rayon de coin.

D'où le recouvrement, qui est une soustraction :

| Appareil | Écran | Bas de la boîte | Haut des boutons | Recouvrement |
|---|---|---|---|---|
| iPhone SE (3e gén.) | 375 × 667 | 701,9 | 568 | **−133,9 pt** |
| iPhone 17e | 390 × 844 | 728,9 | 711 | **−17,9 pt** |
| iPhone 17 / 17 Pro | 402 × 874 | 743,9 | 741 | **−2,9 pt** |

Sur un iPhone SE, la boîte dépasse en plus de 35 pt sous le bord de l'écran :
sa bordure basse n'existe visuellement pas, et l'arbre d'accessibilité ne
contient **aucun des trois crédits photo** de la rangée du bas, présents sur
les deux autres appareils. Trois cases sur six sont hors d'atteinte.

### 4.3 La boîte n'a ses proportions sur aucun écran

`BentoGrid` prend la largeur de son parent, ici `screen − 32` :

| Appareil | Largeur de la boîte | Hauteur rendue | Hauteur proportionnelle | Écart |
|---|---|---|---|---|
| iPhone 17 Pro | 370 | 481,9 | 524,7 | **−8,2 %** |
| iPhone 17e | 358 | 481,9 | 507,7 | −5,1 % |
| iPhone SE | 343 | 481,9 | 486,4 | −0,9 % |

Le fil, lui, montre la boîte à 338 × 480 sur un 17 Pro, proportions exactes.
Le même bento a donc deux formes selon l'écran où on le regarde, et l'écart
est maximal sur le téléphone le plus courant.

### 4.4 Deux allers-retours là où un suffit

`loadPublicBentoByPseudo` (`bento-actions.ts:177`) enchaîne `findUserByPseudo`
puis une requête sur `bentos`. Les deux sont séquentielles : la seconde a
besoin de l'`id` de la première.

Mesuré avec la clé anonyme, sur les 27 pseudos publiés, depuis une connexion
filaire :

| Forme | p50 | p95 | max | octets |
|---|---|---|---|---|
| Deux requêtes séquentielles | **89 ms** | 106 ms | 116 ms | 2 512 |
| Une jointure imbriquée | **46 ms** | 50 ms | 60 ms | 2 527 |

L'économie est d'exactement un aller-retour. Sur une connexion filaire elle
vaut 43 ms ; sur un réseau mobile elle vaut un RTT, soit typiquement 100 à
200 ms. C'est la moitié du temps d'ouverture de la page, et depuis le chantier
6 c'est aussi la moitié du coût perçu d'une recherche qui, elle, répond en
48 ms.

`bentos.user_id` est `unique` (migration initiale, ligne 88), donc PostgREST
expose la relation en **un-à-un** : la jointure rend un objet, pas un tableau.
Vérifié sur les 27.

### 4.5 Un cinquième de la charge utile n'est jamais affiché

La requête demande `year`, `external_source` et `external_id`. La page les
jette : son mappage ne retient que `title`, `subtitle`, `image_url`,
`image_credit` et l'`id` (pour la palette). Elle demande aussi `created_at` et
l'`id` de l'utilisateur, inutilisés dès lors qu'il n'y a plus de seconde
requête à cibler.

| Sélection | Octets par ouverture |
|---|---|
| Champs demandés aujourd'hui | 2 530 |
| Champs réellement rendus | **1 991** |

**−21 %**, sans rien changer à l'écran. Le fil applique déjà cette discipline
(`FEED_SELECT`, avec le commentaire qui l'explique).

### 4.6 Une panne réseau dit « Bento introuvable »

`findUserByPseudo` avale l'erreur : `if (error || !data) return null`
(`pseudo.ts:53`). L'appelant ne peut donc pas distinguer trois situations très
différentes, et les présente toutes comme la première :

- le pseudo n'existe pas ;
- le pseudo existe mais n'a pas de bento en ligne ;
- le réseau est tombé.

Sur la page d'arrivée de tous les liens partagés et de toute la recherche,
c'est le pire endroit de l'app où mentir. Quelqu'un qui reçoit un lien dans le
métro apprend que le bento de son ami n'existe pas.

### 4.7 Rien n'est mis en cache

`useState` plus `useEffect` sur `[pseudo]` (`u/[pseudo].tsx:36-93`). Le
composant se remonte à chaque navigation, l'état repart à `{ kind: 'loading' }`
et les deux requêtes repartent. Depuis un résultat de recherche, revenir en
arrière puis rouvrir le même bento coûte deux allers-retours de plus et un
spinner.

Les images, elles, sont en cache : `Tile` utilise `expo-image` en
`cachePolicy="memory-disk"`. Le coût d'un retour est donc entièrement celui de
la donnée, celle-là même qui ne change pas.

### 4.8 Ce qu'un titre tronqué dit du besoin de signaler la case

Seuils de troncature relevés au pixel sur les captures, puis appliqués aux 162
cases publiées :

| Case | Taille de tuile | Titres au-delà du seuil |
|---|---|---|
| son | petite | **9 / 27 (33 %)** |
| série | moyenne | 6 / 27 (22 %) |
| film | grande | 4 / 27 (15 %) |
| artiste | moyenne | 1 / 27 |
| créa | petite | 1 / 27 |
| lieu | petite | 0 / 27 |
| **total** | | **21 / 162 (13 %)** |

Une arrivée sur huit depuis la recherche tombe donc sur une tuile qui n'affiche
pas en entier le titre cherché. Ce chiffre sert l'arbitrage de §5.5.

---

## 5. Design

### 5.1 L'échelle : le minimum de deux contraintes, avec un plancher

Un module pur, `src/components/bento/public-layout.ts`, sur le modèle exact de
`compose-layout.ts` : aucun import de `react-native`, donc chargeable et
testable sous `node:test`.

```ts
/** Barre du haut : paddingTop 8 + bouton 36. */
export const TOP_BAR_H = 44;
/** En-tête : 12 + avatar 70 + 8 + pseudo 24 + 4 + date 16 + 10. */
export const HEADER_H = 144;
/** Boutons collants : padding 16 + bouton 51 + paddingBottom 32. */
export const CTA_BLOCK_H = 99;
/** Écart minimal entre la boîte et le bloc de boutons. */
export const CTA_GAP = 8;
/**
 * Plancher d'échelle : ce que le fil montre déjà sur un iPhone SE, livré et
 * accepté au chantier 2. En dessous, la page publique montrerait le bento
 * plus petit que le fil sur le même écran, ce qui n'a pas de sens quand il
 * est la seule chose à l'écran.
 */
export const MIN_SCALE = 0.86;

export function publicBentoScale({ width, height, insetTop, insetBottom }): number {
  const byWidth = feedScale(width);                   // §5.3 du chantier 2
  const available = height - insetTop - insetBottom
                  - TOP_BAR_H - HEADER_H - CTA_BLOCK_H - CTA_GAP;
  const byHeight = available / GRID_HEIGHT;
  return Math.min(byWidth, Math.max(byHeight, MIN_SCALE));
}
```

Trois propriétés, dans cet ordre de priorité :

1. **jamais plus large que dans le fil** : `byWidth` est un plafond, donc la
   boîte de la page publique et celle du fil ont la même taille dès que la
   hauteur le permet ;
2. **jamais recouverte** : `byHeight` est un plafond aussi, calculé sur ce qui
   reste une fois les boutons servis ;
3. **jamais illisible** : `MIN_SCALE` est un plancher, et c'est lui qui décide
   quand la page défile.

La largeur de la boîte se déduit de l'échelle et s'applique en **marge**, pas
en `width` avec `alignSelf`. La raison est écrite au chantier 2 et a coûté un
diagnostic en build Release : une largeur posée sur un enfant étiré par son
parent ne tient pas sur iOS.

**L'en-tête rend 12 pt.** `paddingTop` passe de 20 à 12 et `paddingBottom` de
14 à 10. Ce n'est pas cosmétique : ces 12 pt sont exactement ce qui fait la
différence entre une boîte à la taille du fil et une boîte plus petite, sur
les deux tailles d'écran les plus courantes. Le calcul sans le rabot donne
0,920 sur un 17 Pro, contre 0,936 pour le fil, soit une boîte 6 pt plus
étroite que celle du fil sur le même écran.

Résultat attendu, à vérifier au point en recette :

| Appareil | Échelle | Boîte | Contrainte active | Défilement |
|---|---|---|---|---|
| iPhone 17 / 17 Pro | 0,936 | 338 × 480 | largeur (= le fil) | **aucun** |
| iPhone 17e | 0,903 | 326 × 463 | largeur (= le fil) | **aucun** |
| iPhone SE | 0,860 | 311 × 442 | plancher | ~90 pt |

Sur les grands écrans, `feedScale` plafonne déjà la boîte à 420 pt
(`MAX_BOX_WIDTH`) : rien à ajouter pour les tablettes.

### 5.2 La page défile, et presque jamais

Le corps devient un `ScrollView` dont le `contentContainerStyle` réserve
`CTA_BLOCK_H + CTA_GAP` en bas. Les boutons restent collants par-dessus.

C'est un filet, pas un mode de lecture. Par construction, sur tout écran où
`byHeight ≥ MIN_SCALE`, le contenu tient et le `ScrollView` ne défile pas d'un
point. Il ne sert que dans trois cas :

- les écrans où le plancher mord, aujourd'hui l'iPhone SE seul ;
- les grandes tailles de police système, où l'en-tête grossit (§5.4) ;
- toute future ligne ajoutée à l'en-tête, qui rétrécira la boîte puis fera
  défiler, au lieu de cacher une rangée.

**Ce qu'on abandonne, et pourquoi.** La roadmap disait « la grille est
entièrement visible sur iPhone SE ». La rendre visible sans défiler y demande
une échelle de **0,68**, soit une boîte de 245 pt de large sur un écran de
375, avec des tuiles de rangée basse de 62 pt de côté. On préfère 90 pt de
défilement à un bento illisible ; le critère devient « les six cases sont
atteignables et lisibles ».

**L'alternative écartée** est l'échelle dynamique du composer, calculée sur la
seule hauteur. Elle produit exactement ce 0,68, et elle reconduit l'écrasement
de §4.3 puisqu'elle ne touche pas à la largeur. C'est la réponse que la
roadmap proposait ; la mesure la disqualifie.

### 5.3 Quatre états, au lieu de trois dont un faux

| État | Aujourd'hui | Demain |
|---|---|---|
| Chargement | `ActivityIndicator` centré | **squelette de boîte**, à la place et à la taille exactes |
| Trouvé | la page | la page |
| Pseudo inconnu | « Bento introuvable » | « Bento introuvable » |
| Pseudo connu, rien en ligne | « Bento introuvable » | **« @x n'a pas de bento en ligne. »** |
| Réseau tombé | « Bento introuvable » | **« Connexion perdue » + Réessayer** |

Le squelette n'est pas un ornement. Un spinner centré n'annonce rien, puis la
page saute. Un squelette aux dimensions exactes de la boîte fait de l'arrivée
un remplissage plutôt qu'un changement d'écran, et c'est précisément ce qu'on
cherche quand la page est devenue le point d'arrivée d'une recherche à 48 ms.
`FeedPostSkeleton` existe (chantier 2) mais embarque l'étiquette du fil et
`POST_GAP` : on en extrait la partie boîte en `BentoBoxSkeleton`, utilisée par
les deux. Une seule source de proportions, comme pour `GRID_GEOMETRY`.

La distinction « pseudo connu, rien en ligne » sort gratuitement de la
jointure externe (§6.1). Le libellé est **« n'a pas de bento en ligne »** et
non « pas encore publié » : depuis le chantier 5 on peut dépublier, et « pas
encore » serait faux pour quelqu'un qui vient de retirer le sien.

L'état d'erreur reprend la forme de `SearchError` (`search.tsx:422`) : une
phrase, un bouton « Réessayer » qui appelle `refetch`.

### 5.4 La police maximale, qui détruit la page

Relevé au réglage `accessibility-extra-extra-extra-large`, captures à l'appui.

**Sur iPhone SE** : le chevron « ‹ » du bouton retour disparaît, son pastillon
blanc reste vide ; « OPTIONS » occupe la moitié de la largeur ; le pseudo passe
sur deux lignes et mange le tiers de l'écran ; il ne reste que les 30 premiers
points de la boîte ; « COMPOSE LE TIEN » est une pastille blanche sans texte.

**Sur iPhone 17 Pro, c'est pire** : la rangée de boutons, absolue en bas et
sans hauteur bornée, grandit vers le haut jusqu'à recouvrir **l'écran
entier**. « PARTAGER » devient un aplat noir sur toute la page.

Trois correctifs, tous sur cette page :

- `maxFontSizeMultiplier` sur chaque texte de l'écran, comme le chantier 6 l'a
  fait pour « Trouver » : 1,4 sur les textes de contenu, **1,2 sur les
  libellés de boutons**, qui décident d'une hauteur ;
- `numberOfLines={1}` sur les deux libellés de CTA, dont la rangée est le seul
  bloc qui peut grandir sans plafond ;
- le chevron du bouton retour rendu à taille fixe (`allowFontScaling={false}`) :
  c'est un glyphe dans une cible de 36 pt, pas du texte à lire.

Le `ScrollView` de §5.2 fait le reste : l'en-tête grossit, la boîte rétrécit
jusqu'au plancher, puis la page défile.

### 5.5 Signaler la case d'où l'on vient : **non**

C'était la question ouverte de la roadmap. Depuis le chantier 6, on arrive sur
cette page en s'attendant à une case précise ; faut-il la désigner ?

Décision : **non**, et la mesure explique pourquoi.

- La ligne de résultat **nomme déjà la case et le titre** : « Voir le bento de
  @dark_hifus, qui a Le Seigneur des anneaux dans sa case film ». On n'arrive
  pas en cherchant, on arrive en sachant.
- Après ce chantier, **les six cases sont visibles d'un coup**, ce qui n'est
  vrai aujourd'hui sur aucun téléphone. Le vrai remède au « je cherche ma
  case » est là, pas dans une pastille.
- Le cas qui resterait est celui du titre tronqué : **13 % des cases**, 33 %
  pour la musique (§4.8). Un surlignage n'y change rien, puisque c'est le
  titre qui manque, pas la position.
- Une pulsation joue avant que l'œil arrive. Un contour permanent entre en
  concurrence avec les rotations, les tampons et les pastilles que la boîte
  porte déjà.

**Ce que ça coûterait de changer d'avis** : `TilePulse` existe et `BentoGrid`
accepte déjà `pulse`. `search.tsx` connaît `match.item.category`. C'est un
paramètre de route et une prop, deux lignes. Si la recette montre qu'on
cherche sa case, on le fera ; à rouvrir de toute façon au chantier 8, quand
les signaux par case donneront un endroit naturel où l'accrocher.

### 5.6 Détails hérités à corriger au passage

- **`ShareImage` sort du `ScrollView`.** Elle est rendue hors écran en
  1080 × 1920 avec `translateX: 3000`. Absolue mais dimensionnée, elle n'a rien
  à faire dans un conteneur défilant, dont elle perturberait la taille de
  contenu. Elle devient sœur du `ScrollView`, sous la racine de l'écran. Le
  commentaire qui explique le `translateX` la suit tel quel.
- **« Confirme-tu ? »** (`u/[pseudo].tsx:392`). Faute listée au chantier 11,
  corrigée ici parce qu'on réécrit le fichier.
- **`void CATEGORY_META;`** en pied de fichier, et l'index inutilisé du
  `forEach` : import mort et paramètre mort, supprimés.
- **La barre du haut change après le chargement** : « Options » n'apparaît
  qu'une fois `state.kind === 'found'`. Avec le squelette, la barre est stable
  du premier au dernier frame.

---

## 6. Contrat de données

### 6.1 Une requête, en jointure externe

```
GET /rest/v1/users
  ?select=pseudo,display_name,kind,bentos(published_at,is_featured,
           bento_items(category_id,items(id,title,subtitle,image_url,image_credit)))
  &pseudo=ilike.<pseudo>
  &bentos.published_at=not.is.null
  &limit=5
```

Quatre choix, chacun vérifié contre la production.

**Jointure externe et non `!inner`.** Les deux rendent le même résultat sur un
bento publié. Elles diffèrent sur le compte qui existe sans rien en ligne :
`!inner` rend zéro ligne, la jointure externe rend la ligne avec
`bentos: null`. C'est exactement la distinction de §5.3, et elle ne coûte
rien : p50 46 ms contre 48. Vérifié sur trois comptes non publiés et deux
comptes sans ligne `bentos`.

**`limit=5` et `pickExactPseudo` restent.** `_` est un joker `ilike` et un
caractère autorisé dans un pseudo : `bentopop://u/buyt_k` affichait le bento
de `buyt.k`. Le filtre exact, hors SQL, reste indispensable. Le cas retors est
couvert : si un pseudo jumeau publié remonte à la place d'un pseudo exact non
publié, `pickExactPseudo` l'écarte et la page dit correctement qu'il n'y a
rien. Vérifié sur `dark_hifus`.

**Les champs sont ceux que la page rend**, et rien d'autre : −21 % (§4.5).
`bentos.id` disparaît aussi ; le chantier 8 le rajoutera quand il en aura
besoin.

**`bentos` est un objet, pas un tableau**, parce que `bentos.user_id` est
`unique`. Le type doit le refléter, sans quoi un `[0]` défensif masquerait un
changement de schéma.

### 6.2 `src/lib/public-bento.ts`

Le chargement quitte `bento-actions.ts` pour un module à **client injecté**,
comme `feed.ts`, `suggestions.ts` et `search.ts`. Le commentaire d'en-tête de
`feed.ts` le demandait déjà nommément : *« `bento-actions.ts` et `pseudo.ts`
gagneraient à suivre »*.

Ce n'est pas de la cosmétique d'architecture : un module qui importe le
singleton `@/supabase/client` tire `react-native-url-polyfill`, AsyncStorage et
`expo-constants`, donc n'est pas chargeable sous `node:test`. Or ce qu'il faut
verrouiller ici est précisément la **forme de l'URL** : la syntaxe du filtre
sur ressource imbriquée `bentos.published_at=not.is.null` est ce qui casse en
silence, et une erreur PostgREST se solderait par une page « introuvable ».

```ts
export type PublicBentoClient = SupabaseClient<Database>;

export type PublicBento = {
  pseudo: string;
  displayName: string | null;
  isGuest: boolean;
  isFeatured: boolean;
  publishedAt: string;
  slots: BentoItems;
};

/** `null` = ce pseudo n'existe pas. `{ bento: null }` = il n'a rien en ligne. */
export type PublicBentoResult = { pseudo: string; bento: PublicBento | null } | null;

export function mapPublicBento(row: PublicBentoRow): PublicBentoResult;
export async function loadPublicBento(
  client: PublicBentoClient,
  pseudo: string,
): Promise<PublicBentoResult>;
```

Deux règles de mappage, alignées sur `mapFeedRow` :

- une case dont la catégorie est inconnue est **ignorée**, pas rendue au
  hasard : un septième `category_id` déployé avant les clients ne doit pas
  écraser une case existante ;
- une erreur réseau ou PostgREST **remonte**, elle ne devient pas `null`.
  C'est la correction de §4.6, et c'est ce qui permet à React Query de
  distinguer `isError` de « pas de résultat ».

### 6.3 Cache et invalidation

```ts
useQuery({
  queryKey: ['public-bento', pseudo.trim().toLowerCase()],
  queryFn: () => loadPublicBento(supabase, pseudo),
  staleTime: 5 * 60 * 1000,
})
```

**La clé est en minuscules.** La recherche par pseudo est insensible à la
casse et les liens partagés varient : `@Dark_Hifus` et `@dark_hifus` doivent
partager une entrée de cache, pas en occuper deux.

`staleTime` à 5 minutes : un bento publié change rarement, et les changements
qui comptent viennent de son propriétaire, sur cet appareil.

**Le cache introduit un piège qu'il faut fermer dans le même lot.** Après
publication, `compose.tsx:99` fait `router.push('/u/<pseudo>')`. Si la
personne avait déjà ouvert sa propre page avant de publier, elle y avait vu
« pas de bento en ligne » ; sans invalidation, React Query lui resert cette
réponse pendant que la requête repart. Elle verrait son bento déclaré absent
une seconde après l'avoir publié.

`bento-actions.ts` n'a que l'`id` de l'utilisateur, pas son pseudo. Toutes ses
mutations publiques (`publishBento`, `unpublishBento`, `setBentoSlot`,
`clearBentoSlot`) invalident donc **le préfixe entier** :

```ts
void queryClient.invalidateQueries({ queryKey: ['public-bento'] });
```

Grossier et correct : le cache contient au plus quelques entrées de 2 Ko, et
une invalidation de trop coûte 46 ms. `invalidateFeed()` devient
`invalidatePublicViews()` et fait les deux, pour qu'aucun futur appel
n'oublie la moitié.

---

## 7. Performance et egress

| Poste | Avant | Après |
|---|---|---|
| Allers-retours à l'ouverture | 2 séquentiels | **1** |
| Latence médiane mesurée | 89 ms | **46 ms** |
| Octets par ouverture | 2 530 | **1 991** |
| Ouverture d'un bento déjà vu | 2 requêtes, spinner | **0 requête, 0 spinner** |
| Images | déjà en cache disque `expo-image` | inchangé |

À 27 bentos publiés et un cache de 5 minutes, l'egress de cette page est
négligeable. Ce qui se joue ici est le **temps perçu**, pas la facture : la
recherche répond en 48 ms et la page qu'elle ouvre en met le double, sans
compter le second aller-retour.

Aucun index à ajouter : `users.pseudo` porte déjà un index unique sur
`lower(pseudo)`, et la jointure suit une clé étrangère unique.

---

## 8. Stratégie de test et QA

### 8.1 Tests unitaires, `node:test` + `tsx`

`src/components/bento/public-layout.test.ts` :

1. la somme des constantes vaut le haut de page mesuré, 44 + 144 = 188 ;
2. sur les métriques d'un iPhone 17 Pro, l'échelle vaut celle du fil à 0,001 près ;
3. sur un 17e, idem ;
4. sur un iPhone SE, l'échelle vaut le plancher ;
5. l'échelle ne dépasse jamais `feedScale`, sur 200 largeurs de 320 à 1024 ;
6. l'échelle ne descend jamais sous `MIN_SCALE` ;
7. la boîte plus le bloc de boutons ne dépasse jamais la hauteur disponible
   **tant que le plancher ne mord pas**, sur les mêmes 200 cas ;
8. une hauteur absurde (0 sur la première frame de certaines plateformes) rend
   le plancher, pas une valeur négative ;
9. faire grandir `HEADER_H` de 20 pt réduit l'échelle et ne recouvre rien.

Le test 9 est le vrai : c'est celui qui cassera le jour où quelqu'un ajoutera
une ligne à l'en-tête, comme `compose-layout.test.ts` a cassé sur le double
comptage de la barre d'onglets.

`src/lib/public-bento.test.ts` : mappage d'une ligne complète, catégorie
inconnue ignorée, `bentos: null` distingué de la ligne absente, pseudo jumeau
écarté par `pickExactPseudo`, ordre des cases indifférent.

### 8.2 Test d'intégration sur bouchon

`src/lib/public-bento.integration.test.ts`, avec `startPostgrestStub()` et un
vrai `supabase-js` : c'est le constructeur d'URL réel qu'on veut exercer.

- la méthode est un `GET` sur `/rest/v1/users` ;
- la chaîne `select` contient la ressource imbriquée avec exactement les
  champs de §6.1, et **ni `year`, ni `external_source`, ni `external_id`** ;
- le filtre `bentos.published_at=not.is.null` est présent et porte bien sur la
  ressource imbriquée ;
- `limit=5` est présent, le filtre exact étant côté client ;
- un pseudo hors format ne déclenche **aucune** requête ;
- une réponse 500 **jette**, elle ne rend pas `null`.

Le dernier est la régression de §4.6 : c'est lui qui empêche une panne réseau
de redevenir « Bento introuvable ».

### 8.3 Vérification contre la production

Un script `scripts/check-public-bento.mjs`, sur le modèle de
`check-search-bentos.mjs`, lancé avec la clé anonyme :

- les 27 pseudos publiés rendent une ligne avec 6 cases, aucune manquante ;
- les comptes sans bento publié rendent une ligne avec `bentos: null` ;
- un pseudo inexistant rend zéro ligne ;
- les pseudos à `_` et `.` ne se confondent pas deux à deux ;
- la charge utile médiane est sous 2 100 octets ;
- p50 sous 100 ms sur les 27.

### 8.4 Recette manuelle, bloquante

Sur simulateur, dev build pointé sur la production. **Trois tailles d'écran,
la même liste** : iPhone SE (3e gén.), iPhone 17e, iPhone 17 Pro.

1. `bentopop://u/dark_hifus` : les six cases visibles ou atteignables, la
   bordure basse de la boîte visible, aucun bouton par-dessus. **Capture.**
2. Rapport largeur / hauteur de la boîte mesuré au pixel : 361 / 512 à 1 % près.
3. La boîte a la même largeur que dans « La table » sur le même appareil,
   mesurée au pixel sur deux captures.
4. Depuis « Trouver », taper « inception », ouvrir un résultat, revenir,
   rouvrir : **aucun squelette la seconde fois**, et zéro requête au journal.
5. Mode avion, pseudo publié : « Connexion perdue » et un bouton. Le
   réactiver, taper « Réessayer » : la page se remplit.
6. Un pseudo qui existe sans bento en ligne : le bon message.
7. Un pseudo inexistant : « Bento introuvable ».
8. Publier depuis le composer après avoir visité sa propre page vide : le
   bento s'affiche, pas le message d'absence.
9. `content_size accessibility-extra-extra-extra-large` sur les trois
   appareils : le chevron reste dans sa pastille, les deux CTA restent une
   rangée, la page défile, la boîte reste lisible. **Capture.**
10. VoiceOver par `idb ui describe-all` : la boîte n'aspire pas les cases,
    les crédits photo de la rangée basse sont présents sur les trois
    appareils.

Le point 10 est la contre-mesure de §4.2 : aujourd'hui les crédits de la
rangée basse sont absents de l'arbre sur iPhone SE, ce qui est la signature
d'un contenu hors écran.

### 8.5 Ce qui n'est pas testé, assumé

- Le rendu sur appareil réel, qui accumule maintenant sept chantiers.
- Les tablettes : `MAX_BOX_WIDTH` s'applique, personne n'a regardé.
- Le gain de latence sur réseau mobile réel. Mesuré en filaire, extrapolé à un
  RTT.

---

## 9. Plan de développement

Quatre lots. L'arbre compile et la suite passe à la fin de chacun.

### Lot 1 · Les deux modules purs

`public-layout.ts` et ses 9 tests. `public-bento.ts`, son mappage, ses tests
unitaires et son test d'intégration sur bouchon. Types de
`packages/supabase-mobile` complétés si nécessaire pour la jointure.

Aucun écran ne change encore. **Vérification** : suite verte, et
`check-public-bento.mjs` au vert contre la production.

### Lot 2 · L'écran

`ScrollView`, échelle du module, marge et non largeur, `useQuery`, les quatre
états, `BentoBoxSkeleton` extrait et partagé avec le fil, `ShareImage` sortie
du conteneur défilant, invalidation dans `bento-actions.ts`, suppression de
l'ancien `loadPublicBentoByPseudo`.

**Vérification** : captures des trois appareils, plus les mesures au pixel des
points 2 et 3 de la recette.

### Lot 3 · Ce que la police maximale casse

Plafonds de grossissement, `numberOfLines` sur les CTA, chevron à taille fixe.
Les trois corrections de détail de §5.6.

**Vérification** : captures des trois appareils au réglage maximal.

### Lot 4 · Recette et mesures

La liste de §8.4 sur les trois appareils, le relevé de latence après
bascule, la mise à jour de la roadmap et l'ouverture des suivis.

---

## 10. Definition of Done

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Six cases atteignables et lisibles sur iPhone SE | recette 1, capture |
| 2 | Aucun bouton ne recouvre la boîte, sur les trois appareils | modèle testé + recette 1 |
| 3 | Proportions natives à 1 % | recette 2 |
| 4 | Même largeur de boîte que dans le fil | recette 3 |
| 5 | Retour sur un bento déjà vu : zéro requête, zéro squelette | recette 4 |
| 6 | Un seul aller-retour, p50 sous 100 ms | §8.3 |
| 7 | Charge utile sous 2 100 octets | §8.3 |
| 8 | Panne réseau distinguée de l'absence | recette 5 |
| 9 | Pseudo connu sans bento distingué de pseudo inconnu | recette 6 et 7 |
| 10 | Publier puis arriver sur sa page montre le bento | recette 8 |
| 11 | Écran tenable à la police maximale | recette 9, capture |
| 12 | Crédits de la rangée basse présents dans l'arbre d'accessibilité | recette 10 |
| 13 | Suite complète verte | CI |

## 11. Décisions tranchées

| Question | Décision | Raison |
|---|---|---|
| Échelle dynamique du composer ? | **non** | calcule sur la seule hauteur, donne 0,68 sur SE et reconduit l'écrasement |
| Échelle du fil telle quelle ? | **non**, plafonnée aussi par la hauteur | sinon la boîte dépasse de 1 à 2 pt sur les écrans courants |
| Page défilante ? | **oui**, mais inactive par construction | filet pour le SE, la police maximale et l'en-tête futur |
| Plancher d'échelle | **0,86** | ce que le fil montre déjà sur un iPhone SE, livré au chantier 2 |
| Rogner l'en-tête de 12 pt ? | **oui** | c'est ce qui fait tenir la boîte à la taille du fil |
| `!inner` ou jointure externe ? | **externe** | distingue « pas de bento en ligne » de « pseudo inconnu », même latence |
| Garder `pickExactPseudo` ? | **oui** | `_` est un joker `ilike` et un caractère de pseudo valide |
| Champs de la requête | **ceux qui sont rendus** | −21 % d'octets, aucun changement visible |
| Squelette ou spinner ? | **squelette** | la page est l'arrivée d'une recherche à 48 ms |
| Invalidation ciblée ou par préfixe ? | **préfixe** | `bento-actions` ne connaît pas le pseudo, et le cache est minuscule |
| Signaler la case d'arrivée ? | **non** | la ligne de résultat la nomme déjà, et les six seront visibles |
| Corriger le composer au passage ? | **non** | budget vertical validé au chantier 2, hors périmètre |

---

## 12. Suivis générés par ce chantier

**Le composer a probablement le même écrasement.** Il calcule son échelle sur
la seule hauteur (`compose-layout.ts`), donc sa boîte prend toute la largeur
disponible avec des rangées compressées, exactement comme la page publique
avant ce chantier. Sur un iPhone SE, le calcul donne 0,67. Personne n'a
regardé ce que ça donne, et le corriger demande de rouvrir un budget vertical
mesuré au point et testé. À traiter pour lui-même.

**La page web `/u/[pseudo]` porte une troisième géométrie.** Elle a son propre
`DESIGN_HEIGHT`. Trois rendus du même objet, dont deux seront alignés après ce
chantier. À vérifier une fois, pour savoir si le troisième l'est aussi.

**Le bouton retour renvoie vers le composer** quand il n'y a rien à dépiler
(`router.canGoBack()` faux, ligne 110). Depuis un lien partagé ouvert par
quelqu'un qui n'a pas de bento, c'est un atterrissage brutal. À regarder avec
le chantier 9, qui reprend l'entrée dans le produit.

**Personne ne sait d'où viennent les ouvertures de cette page.** Partage,
recherche, fil, lien profond : les quatre chemins existent et aucun n'est
distingué. Le chantier 8 installe des compteurs ; c'est le moment d'y penser.

**Les plafonds de grossissement restent à poser sur 20 usages d'`Extenda` et
sur `TopChip`.** Deux écrans traités sur l'ensemble, « Trouver » au chantier 6
et celui-ci. Chantier 11.
