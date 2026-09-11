# UX-02 · « La table » : fil de bentos complets

> **Statut : spécifié, prêt à développer.** Rédigé le 11 septembre 2026.
> Chantier 2 de la [roadmap UX](./MON-BENTO-POP-UX-ROADMAP.md). Effort M.
> Remplace la première version de cette spec, qui prévoyait une grille de
> mini-cartes sous le carrousel featured.

---

## 1. Intention

L'onglet « À la une » devient un **fil social de bentos complets**. On ne
montre plus un aperçu abstrait sur lequel il faut taper pour voir quelque
chose : on montre le bento, en entier, dans le fil. L'utilisateur défile et
lit directement les choix des autres.

Le carrousel de curation disparaît en tant que bloc séparé. Les bentos
featured restent distingués, mais **à l'intérieur du fil**, à leur date de
publication.

À terme le fil accueillera des likes, des commentaires et plusieurs types de
bento (le bento de la semaine notamment). Ce chantier construit la structure
qui les recevra sans réécriture, mais ne les implémente pas.

### 1.1 Pourquoi maintenant

Relevé en production le 11 septembre 2026, via la clé anonyme (donc
exactement ce que voit l'app) :

| Mesure | Valeur |
|---|---|
| Comptes | 69 |
| Bentos publiés | 26 |
| Bentos `is_featured` | **3**, le plus récent du 10 août |
| Bentos publiés avec les 6 cases | 26 sur 26 |
| Bentos publiés depuis 3 semaines | 14 |

L'onglet montre aujourd'hui 12 % du contenu disponible, et sa fraîcheur
dépend d'un geste manuel qui a lieu une fois par mois pour un rythme de
publication d'un bento tous les deux jours. Vingt-trois compositions
terminées sont invisibles.

Le carrousel « Coups de cœur de la semaine » est par ailleurs du code mort :
le `slice(4)` de `featured.tsx:41` ne produit jamais rien tant qu'il y a moins
de 5 featured, et il n'y en a jamais eu plus de 3.

### 1.2 Le défaut de fond que ce chantier corrige

`publishBento` réécrit `published_at` à chaque appel
(`apps/mobile/src/lib/bento-actions.ts:66`), et le CTA du composer reste
« Publier mon bento » après publication (`compose.tsx:191`). Chaque nouveau
tap remet la date à `now()`.

Sans correctif, le fil n'ordonne pas les dernières publications mais les
derniers taps sur un bouton, et un bento de mai peut réapparaître en tête.
Dans un fil de mini-cartes c'était discutable ; dans un fil où chaque bento
occupe un écran entier, c'est une désorganisation visible. Le correctif
appartient nominalement au chantier 5, il est avancé en lot 0.

---

## 2. Objectif et critères de succès

**Fait quand :**

1. L'onglet n'est jamais vide dès qu'un bento est publié en base.
2. Les 26 bentos publiés sont atteignables par défilement, sans doublon ni
   trou.
3. Chaque bento est lisible dans le fil sans avoir à taper.
4. Un bento featured est identifiable au premier coup d'œil, sans sortir du
   fil.
5. Un bento publié depuis l'app apparaît en tête au prochain pull-to-refresh.
6. Republier un bento existant ne le fait pas remonter en tête.
7. Le second passage sur le fil ne retélécharge aucune image.
8. Le défilement reste fluide (voir le budget mesurable en §8).

---

## 3. Périmètre

**Dans le périmètre**

- `apps/mobile/app/(tabs)/featured.tsx` renommé `table.tsx`, entièrement
  réécrit.
- `apps/mobile/app/(tabs)/_layout.tsx` : renommage de l'onglet.
- `apps/mobile/src/lib/feed.ts` (remplace `featured.ts`) : requête unique,
  pagination par curseur, mapping pur.
- `apps/mobile/src/components/feed/` (nouveau) : `FeedPost`,
  `FeedPostHeader`, `FeedPostSkeleton`.
- `apps/mobile/src/components/bento/Tile.tsx` : migration vers `expo-image`.
- `apps/mobile/src/lib/relative-date.ts` (nouveau).
- `apps/mobile/src/lib/bento-actions.ts` : `publishBento` idempotent.
- Suppression de `MiniBentoCard` (voir décision D3).

**Hors périmètre**

- Likes, commentaires, compteurs (chantier 8). La structure les accueille,
  rien n'est rendu.
- Les types de bento, dont le bento de la semaine (nouveau chantier 13).
- La recherche par item (chantier 6).
- `expo-image` sur le reste de l'app : `search-modal`, `search`, `profile`,
  `u/[pseudo]`, `ShareImage` (chantier 4, réduit d'autant).
- Le vrai modèle brouillon / publié (chantier 5).
- La recompression des images à l'upload dans le back-office (§4.4).

---

## 4. Le coût des images, et ce qui en découle

C'est la contrainte qui structure tout le chantier. Un fil de bentos complets
charge de vraies images là où les mini-cartes n'en chargeaient aucune.

### 4.1 Mesures

Relevé sur les 6 derniers bentos publiés, puis vérifié sur 8.

| Mesure | Valeur |
|---|---|
| Cases avec un visuel | 34 sur 48, soit 4,25 par bento |
| Poids moyen d'une image | 165 Ko |
| Poids images d'un bento complet | environ 700 Ko |
| Défilement des 26 bentos | environ **18 Mo** |
| Part hébergée sur Supabase Storage | **76 %**, soit 13,7 Mo facturés |
| Part hébergée sur TMDb | 24 %, CDN externe, gratuit |
| Charge utile JSON, 8 bentos | 15 082 o |

Les images du Storage sont en 960 px de large pour 173 à 310 Ko. Les images
TMDb sont en 500 × 750 pour 85 à 116 Ko. À surface comparable, celles du
Storage pèsent deux à trois fois plus.

### 4.2 Trois verrous vérifiés

**Pas de cache CDN.** Les objets du Storage sortent en
`cache-control: no-cache`. Confirmé par requête directe, et cohérent avec ce
qui avait déjà été constaté côté landing.

**Pas de redimensionnement serveur.** L'endpoint de transformation
`/storage/v1/render/image/public/...?width=400` répond :

```json
{"statusCode":"403","error":"FeatureNotEnabled",
 "message":"feature not enabled for this tenant"}
```

On sert donc un JPEG de 280 Ko dans une case de 100 pt de haut, sans levier
côté serveur.

**Le quota, à vérifier.** La transformation d'image est indisponible sur le
plan gratuit. Si le projet mobile y est, le budget d'egress est de 5 Go par
mois, soit **environ 365 défilements complets** avant épuisement. Avec 69
comptes, cela laisse cinq défilements par personne et par mois. À confirmer
dans le tableau de bord Supabase avant la mise en production du fil.

### 4.3 Conséquence : `expo-image` est un préalable, pas une optimisation

Toutes les images distantes passent aujourd'hui par le `<Image>` de React
Native : aucun cache disque. Chaque retour sur l'onglet retéléchargerait les
18 Mo.

`expo-image` conserve les images sur le disque via son propre cache, qui ne
dépend pas des en-têtes HTTP, donc le `no-cache` du Storage ne le gêne pas.
C'est le seul levier disponible, et il transforme un coût récurrent en coût
unique par appareil.

La migration est donc le **lot 1** de ce chantier, limitée au composant
`Tile` (celui qui rend les images du fil). Le reste de l'app suit au
chantier 4, qui s'en trouve allégé.

### 4.4 Ce qui reste sur la table

Les images du Storage sont compressées trop faiblement : 274 Ko pour du
960 × 540, soit environ 0,53 octet par pixel là où un JPEG de qualité
correcte tourne autour de 0,15.

Ré-encodage mesuré avec `sharp` sur cette même image :

| Traitement | Poids |
|---|---|
| Original | 274 Ko |
| 960 px, q75 | 156 Ko (-43 %) |
| 800 px, q75 | 105 Ko (-62 %) |
| 720 px, q72 | **79 Ko (-71 %)** |

Le levier est dans le back-office admin, au moment de l'upload dans
`item-images` : `sharp` y est déjà une dépendance (utilisé pour l'image Open
Graph de la landing). Recompresser à l'upload diviserait par trois l'egress
du fil, en plus du cache disque.

**Hors périmètre de ce chantier**, mais c'est le suivi le plus rentable qu'il
génère. Voir §14.

---

## 5. Design du fil

### 5.1 Le principe : la boîte est le post

Le piège de cette refonte est la boîte dans la boîte. La grille bento est
déjà un objet clos et signé : fond crème, bordure noire de 5 px, quatre
rivets, ombre stamp. L'emballer dans une carte blanche bordée donnerait deux
cadres concentriques et détruirait la signature visuelle.

Donc **pas de carte de post**. La boîte bento *est* le post. L'étiquette
d'identité flotte au-dessus, directement sur le fond jaune, alignée sur le
bord gauche de la boîte.

### 5.2 Anatomie d'un post

```
   ╭─────────────────────╮                    ← étiquette d'identité,
   │ 🍙  @dark_hifus     │                      rotation -1,5°, bordure 2,5 px,
   │     Florian · 3 j   │                      ombre plate, fond blanc
   ╰─────────────────────╯
                                    ╭──────────────╮
   ┌────────────────────────────────┤ COUP DE CŒUR │  ← uniquement si featured
   │ ●                              ╰●─────────────╯     rotation -8°, rouge
   │   ┌──────────────────────────────┐ │
   │   │            FILM              │ │
   │   └──────────────────────────────┘ │
   │   ┌─────────────┐┌───────────────┐ │      la grille existante,
   │   │    SÉRIE    ││    ARTISTE    │ │      composant inchangé
   │   └─────────────┘└───────────────┘ │
   │   ┌────────┐┌─────────┐┌─────────┐ │
   │   │CHANSON ││  CRÉA   ││  LIEU   │ │
   │   └────────┘└─────────┘└─────────┘ │
   │ ●                                ● │
   └────────────────────────────────────┘
```

**L'étiquette d'identité** reprend le vocabulaire du composant `Sticker` :
rotation légère, bordure ink, ombre plate rendue par une vue dupliquée. Elle
contient le Popy de l'utilisateur (déjà dérivé du pseudo par
`popyForPseudo`), le pseudo en Extenda, et sur une seconde ligne le nom
d'affichage suivi de la date relative.

**Elle ne chevauche pas la boîte.** Le chevauchement serait plus joli sur
maquette et coûterait une journée de débogage : superposer deux frères sur
Android demande une `elevation`, or les ombres du produit sont dessinées à la
main précisément parce que les ombres natives se décalent sous `rotate` sur
iOS. Un écart de 10 pt, la rotation et l'ombre suffisent à produire l'effet
« collé à la main ».

**Le tap** couvre l'étiquette et la boîte, et mène à `/u/[pseudo]`, comme le
font les cartes featured aujourd'hui. Les cases ne sont pas individuellement
tapables dans le fil : `BentoGrid` reçoit `onTap` non défini, donc aucun
`Pressable` imbriqué, ce qui évite les conflits de geste au défilement.

### 5.3 Dimensions

La grille mesure exactement **361 × 512 pt** à l'échelle 1, et 361 vaut
393 - 32 sur un iPhone 15. Les proportions tombent juste sans rien forcer.

```ts
const DESIGN_WIDTH = 361;
const H_PADDING = 16;
const MAX_WIDTH = 420;   // au-delà, sur tablette, la boîte s'étale
const boxWidth = Math.min(width - H_PADDING * 2, MAX_WIDTH);
const scale = boxWidth / DESIGN_WIDTH;
```

L'échelle se calcule sur la **largeur**, parce qu'un fil défile
verticalement : la largeur est la seule contrainte. C'est l'inverse du
composer, qui calcule sur la hauteur disponible parce qu'il tient en un
écran. Les deux sont corrects, la différence est notée ici pour qu'on ne
« corrige » pas l'un avec l'autre.

`Tile` plafonne déjà l'échelle typographique à 0,7 en interne, donc rien à
clamper en plus.

Hauteur d'un post à l'échelle 1 : 64 (étiquette) + 10 (écart) + 512 (boîte)
+ 28 (marge basse) = **614 pt**, pour 709 pt utiles sur iPhone 15. Un post
tient à l'écran et laisse apparaître 95 pt du suivant, ce qui est exactement
le signal de défilement recherché.

Sur iPhone SE (375 pt), l'échelle tombe à 0,95 et le post dépasse un peu :
on défile à l'intérieur. Comportement normal pour un fil.

`useWindowDimensions()` et non `Dimensions.get('window')` : le second est
figé au chargement du module et ne suit pas la rotation.

### 5.4 Le traitement featured

Deux signaux, pas trois. En ajouter un de plus rendrait le post ordinaire
terne par contraste, ce qui est l'inverse du but.

1. **L'étiquette « COUP DE CŒUR »**, rouge Bento (`#e63946`), texte crème,
   rotation -8°, en position absolue débordant du coin supérieur droit de la
   boîte.
2. **La bordure de la boîte passe de 5 à 7 px.**

Le conteneur du post réserve `paddingTop: 14` et `paddingRight: 8` pour le
débordement de l'étiquette, sinon elle serait rognée par la cellule
`FlatList` en mode `removeClippedSubviews`.

L'étiquette est rendue **après** la boîte dans l'arbre, donc elle passe
au-dessus sur les deux plateformes sans avoir à toucher au `zIndex`.

Cette étiquette est le point d'extension pour les futurs types : le bento de
la semaine reprendra le même emplacement avec un autre libellé et une autre
couleur. Le composant l'expose donc en prop `ribbon?: { label, color }`
plutôt qu'en booléen `isFeatured`.

### 5.5 Conséquence de l'entrelacement

Les featured étant intercalés à leur date, `featured_order` ne pilote plus
rien dans l'app. Cela supprime d'un coup trois problèmes de la version
précédente de cette spec : la déduplication entre deux blocs, le tri instable
des featured, et le doublon de données (`noxito` et `keremasan` partagent
`featured_order = 2` en base). La colonne reste utilisée par la liste du
back-office.

**Conséquence assumée, signalée avant décision.** Avec 3 featured dont le
plus récent date du 10 août, ils se trouveront tous vers la vingtième
position et personne ne les verra tant que l'équipe ne mettra pas en avant
des bentos récents. Le levier est éditorial, pas technique : featurer au fil
de l'eau plutôt que par vagues.

### 5.6 Ce qu'on ne met pas : la barre d'actions

Les likes et commentaires arriveront (chantier 8). La tentation est de poser
dès maintenant une rangée cœur / bulle / partage grisée sous chaque post.

**Non.** Une affordance inerte annonce une fonctionnalité qui n'existe pas et
récolte des taps sans réponse, ce qui est pire que son absence. Le fil v1
s'arrête à l'étiquette et à la boîte.

En revanche le module de mise en page déclare `ACTIONS_HEIGHT = 0` avec un
commentaire pointant vers le chantier 8, pour que l'ajout ultérieur soit un
changement de constante et pas une reprise de la mise en page.

### 5.7 En-tête de l'écran

Logo seul, puis le titre. Pas de chip « LA TABLE » : la barre d'onglets
indique déjà la section active, le doublon avait déjà été écarté sur l'écran
actuel.

Titre en Extenda : **« TOUT LE MONDE À TABLE. »**

### 5.8 États

| Situation | Rendu |
|---|---|
| Chargement initial | Un squelette de post complet : étiquette grise, boîte crème, six cases grises. Pas d'`ActivityIndicator` centré. La hauteur de l'écran ne saute pas à l'arrivée des données, et l'utilisateur voit la forme de ce qui arrive. |
| Fil non vide | Nominal. |
| Fil vide | « Sois le premier à dresser ta table », plus un bouton vers Compose. N'arrive que sur base fraîche. |
| Erreur | `ErrorState` existant, conservé. |
| Page suivante en cours | `ActivityIndicator` compact en pied de liste. |
| Fin de liste | « C'est tout pour l'instant. À toi de jouer. » Un défilement qui s'arrête sans rien dire laisse croire à un chargement bloqué. |

### 5.9 Accessibilité

Le point délicat d'un fil visuel. Rendre le post entièrement opaque à
VoiceOver le rendrait activable mais viderait le fil de son contenu pour un
utilisateur non voyant ; le laisser ouvert ferait parcourir une soixantaine
de vues par post.

Solution : le post est **un seul élément accessible**, dont le libellé
énumère la composition.

```
« Bento de @dark_hifus, il y a 3 jours. Coup de cœur.
  Film Interstellar. Série Severance. Artiste Orelsan.
  Chanson La Quête. Créateur Squeezie. Lieu Japan Expo.
  Bouton. »
```

Un balayage, tout le contenu, activable. La grille interne reçoit
`importantForAccessibility="no-hide-descendants"` (Android) et
`accessibilityElementsHidden` (iOS) pour ne pas être parcourue deux fois.

Par ailleurs :

- Titre de l'écran en `accessibilityRole="header"`.
- Les crédits d'image restent affichés sur chaque case : obligation CC-BY-SA,
  et les 34 images mesurées en portent toutes un. Leur contraste insuffisant
  (`rgba(255,255,255,0.5)`, `Tile.tsx:283`) est un point du chantier 11, non
  traité ici, mais le fil le rend beaucoup plus visible : à noter en suivi.
- Aucune rotation supérieure à 8°, et uniquement sur des éléments décoratifs.

---

## 6. Contrat de données

### 6.1 Une seule requête

Le carrousel disparaissant, `loadFeaturedBentos` disparaît avec lui. Une
requête unique sert tout l'écran.

```ts
supabase
  .from('bentos')
  .select(`
    id,
    published_at,
    is_featured,
    users:user_id ( pseudo, display_name ),
    bento_items (
      category_id,
      items ( id, title, subtitle, image_url, image_credit )
    )
  `)
  .not('published_at', 'is', null)
  .order('published_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(PAGE_SIZE)
```

Le `.not('published_at', 'is', null)` explicite est nécessaire : la RLS
`bentos_read_published` laisse aussi passer le brouillon de l'utilisateur
courant, qui apparaîtrait en tête du fil public.

Le départage sur `id` n'est pas cosmétique : la pagination par curseur exige
un ordre total.

`PAGE_SIZE = 8`, soit 15 Ko mesurés et cinq écrans de défilement avant
l'appel suivant.

### 6.2 Pagination par curseur

Pas de `range()`. Un décalage numérique produit doublons et trous dès qu'une
ligne est insérée en tête pendant le défilement, ce qui est exactement le
comportement d'un fil trié par date.

```ts
.or(
  `published_at.lt.${cursor.publishedAt},` +
  `and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`,
)
```

#### Deux pièges, tous deux vérifiés en production

**Le `+` du décalage horaire.** `published_at` est sérialisé
`2026-08-26T22:10:09.227+00:00`. Injecté dans une URL sans encodage, le `+`
est décodé en espace et PostgREST répond :

```
22007  invalid input syntax for type timestamp with time zone:
       "2026-08-26T22:10:09.227 00:00"
```

`supabase-js` protège du piège : il passe par `URL.searchParams`, qui encode
le `+` en `%2B`. Vérifié sur la version installée en inspectant
`query.url.href`. Conclusion : **utiliser `.or()` du client, jamais une URL
construite à la main.** Le test d'intégration du lot 2 verrouille ce point.

**La précision du timestamp.** Le curseur est la chaîne renvoyée par
PostgREST, reprise mot pour mot. La faire transiter par
`new Date(x).toISOString()` la tronque à la milliseconde ; sur une colonne
`timestamptz` en précision microseconde, un curseur tronqué de `.227431` à
`.227` saute silencieusement les lignes intermédiaires. Le type du curseur
porte une chaîne opaque, jamais un `Date`.

### 6.3 Mapping et cas limites

Le mapping ligne vers modèle de vue est extrait en fonction pure
`mapFeedRow(row): FeedBento | null`, hors de la fonction réseau, pour être
testable sans Supabase.

| Cas | Comportement |
|---|---|
| `users` nul | Ligne écartée. Le `'???'` actuel de `featured.ts:56` produit une carte qui mène à un cul-de-sac. |
| `items` nul (item `pending`, masqué par la RLS `items_read_validated_or_own_pending`) | Case rendue vide (`EmptyTile`). |
| `category_id` inconnu | Case ignorée. Déjà couvert par `CATEGORY_BY_ID[99] === undefined`, testé. |
| Zéro case lisible | Ligne écartée : une boîte entièrement vide n'apprend rien et occupe un écran. |
| `published_at` nul | Impossible via ce filtre, mais le type l'autorise. Ligne écartée. |

Aucun de ces cas n'existe aujourd'hui (26 bentos sur 26 ont leurs 6 cases et
un utilisateur valide). Ils sont traités parce que le premier item modéré ou
le premier compte supprimé les fera apparaître, et qu'un post vide dans un
fil plein écran ne passe pas inaperçu.

**Asymétrie assumée.** Un item `pending` est lisible par son auteur et par
personne d'autre. L'auteur verra donc sa case remplie dans le fil là où les
autres voient une case vide. Le badge « en attente » n'est pas rendu dans le
fil : il vit dans le composer, qui est l'endroit où l'on peut agir.

### 6.4 Remontée d'erreur

`loadFeaturedBentos` fait `if (error || !data) return []`. Une panne réseau et
une base vide deviennent indiscernables, et l'écran affiche l'état vide alors
que Supabase est tombé. La nouvelle fonction lève, et React Query distingue
`isError` de la liste vide. L'écran a déjà les deux rendus, seule la couche
de données les empêchait d'être atteints.

---

## 7. Migration `expo-image`

### 7.1 Périmètre

Un seul composant : `Tile.tsx`. C'est lui qui rend les images du fil, et il
est partagé par le composer, la page bento publique et l'image de partage,
donc la migration profite immédiatement à ces trois écrans.

Réglages :

| Prop | Valeur | Raison |
|---|---|---|
| `cachePolicy` | `'memory-disk'` | Le défaut est `'disk'` ; la mémoire évite un aller-retour disque au défilement rapide. |
| `contentFit` | `'cover'` | Équivalent du `resizeMode` actuel. |
| `transition` | `160` | Fondu court à l'apparition, plutôt qu'un saut. |
| `placeholder` | dégradé de la palette | La palette est déjà déterministe par item : la case a sa couleur avant même que l'image arrive. |
| `recyclingKey` | `item.id` | Évite qu'une cellule recyclée par `FlatList` affiche brièvement l'image de la précédente. |

Le `placeholder` mérite d'être souligné : c'est ce qui fait qu'un fil qui
charge reste un fil coloré et pas une suite de rectangles gris. La donnée
existe déjà, elle n'est simplement pas exploitée aujourd'hui.

### 7.2 Le risque : la capture de l'image de partage

`share-image.ts:18` précharge les visuels avec `Image.prefetch` de React
Native avant `captureRef`, et la capture est sensible aux courses de
chargement. `ShareImage` rend `BentoGrid`, donc `Tile`, donc la migration le
touche.

Deux effets, opposés :

- `expo-image` expose `Image.prefetch` et son cache disque, donc les visuels
  sont plus souvent déjà prêts au moment de la capture. La capture devrait
  devenir *plus* fiable.
- `react-native-view-shot` capture parfois des vues natives tierces en blanc,
  en particulier sur Android.

**QA bloquante** : générer une image de partage sur iOS et sur Android après
la migration, avec un bento à six visuels, cache vide puis cache chaud.

**Échappatoire documentée, non construite** : si la capture régresse sur
Android, `Tile` accepte une prop `ImageComponent` que seul `ShareImage`
renseigne avec le `Image` de React Native. Le reste de l'app garde
`expo-image`.

### 7.3 Ce que la migration ne résout pas

Le poids unitaire des images. Sans transformation serveur (§4.2) et sans
recompression à l'upload (§4.4), la première visite télécharge toujours
18 Mo. Le cache disque supprime les visites suivantes, pas la première.

---

## 8. Performance

**Budget mesurable, à vérifier sur device :**

| Critère | Cible |
|---|---|
| Premier post peint, cache vide, 4G | < 1,2 s |
| Défilement du fil complet | pas de cellule blanche visible plus d'une image |
| Second passage sur l'onglet | aucune requête image (vérifiable au compteur réseau) |
| Mémoire après défilement des 26 | stable, pas de croissance monotone |

**Coût de rendu.** Un post représente environ 75 vues natives : la boîte,
quatre rivets, six `Tile` d'environ dix vues chacune, l'étiquette. Avec
`windowSize={3}` sur des posts de 614 pt, quatre posts sont montés
simultanément, soit environ 300 vues. C'est tenable, mais c'est un ordre de
grandeur au-dessus de l'écran actuel.

**Réglages `FlatList`** : `initialNumToRender={2}`,
`maxToRenderPerBatch={2}`, `windowSize={3}`,
`removeClippedSubviews` **sur Android uniquement** (sur iOS il provoque des
cellules blanches sur les listes à cellules hautes).

Pas de `getItemLayout` : la hauteur varie avec la présence du nom
d'affichage et l'échelle. Si le défilement rapide s'avère saccadé, la piste
est une hauteur fixe par post, calculée depuis `scale`, ce qui rendrait
`getItemLayout` possible.

**Point de vigilance mesuré à l'œil, pas au profileur** : chaque `Tile`
combine `borderRadius`, `overflow: hidden` et une ombre. C'est déjà le cas
sur les écrans existants, mais jamais six fois par cellule sur une liste qui
défile. Si le coût se voit, la première piste est de retirer l'ombre des
`Tile` à l'intérieur du fil (elles sont déjà à l'intérieur d'une boîte
ombrée, leur ombre propre est peu lisible), pas de toucher au rayon.

**Index.** Aucun ajout. `bentos_published_idx (published_at) where published_at is not null`
couvre le tri, parcouru à l'envers. Trier 26 lignes sur le départage `id` ne
se mesure pas. Seuil de réexamen : environ 10 000 bentos publiés, soit plus
d'un siècle au rythme actuel.

---

## 9. Sécurité et modération

Rien de nouveau n'est exposé : le fil montre ce que la RLS
`bentos_read_published` autorise déjà, et ce que la page publique
`/u/[pseudo]` livre depuis le chantier 1.

**Liste de blocage.** Le filtre `useBlocked` est appliqué au fil. Il est local
au device (`AsyncStorage`), donc inapplicable côté serveur : une page de 8
peut rendre 7 posts. Sans importance sur un défilement continu.

**Signalement.** Pas de menu d'actions sur le post. Le signalement reste sur
la page du bento, à un tap. Un fil de découverte est le mauvais endroit pour
un menu d'actions destructives, et le geste principal du fil doit rester le
défilement.

**Le bento de l'utilisateur courant apparaît dans le fil.** Choisi : voir son
propre post juste après publication est le seul retour que l'app donne
aujourd'hui, en attendant le chantier 8.

---

## 10. Stratégie de test et QA

### 10.1 État des lieux

`apps/mobile` a `pnpm test` (`tsx --test` sur `src/**/*.test.ts`), branché
dans `turbo.json` et dans la CI depuis le chantier 1. Deux fichiers
aujourd'hui. Aucun composant React Native n'est testé, et ce chantier ne
change pas cela : introduire `@testing-library/react-native` n'est pas un
sous-produit de ce chantier.

Couverture visée : **tout ce qui est pur en test unitaire, la forme de la
requête en test d'intégration, le rendu et la performance à la main sur
device.**

### 10.2 Tests unitaires

`src/lib/relative-date.test.ts`

- Chaque borne, testée juste avant et juste après (59 s / 61 s, 23 h 59 /
  24 h 01, 47 h / 49 h, 6 j / 8 j).
- Pluriels : `il y a 1 jour` contre `il y a 2 jours`.
- Date future (horloge du device en avance) ramenée à `à l'instant`, pas
  `il y a -3 min`.
- Entrée non analysable : chaîne vide, pas de plantage.
- Horloge injectée en second paramètre, sinon le test est daté.

`src/lib/feed.test.ts` (partie pure)

- `mapFeedRow` sur chacun des cinq cas limites du tableau 6.3.
- `mapFeedRow` sur une ligne nominale : six cases, palettes déterministes,
  `imageCredit` propagé, `displayName` nul préservé en `null`.
- `cursorOf(row)` renvoie la chaîne `published_at` **inchangée**, avec un cas
  à six décimales pour verrouiller l'absence de passage par `Date`.
- `feedAccessibilityLabel(post)` : l'énumération de §5.9, y compris les cases
  vides (qui ne doivent pas produire « Film undefined »).

### 10.3 Test d'intégration de la requête

C'est ce qui casse en silence : une erreur de syntaxe dans le `.or()` renvoie
une erreur PostgREST, et le fil se vide sans message.

Bouchon HTTP au niveau du protocole, dans l'esprit de
`apps/landing/e2e/stub.ts` : un `node:http` qui enregistre l'URL reçue et
renvoie du JSON figé, avec un vrai `createClient` pointé dessus. Le
constructeur d'URL de `supabase-js` est donc réellement exercé.

Assertions :

1. Page 1 : `order=published_at.desc,id.desc`, `published_at=not.is.null`,
   `limit=8`, et **absence** de `or=`.
2. Le `select` demande bien `image_url` et `image_credit` (le crédit est une
   obligation légale, sa disparition doit casser un test).
3. Page 2 : le `or=` contient les deux branches, et le timestamp apparaît
   encodé `%2B00%3A00` dans l'URL brute. C'est l'assertion qui attrape la
   régression du `+`.
4. Le curseur envoyé est identique, caractère pour caractère, au
   `published_at` renvoyé à la page précédente.
5. Une réponse 500 produit un rejet, pas un tableau vide silencieux.
6. `publishBento` émet bien `published_at=is.null`. Le correctif du lot 0 est
   une ligne dont l'utilité n'est visible qu'à la lecture du commentaire :
   sans test, le prochain lecteur la prendra pour une redondance et la
   retirera, et le fil recommencera à trier sur les taps.

`loadFeedPage` et `publishBento` acceptent pour cela un client injecté en
dernier paramètre, avec le singleton en valeur par défaut. Aucun branchement
de test dans le code de production.

### 10.4 QA manuelle, checklist bloquante

À la charge de Clément, sur device réel.

**Le fil**

- [ ] iPhone SE (375 pt) : la boîte tient en largeur, aucun débordement.
- [ ] iPhone 15 : un post par écran, le suivant apparaît sur environ 95 pt.
- [ ] Tablette Android : la boîte est plafonnée à 420 pt, centrée, pas étirée.
- [ ] Défilement des 26 posts : aucun doublon, aucun trou, pied de liste
      affiché.
- [ ] Un post featured est reconnaissable sans lire l'étiquette.
- [ ] L'étiquette « COUP DE CŒUR » n'est pas rognée en haut d'écran ni en
      cellule recyclée.
- [ ] Tap sur un post : arrivée sur `/u/[pseudo]`, retour, position de
      défilement conservée.

**Les données**

- [ ] Publier depuis un second compte, pull-to-refresh : le post apparaît en
      tête avec « à l'instant ».
- [ ] Retaper « Publier mon bento » sur un bento déjà publié : il **ne**
      remonte **pas**. Vérifie le lot 0.
- [ ] Bloquer un pseudo, revenir : son post a disparu.
- [ ] Mode avion à l'ouverture : `ErrorState`, bouton Réessayer fonctionnel.
- [ ] Mode avion en cours de défilement : échec propre, pas d'écran blanc, la
      liste déjà chargée reste affichée.

**Les images**

- [ ] Premier défilement complet, puis retour sur l'onglet : **aucune requête
      image** au second passage (compteur réseau du dev menu, ou proxy).
- [ ] Cache vide : les cases affichent leur dégradé de palette avant l'image,
      jamais un rectangle gris.
- [ ] Image de partage générée sur **iOS** et sur **Android**, bento à six
      visuels, cache vide puis cache chaud. Aucun visuel manquant ni blanc.
- [ ] Les crédits d'image sont présents sur chaque case qui en porte un.

**Confort et accessibilité**

- [ ] Taille de police système au maximum : les pseudos longs ne débordent
      pas de l'étiquette.
- [ ] VoiceOver : un balayage par post, énoncé conforme à §5.9. La grille
      n'est pas parcourue case par case.
- [ ] Android, défilement rapide sur les 26 posts : pas de saccade
      perceptible, pas de cellule blanche persistante.
- [ ] Captures partagées dans la conversation, comme au chantier 1.

### 10.5 Ce qui n'est pas testé, assumé

- Le rendu des composants React Native (pas de harnais).
- La virtualisation de `FlatList` (code amont).
- Le comportement du cache disque d'`expo-image` (code amont), vérifié
  seulement par l'observation du compteur réseau.
- Le calcul d'échelle, vérifié à l'œil sur trois tailles d'écran.

---

## 11. Plan de développement

### Lot 0 · `publishBento` idempotent

Indépendant de l'affichage, livré d'abord parce que l'ordre du fil en dépend.

- `.is('published_at', null)` sur l'update : zéro ligne affectée sur un bento
  déjà publié, sans erreur, donc aucun changement pour l'appelant.
- Commentaire expliquant pourquoi la fonction ne doit pas être « corrigée »
  pour toujours écrire.

**Vérification** : republier depuis l'app, constater en base que
`published_at` n'a pas bougé.

### Lot 1 · `expo-image` sur `Tile`

Priorité posée par Clément, et préalable technique au fil.

- Dépendance `expo-image`, migration de `Tile.tsx`, réglages de §7.1.
- Adaptation de `share-image.ts` au `prefetch` d'`expo-image`.
- QA de capture iOS et Android (§7.2) avant d'aller plus loin.

**Vérification** : `expo export` pour iOS et Android, plus la capture de
partage sur les deux plateformes.

### Lot 2 · Couche de données

- `src/lib/feed.ts` : `FeedBento`, `Cursor`, `PAGE_SIZE`, `mapFeedRow`,
  `cursorOf`, `loadFeedPage`, `feedAccessibilityLabel`.
- Suppression de `src/lib/featured.ts`.
- `publishBento` accepte un client injecté, pour l'assertion 6 de §10.3.
- Remontée d'erreur au lieu du tableau vide.
- Tests unitaires (§10.2) et bouchon d'intégration (§10.3).

**Vérification** : `pnpm --filter @bento-pop/mobile test` au vert, plus un tir
manuel de la requête page 2 contre la production.

### Lot 3 · Composants du post

- `src/components/feed/FeedPost.tsx`, `FeedPostHeader.tsx`,
  `FeedPostSkeleton.tsx`, plus un `layout.ts` portant les constantes de §5.3
  et `ACTIONS_HEIGHT = 0`.
- `src/lib/relative-date.ts` et ses tests.
- Prop `ribbon` plutôt que `isFeatured`.
- Suppression de `MiniBentoCard`.

**Vérification** : captures des deux variantes, ordinaire et featured.

### Lot 4 · L'écran « La table »

- `featured.tsx` renommé `table.tsx`, réécrit en `FlatList`.
- `_layout.tsx` : `name="table"`, titre « La table ».
- `useInfiniteQuery`, `onEndReached`, pieds de liste, les six états de §5.8.
- Filtre de blocage, échelle calculée, en-tête de liste.

**Vérification** : captures sur trois tailles d'écran, partagées.

### Lot 5 · Performance et QA

- Réglages `FlatList`, mesure du budget de §8 sur device.
- Checklist §10.4.
- Mise à jour de la roadmap, ouverture des suivis.

---

## 12. Definition of Done

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` au vert sur tout le dépôt.
- [ ] Les tests de §10.2 et §10.3 existent et passent en CI.
- [ ] Les huit critères de succès de §2 sont vérifiés sur device.
- [ ] La checklist §10.4 est intégralement cochée, capture de partage
      comprise sur les deux plateformes.
- [ ] `expo export` passe pour iOS et Android.
- [ ] Aucune référence résiduelle à `featured.ts` ni à `MiniBentoCard`.
- [ ] Le plan Supabase et son quota d'egress ont été vérifiés (§4.2).
- [ ] Roadmap mise à jour, suivis consignés.

---

## 13. Décisions tranchées

| # | Décision | Retenu |
|---|---|---|
| D1 | `expo-image` | Préalable, en lot 1, limité à `Tile`. Le reste au chantier 4. |
| D2 | Place des featured | Intercalés à leur date, distingués par une étiquette et une bordure épaissie. Conséquence de visibilité signalée en §5.5. |
| D3 | `MiniBentoCard` | Supprimé. Plus aucun appelant, et le composant porte un badge « Featured » codé en dur. Récupérable dans l'historique git si le chantier 6 en veut une variante. |
| D4 | Cible du tap | `/u/[pseudo]`, comme les cartes featured aujourd'hui. Les cases ne sont pas tapables dans le fil. |
| D5 | Nom de l'onglet | « La table ». Prolonge le vocabulaire du produit là où « le fil » est le mot générique de tout le monde, et ouvre la suite : le bento de la semaine devient « le menu ». |
| D6 | Barre d'actions | Absente en v1. Pas d'affordance inerte. Budget de mise en page réservé par une constante. |
| D7 | Emballage du post | Pas de carte. La boîte bento est le post, l'étiquette d'identité flotte au-dessus sans chevauchement. |

---

## 14. Suivis générés par ce chantier

### Recompression des images à l'upload (le plus rentable)

Mesuré en §4.4 : 274 Ko vers 79 Ko à 720 px q72, soit **-71 %** sur les 76 %
d'images hébergées chez nous. Le levier est dans le back-office admin, où
`sharp` est déjà une dépendance. Combiné au cache disque, cela ramènerait le
premier défilement d'environ 18 Mo à environ 7 Mo.

### Vérifier le plan Supabase et le quota d'egress

La transformation d'image est désactivée sur le projet, ce qui est le
comportement du plan gratuit. Si c'est le cas, 5 Go par mois valent environ
365 défilements complets. À regarder avant la mise en production.

### Contraste des crédits d'image

`rgba(255,255,255,0.5)` sur photo (`Tile.tsx:283`), sous le seuil de
contraste, pour une mention légale CC-BY-SA. Déjà listé au chantier 11 ; le
fil le rend beaucoup plus visible.

### Le reste d'`expo-image`

`search-modal`, `search`, `profile`, `u/[pseudo]`. Le chantier 4 s'en trouve
réduit à ces quatre écrans.

### Nettoyage des `featured_order` en doublon

Deux bentos à `featured_order = 2`. Sans effet sur l'app une fois les
featured entrelacés, mais la liste du back-office reste concernée.
