# UX-03 · Recherche d'item : suggestions, autofocus, retour tactile

> Spécification du chantier 3 de [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
> Rédigée le 12 septembre 2026 à partir du code de `apps/mobile/app/search-modal.tsx`
> et `apps/mobile/app/(tabs)/compose.tsx`, et de mesures faites sur la base de
> production le même jour.
>
> Recette sur simulateur : [`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md).

---

## 1. Intention

Le composer est le seul écran qui produit du contenu. Tout le reste de l'app
(le fil, la page publique, le partage) n'existe que s'il y a des bentos, et un
bento n'existe que si six cases ont été remplies d'affilée. Le chantier 1 a
ouvert la porte d'entrée, le chantier 2 a donné une raison de revenir. Celui-ci
s'attaque au seul endroit où l'utilisateur peut abandonner en cours de route.

Six cases, c'est six allers-retours dans la même modale. Chaque friction y est
donc payée six fois, et chaque tap économisé l'est aussi.

### 1.1 Le défaut de fond

La modale de recherche part du principe que l'utilisateur sait déjà ce qu'il
cherche. Elle s'ouvre sur un écran vide qui dit « Tape pour chercher », sans
clavier, sans piste.

Or au moment précis où quelqu'un remplit un bento, il ne sait justement pas
quoi mettre. « Ton lieu de voyage préféré » n'est pas une question à laquelle
on répond en une seconde. L'écran vide renvoie la question à l'utilisateur au
lieu de l'aider, et il le fait six fois de suite.

Le reste des défauts découle du même angle mort : l'écran est conçu pour une
recherche, pas pour une composition.

---

## 2. Objectif et critères de succès

Remplir les six cases doit se faire sans écran vide, sans tap superflu, et
chaque case validée doit produire une réponse tactile et visuelle.

Traduit en critères vérifiables :

| # | Critère | Mesure |
|---|---|---|
| C1 | Aucun écran vide à l'ouverture de la modale | Capture, sur les six catégories |
| C2 | Le clavier est actif sans tap supplémentaire | Capture |
| C3 | Une rangée complète de propositions reste visible au-dessus du clavier | Capture mesurée au pixel, iPhone SE et iPhone 17 |
| C4 | Un seul tap remplit une case depuis les résultats | Comptage du parcours |
| C5 | Une case remplie par erreur s'annule sans quitter le composer | Recette manuelle |
| C6 | Plus aucune `Alert` native dans le parcours de composition | `grep` + recette |
| C7 | Le CTA du composer n'est jamais grisé sur un bento vide | Capture |
| C8 | Le remplissage d'une case produit un retour haptique et une animation | Recette sur appareil, haptique non capturable |
| C9 | Pas de régression de fluidité sur le composer | `dumpsys gfxinfo`, avec témoin |
| C10 | Le surcoût d'egress est mesuré et tenable | Comptage sur le proxy de recette |

**Compté aujourd'hui** : remplir une case demande 4 taps (la case, le champ, la
tuile, « Choisir X ») plus la frappe. Six cases : 24 taps. **Cible** : 2 taps
par case (la case, la tuile), soit 12 taps, et la frappe devient facultative
quand la proposition affichée convient.

---

## 3. Périmètre

**Dans le périmètre.**

- `apps/mobile/app/search-modal.tsx` en entier.
- `apps/mobile/app/(tabs)/compose.tsx` : barre de progression, CTA d'amorçage,
  retour visuel au remplissage.
- Une fonction SQL `popular_items` sur le projet Supabase mobile.
- `expo-haptics` en nouvelle dépendance.
- Première utilisation de `react-native-reanimated`, déjà installé.

**Hors périmètre, et pourquoi.**

- L'onglet « Trouver ». La recherche par item y est le chantier 6, qui
  réutilisera `popular_items` mais pose ses propres questions de navigation.
- Le modèle brouillon / publié (chantier 5). Ce chantier ne change pas le
  moment où l'on écrit en base, seulement le nombre de taps pour y arriver.
- La modération du catalogue et le BO admin. Les doublons continuent d'être
  traités en aval par `admin_merge_items`, cf. §4.3.
- La qualité des images du catalogue. Elle est mesurée en §4.2 parce qu'elle
  conditionne le rendu, mais la recompression à l'upload reste le suivi ouvert
  par le chantier 2.

---

## 4. Ce que dit la production

Toutes les mesures ci-dessous ont été prises le 12 septembre 2026 sur
`ggjgktbcqumfxrixcdyx`, en lecture seule avec la clé anonyme.

### 4.1 Le signal de popularité n'existe pas encore

La roadmap propose d'afficher « les items les plus choisis de la catégorie ».
Voici ce que cela donnerait aujourd'hui.

`bento_items` visible en anonyme (donc les bentos publiés) : **156 lignes**,
issues de 26 bentos.

| Catégorie | Items distincts | Choisis 2 fois ou plus | Meilleur score |
|---|---|---|---|
| Film | 24 | 2 | 2 |
| Série | 23 | 2 | 3 |
| Artiste | 23 | 2 | 3 |
| Chanson | 26 | **0** | 1 |
| Créateur | 21 | 2 | 4 |
| Lieu | 20 | 3 | 4 |

Un classement par nombre de choix produit donc, dans le meilleur cas, deux ou
trois items réellement classés suivis d'une vingtaine d'ex æquo à 1. Pour la
catégorie « Chanson », **il n'y a aucun classement du tout** : les 26 items ont
tous été choisis exactement une fois.

**Conséquence sur le design, et c'est la décision structurante de ce chantier :
le bloc ne peut pas s'appeler « Les plus populaires ».** Ce serait faux, et
faux d'une manière que l'utilisateur peut vérifier en regardant son propre
bento. Ce qu'on affiche est un échantillon du catalogue, ordonné de façon à ce
que les vrais choix remontent en premier quand il y en a. Le libellé doit dire
cela, pas autre chose. Cf. §5.2 et la décision D2.

Le classement reste le bon calcul : il devient juste de plus en plus
informatif à mesure que la base grossit, sans qu'on ait à retoucher quoi que ce
soit. C'est le libellé qui doit être vrai dès aujourd'hui.

### 4.2 Couverture et poids des images

Le bloc de propositions est une grille d'affiches. Sa qualité perçue dépend
entièrement de la présence d'images.

| Catégorie | Items validés | Avec image | Sources |
|---|---|---|---|
| Film | 53 | 50 (94 %) | tmdb 29, user 24 |
| Série | 43 | 42 (98 %) | tmdb 22, user 21 |
| Artiste | 48 | 37 (77 %) | musicbrainz 24, user 24 |
| Chanson | 54 | **19 (35 %)** | musicbrainz 31, user 23 |
| Créateur | 39 | 21 (54 %) | wikidata 23, user 16 |
| Lieu | 40 | 36 (90 %) | osm 18, user 22 |

**« Chanson » cumule les deux faiblesses** : aucun signal de popularité et une
image sur trois. C'est la catégorie sur laquelle il faut juger le résultat, pas
sur « Film ».

L'ordonnancement retenu en §6.1 place les items sans image en dernier, ce qui
rattrape presque tout. Simulé sur les données réelles, le top 12 contient
12 images sur 12 dans cinq catégories, et 10 sur 12 pour « Chanson ».

Poids des images, échantillon de 10 par hôte, téléchargement réel :

| Hôte | Nombre | Médiane | Moyenne | Max |
|---|---|---|---|---|
| `image.tmdb.org` (w500) | 82 | 100 Ko | 97 Ko | 136 Ko |
| `…supabase.co/storage` | 117 | 220 Ko | **288 Ko** | **1032 Ko** |
| `upload.wikimedia.org` et autres | 6 | 25 Ko | 18 Ko | 33 Ko |

Les 117 images hébergées chez Supabase sont facturées en egress, les autres
non. Et elles sont servies à leur taille d'origine : un échantillon mesuré fait
**960 × 1441 px** pour une tuile qui en fait 113 pt de large, soit 339 px sur un
écran ×3.

La transformation d'image de Supabase, qui permettrait de demander une largeur,
**n'est pas disponible sur le plan gratuit** ; vérifié, l'endpoint répond :

```
GET /storage/v1/render/image/public/… → 403 FeatureNotEnabled
```

Il n'y a donc aucun levier côté client pour ces 117 images. Le seul levier est
la recompression à l'upload dans le BO, déjà ouverte comme suivi par le
chantier 2 et que ce chantier rend plus rentable. Cf. §8.

### 4.3 L'`Alert` anti-doublon est démontrablement redondante

Avant de soumettre un nouvel item, le code appelle `find_similar_items` et,
s'il trouve un candidat, ouvre une `Alert` à trois boutons.

Les deux fonctions SQL sont dans la même migration
(`20260529000000_catalog_search_functions.sql`) et partagent le même score, le
même filtre de catégorie et le même filtre de statut. Elles ne diffèrent que
par leur seuil : **0,15 pour `search_items`, 0,4 pour `find_similar_items`**.

Un candidat au-dessus de 0,4 est donc toujours au-dessus de 0,15 : l'ensemble
des résultats de `find_similar_items` est un **sous-ensemble strict** de celui
de `search_items`. Comme les deux trient par score décroissant, le candidat est
même nécessairement en tête, sauf à ce que plus de vingt items le dépassent, ce
qui est impossible avec un score supérieur à 0,4.

Vérifié en production sur 24 requêtes réalistes (titres exacts, fautes de
frappe, saisies partielles), réparties sur les six catégories :

```
Popup déclenchée 24 / 24 fois.
Candidat déjà visible dans la grille : 24 / 24, et au rang 1 dans 24 cas sur 24.
```

**L'`Alert` interrompt donc l'utilisateur pour lui montrer une tuile qui est
déjà la première de son écran, et devant laquelle il vient de passer pour
atteindre le bouton « Ajouter » en bas de liste.** Elle ne l'a jamais informé de
quoi que ce soit qu'il ne voyait pas.

Elle disparaît, ainsi que l'appel à `find_similar_items` dans ce parcours, ce
qui économise au passage un aller-retour réseau avant chaque soumission. La
défense contre les doublons reste celle qui les traite vraiment : la
modération, et `admin_merge_items` côté BO.

`find_similar_items` n'est pas supprimée de la base : le BO admin peut la
consommer, et la faire disparaître dépasse le périmètre de ce chantier.

**Défaut voisin, constaté en capture pendant la préparation de cette spec** :
la ligne « Ajouter « X » » est déjà affichée pendant que le compteur dit
« Recherche… », donc avant tout résultat. L'utilisateur se voit proposer de
créer un item alors que la recherche qui le trouverait n'a pas encore répondu.
C'est le même problème vu par l'autre bout, et il est traité en §5.5.

### 4.4 Latences de référence

`search_items`, 5 tirs depuis la même machine :

```
0,457 s (à froid)   0,154 s   0,095 s   0,078 s   0,074 s
```

Environ **80 ms à chaud**. C'est le budget dans lequel `popular_items` doit
tenir pour que le bloc de propositions ne se fasse pas remarquer.

Les agrégats PostgREST sont désactivés sur le projet (`PGRST123 : Use of
aggregate functions is not allowed`), donc un `count` groupé côté client est
impossible : une fonction SQL est obligatoire, ce n'est pas un choix de confort.

### 4.5 Un trou dans l'outillage de recette, corrigé au passage

Le proxy de recette du chantier 2 ne relaie que les `GET`. Or PostgREST expose
les fonctions SQL en `POST` : `search_items` répondait donc 405 et l'écran
affichait « Search failed: undefined ». **Tout ce chantier était intestable
derrière le proxy**, ce qui n'était pas visible tant qu'on ne recettait que le
fil, qui n'utilise que des `GET`.

`apps/mobile/scripts/readonly-proxy.mjs` accepte désormais les `POST` vers une
liste blanche de fonctions (`search_items`, `find_similar_items`,
`popular_items`), toutes déclarées `stable` en SQL donc incapables d'écrire.
Une liste blanche plutôt qu'une ouverture de `/rest/v1/rpc/` en général : rien
ne garantit qu'une future fonction ne fera pas d'écriture, et la seule garantie
qui compte dans ce script est qu'une recette ne peut pas toucher la production.
Vérifié après correctif : RPC autorisée 200, RPC hors liste 405, `PATCH` 405,
`POST /rest/v1/items` 405, `/auth/*` 503.

Le refus renvoie maintenant `message` et non `error`, parce que c'est le champ
que lit `supabase-js` : d'où le « undefined » affiché à l'écran.

---

## 5. Design

### 5.1 Le parcours actuel, compté

| Étape | Taps | Remarque |
|---|---|---|
| Taper la case dans le composer | 1 | |
| Taper le champ de recherche | 1 | pas d'`autoFocus` |
| Frappe + attente | 0 | 300 ms de debounce, puis ~80 ms |
| Taper la tuile | 1 | sélectionne seulement |
| Taper « Choisir X » en bas | 1 | valide |
| **Total par case** | **4** | **× 6 = 24** |

Deux de ces quatre taps ne portent aucune information.

Et l'écran sur lequel on arrive est vide à **78,3 %**, mesuré au pixel sur une
capture iPhone 17 : le dernier élément se termine à 189,7 pt sur 874, le reste
est du crème. Avec le clavier levé, il reste encore 332,6 pt de vide entre le
libellé et le clavier (§5.3).

### 5.2 Ouverture : « Au menu »

À l'ouverture, sous le champ de recherche, une grille de 12 propositions dans
la catégorie demandée, au même format que les résultats de recherche : même
tuile, même palette, même rotation. L'utilisateur voit immédiatement ce que
l'écran sait faire, et dans le meilleur des cas il n'a rien à taper.

**Libellé de section : `AU MENU`**, en Bungee 10, même style que le compteur de
résultats existant. Il annonce ce qui est disponible sans prétendre à un
classement que les données ne portent pas (cf. §4.1), et il tient dans la
thématique bento. Alternatives écartées : « Populaires » et « Les plus choisis »
(faux), « Suggestions » (fade et vaguement algorithmique), « Idées » (juste,
mais moins ancré dans la DA).

Dès que la recherche renvoie quelque chose, le bloc est remplacé par les
résultats et le libellé redevient le compteur actuel. Il n'y a jamais deux
grilles à l'écran.

**L'item déjà présent dans la case est exclu** des propositions : il est visible
derrière, dans le composer, et le reproposer suggère à tort qu'il n'a pas été
pris en compte.

### 5.3 La tension entre l'autofocus et les propositions

Les deux corrections demandées se contrarient. L'`autoFocus` lève le clavier,
et le clavier recouvre précisément la zone où l'on veut afficher les
propositions. Il faut trancher, et le trancher avec des chiffres.

Mesures prises au pixel sur les captures de l'état actuel, clavier français
levé, barre d'accessoires comprise :

| | iPhone SE (3e gén.) | iPhone 17 |
|---|---|---|
| Écran | 375 × 667 pt | 402 × 874 pt |
| Bas du dernier élément (le libellé de section) | 158,0 pt | 189,7 pt |
| Haut du clavier | 387,0 pt | 522,3 pt |
| Hauteur du clavier | 280,0 pt | 351,7 pt |
| **Espace libre entre les deux** | **229,0 pt** | **332,6 pt** |
| Largeur de tuile, `(largeur - 52) / 3` | 107 pt | 116 pt |
| Hauteur de tuile, image 2:3 + sous-titre | ~183,5 pt | ~197 pt |
| **Marge restante après une rangée** | **45,5 pt** | **135,6 pt** |

Une rangée complète tient sur les deux appareils. Sur l'iPhone 17, les 135 pt
restants laissent dépasser le haut de la rangée suivante, ce qui donne
l'affordance de défilement gratuitement. Sur l'iPhone SE, c'est juste mais ça
passe, avec 45 pt de marge.

**Décision : `autoFocus` activé.**

**Vérifié après implémentation**, capture mesurée au pixel sur les deux
appareils, catégorie « Chanson » pour l'iPhone SE puisque c'est le pire cas :

| | iPhone SE | iPhone 17 |
|---|---|---|
| Première rangée de tuiles | 169,0 → 351,0 pt | 200,7 → 396,7 pt |
| Hauteur de rangée mesurée | 182,5 pt (prévu 183,5) | 196,3 pt (prévu 197) |
| Haut du clavier | 410,5 pt | 522,3 pt |
| **Marge sous la rangée** | **59,5 pt** | **125,6 pt** |
| Rangée suivante visible sur | 49,5 pt | 138 pt |

C3 est rempli. La marge réelle sur iPhone SE est meilleure que les 45 pt
prévus, parce que l'en-tête « Au menu » occupe la place qu'occupait « Tape
pour chercher » au lieu de s'y ajouter.

Elle reste le budget total : **tout élément glissé entre le champ et la grille
le consomme**. C'est la contrainte de conception de l'écran, pas une remarque
en passant, et `components/search/layout.test.ts` la fige.

`returnKeyType="search"` sur le champ. La touche entrée ne déclenche rien de
plus que le debounce déjà en cours, elle sert à replier le clavier pour voir
toute la grille : `onSubmitEditing` fait un `blur`. Vérifié sur capture, la
touche affiche aujourd'hui la flèche de retour à la ligne par défaut.

Plus de `KeyboardAvoidingView` à prévoir : la barre de boutons du bas
disparaît (§5.4), donc il n'y a plus rien à protéger. La liste reçoit
`automaticallyAdjustKeyboardInsets` sur iOS pour que sa dernière rangée reste
atteignable, et le comportement Android par défaut (`resize`) est à vérifier en
recette plutôt qu'à supposer : `app.json` ne pose pas
`android.softwareKeyboardLayoutMode`.

### 5.4 Un tap valide, le toast rattrape

La roadmap propose « second tap sur une tuile déjà sélectionnée = validation ».
C'est une interaction invisible : elle ne se découvre pas, et elle laisse le
coût à deux taps pour tout le monde sauf ceux qui la connaissent.

**Un tap sur une tuile remplit la case et ferme la modale.**

L'objection est légitime : un tap malheureux écrit en base. Mais cette écriture
est déjà réversible, et le code sait déjà le faire. `onClear` prend un
instantané du slot et propose « Annuler » dans le toast. On applique le même
patron :

- mise à jour optimiste du store Zustand, fermeture immédiate de la modale ;
- écriture `ensureBento` puis `setBentoSlot` en arrière-plan ;
- toast « Case remplie » avec une action « Annuler » qui restaure l'état
  précédent, case vide comprise ;
- si l'écriture échoue, rollback du store et toast d'erreur.

La barre de boutons du bas disparaît donc entièrement, avec elle le CTA
« Choisir X » et le problème de recouvrement par le clavier. « Vider cette
case » remonte en tête de la modale, à droite de l'en-tête, en lien discret :
c'est une action rare qui n'a pas à occuper le bas de l'écran en permanence.

La clé primaire de `bento_items` étant `(bento_id, category_id)`, retaper une
autre tuile remplace simplement : il n'y a pas d'état incohérent possible.

### 5.5 Proposer un item au catalogue

La ligne « Ajouter « X » » reste en pied de liste, inchangée dans sa forme.
Trois évolutions :

- l'`Alert` disparaît (§4.3) ; le tap soumet directement ;
- la ligne ne s'affiche que lorsque les résultats correspondent au texte tapé,
  c'est-à-dire quand `debouncedQuery === query.trim()`. Sans cette garde, elle
  propose d'ajouter « inception » pendant que la grille montre encore les
  résultats de « incep », ce qui invite à créer un doublon de ce qui est
  affiché juste au-dessus ;
- le toast de confirmation existant reste (« Proposition envoyée à la
  modération »), la case est remplie en `pending` comme aujourd'hui.

### 5.6 États de l'écran

| État | Ce qui s'affiche |
|---|---|
| Ouverture, propositions en cours de chargement | `AU MENU` + squelette d'une rangée de 3 tuiles |
| Ouverture, propositions chargées | `AU MENU` + 12 tuiles |
| Ouverture, propositions en erreur | Pas de bloc, pas de bandeau : on retombe sur le comportement actuel (`Tape pour chercher`). Une panne de suggestion ne doit pas ressembler à une panne de l'écran. |
| Ouverture, catalogue vide pour la catégorie | Idem |
| 1 caractère tapé | Le bloc `AU MENU` reste : la recherche ne démarre qu'à 2 caractères, l'écran ne doit pas se vider entre-temps |
| Recherche en cours | Compteur « Recherche… » + `ActivityIndicator` dans le champ, la grille précédente reste affichée |
| Résultats | Compteur « n résultats » + grille |
| Aucun résultat | « Aucun résultat trouvé » + ligne « Ajouter « X » » |
| Erreur de recherche | Bandeau rouge existant, conservé |

Le point qui compte : **la grille ne se vide jamais en cours de frappe**. Aujourd'hui,
passer de « Tape pour chercher » à un écran blanc à chaque caractère est ce qui
donne la sensation d'instabilité.

### 5.7 Le composer

**Barre de progression.** Elle saute aujourd'hui d'un sixième à l'autre sans
transition. Animation Reanimated sur la largeur, 320 ms, `Easing.out(Easing.cubic)`.
C'est le seul endroit de l'app qui dit « tu as avancé », il mérite d'être vu.

**Retour sur la case remplie.** Au retour de la modale, la tuile fraîchement
remplie fait une pulsation d'échelle (1 → 1,04 → 1), 260 ms. Rien de plus : la
grille du composer est déjà l'objet le plus chargé de l'écran, et le chantier 2
a laissé une question ouverte sur la fluidité du rendu des grilles.

**CTA d'amorçage.** Le bouton est aujourd'hui grisé quand `filled === 0`
(`compose.tsx:183`), ce qui accueille un nouvel utilisateur par un gros bouton
mort. Il devient actif et dit **« Commence par ton film »**, et il ouvre
directement `/search-modal?category=film`.

Le reste de la logique du bouton ne bouge pas : « Compléter (n restants) »,
« En attente de validation », « Publier mon bento ».

**Retour haptique.** Cf. §7.

### 5.8 Accessibilité

- Les tuiles de proposition portent le même `accessibilityLabel` que les tuiles
  de résultat, avec le nombre de choix quand il est supérieur à 1 :
  « Anonyme, choisi 3 fois ». En dessous, ne rien dire plutôt que d'annoncer
  « choisi 1 fois », qui suggère une popularité inexistante.
- Le bloc de propositions est précédé d'un en-tête avec
  `accessibilityRole="header"`, ce que le compteur de résultats actuel ne fait
  pas non plus : corrigé pour les deux.
- L'`autoFocus` place VoiceOver sur le champ. Il faut vérifier qu'on peut
  atteindre la grille en balayant vers la droite, et que le lecteur annonce le
  nombre de propositions.
- La suppression de l'`Alert` retire un point de passage que VoiceOver gérait
  bien. Le toast, lui, doit être annoncé : vérifier que `ToastHost` porte
  `accessibilityLiveRegion="polite"` et le poser sinon.
- Le lien « Vider cette case » passe de 8 pt de padding vertical à une cible de
  44 pt de haut en remontant dans l'en-tête.

---

## 6. Contrat de données

### 6.1 `popular_items`

```sql
create or replace function public.popular_items(
  category_key text,
  lim int default 12,
  exclude_item uuid default null
)
returns table (
  id uuid, title text, subtitle text, year int,
  image_url text, image_credit text, picks int
)
language sql
stable
as $$
  with cat as (
    select id from public.bento_categories
    where key = category_key and is_active = true
    limit 1
  ),
  tally as (
    select bi.item_id, count(*)::int as n
    from public.bento_items bi
    join public.bentos b on b.id = bi.bento_id
    where b.published_at is not null
    group by bi.item_id
  )
  select
    i.id, i.title, i.subtitle, i.year, i.image_url, i.image_credit,
    coalesce(t.n, 0) as picks
  from public.items i
  left join tally t on t.item_id = i.id
  where i.category_id = (select id from cat)
    and i.status = 'validated'
    and (exclude_item is null or i.id <> exclude_item)
  order by
    coalesce(t.n, 0) desc,
    (i.image_url is not null) desc,
    i.created_at desc,
    i.id
  limit lim;
$$;

grant execute on function public.popular_items(text, int, uuid)
  to anon, authenticated;
```

Trois points méritent d'être justifiés.

**`security invoker`, la valeur par défaut, est conservée.** La RLS
`bento_items_read_published` et `items_read_validated_or_own_pending`
s'appliquent donc. C'est voulu : la règle de visibilité vit à un seul endroit,
et une fonction `security definer` la recopierait dans un second où elle
pourrait diverger.

**Le filtre `b.published_at is not null` est écrit explicitement alors que la
RLS le couvre presque.** Presque, parce que la policy dit
`published_at is not null or user_id = auth.uid()` : sans ce filtre, un
utilisateur connecté verrait son propre brouillon compté dans le classement.
Le résultat différerait alors d'un utilisateur à l'autre, donc ne serait ni
testable ni cachable. Avec le filtre, l'intersection avec la RLS vaut
exactement « bentos publiés », identique pour tout le monde.

**L'ordre a quatre niveaux, et le dernier est `i.id`.** `created_at` peut être
ex æquo sur des items importés par lot ; sans départage stable, deux appels
successifs pourraient renvoyer un ordre différent, ce qui casserait à la fois
les tests et le cache d'images. Le critère `(i.image_url is not null) desc` est
ce qui fait passer « Chanson » de 35 % d'images dans le catalogue à 10 sur 12
dans le top affiché (§4.2).

**Le paramètre `exclude_item`** sert au cas d'une case déjà remplie (§5.2). Il
est optionnel pour que le chantier 6 puisse appeler la même fonction sans lui.

### 6.2 Pourquoi pas une vue matérialisée

C'était l'autre option de la roadmap. Elle est écartée pour l'instant :
`bento_items` fait 156 lignes, et une stratégie de rafraîchissement
(déclencheur à la publication, ou tâche planifiée, plus la gestion de la
péremption) représenterait plus de code que la requête qu'elle remplacerait.

Le coût réel est le sous-plan RLS sur `bento_items`, un `exists` par ligne.
Aujourd'hui négligeable. **Seuil de réexamen : 50 000 lignes dans
`bento_items`**, soit environ 8 000 bentos publiés. À ce moment, la vue
matérialisée devient le bon outil, et la signature de la fonction n'aura pas à
changer. C'est noté en §13.

Un objectif de latence est posé dès maintenant pour que la dérive se voie :
**`popular_items` doit rester sous 150 ms à chaud**, contre ~80 ms mesurés pour
`search_items`.

### 6.3 `src/lib/suggestions.ts`

Nouveau module, sur le patron de `src/lib/feed.ts` :

```ts
export type SuggestedItem = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  picks: number;
};

export const SUGGESTIONS_COUNT = 12;

export async function loadSuggestions(
  client: SupabaseClient<Database>,
  category: CategoryKey,
  options?: { excludeItemId?: string; limit?: number },
): Promise<SuggestedItem[]>;

/** Libellé lu par VoiceOver, cf. §5.8. */
export function suggestionAccessibilityLabel(item: SuggestedItem): string;
```

**Le client est le premier paramètre, pas un import.** Même raison que pour
`feed.ts` : le singleton `@/supabase/client` tire `react-native-url-polyfill`,
AsyncStorage et `expo-constants`, ce qui rend le module intestable sous
`node:test`. `items.ts` importe le singleton et reste donc non testé ; ce n'est
pas corrigé ici, mais le nouveau module ne reproduit pas le défaut.

La fonction **lève** en cas d'erreur plutôt que de renvoyer un tableau vide :
c'est React Query qui décide quoi en faire, et l'écran choisit de rester
silencieux (§5.6). Un tableau vide rendrait « pas de suggestions » et « panne »
indiscernables dans les tests.

**Cache React Query** : `staleTime` 30 minutes, `gcTime` 1 heure. Le catalogue
bouge à la vitesse de la modération, pas à celle de l'utilisateur. Rouvrir la
même case dans la session ne redéclenche rien, ni requête ni chargement
d'image.

Pas de préchargement des six catégories au montage du composer : ce serait six
requêtes et jusqu'à 72 images pour quelqu'un qui ne remplira peut-être qu'une
case, et le gain se compte en quelques dizaines de millisecondes.

---

## 7. Retour tactile et animation

### 7.1 `expo-haptics`

Nouvelle dépendance, donc **module natif, donc reconstruction obligatoire** :
le rechargement à chaud ne suffira pas, et la prochaine soumission au store
demandera une nouvelle build EAS. Le plugin ajoute aussi la permission
`VIBRATE` au manifeste Android, sans conséquence sur la fiche Play.

Trois usages, et pas un de plus :

| Moment | Retour |
|---|---|
| Tap sur une tuile (proposition ou résultat) | `impactAsync(Light)` |
| Case effectivement remplie, au retour sur le composer | `notificationAsync(Success)` |
| Échec d'écriture | `notificationAsync(Error)` |

Sur simulateur iOS, l'haptique n'est pas restituée et l'appel est sans effet :
ce point sort de la recette simulateur et va dans la checklist manuelle.

### 7.2 Reanimated

Vérifié : `babel-preset-expo` 57.0.10 ajoute automatiquement
`react-native-worklets/plugin` quand `react-native-worklets` est installé
(`node_modules/babel-preset-expo/build/configs/expo.js:98`). `react-native-worklets`
0.10.1 est bien présent. **Aucune modification de `babel.config.js` n'est
nécessaire**, et `react-native-reanimated` 4.5.1 étant déjà une dépendance, sa
partie native est déjà liée : contrairement à `expo-haptics`, l'utiliser
n'impose pas de reconstruction.

Deux animations seulement, cf. §5.7. Le chantier 2 a laissé ouverte une
question de fluidité sur le rendu des grilles ; ce n'est pas le moment
d'en ajouter partout.

---

## 8. Performance et egress

### 8.1 Ce que le chantier ajoute

Un bloc de propositions charge jusqu'à 12 images à l'ouverture d'une case,
contre zéro aujourd'hui. C'est le coût de la fonctionnalité, et il est réel.

Estimation à partir des mesures du §4.2, en supposant la moitié des images
hébergées chez Supabase (proportion observée : 117 sur 205) :

```
6 images Supabase × 288 Ko  ≈ 1,7 Mo d'egress facturé par case ouverte
× 6 catégories              ≈ 10 Mo pour une composition complète
```

Le quota du plan gratuit est de 5 Go, dont 0,01 utilisé. Cela laisse de la
marge, mais c'est une dépense récurrente sur un geste que tout le monde fait.
Trois contreparties :

- **12 propositions, pas 30.** La grille tient en quatre rangées, ce qui est
  déjà plus que ce qu'on voit sans défiler.
- **`expo-image` avec `cachePolicy="memory-disk"` et `recyclingKey`.** Les
  tuiles utilisent encore `Image` de `react-native` (`search-modal.tsx:333`),
  qui ne persiste rien sur disque. Après migration, la deuxième ouverture d'une
  case ne coûte rien, et les propositions sont par nature les mêmes d'une fois
  sur l'autre.
- **Rien n'est préchargé** (§6.3).

**Mesuré au lot 3**, en téléchargeant réellement les 72 images des six top 12,
après application du redimensionnement TMDb :

| | Nombre | Poids |
|---|---|---|
| JSON des 6 RPC | 6 | 22 Ko |
| Images hébergées chez Supabase | 44 | **9 645 Ko, facturés** |
| Images TMDb (en `w342`) | 20 | 1 052 Ko, gratuits |
| Images Wikimedia et autres | 6 | 164 Ko, gratuits |
| Tuiles sans image | 2 | 0 |
| **Total téléchargé** | | **10,63 Mo** |
| **Dont egress facturé** | | **9,44 Mo** |

Soit **542 compositions complètes avant de toucher les 5 Go**, et uniquement à
froid : le cache disque rend les suivantes gratuites, et les propositions sont
par construction les mêmes d'une ouverture à l'autre.

44 tuiles sur 72 portent une image Supabase et pèsent 91 % du total. C'est le
chiffre qui rend la recompression à l'upload rentable : à -71 %, mesuré au
chantier 2, on passerait de 542 à environ 1 900 compositions.

### 8.2 Ce que le chantier ne peut pas résoudre

Les 117 images du stockage Supabase sont servies en pleine résolution
(960 × 1441 mesuré) parce que la transformation d'image est indisponible sur le
plan gratuit (§4.2). Une tuile de 113 pt en affiche 339 px de large sur un
écran ×3 : on télécharge environ **huit fois plus de pixels que nécessaire**.

Le seul correctif est la recompression à l'upload dans le BO, mesurée à -71 %
lors du chantier 2. Ce chantier ne la fait pas, il en augmente le rendement.

Correctif gratuit et immédiat en revanche : les URL TMDb sont stockées en
`w500`. Une tuile n'a besoin que de `w342`. Le remplacement se fait sur la
chaîne à l'affichage, sans toucher à la base, et allège d'environ 40 % le
chargement des 82 images concernées. Pas d'effet sur la facture, un effet réel
sur la vitesse d'apparition.

### 8.3 Fluidité

Le composer et la modale sont des écrans à grille, comme le fil. Le chantier 2
a mesuré 62,5 % de trames saccadées sur émulateur contre 1,3 % pour un témoin
système, sans conclure. Ce chantier ajoute deux animations sur ces écrans : il
doit donc mesurer avant et après, avec le même témoin, sous peine de ne pas
savoir ce qu'il a coûté (C9).

---

## 9. Stratégie de test et QA

### 9.1 Tests unitaires, `node:test` + `tsx`

`src/lib/suggestions.test.ts`, sur le stub HTTP `src/test/postgrest-stub.ts`
déjà écrit pour le chantier 2 :

- mapping d'une ligne complète, d'une ligne à champs nuls, d'une réponse vide ;
- `picks` absent ou nul devient 0, jamais `undefined` ;
- `excludeItemId` est bien transmis en paramètre de la RPC ;
- une erreur PostgREST lève, avec le message d'origine dans l'exception ;
- `suggestionAccessibilityLabel` : silencieux à 0 et 1 choix, explicite à 2 et
  plus, et le pluriel est correct.

### 9.2 Test d'intégration de l'appel, sur bouchon

`src/lib/suggestions.integration.test.ts`, contre le bouchon HTTP, sur le
patron de `feed.integration.test.ts`. La CI n'a pas d'identifiants Supabase,
donc rien ici ne touche la vraie base.

Ce qui est exercé, c'est le vrai `supabase-js` : le verbe, le chemin et le
corps envoyés sur le fil. Une RPC casse autrement qu'une requête de table, et
plus silencieusement : un nom d'argument qui dérive du SQL donne un
`PGRST202` qui ressemble à une fonction absente, et un `lim` oublié laisse
Postgres appliquer son défaut sans le signaler.

- `POST` sur `/rest/v1/rpc/popular_items` ;
- corps exact `{ category_key, lim, exclude_item }`, noms compris ;
- `lim` à 12 par défaut, surchargeable ;
- `exclude_item` transmis à `null` plutôt qu'omis ;
- l'ordre reçu est conservé tel quel, le client ne retrie jamais (il n'a pas
  `created_at`, donc il ne pourrait pas reproduire le départage) ;
- une réponse `null` donne une liste vide, une erreur lève.

Le bouchon a été étendu pour capturer le corps des requêtes : il ne relevait
que la méthode et l'URL, ce qui ne suffit pas pour une RPC.

### 9.2 bis Vérification contre la production

`apps/mobile/scripts/check-popular-items.mjs`, en lecture seule avec la clé
anonyme, lancé à la main après application de la migration. Il couvre ce
qu'un bouchon ne peut pas : les propriétés qui dépendent des données et du
planificateur Postgres.

- les six catégories renvoient au plus 12 items, et au moins un ;
- `picks` est décroissant, entier et positif ;
- à `picks` égal, les items sans image sont relégués en fin de groupe ;
- deux appels consécutifs renvoient exactement le même ordre (c'est le
  contrôle qui protège le départage par `i.id` du §6.1) ;
- tous les items renvoyés sont `validated`, recoupé sur la table ;
- `exclude_item` retire l'item demandé sans décaler le reste du classement ;
- la latence médiane à chaud reste sous 150 ms (§6.2), le premier appel étant
  écarté car il porte l'établissement TLS et le démarrage du pooler.

### 9.2 ter Ce que la recette du lot 3 a trouvé

Trois défauts, dont deux invisibles à la lecture du code.

**La bande blanche vide.** Une rangée `flex` étire ses enfants par défaut :
une tuile sans sous-titre était donc allongée à la hauteur de la plus grande
de sa rangée et montrait une bande blanche vide sous son affiche. Le catalogue
mélange les deux cas dans presque toutes les catégories, donc c'était visible
dès la première grille. Corrigé par `alignItems: 'flex-start'` sur la rangée ;
des rangées un peu inégales vont d'ailleurs mieux à une DA d'autocollants.

**« Cherche un chanson… ».** Le placeholder concaténait « Cherche un » et le
libellé de la catégorie. Faux pour « Chanson » et « Série », donc sur deux
écrans sur six, depuis toujours. `CATEGORY_META` porte désormais le genre
grammatical du libellé, qui est une propriété du mot et non de l'écran.

**La ligne « Ajouter » survivait à une panne de recherche.** Trouvé en
simulant `FAIL=/rest/v1/rpc/search_items` : le bandeau d'erreur s'affichait, et
juste en dessous l'écran proposait quand même de créer l'item. C'est
l'invitation au doublon exacte, au moment précis où l'on est le moins capable
de le détecter. La ligne est maintenant conditionnée à l'absence d'erreur.

### 9.3 Ce qui ne se teste pas automatiquement

L'`autoFocus`, la hauteur de clavier, l'haptique et les animations. Ils passent
par la recette. Le point C3 en particulier se vérifie **au pixel sur une
capture**, pas à l'œil : la leçon du chantier 2 est qu'une marge estimée sur
une image réduite est une marge inventée.

### 9.4 Checklist de recette manuelle

Sur simulateur, avec le proxy en lecture seule, donc sans écriture possible :

- [ ] Les six catégories ouvrent sur une grille remplie, pas sur un écran vide.
- [ ] « Chanson » comprise, qui est le pire cas (§4.2).
- [ ] Le clavier est levé à l'ouverture, sans tap.
- [ ] Une rangée complète est visible au-dessus du clavier, iPhone SE et
      iPhone 17, **mesuré au pixel**.
- [ ] Taper un caractère ne vide pas la grille.
- [ ] Le champ vidé après une recherche fait revenir « AU MENU ».
- [ ] Rotation d'écran : les tuiles se redimensionnent (correctif `TILE_WIDTH`).
- [ ] `FAIL=/rest/v1/rpc/popular_items` : l'écran retombe proprement sur
      « Tape pour chercher », sans bandeau d'erreur.
- [ ] `FAIL=/rest/v1/rpc/search_items` : le bandeau d'erreur existant s'affiche
      toujours.
- [ ] Aucune `Alert` native n'apparaît nulle part dans le parcours.
- [ ] Aucun bandeau LogBox en bas de capture (piège du chantier 2 :
      **lire toute l'image**).

Avec écriture, donc hors proxy, sur un compte de test :

- [ ] Un tap sur une tuile remplit la case et ferme la modale.
- [ ] Le toast « Annuler » restaure l'état exact, case vide comprise.
- [ ] Retaper une autre tuile sur une case déjà remplie la remplace.
- [ ] Proposer un item absent le crée en `pending`, sans `Alert`.
- [ ] La barre de progression s'anime, la tuile pulse.
- [ ] Les six cases se remplissent d'affilée sans accroc.

Sur appareil réel, ce qu'aucun simulateur ne donne :

- [ ] L'haptique se sent, et n'est pas envahissante au sixième déclenchement.
- [ ] VoiceOver : §5.8 en entier.
- [ ] Taille de police système au maximum : les libellés de tuile ne débordent
      pas.
- [ ] `dumpsys gfxinfo` avant / après, avec témoin (C9).

---

## 10. Plan de développement

Sept lots. Chacun est validé avant de passer au suivant.

### Lot 0 · La fonction SQL

Migration `apps/mobile/supabase/migrations/20260912000000_popular_items.sql`,
appliquée à la main dans l'éditeur SQL du projet mobile (il n'y a pas de
lanceur de migrations). Vérification immédiate : les six catégories répondent,
l'ordre est stable entre deux appels, la latence tient le budget.

### Lot 1 · `src/lib/suggestions.ts`

Le module, ses types, son libellé d'accessibilité. Tests unitaires et test
d'intégration. Aucune modification d'écran : le lot est vert quand
`pnpm --filter mobile test`, `lint` et `typecheck` passent.

### Lot 2 · Corrections de mise en page de la modale

Sans fonctionnalité nouvelle, donc livrable seul :

- `TILE_WIDTH` calculé depuis `useWindowDimensions` ;
- `autoFocus`, `returnKeyType="search"`, `onSubmitEditing` qui replie ;
- `automaticallyAdjustKeyboardInsets` sur la liste ;
- migration des tuiles vers `expo-image` avec `cachePolicy="memory-disk"` ;
- `w500` → `w342` sur les URL TMDb à l'affichage.

Capture avant / après sur iPhone SE et iPhone 17.

### Lot 3 · Le bloc « Au menu »

L'en-tête de section, la grille de propositions, le squelette de chargement,
les états du §5.6, l'exclusion de l'item courant. Captures sur les six
catégories.

### Lot 4 · Le tap unique

Validation en un tap, écriture optimiste, toast avec annulation, rollback sur
échec. Suppression de la barre de boutons du bas, remontée de « Vider cette
case » dans l'en-tête. Suppression de l'`Alert` anti-doublon et de l'appel à
`find_similar_items`. Garde `debouncedQuery === query.trim()` sur la ligne
d'ajout.

C'est le lot qui touche au chemin d'écriture : il se recette avec écriture, sur
un compte de test, pas derrière le proxy.

### Lot 5 · Le composer

`expo-haptics` (donc reconstruction), les trois déclenchements, la barre de
progression animée, la pulsation de la tuile, le CTA « Commence par ton film ».

### Lot 6 · Recette et mesures

Recette iOS et Android en entier, mesure d'egress sur une composition complète
(C10), mesure de fluidité avec témoin (C9), captures partagées, DoD.

---

## 11. Definition of Done

Le chantier est terminé quand les dix critères du §2 sont remplis, avec la
preuve en face, et que :

- `pnpm lint`, `pnpm typecheck`, `pnpm --filter mobile test` passent ;
- la CI est verte sur la PR ;
- la migration du lot 0 est appliquée en production et le fichier est commité ;
- la checklist §9.4 est cochée, ou ses restes explicitement listés comme dans
  les chantiers 1 et 2 ;
- les captures ont été partagées et validées ;
- le tableau de la roadmap est à jour.

**Un critère non rempli se déclare, il ne s'arrondit pas.** Le chantier 2 a
livré 6 critères sur 8 et l'a écrit ainsi.

---

## 12. Décisions tranchées

| # | Décision | Raison |
|---|---|---|
| D1 | Fonction SQL `popular_items`, pas de vue matérialisée | 156 lignes ; le rafraîchissement coûterait plus que la requête. Seuil de réexamen posé à 50 000 lignes |
| D2 | Libellé « AU MENU », jamais « populaires » | Le signal n'existe pas encore : au plus 3 items choisis 2 fois par catégorie, 0 pour « Chanson » |
| D3 | Un tap valide, au lieu du double tap proposé | Le double tap est invisible et ne fait gagner un tap qu'à ceux qui le connaissent. L'annulation par toast existe déjà dans le code |
| D4 | Suppression de l'`Alert` anti-doublon | Ses résultats sont un sous-ensemble de ceux déjà affichés, vérifié 24 fois sur 24, toujours au rang 1 |
| D5 | `autoFocus` malgré le clavier qui monte | Une rangée reste visible sur iPhone SE d'après le calcul du §5.3, à confirmer par capture |
| D6 | `security invoker` et filtre `published_at` explicite | La règle de visibilité reste à un seul endroit, et le résultat devient identique pour tous, donc testable |
| D7 | 12 propositions | Compromis entre remplir l'écran et l'egress ; 4 rangées, dont 1,5 visible |
| D8 | Reanimated sur deux animations seulement | La question de fluidité du chantier 2 est encore ouverte |
| D9 | Pas de préchargement des six catégories | 6 requêtes et 72 images pour un gain de quelques dizaines de millisecondes |
| D10 | `find_similar_items` reste en base | Le BO peut la consommer ; la retirer dépasse le périmètre |

---

## 13. Suivis générés par ce chantier

**Vue matérialisée pour `popular_items`.** À rouvrir quand `bento_items`
dépasse 50 000 lignes. La signature de la fonction ne changera pas.

**Recompression des images à l'upload dans le BO.** Déjà ouvert par le
chantier 2, rendu plus rentable par celui-ci : 117 images servies en pleine
résolution alors que la transformation Supabase est indisponible sur le plan
gratuit.

**Couverture d'images de la catégorie « Chanson ».** 35 %, contre 90 % et plus
ailleurs. C'est un problème de catalogue, pas d'app : il se traite en
modération.

**`items.ts` n'est pas testable.** Il importe le singleton Supabase. Le
refactoriser sur le patron client-en-paramètre permettrait de tester
`searchItems` et `submitItem`. Hors périmètre ici.

**`can_publish_bento` côté SQL.** Toujours pas implémenté, la règle vit encore
côté UI seulement (cf. la note en fin de migration `20260528120000`). Sans
rapport avec ce chantier, mais toujours ouvert.
