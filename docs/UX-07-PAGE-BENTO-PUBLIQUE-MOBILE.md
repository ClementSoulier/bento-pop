# Chantier 7 · Page bento publique dans l'app

> Spécification écrite le 14 septembre 2026, à partir de mesures faites le jour
> même sur la production et sur trois tailles d'écran au simulateur. Chantier 7
> de [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
>
> **Révisée le même jour**, après relecture contre le code et livraison du
> lot 1 : une mesure mal étiquetée (§1.1, §4.2), une invalidation qui ne
> fermait pas le piège qu'elle décrivait (§6.3) et un test contredit par sa
> propre formule (§8.1) sont corrigés, onze arbitrages rendus (§11), et les
> écarts du lot 1 reportés là où ils changent le contrat (§5, §6, §8, §9).
>
> **Révisée à la livraison du lot 2**, le même soir. L'écran a révélé deux
> attentes que la spéc ignorait : les réessais cachés de `postgrest-js`
> (§5.3, §6.2) et l'attente de l'authentification, levée par un client sans
> session (§6.4). Écarts, mesures et arbitrages du lot 2 reportés en §8, §9
> et §11, suivis ouverts en §12.
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

- la boîte est **écrasée de 8 %** sur un iPhone 17 Pro, où elle fait 370 pt
  de large pour 482 de haut là où ses proportions natives en demandent 525 ;
- elle ne rentre pas. Sur un iPhone SE, les boutons collants recouvrent
  **118 pt** du bas de la boîte, qui dépasse en plus sous le bord de l'écran,
  et rien ne permet de défiler. Sur un 17e, le bouton mord le cadre de 2 pt et
  en masque l'ombre. Sur un 17 Pro, rien de visible : seul le haut du dégradé
  des boutons, presque transparent, touche la boîte.

La roadmap annonçait le défaut « sur un iPhone SE ». La mesure dit :
l'écrasement partout, le recouvrement dès le 17e.

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
| 2 | Rien ne recouvre la boîte au repos tant que le plancher ne s'applique pas, et rien en fin de défilement, sur toute taille d'écran | modèle testé + captures |
| 3 | La boîte a les proportions natives 361 × 512 | rapport largeur / hauteur mesuré au pixel |
| 4 | Revenir sur un bento déjà consulté n'affiche aucun chargement | recette, requête réseau comptée |
| 5 | Un seul aller-retour réseau à l'ouverture | 89 ms → 46 ms mesurés en §4.4 |
| 6 | Une panne réseau ne dit plus « Bento introuvable » | recette en mode avion |
| 7 | L'écran et les tuiles restent lisibles à la plus grande taille de police système | capture |
| 8 | Les mêmes critères tiennent sur Android | émulateurs Android Studio, §8.6 |

---

## 3. Périmètre

**Dedans.**

- `apps/mobile/app/u/[pseudo].tsx` : géométrie, défilement, états, police.
- Un module de budget vertical testable, sur le modèle de `compose-layout.ts`,
  et la hauteur réelle de la boîte dans `geometry.ts`.
- `loadPublicBentoByPseudo` : une requête au lieu de deux, client injecté,
  champs réduits à ce qui est rendu.
- `useQuery` et la remise à zéro du cache par les mutations de
  `bento-actions.ts`.
- Le squelette de chargement de la boîte, partagé avec le fil.
- Les plafonds de police de `Tile` et `EmptyTile`, donc aussi ceux du fil et du
  composer : une tuile illisible ne se corrige pas écran par écran (§11).
- Les titres de `Tile` coupés au milieu d'un mot sur Android, ajoutés au lot 3
  pour la même raison (§5.6).
- Un client Supabase sans session pour la lecture de la page, ajouté au lot 2
  (§6.4).
- La mesure de `ShareImage` à la plus grande police, et son gel si elle suit la
  police système.
- L'échappement du joker `_` dans `checkPseudoAvailability`, puisque le lot 2
  touche `pseudo.ts`.
- Android, sur les émulateurs Android Studio (§8.6).

**Dehors.**

- La page **web** `/u/[pseudo]` de la landing. Elle a sa propre géométrie
  (`DESIGN_HEIGHT`) et son propre chantier, le 1, livré.
- Le composer. Il calcule son échelle sur la hauteur et se retrouve à 0,67 sur
  un iPhone SE, donc probablement avec le même écrasement. Ce n'est pas cet
  écran-là qu'on livre aujourd'hui, et le corriger demande de rouvrir le
  budget vertical validé au chantier 2. **Suivi ouvert en §12.**
- Les 20 usages d'`Extenda` sans plafond de grossissement ailleurs dans l'app.
  Chantier 11. Seules cette page et les tuiles sont traitées, parce qu'on ne
  livre pas un écran cassé.
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
place de la boîte est donc purement géométrique, et il ne dépend d'aucune
donnée. Celui de l'en-tête, si : un pseudo long, ou un `display_name` que le
chantier 10 remplira, passe à la ligne dès que la police grossit (§5.4).

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
haut des boutons        = haut du bloc + 16
```

Et la boîte, à l'échelle `s`, mesure `502 s + 2 × max(3, round(5 s))` : le
cadre se met à l'échelle et s'arrondit au point (`BentoGrid.tsx:69`), soit 5
de 0,9 à 1,1 et 4 en dessous. À 0,94 : **481,9 pt**, retrouvé au pixel sur les
captures après correction du rayon de coin.

D'où le recouvrement, qui est une soustraction. Le haut des boutons est relevé
au pixel sur les captures, colonne x = 150 pt, loin des coins arrondis :

| Appareil | Écran | Bas de la boîte | Haut du bloc | Haut des boutons | Sous le bloc | Sous les boutons |
|---|---|---|---|---|---|---|
| iPhone SE (3e gén.) | 375 × 667 | 701,9 | 568 | 583,5 | 133,9 pt | **118,4 pt** |
| iPhone 17e | 390 × 844 | 728,9 | 711 | 726,7 | 17,9 pt | **2,2 pt** |
| iPhone 17 / 17 Pro | 402 × 874 | 743,9 | 741 | 756,7 | 2,9 pt | **aucun**, 13 pt de dégagement |

La première version de ce tableau appelait « haut des boutons » le haut du
bloc, 16 pt plus haut, et concluait à un recouvrement sur tous les iPhone. Sur
un 17 Pro, ce qui touche la boîte est le haut du dégradé, à 3 % d'opacité.

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
export const TOP_BAR_H = 44;         // paddingTop 8 + bouton retour 36, taille fixe
export const HEADER_FIXED_H = 104;   // 12 + avatar 70 + 8 + 4 + 10
export const PSEUDO_LINE_H = 24;     // Extenda 24, police par défaut
export const DATE_LINE_H = 16;       // 13 pt système, police par défaut
export const CTA_FIXED_H = 82;       // padding 16 + bordures 6 + 28 + paddingBottom 32
export const CTA_LABEL_LINE_H = 17;  // Bungee 13 : 51 − 34
export const CTA_GAP = 8;
export const CONTENT_MAX_FONT_MULTIPLIER = 1.4;
export const BUTTON_MAX_FONT_MULTIPLIER = 1.2;
export const MIN_SCALE = feedScale(375);  // 0,8615 : la boîte du fil sur SE

export function publicBentoScale(m: PublicLayoutMetrics): number {
  const byWidth = feedScale(m.width);                         // §5.3 du chantier 2
  const byHeight = gridScaleForHeight(publicBoxAvailableHeight(m));
  return Math.min(byWidth, Math.max(byHeight, MIN_SCALE));
}
```

Trois écarts à la première version, trouvés en relecture et livrés au lot 1 :

- **la taille de police entre dans le modèle.** `fontScale` est obligatoire ;
  l'en-tête et les boutons grossissent avec elle, bornés par les plafonds que
  l'écran pose (§5.4). Sans ça, la promesse de §5.4, « la boîte rétrécit »,
  était impossible : un en-tête constant ne voit pas la police grossir ;
- **la boîte ne mesure pas `512 × échelle`.** `gridScaleForHeight` est
  l'inverse exact de la hauteur rendue, cadre arrondi compris (§4.2). Diviser
  par 512 se trompait d'au plus 1 pt, dans un sens ou dans l'autre ;
- **le plancher est l'échelle du fil sur SE, 0,8615, et non 0,86**, qui aurait
  rendu la boîte du SE 0,5 pt plus étroite que celle du fil.

Trois propriétés, dans cet ordre de priorité :

1. **jamais plus large que dans le fil** : `byWidth` est un plafond, donc la
   boîte de la page publique et celle du fil ont la même taille dès que la
   hauteur le permet ;
2. **jamais recouverte** : `byHeight` est un plafond aussi, calculé sur ce qui
   reste une fois les boutons servis ;
3. **jamais illisible** : `MIN_SCALE` est un plancher, et c'est lui qui décide
   quand la page défile. Un plancher, pas une garantie : sous 374,5 pt de
   large, 360 dp sur beaucoup d'Android, le fil descend lui-même sous 0,8615
   et la largeur l'emporte. La boîte n'est jamais plus petite que dans le fil.

La largeur de la boîte se déduit de l'échelle et s'applique en **marge**, pas
en `width` avec `alignSelf`. La raison est écrite au chantier 2 et a coûté un
diagnostic en build Release : une largeur posée sur un enfant étiré par son
parent ne tient pas sur iOS.

**L'en-tête rend 12 pt.** `paddingTop` passe de 20 à 12 et `paddingBottom` de
14 à 10. Sous ce modèle, ces 12 pt sont ce qui sépare une boîte à la taille du
fil d'une boîte plus petite, sur les deux tailles d'écran les plus courantes :
le calcul sans le rabot donne 0,920 sur un 17 Pro, contre 0,936 pour le fil,
soit une boîte 6 pt plus étroite que celle du fil sur le même écran.

Ce calcul compte les boutons depuis le haut de leur bloc, 16 pt au-dessus des
boutons eux-mêmes (§4.2). Calée sur le haut visible des boutons, la boîte du
fil tiendrait sans rabot, avec 7 pt de jaune entre son ombre et les boutons.
Le rabot est donc un choix de marge et non une contrainte ; il est retenu
(§11), et cette marge sert aussi aux tailles de police au-dessus du défaut.

Ce que rend le modèle, couvert par les tests du lot 1 et à confirmer au point
en recette :

| Appareil | Échelle | Boîte | Contrainte active | Défilement |
|---|---|---|---|---|
| iPhone 17 / 17 Pro | 0,936 | 338 × 480 | largeur (= le fil) | **aucun** |
| iPhone 17e | 0,903 | 326 × 463 | largeur (= le fil) | **aucun** |
| iPhone SE | 0,8615 | 311 × 440,5 | plancher (= le fil) | 88 pt |
| 17 Pro, plus grande police | 0,904 | 326 × 464 | hauteur | **aucun** |
| SE, plus grande police | 0,8615 | 311 × 440,5 | plancher | ~108 pt |

Sur les grands écrans, `feedScale` plafonne déjà la boîte à 420 pt
(`MAX_BOX_WIDTH`) : rien à ajouter pour les tablettes.

### 5.2 La page défile, et presque jamais

Le corps devient un `ScrollView` dont le `contentContainerStyle` réserve en bas
`publicScrollBottomInset(fontScale)`, le bloc de boutons et l'écart. Les
boutons restent collants par-dessus.

C'est un filet, pas un mode de lecture. Par construction, sur tout écran où
`byHeight ≥ MIN_SCALE`, le contenu tient et le `ScrollView` ne défile pas d'un
point. Il ne sert que dans trois cas :

- les écrans où le plancher mord : l'iPhone SE seul parmi les iPhone, et les
  écrans Android courts, à mesurer (§8.6) ;
- les grandes tailles de police système sur ces mêmes écrans : l'en-tête
  grossit, la boîte rétrécit jusqu'au plancher, puis la page défile (§5.4) ;
- toute future ligne ajoutée à l'en-tête, qui rétrécira la boîte puis fera
  défiler au lieu de cacher une rangée, **à condition d'entrer dans le
  modèle** : l'écran importe les constantes du module (lot 2), mais rien ne
  détecte une ligne ajoutée au JSX seul.

**Ce qu'on abandonne, et pourquoi.** La roadmap disait « la grille est
entièrement visible sur iPhone SE ». La rendre visible sans défiler y demande
une échelle de **0,69**, soit une boîte de 249 pt de large sur un écran de
375, avec des tuiles de rangée basse d'environ 69 pt de côté. On préfère 88 pt
de défilement à un bento illisible ; le critère devient « les six cases sont
atteignables et lisibles ».

Au repos, sur SE, 64 pt de boîte restent donc sous les boutons. Ils restent
collants, pour que « Partager » soit visible dès l'arrivée : le critère 2 le
dit (arbitrage §11). Les boutons dans le flux, ou un bloc compact qui ne
ferait que réduire le recouvrement à 45 pt, ont été écartés.

**L'alternative écartée** est l'échelle dynamique du composer, calculée sur la
seule hauteur. Elle produit exactement ce 0,69, et elle reconduit l'écrasement
de §4.3 puisqu'elle ne touche pas à la largeur. C'est la réponse que la
roadmap proposait ; la mesure la disqualifie.

### 5.3 Quatre états, au lieu de trois dont un faux

| État | Aujourd'hui | Demain |
|---|---|---|
| Chargement | `ActivityIndicator` centré | **squelette de boîte**, à la place et à la taille exactes |
| Trouvé | la page | la page |
| Pseudo inconnu | « Bento introuvable » | « Bento introuvable » |
| Pseudo connu, rien en ligne | « Bento introuvable » | **« Rien en ligne »**, puis « @x n'a pas de bento en ligne. » |
| Son propre pseudo, rien en ligne | « Bento introuvable » | **« Rien en ligne »**, puis « Ton bento n'est pas en ligne. » et « Reprendre mon bento », vers le composer |
| Réseau tombé | « Bento introuvable » | **« Connexion perdue »**, puis « Le bento de @x n'a pas pu se charger. » et « Réessayer » |

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

**Il doit arriver vite.** La politique globale de `query-client.ts` réessaie
deux fois, à 1 s puis 2 s, sans délai d'abandon. La première version en
déduisait environ 3 s de squelette en mode avion : **c'est faux**, découvert
au lot 2. Sous chaque tentative, `postgrest-js` 2.105.4 réessaie de lui-même
trois fois un `GET` tombé en réseau ou reçu en 503 ou 520, après 1, 2 puis
4 s : 7 s par tentative, donc environ 24 s en mode avion, calcul à confirmer
par une mesure (§12). Et rien ne borne l'attente sur le réseau du métro de
§4.6, qui répond sans répondre. D'où, pour cette requête seule (arbitrage
§11) : hors ligne, NetInfo (`useIsOffline`, déjà dans l'app) affiche l'erreur
sans attendre de requête ; sinon chaque tentative abandonne au bout de 5 s,
avec un seul réessai et aucun réessai caché (§6.2), soit 11 s au pire. Mesuré
au lot 2 sur un proxy suspendu : 10 à 12 s.

Au retour du réseau, une page restée sur « Connexion perdue » se recharge
seule, sans attendre qu'on touche « Réessayer » : en 4 s environ sur
l'émulateur Android (arbitrage §11).

Sa propre page sans bento en ligne n'est atteignable que par un lien, le
profil masquant le bouton quand rien n'est en ligne. « @toi n'a pas de bento
en ligne » ne s'y adresserait à personne.

### 5.4 La police maximale, qui détruit la page

Relevé au réglage `accessibility-extra-extra-extra-large`, captures à l'appui.

**Sur iPhone SE** : le chevron « ‹ » du bouton retour disparaît, son pastillon
blanc reste vide ; « OPTIONS » occupe la moitié de la largeur ; le pseudo passe
sur deux lignes et mange le tiers de l'écran ; il ne reste que les 30 premiers
points de la boîte ; « COMPOSE LE TIEN » est une pastille blanche sans texte.

**Sur iPhone 17 Pro, c'est pire** : la rangée de boutons, absolue en bas et
sans hauteur bornée, grandit vers le haut jusqu'à recouvrir **l'écran
entier**. « PARTAGER » devient un aplat noir sur toute la page.

Six correctifs :

- `maxFontSizeMultiplier` sur chaque texte de l'écran, comme le chantier 6 l'a
  fait pour « Trouver » : 1,4 sur les textes de contenu, **1,2 sur les
  libellés de boutons**, qui décident d'une hauteur. Les deux valeurs sont
  exportées par `public-layout.ts` et l'écran les importe : le modèle ne tient
  que si l'écran applique les mêmes ;
- `numberOfLines={1}` sur les deux libellés de CTA, dont la rangée est le seul
  bloc qui peut grandir sans plafond ;
- `numberOfLines={1}` et `adjustsFontSizeToFit` sur le pseudo et sur la ligne
  de date. Calculé sur la chasse réelle d'Extenda, recalée à 2 % près sur la
  capture : `@bento_pop_culture`, le plus long pseudo publié, passe sur deux
  lignes dès la taille xxLarge sur SE, et un pseudo de 20 caractères dès
  xLarge sur SE et 17e. Le pseudo reste entier, sa police rétrécit juste
  assez, et l'en-tête garde la hauteur du modèle ;
- le chevron du bouton retour rendu à taille fixe (`allowFontScaling={false}`) :
  c'est un glyphe dans une cible de 36 pt, pas du texte à lire ;
- des plafonds dans `Tile` et `EmptyTile`. À la plus grande taille, la pastille
  « FILM », l'année et les crédits débordent de leur tuile (captures
  `se-xxxl` et `17pro-xxxl`). Le fil et le composer en profitent ;
- `ShareImage` mesurée à la plus grande police. Ses textes n'ont aucun plafond,
  et l'image 1080 × 1920 grossit probablement avec la police de la personne
  qui partage. Si la capture le confirme, `allowFontScaling={false}` : une
  image doit sortir identique pour tout le monde.

La taille de police entre dans le modèle (§5.1) : l'en-tête grossit, la boîte
rétrécit, et la page ne défile que lorsque le plancher mord. Sur un 17 Pro à
la plus grande taille, la boîte passe à 0,904 sans défiler ; sur un SE, elle
reste au plancher et la page défile d'environ 108 pt.

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
- **Les titres de tuile coupés au milieu d'un mot, sur Android.** Vu à la
  recette du lot 2 sur le Pixel 8 à 411 dp : un titre plus long que sa case y
  passe à la ligne en pleine lettre, « JIMMY PU / NCHLINE », « MERRY-G /
  O-ROUN… », là où iOS tronque « PUNCHL… ». Le défaut est dans `Tile`, que le
  lot 3 rouvre, et le fil comme le composer rendent le même composant
  (arbitrage §11).

---

## 6. Contrat de données

### 6.1 Une requête, en jointure externe

```
GET /rest/v1/users
  ?select=pseudo,display_name,kind,bentos(published_at,is_featured,
           bento_items(category_id,items(id,title,subtitle,image_url,image_credit)))
  &pseudo=ilike.<pseudo, joker _ échappé>
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

**Le joker `_` est échappé à la source ; `limit=5` et `pickExactPseudo`
restent en seconde ligne.** `_` est un joker `ilike` et un caractère autorisé
dans un pseudo : `bentopop://u/buyt_k` affichait le bento de `buyt.k`. Le
filtre client seul ne suffit pas : sans ordre, `limit=5` peut couper la bonne
ligne dès que plus de cinq pseudos répondent au joker, et le filtre ne voit
que ce qui est revenu. Échappé, `ilike.dark\_hifus` ne rend que la
correspondance exacte, à la casse près. Vérifié contre la production :
`ilike.dark_hifu_` rend `dark_hifus`, `ilike.dark\_hifu\_` ne rend rien, et
les douze pseudos à `_` rendent zéro ligne pour leur joker (§8.3).

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

export function mapPublicBento(row: PublicBentoRow): NonNullable<PublicBentoResult>;
export async function loadPublicBento(
  client: PublicBentoClient,
  pseudo: string,
  options?: { signal?: AbortSignal },
): Promise<PublicBentoResult>;
```

Le `signal` porte l'abandon de §6.3 jusqu'au `fetch` : une tentative
abandonnée ferme vraiment sa requête, au lieu de la laisser courir derrière
le réessai.

Règles de mappage, alignées sur `mapFeedRow` pour qu'un bento absent du fil ne
s'affiche pas ici, et inversement :

- une case dont la catégorie est inconnue est **ignorée**, pas rendue au
  hasard : un septième `category_id` déployé avant les clients ne doit pas
  écraser une case existante ;
- une case dont l'item est masqué par la RLS (`items: null`) devient **vide**,
  et le bento reste en ligne. C'est un item en attente ou rejeté après
  publication, que la RLS ne montre qu'à celui qui l'a proposé ;
- zéro case lisible, ou un `published_at` nul, se lisent **« rien en
  ligne »**, comme le fil qui écarte la ligne ;
- une erreur réseau ou PostgREST **remonte**, elle ne devient pas `null`, et
  porte son statut HTTP : 0 pour une panne réseau, qui reste réessayable, 4xx
  pour une requête refusée, que `query-client.ts` ne réessaie pas à condition
  de la reconnaître. C'est la correction de §4.6, et c'est ce qui permet à
  React Query de distinguer `isError` de « pas de résultat » ;
- **aucun réessai caché.** `postgrest-js` 2.105.4 réessaie de lui-même trois
  fois un `GET` tombé en réseau ou reçu en 503 ou 520, après 1, 2 puis 4 s, et
  `supabase-js` n'expose aucun réglage global. La requête porte donc
  `.retry(false)` : la politique de réessai est celle de §6.3, sans une
  seconde cachée dessous. Découvert au lot 2 par un test d'intégration qui
  prenait 7 s, et verrouillé par deux tests : une panne réseau lève en moins
  de 500 ms, un 503 ne part qu'une fois.

`PSEUDO_REGEX` et ses bornes passent de `pseudo.ts` à `pseudo-match.ts`, qui ne
tire pas le client : sans ça, le module ne se chargerait pas sous `node:test`.
Les types de `packages/supabase-mobile` n'ont pas à changer : une seule
assertion sur la forme du `select`, comme `feed.ts`.

### 6.3 Cache et invalidation

Tel que livré au lot 2, dans `src/lib/public-bento-query.ts` :

```ts
export function publicBentoQueryOptions(client: PublicBentoClient, pseudo: string) {
  return {
    queryKey: ['public-bento', pseudo.trim().toLowerCase()],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      withAbortTimeout((attempt) => loadPublicBento(client, pseudo, { signal: attempt }), 5000, signal),
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryPublicBento, // un seul réessai, jamais sur un refus 4xx
  };
}

// app/u/[pseudo].tsx, avec le client sans session de §6.4
useQuery(publicBentoQueryOptions(publicSupabase, pseudo));
```

**La clé est en minuscules.** La recherche par pseudo est insensible à la
casse et les liens partagés varient : `@Dark_Hifus` et `@dark_hifus` doivent
partager une entrée de cache, pas en occuper deux.

`staleTime` à 5 minutes : un bento publié change rarement, et les changements
qui comptent viennent de son propriétaire, sur cet appareil.

**Le cache introduit un piège qu'il faut fermer dans le même lot.** Après
publication, `compose.tsx:99` fait `router.push('/u/<pseudo>')`. Si la
personne avait déjà ouvert sa propre page avant de publier, elle y avait vu
« pas de bento en ligne » ; React Query lui resert cette réponse pendant que
la requête repart. Elle verrait son bento déclaré absent une seconde après
l'avoir publié. Le cas fréquent est plus simple : changer une case d'un bento
en ligne, puis « Voir mon bento », montre l'ancien item avant le nouveau.

**Invalider ne suffit pas.** La première version de cette spéc prescrivait
`invalidateQueries`. Simulé avec `@tanstack/query-core` 5.100.10, la version
installée, sur le scénario exact : une requête invalidée pendant que la page
est démontée reste en cache, et le premier rendu au remontage est `success`
avec `bento: null`, puis le bento. `resetQueries` rend `pending`, donc le
squelette, puis le bon contenu.

`bento-actions.ts` n'a que l'`id` de l'utilisateur, pas son pseudo. Toutes ses
mutations publiques (`publishBento`, `unpublishBento`, `setBentoSlot`,
`clearBentoSlot`) remettent donc à zéro **le préfixe entier** :

```ts
void queryClient.resetQueries({ queryKey: ['public-bento'] });
```

Grossier et correct : le cache contient au plus quelques entrées de 2 Ko, et
une remise à zéro de trop coûte un squelette le temps d'un aller-retour.
`invalidateFeed()` devient `invalidatePublicViews()`, qui appelle
`refreshPublicViews` : le fil garde son invalidation, les pages publiques sont
remises à zéro, et aucun futur appel n'oublie la moitié. La suppression de
compte l'appelle aussi (écart validé, §11). Quatre tests sur `query-core`
verrouillent le comportement, dont celui qui montre qu'une simple invalidation
resservirait « rien en ligne ».

Réessais et délai d'abandon sont propres à cette requête : un seul réessai,
5 s par tentative, et l'état hors ligne lu sur NetInfo (§5.3).
`withAbortTimeout` rejette à l'échéance **puis** annule la tentative : dans
l'autre ordre, la course rendait l'erreur d'annulation au lieu de celle du
délai, défaut attrapé par son test au lot 2.

### 6.4 Un client sans session pour les lectures publiques

**Ajouté au lot 2, arbitré en §11.** La recette sur l'émulateur Android a
affiché « Connexion perdue » sur une page dont les données répondaient.

Le client principal fait attendre **chaque requête**, même publique, la fin
du renouvellement de sa session : `supabase-js` demande le jeton à
`auth.getSession()` avant tout `fetch`, et une session stockée expirée, ou à
moins de 90 s de l'expiration, est d'abord renouvelée. Si l'authentification
répond en panne (503, réseau), `auth-js` 2.105.4 réessaie après 200 ms,
400 ms, et ainsi de suite jusqu'à 12,8 s, dans une limite de 30 s, en tenant
sa file d'attente. Mesuré au lot 2 : des boucles de 8 tentatives sur 25,5 s,
enchaînées sans pause. Chaque tentative de la page abandonnait à 5 s sans
avoir rien envoyé, d'où « Connexion perdue » à 11 s.

`publicSupabase` est un second client, créé avec `PUBLIC_READS_AUTH_OPTIONS`
(`src/supabase/public-reads.ts`) : pas de persistance, pas de renouvellement
automatique, et une clé de stockage distincte. Deux protections redondantes à
dessein : sans persistance, le stockage de l'app n'est jamais lu ; persistée
par erreur, la session serait rangée sous une autre clé que celle du client
principal.

**Ce que ça change pour le propriétaire.** La page lit ce que lit n'importe
quel visiteur, sous la RLS anonyme : son auteur la voit comme le public, sans
les items en attente que la RLS ne montre qu'à lui. C'est aussi ce que la page
doit montrer.

**Vérifié par un test.** `src/supabase/public-reads.integration.test.ts`, vrai
`supabase-js` contre un serveur local, avec une session périmée dans le
stockage et un renouvellement qui répond 503 :

- témoin, avec les options du client principal : quatre renouvellements, puis
  la lecture, environ 1,4 s après ;
- avec `PUBLIC_READS_AUTH_OPTIONS` : la lecture seule, en moins de 5 ms, sans
  appel à l'authentification ;
- chaque protection tient seule. Retirer la première, la seconde, les deux, ou
  reprendre les options du client principal : les quatre défauts sont
  attrapés.

**Vérifié sur appareil**, l'écran rebasculé temporairement sur le client
principal puis remis à l'identique, sur des pseudos jamais chargés :

| Appareil et scénario | Client sans session | Client principal |
|---|---|---|
| iPhone 17e, session de 30 s, renouvellement en 503 | chargée à 0,8 s, et à 0,5 s une fois le code rétabli | « Connexion perdue » à 11,2 s, aucune lecture partie |
| Pixel 8, session périmée et `/auth` en 503, le scénario qui avait échoué | lecture partie 0,32 s après le lien | « Connexion perdue », aucune lecture partie |

Seule cette page en profite : le fil, la recherche et le profil restent sur le
client principal, et attendent de la même façon (§12).

---

## 7. Performance et egress

| Poste | Avant | Après |
|---|---|---|
| Allers-retours à l'ouverture | 2 séquentiels | **1** |
| Latence médiane mesurée | 89 ms | **46 ms** ; 53 ms au contrôle du lot 1 |
| Octets par ouverture | 2 530 | **1 991** ; 1 973 en médiane au lot 1, de 1 586 à 2 240 |
| Ouverture d'un bento déjà vu | 2 requêtes, spinner | **0 requête, 0 spinner** |
| Images | déjà en cache disque `expo-image` | inchangé |

À 27 bentos publiés et un cache de 5 minutes, l'egress de cette page est
négligeable. Ce qui se joue ici est le **temps perçu**, pas la facture : la
recherche répond en 48 ms et la page qu'elle ouvre en met le double, sans
compter le second aller-retour.

Aucun index à ajouter, mais pas pour la raison que la première version donnait :
l'index unique sur `lower(pseudo)` ne sert pas un `pseudo ILIKE …`, que
Postgres résout en parcourant `users`. À 75 profils, c'est sans effet ; le
suivi est ouvert en §12. La jointure, elle, suit une clé étrangère unique.

---

## 8. Stratégie de test et QA

### 8.1 Tests unitaires, `node:test` + `tsx`

Livrés au lot 1 : 53 tests. Treize défauts injectés un à un dans les modules,
dont la formule qui divisait par 512, un en-tête constant, le plancher à 0,86,
un pseudo non échappé et une erreur avalée, ont tous été attrapés.

`src/components/bento/public-layout.test.ts` :

1. le modèle retrouve les cotes mesurées : haut de la boîte à 261,9, 247 et
   219,9 pt sur les trois appareils, bas de la boîte à 743,7 et haut des
   boutons à 756,7 sur un 17 Pro. La première version de ce test additionnait
   ses propres constantes, 44 + 144 = 188, sans rien comparer ;
2. sur un 17 Pro et un 17e, l'échelle est celle du fil, sans défilement ;
3. sur un iPhone SE, l'échelle est le plancher, qui est la boîte du fil, et la
   page défile de 80 à 95 pt ;
4. la boîte a la largeur du fil sur les trois appareils ;
5. sur 200 largeurs de 320 à 1024, 13 hauteurs, cinq jeux de marges système
   et huit tailles de police, l'échelle ne dépasse jamais celle du fil ;
6. et ne descend jamais sous **le plus petit du plancher et de l'échelle du
   fil**. La première version demandait « jamais sous `MIN_SCALE` », ce que sa
   propre formule contredit sous 374,5 pt de large ;
7. la boîte tient au-dessus des boutons, au point près et cadre arrondi
   compris, tant que la hauteur permet d'atteindre le plancher ; sinon la page
   défile ;
8. une fenêtre absurde (0, négative, police `NaN`) rend une échelle finie et
   positive, et une hauteur nulle rend le plancher ;
9. une police plus grande ne fait jamais grandir la boîte, la rétrécit sur un
   17 Pro à la plus grande taille sans défilement, et les plafonds 1,4 et 1,2
   bornent la croissance.

Le test 9 remplace celui qui faisait grandir `HEADER_H` de 20 pt : un test sur
une constante ne voit pas une ligne ajoutée au JSX. Ce qui protège l'en-tête,
désormais, c'est que l'écran importe les constantes du module (lot 2).

`src/components/bento/geometry.test.ts` : hauteur de boîte de 481,9 pt à
l'échelle 0,94, cadre arrondi comme `BentoGrid`, et `gridScaleForHeight`
inverse exact de la hauteur rendue, balayé au quart de point jusqu'à 1 600 pt.

`src/lib/public-bento.test.ts` : mappage d'une ligne complète, crédit d'image
propagé, `bentos: null` distingué de la ligne absente, brouillon et zéro case
lisible lus « rien en ligne », case masquée par la RLS rendue vide, catégorie
inconnue ignorée, ordre des cases indifférent. `pseudo-match.test.ts` couvre
l'échappement.

Livrés au lot 2 : 38 tests, 308 au total. Onze défauts injectés un à un, dont
une invalidation à la place de la remise à zéro, un réessai de trop, un refus
4xx réessayé, le délai d'abandon oublié, l'état hors ligne ignoré, la casse du
pseudo comptée, le joker non échappé à l'inscription et les options du client
principal reprises pour la page : tous attrapés. Côté unitaire :

- `src/lib/public-page-state.test.ts` : l'état à montrer, dont « Connexion
  perdue » tout de suite hors ligne, sa propre page reconnue à la casse près,
  et une réponse déjà reçue gardée hors ligne ;
- `src/lib/public-bento-query.test.ts` : la clé en minuscules, la politique de
  réessai, et sur `query-core` la remise à zéro qui rouvre sur le squelette là
  où une invalidation resservirait « rien en ligne » ;
- `src/lib/abort-timeout.test.ts` : l'échéance tenue même quand l'opération
  ignore le signal, l'annulation du parent relayée, aucun minuteur laissé.

### 8.2 Test d'intégration sur bouchon

`src/lib/public-bento.integration.test.ts`, avec `startPostgrestStub()` et un
vrai `supabase-js` : c'est le constructeur d'URL réel qu'on veut exercer.

- la méthode est un `GET` sur `/rest/v1/users`, une seule requête ;
- la chaîne `select` vaut exactement les champs de §6.1, et **ni `year`, ni
  `external_source`, ni `external_id`, ni `created_at`** ;
- le filtre `bentos.published_at=not.is.null` est présent et porte sur la
  ressource imbriquée, aucun `published_at` sur `users` ;
- le pseudo part échappé, `ilike.dark\_hifus`, antislash encodé sur le fil,
  avec `limit=5` ;
- un pseudo hors format ne déclenche **aucune** requête ;
- un compte sans bento rend `{ bento: null }`, un pseudo inconnu `null`, et un
  jumeau remonté par le joker est écarté ;
- une réponse 500 **lève**, avec le statut 500 ; une 400 avec le statut 400 ;
  une panne réseau avec le statut 0.

Les trois derniers sont la régression de §4.6 : ce sont eux qui empêchent une
panne réseau de redevenir « Bento introuvable ».

Ajoutés au lot 2 :

- dans le même fichier, une panne réseau lève en moins de 500 ms et un 503 ne
  part qu'une fois : les réessais cachés de §6.2 ;
- `src/lib/public-bento-query.integration.test.ts`, avec un vrai React Query
  et un serveur qui accepte les requêtes sans jamais répondre : la tentative
  abandonne à l'échéance et ferme vraiment sa requête, deux requêtes et une
  pause précèdent l'erreur, quitter la page annule la requête en cours, et un
  refus 400 ne part qu'une fois ;
- `src/lib/pseudo-availability.integration.test.ts` : l'inscription interroge
  `users` avec le joker échappé, ne compte pas un voisin remonté par le joker,
  et lève sur une erreur au lieu de trancher ;
- `src/supabase/public-reads.integration.test.ts` : le client sans session de
  §6.4.

### 8.3 Vérification contre la production

`scripts/check-public-bento.ts`, lancé par `tsx` avec la clé anonyme. Il
importe `loadPublicBento` et le pointe sur la production : c'est la fonction
de l'app qui part, pas une requête recopiée comme dans
`check-search-bentos.mjs`, et un `fetch` enregistreur compte les
allers-retours et pèse les réponses. La vérité de terrain est lue en requête
brute, hors du module.

- chaque bento en ligne se charge sous son pseudo, avec 6 cases et un seul
  aller-retour ;
- la casse du lien ne compte pas ;
- un compte sans bento en ligne rend son pseudo, sans bento ;
- un pseudo inconnu rend `null`, un pseudo hors format ne part pas ;
- aucun pseudo à `_` ne se confond avec sa variante à `.`, et **la base
  elle-même** rend zéro ligne pour le joker : `pickExactPseudo` masquerait un
  échappement perdu ;
- la charge utile médiane est sous 2 100 octets, p50 sous 100 ms.

Relevé du lot 1, le 14 septembre 2026 : tout vert. 27 bentos en ligne, 8
comptes sans bento éprouvés, 12 pseudos à `_` ; 1 973 octets en médiane, de
1 586 à 2 240 ; p50 53 ms, p95 139 ms, max 193 ms. Échappement retiré, le
contrôle du joker tombe sur les douze.

### 8.4 Recette manuelle, bloquante

Sur simulateur, dev build pointé sur le proxy lecture seule de
[`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md), **jamais sur la production** :
sans session, l'app se connecte anonymement dès son lancement, et une build
pointée sur la production y crée un compte. **Trois tailles d'écran, la même
liste** : iPhone SE (3e gén.), iPhone 17e, iPhone 17 Pro.

1. `bentopop://u/dark_hifus` : sur 17 Pro et 17e, les six cases et la
   bordure basse visibles sans défiler, rien par-dessus ; sur SE, la rangée
   basse atteinte en fin de défilement, rien par-dessus. **Capture.**
2. Rapport largeur / hauteur de la boîte mesuré au pixel : 361 / 512 à 1 % près.
3. La boîte a la même largeur que dans « La table » sur le même appareil,
   mesurée au pixel sur deux captures.
4. Depuis « Trouver », taper « inception », ouvrir un résultat, revenir,
   rouvrir : **aucun squelette la seconde fois**, et zéro requête, comptée à
   l'inspecteur réseau des React Native DevTools.
5. Mode avion, pseudo publié : « Connexion perdue » et un bouton, **sans
   attendre**. Le réactiver, taper « Réessayer » : la page se remplit. Puis un
   réseau qui ne répond pas : l'erreur arrive en 11 s au plus.
6. Un pseudo qui existe sans bento en ligne : le bon message.
7. Un pseudo inexistant : « Bento introuvable ».
8. Publier depuis le composer après avoir visité sa propre page vide : le
   squelette puis le bento, **jamais** le message d'absence, y compris sur un
   réseau ralenti, où un mensonge de 50 ms deviendrait visible. Idem en
   changeant une case puis « Voir mon bento » : jamais l'ancien item.
9. `content_size accessibility-extra-extra-extra-large` sur les trois
   appareils : le chevron reste dans sa pastille, les deux CTA restent une
   rangée, le pseudo tient sur une ligne, la boîte rétrécit ou la page défile,
   et les tuiles restent lisibles. Idem en `extra-extra-large`, taille
   ordinaire où `@bento_pop_culture` passait à la ligne. **Capture.**
10. VoiceOver par `idb ui describe-all` : la boîte n'aspire pas les cases,
    les crédits photo de la rangée basse sont présents sur les trois
    appareils.
11. Sa propre page sans bento en ligne, ouverte par un lien : « Ton bento
    n'est pas en ligne. » et le bouton vers le composer.
12. Une image de partage générée en
    `accessibility-extra-extra-extra-large`, comparée à celle de la taille par
    défaut. **Capture des deux.**
13. Le fil et le composer à la plus grande police, puisque les plafonds de
    `Tile` les touchent aussi. **Capture.**

Le point 10 est la contre-mesure de §4.2 : aujourd'hui les crédits de la
rangée basse sont absents de l'arbre sur iPhone SE, ce qui est la signature
d'un contenu hors écran.

**Relevé du lot 2**, le 14 septembre 2026, par le proxy. Cotes en points,
mesurées au pixel, la valeur du modèle entre parenthèses quand elle a été
comparée :

| Appareil | Boîte, bord gauche et droit | Haut de la boîte | Bordure basse | Haut des boutons | Largeur / hauteur | Défilement |
|---|---|---|---|---|---|---|
| iPhone 17 Pro | 32 → 370 | 250,00 | dès 725,00 (725,02) | 757,00 | −0,06 % | aucun |
| iPhone 17e | 32 → 358 | 235,00 | dès 693,33 | 727,00 | −0,07 % | aucun |
| iPhone SE | 32 → 343 | 208,00 | 556 → 560 en fin de défilement | 584,00 en fin de défilement | non mesuré | 88,5 (88,47) |

- Points 1 et 3 : faits sur les trois appareils, captures à l'appui, boîte de
  la largeur du fil partout ; point 2 sur 17 Pro et 17e.
- Point 4 : zéro requête au retour sur un bento déjà vu, comptée au journal
  du proxy.
- Point 5 : le simulateur iOS n'a pas de mode avion. Hors ligne, éprouvé sur
  Android (§8.6) ; réseau qui ne répond pas, simulé en suspendant le proxy :
  « Connexion perdue » en 10 à 12 s, et « Réessayer » remplit la page.
- Points 6 et 7 : `vanhlad` et un pseudo inexistant, les bons messages.
- Point 10 : pseudo, date et boutons aux cotes du modèle dans l'arbre, crédits
  de la rangée basse présents sur les trois appareils, SE compris.
- Squelette aligné au pixel sur la boîte, iOS et Android, et celui du fil
  intact.
- Points 8 et 11 : hors de portée du proxy, qui refuse la publication et ne
  connaît pas de profil public au compte factice. Vérifiés par les tests
  seulement, ils restent à recetter au lot 4.
- Points 9, 12 et 13 : lot 3.

### 8.5 Ce qui n'est pas testé, assumé

- Le rendu sur appareil réel, qui accumule maintenant sept chantiers.
- Les tablettes iOS : l'app ne les prend pas en charge (`supportsTablet:
  false`). La tablette Android est regardée en §8.6.
- Le gain de latence sur réseau mobile réel. Mesuré en filaire, extrapolé à un
  RTT.

### 8.6 Android, sur les émulateurs Android Studio

Arbitré en §11 : le plus de cas possible. La première version de cette spéc ne
prononçait pas le mot, alors que l'app est publiée sur Google Play et que la
formule de §5.1 y rencontre son seul cas limite : sous 374,5 pt de large, la
boîte descend avec le fil sous le plancher, et 360 dp est une largeur Android
courante.

Tout tient avec ce qui est installé, sans téléchargement : l'AVD `Pixel_8`
(Android 37, 1080 × 2400 px, 411 dp) et l'AVD `Pixel_Tablet` (Android 35). Les
largeurs se simulent par la densité, que `adb shell wm density reset` rétablit.
Lancement de l'app : `RECETTE-MOBILE.md` §3.

| Cas | Réglage `adb shell` | Ce qu'il éprouve |
|---|---|---|
| 411 dp | défaut | le téléphone Android courant |
| 384 dp | `wm density 450` | une largeur intermédiaire |
| 360 dp | `wm density 480` | la boîte sous le plancher, avec le fil |
| 360 × 640 dp | `wm size 720x1280` puis `wm density 320` | petit écran : plancher et défilement |
| navigation à trois boutons | `cmd overlay enable com.android.internal.systemui.navbar.threebutton` | la marge basse de la barre de navigation |
| police 1,3 puis 2,0 | `settings put system font_scale` | plafonds et rétrécissement de §5.4 |
| tablette | AVD `Pixel_Tablet` | `MAX_BOX_WIDTH`, et une seconde version d'Android |
| hors ligne | `svc wifi disable` et `svc data disable` | « Connexion perdue » sans attendre |

Sur chaque cas : recettes 1, 2, 3 et 9 ; la 5 sur le cas hors ligne. Sur 411
et 360 dp, en plus, un relevé des marges que `useSafeAreaInsets` rend
réellement et de la hauteur de `useWindowDimensions` : c'est le couple dont la
formule dépend, et il n'a jamais été mesuré sur Android.

**Relevé du lot 2**, sur l'AVD `Pixel_8`, en dp, la valeur du modèle entre
parenthèses :

| Cas | Barres système, haut et bas | Boîte, bord gauche et droit | Haut de la boîte | Bordure basse | Haut des boutons | Largeur / hauteur |
|---|---|---|---|---|---|---|
| 411 dp | 50,29 et 24 | 32 → 379,43 | 238,48 (238,29) | 726,48 (726,41) | 807,24 (807,29) | −0,05 % |
| 360 dp | 44 et 24 | 32 → 328 | 232,00 | 647,67 (647,61) | 693,00 | +0,03 % |

- Aucun défilement ni recouvrement dans les deux cas, boîte de la largeur du
  fil, et l'ombre rendue par une élévation.
- Les barres ont été lues par `dumpsys window`, pas dans l'app : les marges
  que rend `useSafeAreaInsets` restent à relever au lot 4, même si les cotes,
  à 0,2 dp du modèle, n'indiquent aucun écart.
- Hors ligne : « Connexion perdue » sans attendre, puis la page se recharge
  seule en 4 s environ au retour du réseau. `adb reverse` laisse pourtant
  passer les requêtes après `svc wifi disable` et `svc data disable` : NetInfo
  dit hors ligne quand le proxy répond encore.
- Un défaut trouvé et corrigé : Android ignore `color: 'transparent'` sur un
  `Text`, et l'os de la date du squelette affichait son texte de gabarit. Il
  est devenu un fond, avec un texte à opacité nulle qui lui donne sa hauteur.
- Reste pour le lot 4 : 384 dp, 360 × 640 dp, la navigation à trois boutons,
  les tailles de police, la tablette, et le relevé des marges dans l'app.

---

## 9. Plan de développement

Quatre lots. L'arbre compile et la suite passe à la fin de chacun.

### Lot 1 · Les deux modules purs · livré

`public-layout.ts`, les fonctions de hauteur réelle de `geometry.ts`,
`public-bento.ts`, leurs tests unitaires, le test d'intégration sur bouchon et
`scripts/check-public-bento.ts`. `PSEUDO_REGEX` et ses bornes passent dans
`pseudo-match.ts`. Les types de `packages/supabase-mobile` n'ont pas changé.

Aucun écran ne change. **Vérifié** : 270 tests verts dont 53 nouveaux,
typecheck et lint propres, treize défauts injectés dans les modules tous
attrapés par les tests, contrôle de production au vert et capable de tomber
(§8.3). Commit `0000f74`.

### Lot 2 · L'écran · livré

`ScrollView`, échelle du module avec `fontScale`, marge et non largeur, et des
styles qui importent les constantes du module au lieu de les recopier.
`useQuery` avec un seul réessai, 5 s par tentative et l'état hors ligne lu sur
NetInfo. Les états de §5.3, dont le message dédié sur sa propre page.
`BentoBoxSkeleton` extrait et partagé avec le fil, et `gridBorderWidth` dans
`BentoGrid` et le squelette. `ShareImage` sortie du conteneur défilant.
`resetQueries` dans `bento-actions.ts`, avec un test sur `query-core`.
Suppression de `loadPublicBentoByPseudo` et de `findUserByPseudo`, désormais
sans appelant, et échappement du joker dans `checkPseudoAvailability`.

**Écarts au plan, tous validés (§11)** : aucun réessai caché de `postgrest-js`
(§6.2) ; rechargement seul au retour du réseau (§5.3) ; remise à zéro du fil et
des pages publiques après une suppression de compte ; hauteurs de ligne tirées
du modèle, et « Partager » qui ne grandit plus de 3 pt pendant le partage ;
client sans session pour la lecture de la page (§6.4). Côté code, l'état à
montrer vit dans `public-page-state.ts`, la politique de requête dans
`public-bento-query.ts`, et la vérification de pseudo de l'inscription dans
`pseudo-availability.ts`, à client injecté pour que son échappement se teste.

**Vérifié** : 308 tests verts dont 38 nouveaux, typecheck et lint propres, onze
défauts injectés tous attrapés (§8.1), recette des trois iPhone et de
l'émulateur à 411 et 360 dp (§8.4, §8.6), client sans session éprouvé sur les
deux plateformes (§6.4). Commit `b36a489`.

### Lot 3 · Ce que la police maximale casse

Plafonds de grossissement, `numberOfLines` sur les CTA, pseudo et date sur une
ligne avec `adjustsFontSizeToFit`, chevron à taille fixe. Plafonds dans `Tile`
et `EmptyTile`, et titres de `Tile` jamais coupés au milieu d'un mot sur
Android. `ShareImage` mesurée à la plus grande police, et gelée si elle la
suit. Les corrections de détail qui restent en §5.6.

**Vérification** : captures des trois iPhone et d'Android au réglage maximal
et en xxLarge, le fil et le composer compris, et les titres longs sur Android
à la taille par défaut.

### Lot 4 · Recette et mesures

La liste de §8.4 sur les trois iPhone, dont les points 8 et 11 que le proxy
n'a pas permis au lot 2, la matrice Android de §8.6, le relevé de latence après
bascule, la mise à jour de la roadmap et l'ouverture des suivis.

---

## 10. Definition of Done

| # | Critère | Vérifié par |
|---|---|---|
| 1 | Six cases atteignables et lisibles sur iPhone SE | recette 1, capture |
| 2 | Rien ne recouvre la boîte au repos tant que le plancher ne s'applique pas, ni en fin de défilement | modèle testé + recette 1 |
| 3 | Proportions natives à 1 % | recette 2 |
| 4 | Même largeur de boîte que dans le fil | recette 3 |
| 5 | Retour sur un bento déjà vu : zéro requête, zéro squelette | recette 4 |
| 6 | Un seul aller-retour, p50 sous 100 ms | §8.3, vert au lot 1 |
| 7 | Charge utile sous 2 100 octets | §8.3, vert au lot 1 |
| 8 | Panne réseau distinguée de l'absence, sans attendre hors ligne et en 11 s au plus sinon | recette 5 |
| 9 | Pseudo connu sans bento distingué de pseudo inconnu | recette 6 et 7 |
| 10 | Publier puis arriver sur sa page montre le bento, jamais le message d'absence ni l'ancien item | recette 8 |
| 11 | Écran et tuiles lisibles à la police maximale, et en xxLarge | recettes 9 et 13, captures |
| 12 | Crédits de la rangée basse présents dans l'arbre d'accessibilité | recette 10 |
| 13 | Suite complète verte | CI |
| 14 | Sa propre page sans bento : message dédié | recette 11 |
| 15 | Image de partage identique quelle que soit la police | recette 12, captures |
| 16 | Les critères 1 à 11 tiennent sur la matrice Android | §8.6, captures |
| 17 | La page se charge avec une session périmée et l'authentification en panne | §6.4, test d'intégration et recette sur les deux plateformes, fait au lot 2 |
| 18 | Aucun titre de tuile coupé au milieu d'un mot sur Android | lot 3, captures |

## 11. Décisions tranchées

| Question | Décision | Raison |
|---|---|---|
| Échelle dynamique du composer ? | **non** | calcule sur la seule hauteur, donne 0,69 sur SE et reconduit l'écrasement |
| Échelle du fil telle quelle ? | **non**, plafonnée aussi par la hauteur | sinon la boîte passe sous les boutons dès que la police grossit, et sur tout écran court |
| Page défilante ? | **oui**, mais inactive par construction | filet pour le SE, la police maximale et l'en-tête futur |
| Plancher d'échelle | **`feedScale(375)`, 0,8615** | ce que le fil montre sur un iPhone SE, livré au chantier 2 ; 0,86 aurait rendu la boîte 0,5 pt plus étroite |
| Rogner l'en-tête de 12 pt ? | **oui**, confirmé en relecture | sans rabot la boîte du fil tient encore, à 7 pt près ; le rabot achète la marge et il est codé. Descendre les boutons, ou ne rien toucher, écartés |
| `!inner` ou jointure externe ? | **externe** | distingue « pas de bento en ligne » de « pseudo inconnu », même latence |
| Garder `pickExactPseudo` ? | **oui**, derrière un échappement à la source | le filtre client ne voit que les lignes revenues, et `limit=5` peut couper la bonne |
| Champs de la requête | **ceux qui sont rendus** | −21 % d'octets, aucun changement visible |
| Squelette ou spinner ? | **squelette** | la page est l'arrivée d'une recherche à 48 ms |
| Remise à zéro ciblée ou par préfixe ? | **préfixe, par `resetQueries`** | `bento-actions` ne connaît pas le pseudo ; `invalidateQueries` resert l'ancienne réponse au remontage, simulé |
| Signaler la case d'arrivée ? | **non** | la ligne de résultat la nomme déjà, et les six seront visibles |
| Corriger le composer au passage ? | **non** | budget vertical validé au chantier 2, hors périmètre |
| Taille de police dans le modèle ? | **oui**, `fontScale` obligatoire | un en-tête constant laisse la boîte sous les boutons dès que la police grossit |
| Hauteur de la boîte | **réelle, cadre arrondi compris** | `512 × échelle` se trompe d'un point, la marge d'un bouton |
| Délai avant « Connexion perdue » | **immédiat hors ligne (NetInfo), sinon 5 s par tentative et un réessai** | 11 s au pire ; la politique globale ne bornait rien. 10 s sans réessai, ou rien, écartés |
| Pseudo long à police agrandie | **une ligne, `adjustsFontSizeToFit`** | pseudo entier et en-tête à la hauteur du modèle ; tronquer, ou mesurer l'en-tête, écartés |
| Recouvrement au repos sur SE | **accepté, critère 2 reformulé** | boutons collants, « Partager » visible à l'arrivée ; boutons dans le flux, ou bloc compact, écartés |
| Sa propre page sans bento | **message dédié, bouton vers le composer** | « @toi n'a pas de bento en ligne » ne s'adresse à personne |
| Plafonds de police des tuiles | **dans `Tile` et `EmptyTile`** | une tuile illisible ne se corrige pas écran par écran ; le fil et le composer en profitent |
| Image de partage et police système | **mesurer, puis figer si confirmé** | une image doit sortir identique pour tout le monde |
| Android | **le plus de cas possible, émulateurs Android Studio** | l'app y est publiée, et 360 dp est le seul cas limite de la formule |
| Joker dans `checkPseudoAvailability` | **corrigé au lot 2** | `pseudo.ts` y est touché, et `escapeLikePattern` existe |
| Libellés des états | **« Rien en ligne »** en titre, « Reprendre mon bento », « Le bento de @x n'a pas pu se charger. » | un titre court, la phrase dessous dit ce qui manque ; « Pas de bento en ligne » répétait la phrase |
| Réessais cachés de `postgrest-js` sur la page | **coupés, `.retry(false)`** | jusqu'à 7 s de réessais silencieux par tentative, et la borne de 11 s sautait |
| Rechargement au retour du réseau | **oui, sans toucher « Réessayer »** | sinon « Connexion perdue » attend un geste une fois le réseau revenu ; vérifié sur Android, en 4 s environ |
| Suppression de compte | **remet aussi à zéro le fil et les pages publiques** | rien du compte supprimé ne reste en cache sur l'appareil |
| Hauteurs de ligne | **tirées du modèle**, « Partager » compris | le modèle ne tient que si l'écran rend les hauteurs qu'il suppose ; le bouton grandissait de 3 pt pendant le partage |
| Client des lectures de la page | **sans session, au lot 2** | le client principal faisait attendre la page derrière l'authentification ; le propriétaire voit sa page comme le public |
| Réessais cachés du fil, de la recherche et de l'inscription | **suivi hors chantier** (§12) | chaque écran aura sa politique et sa recette ; la doc de recette est corrigée tout de suite |
| Bandeau « Pas de connexion » sur le bouton retour | **chantier 11** | commun à tous les écrans : le corriger ici seulement créerait deux comportements |
| Espace sous la boîte sur écran haut | **laissé ainsi** | même boîte que dans le fil et même haut de page partout ; 76 dp environ sur Pixel 8, 48 pt calculés sur 17 Pro Max |
| Titres coupés au milieu d'un mot sur Android | **lot 3, dans `Tile`** | le lot 3 rouvre `Tile` et fait ses captures sur Android ; le fil et le composer en profitent |
| Client principal bloqué par une authentification en panne | **suivi hors chantier** (§12) | même famille de panne que les réessais cachés ; seules les lectures publiques pourraient changer de client |

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
sur `TopChip`.** Deux écrans et les tuiles traités sur l'ensemble, « Trouver »
au chantier 6, celui-ci et `Tile`. Chantier 11.

**`pseudo ILIKE` ne profite d'aucun index.** Chaque ouverture parcourt
`users` : sans effet à 75 profils, à revoir bien avant quelques dizaines de
milliers, par un index trigramme ou une égalité sur une forme normalisée du
pseudo.

**Les réessais cachés de `postgrest-js` restent sur le fil, la recherche et
l'inscription.** Sous chaque tentative de React Query, trois réessais après 1,
2 puis 4 s pour un `GET` tombé en réseau ou reçu en 503 ou 520. En panne
réseau, le fil attendrait environ 24 s avant son erreur : trois tentatives de
7 s et deux pauses, calcul à confirmer par une mesure. `supabase-js` 2.105 ne
permet pas de les couper globalement, donc `.retry(false)` chargeur par
chargeur, chaque écran avec sa politique et sa recette. Versé à la roadmap.

**Le client principal attend l'authentification.** Session proche de
l'expiration et authentification en panne : des boucles de 8 tentatives sur
25,5 s, enchaînées sans pause, mesurées sur simulateur et sur émulateur.
Toutes les requêtes de ce client attendent, publiques comprises : au
démarrage, le profil a attendu 25,5 s. Seule la page publique en est sortie
(§6.4). Le fil et la recherche pourraient suivre après vérification de leur
RLS ; les écritures, non. Versé à la roadmap.

**Le bandeau « Pas de connexion » recouvre le bouton retour**, justement dans
l'état « Connexion perdue ». Le bandeau est commun à tous les écrans.
Chantier 11.

**Sa propre page sans bento n'est vérifiée que par les tests.** Le proxy de
recette refuse la publication et ne connaît pas de profil public au compte
factice : les recettes 8 et 11 restent à faire au lot 4.

**Les sous-titres d'artistes sont en anglais.** « US · Person », « FR · Person
· French rapper » : des données héritées d'anciens imports, que le code actuel
ne produit plus, vues sur les cases Artiste pendant la recette. Hors chantier,
une tâche séparée est proposée pour en mesurer l'ampleur.
