# Chantier 13 · Bento hebdomadaire

> Spécification écrite le 16 septembre 2026, à partir du code de `main`
> (`45b3b64`), de lectures `GET` sur la production avec la clé anonyme, de
> mesures au pixel sur l'image Open Graph et la page publique de production, et
> de mesures de texte avec la police Bungee réelle. Aucune écriture en
> production.
>
> **Arbitrages rendus le 16 septembre 2026**, les dix de §11. En résumé : les
> cases d'une édition sont des lignes de plus dans la table des cases, une
> édition est un bento secondaire, la direction artistique livre les
> dispositions de 2 à 5 cases avant le premier lot, la sortie est hebdomadaire
> le jeudi à 18 h de Paris, les éditions passées restent composables pour
> toujours, l'intitulé d'une case est refusé s'il ne tient pas dans sa
> disposition, la sortie store embarque les chantiers 13, 17, 21 et 29, la
> bascule pose un plancher de version, l'aperçu de lien se corrige tout de
> suite en PR séparée, et le développement se fait sur Supabase local.
>
> **Ce chantier ne peut pas sortir seul.** Une édition est un second bento,
> donc elle dépend de la migration B du chantier 16, qui dépend de l'adoption
> d'une version que les stores n'ont pas encore. Le calendrier est en §6.2.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 13,
> [le chantier 15](./UX-15-NOUVELLES-CATEGORIES.md) qui a séparé le type de la
> case, et [le chantier 16](./UX-16-PLUSIEURS-BENTOS.md) qui a fait la place.

---

## 1. Intention

### 1.1 Ce que la roadmap annonce, et ce que le chantier 15 avait déjà réglé

La roadmap ouvre le chantier 13 sur un blocage de schéma, repris tel quel dans
la ligne du tableau d'attaque :

> reste à trancher : la PK `(bento_id, category_id)` interdit deux cases du
> même type dans une édition

**Cette phrase était vraie en mai, elle ne l'est plus depuis le 15 septembre.**
Le chantier 15 a séparé ce qu'est un élément de la case qui l'accueille, et il
l'a fait en donnant un `type_id` à chaque case. Le commentaire de table posé
par sa migration le dit sans ambiguïté :

```
-- 20260915100000_item_types_and_cases.sql:110-113
comment on table public.bento_categories is
  'Les six cases du bento principal. Chacune a un type (type_id). Le nom de '
  'la table est historique : ce ne sont plus des catégories d''items depuis '
  '20260915100000_item_types_and_cases.sql.';
```

`bento_categories` n'est plus une table de catégories : c'est **la table des
cases**. Deux cases « film » dans une édition sont donc deux lignes distinctes
portant le même `type_id`, et la clé primaire `(bento_id, category_id)` veut
déjà dire « un item par case », ce qui est exactement la règle qu'on veut
tenir. Le blocage annoncé n'existe plus, et il n'y a rien à lever.

Ce qui suit dans ce document part donc d'un autre endroit.

### 1.2 Le constat qui commande le chantier

Trois chiffres, relevés le 16 septembre 2026 en lecture seule sur la
production, clé anonyme.

| Mesure | Valeur |
| --- | --- |
| Bentos publiés | 27 |
| Cases posées, toutes personnes confondues | 162, soit 27 × 6 exactement |
| Bentos incomplets parmi les publiés | 0 |
| Jours depuis la dernière case posée, médiane | 28 |
| Jours depuis la dernière case posée, maximum | 127 |
| Publiés depuis plus de sept jours | 25 sur 27 |

```bash
# bento_items?select=bento_id,category_id,added_at, clé anonyme
# répartition du nombre de cases par bento : {6: 27}
# catégories utilisées : [(1,27),(2,27),(3,27),(4,27),(5,27),(6,27)]
```

**Tous les bentos publiés sont complets, et 25 personnes sur 27 n'ont plus rien
à faire depuis plus d'une semaine.** Le composer le leur dit lui-même : quand
les six cases sont pleines et le bento en ligne, le plus gros bouton de l'écran
devient « Voir mon bento public » (`src/lib/compose-cta.ts:82`). C'est une
sortie, pas une invitation.

Le chantier 13 existe pour qu'il y ait quelque chose derrière ce bouton.

### 1.3 Une mesure qui a disparu, et qu'il faut savoir ne plus lire

`bentos.updated_at` ne dit plus rien de l'activité d'une personne. La migration
A du chantier 16 a posé `update public.bentos set slug = 'mon-bento',
is_primary = true` sur toutes les lignes, ce qui a déclenché le trigger
`touch_updated_at` : les 27 bentos portent tous la date du 16 septembre.

```
âge updated_at   : min 0   médiane 0   max 0
âge published_at : min 2   médiane 28  max 127
```

La mesure de §1.2 s'appuie donc sur `bento_items.added_at` et
`bentos.published_at`, que rien n'a touchés. Toute mesure ultérieure de
rétention doit faire pareil.

### 1.4 La règle qui tient le chantier

> **Une édition ne crée aucune notion nouvelle. Elle réutilise le bento, la
> case et l'item tels qu'ils existent.**

Une édition est un modèle de bento : un titre, une date de sortie, et de deux à
six cases décrites. Quand quelqu'un la compose, il obtient un bento comme les
autres, avec son adresse publique, sa place dans le fil, son partage, son
signalement et son export. Tout cela a été construit au chantier 16 et n'a pas
à être refait.

C'est ce qui rend le chantier faisable en un temps raisonnable, et c'est aussi
ce qui le rend dépendant de la migration B.

---

## 2. Objectif et critères de succès

**Objectif.** Que l'équipe programme une édition depuis le back-office, qu'elle
sorte à sa date sans nouvelle version de l'app, et que quelqu'un qui a déjà
publié son bento ait une raison de revenir composer.

**Critères, mesurables.**

1. Une édition créée dans le back-office, programmée à une date future, est
   invisible de l'app et de la page web jusqu'à cette date, et visible après,
   sans redéploiement ni nouvelle version.
2. Une personne qui a déjà publié son bento principal voit l'édition en cours,
   la compose, et la publie. Son adresse est `/u/<pseudo>/<slug>`.
3. Une édition passée reste composable. Une personne arrivée à la dixième
   édition peut composer les dix.
4. Les dispositions de 2, 3, 4 et 5 cases sont identiques au pixel entre l'app,
   la page web et l'aperçu de lien, à l'échelle près.
5. Le back-office refuse un intitulé de case qui ne tient pas dans la
   disposition choisie, et le montre avant l'enregistrement.
6. Le bento principal est inchangé, au pixel, dans les trois rendus.

---

## 3. Périmètre

**Dans le chantier.**

- Le modèle : éditions, leurs cases, et le lien d'un bento à son édition.
- Les dispositions de 2 à 6 cases, dans les cinq rendus de la boîte.
- Le back-office : créer, décrire les cases, prévisualiser, programmer.
- L'app : découvrir l'édition en cours, la composer, la publier, retrouver les
  précédentes.
- La page publique et l'aperçu de lien d'un bento d'édition.
- L'étiquette de l'édition dans « La table ».

**Hors du chantier, et pourquoi.**

- **Prévenir à la sortie** : c'est le chantier 17, embarqué dans la même
  sortie store (D7) mais spécifié à part.
- **Lister tous les bentos d'un compte** : chantier 21, même sortie, même
  remarque.
- **Lier une édition à une émission** : la roadmap pose la question pour le 19.
  Le modèle réserve la place (`editions.show_id` nullable, non lu), rien de
  plus.
- **Les succès** : chantier 27, qui dépend de celui-ci.
- **L'import des 446 candidats** : c'est la dette du chantier 15, et c'est un
  **préalable** (§4.8), pas un lot d'ici.

---

## 4. Ce que disent le code, la base et les appareils

### 4.1 Méthode

- Code lu sur `main` à `45b3b64`, chaque constat porte son fichier et sa ligne.
- Production lue en `GET` seulement, clé anonyme, depuis `apps/mobile/.env`.
  Aucun `POST`, `PATCH` ni `DELETE`.
- L'image Open Graph et la page publique de production mesurées au pixel.
- Les largeurs de texte mesurées avec la police Bungee réelle, à la taille et
  à l'interlettrage du code.
- **Aucune build installée sur simulateur.** Le seul `.app` du dépôt a été
  contrôlé avant tout lancement et **pointe sur la production**
  (`EXConstants.bundle/app.config` porte `SUPABASE_URL =
  https://ggjgktbcqumfxrixcdyx.supabase.co`). C'est le fichier qui a créé trois
  comptes anonymes le 16 au matin. Il n'a pas été installé. Le contrôle est
  celui de `RECETTE-MOBILE.md`, cette fois appliqué.

### 4.2 La clé primaire n'est pas le problème, la source des cases l'est

`bento_items` est identifiée par `(bento_id, category_id)` :

```sql
-- 20260511000000_initial_schema.sql:107-113
create table public.bento_items (
  bento_id uuid not null references public.bentos(id) on delete cascade,
  category_id smallint not null references public.bento_categories(id),
  item_id uuid not null references public.items(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (bento_id, category_id)
);
```

Rien à y changer (§1.1). Le vrai blocage est ailleurs : **les six cases ne sont
pas lues en base par l'app, elles y sont compilées.**

```ts
// packages/supabase-mobile/src/bento.ts:26-33
export const CATEGORY_IDS: Readonly<Record<CategoryKey, number>> = {
  film: 1, series: 2, artist: 3, track: 4, creator: 5, place: 6,
};
```

```ts
// packages/supabase-mobile/src/types.ts:10-16
export type CategoryKey =
  | 'film' | 'series' | 'artist' | 'track' | 'creator' | 'place';
```

Un `Record<CategoryKey, …>` est total : une septième case est inexprimable au
compilateur. Les libellés, tampons et genres grammaticaux sont dans le même
fichier (`bento.ts:65-77`), et l'ordre d'affichage aussi (`bento.ts:47-54`).

**Surface mesurée : 24 fichiers hors tests, 31 avec**, répartis ainsi.

| Application | Fichiers |
| --- | --- |
| `apps/mobile` | 15 |
| `apps/landing` | 6 |
| `apps/admin` | 2 |
| `packages/supabase-mobile` | 1 |

`display_order` existe en base (`initial_schema.sql:28`, seed lignes 220-226)
et **n'est lu qu'à un seul endroit du dépôt**,
`apps/admin/src/app/(protected)/bentos/[id]/page.tsx:42`. Changer l'ordre en
base ne changerait rien à l'écran.

Seule souplesse déjà présente, et elle est précieuse : `CATEGORY_BY_ID` est
typé `| undefined` (`bento.ts:41-44`) et les quatre boucles de correspondance
sautent une case inconnue plutôt que de planter.

```ts
// src/lib/bento-slots.ts:42-45
const cat = CATEGORY_BY_ID[row.category_id];
const item = row.items as RemoteItem | null;
if (!cat || !item) continue;
```

Même règle à `apps/landing/src/lib/bento/map.ts:76`, `src/lib/feed.ts:146` et
`src/lib/public-bento.ts:221`. **Conséquence exacte : une case d'édition
envoyée à une version déjà déployée ne casse rien, elle est simplement
invisible.** Le bento d'édition y apparaîtrait comme une boîte de six cases
vides. C'est la raison du calendrier de §6.2.

### 4.3 Trois contrôles de complétude, qui disent la même règle

| Où | Ligne | Forme |
| --- | --- | --- |
| Client mobile | `src/lib/compose-cta.ts:70` | `CATEGORY_ORDER.length - filled.length` |
| Back-office | `utilisateurs/nouveau/actions.ts:120` | `chosen.length < CATEGORY_ORDER.length` |
| Serveur | `20260916180000_publish_first_bento.sql:82` | `count(*) from bento_categories where is_active` |

Seul le dernier est dynamique, et **c'est précisément celui qui casse** dès que
des cases d'édition entrent dans la table : il compterait toutes les cases
actives, éditions comprises, et refuserait toute première publication. Le
correctif est en §6.1, et il est bloquant.

Deux compteurs affichent `6` en littéral : `compose.tsx:302` et `:312`. Deux
autres côté back-office : `UsersClient.tsx:400` et `bentos/[id]/page.tsx:81`.

### 4.4 La boîte est dessinée cinq fois, pas trois

La roadmap en annonce trois. Il y en a cinq, plus deux sources de constantes
parallèles qui ne s'importent pas l'une l'autre.

| # | Exemplaire | Fichier | Itération | Autre que six cases ? |
| --- | --- | --- | --- | --- |
| 1 | Grille de l'app | `src/components/bento/BentoGrid.tsx:147-161` | six appels littéraux | non |
| 2 | Squelette de chargement | `src/components/bento/BentoBoxSkeleton.tsx:44-53` | six `<Bone>` littéraux | non |
| 3 | Grille web | `apps/landing/.../PublicBentoGrid.tsx:78` | `TILE_LAYOUT.map` | cases libres, trois rangées au plus |
| 4 | Aperçu 1200×630 | `apps/landing/.../opengraph-image.tsx:162-165` | `[1,2,3].map` puis filtre | idem |
| 5 | Image de partage 1080×1920 | `src/components/bento/ShareImage.tsx:143-149` | réutilise le 1 | hérité |

Constantes : `src/components/bento/geometry.ts` pour 1, 2 et 5 ;
`apps/landing/src/components/bento/layout.ts` pour 3 et 4. La hauteur **512**
vit en dur à trois endroits de plus que `GRID_HEIGHT` : `NATIVE_GRID_H`
(`compose-layout.ts:58`), `DESIGN_HEIGHT` (`layout.ts:26`) et le calcul de
budget de `ShareImage.tsx:36-50`. Le rayon d'une case est redéclaré une
septième fois à `Tile.tsx:83`.

Les hauteurs de rangée sont nommées d'après les catégories, ce qui dit bien que
la disposition et le contenu n'ont jamais été séparés :

```ts
// src/components/bento/geometry.ts:15-21
export const GRID_GEOMETRY = {
  H_FILM: 220,   // Rangée 1 : le film, en grand.
  H_MID: 134,    // Rangée 2 : série et artiste.
  H_SM: 100,     // Rangée 3 : chanson, créateur, lieu.
  GAP: 10, PAD: 14, BORDER: 5, RADIUS: 28, TILE_RADIUS: 18,
} as const;
```

### 4.5 L'aperçu de lien ne dessine pas la même boîte, mesuré

Trouvé en mesurant la grille, sans rapport avec le chantier 13, mais dans le
même code.

`opengraph-image.tsx` n'importe pas `ROW_HEIGHTS` (bloc d'import lignes 17-25)
et pose `flex: 1` sur chaque rangée (ligne 163). Les trois rangées se partagent
donc la hauteur à parts égales.

Mesuré sur `bento-pop.com/u/dark_hifus/opengraph-image`, image de production
1200×630 :

```
bande crème y 50..63    → 14 px, marge haute
rangée 1     y 64..223  → 160 px
écart        y 224..234 → 11 px
rangée 2     y 235..394 → 160 px
écart        y 395..405 → 11 px
rangée 3     y 406..565 → 160 px
bande crème  y 566..579 → 14 px, marge basse
```

Mesuré sur la page web du même bento, au même moment :

```
rangée 1 : 259,23 px   rangée 2 : 157,17 px   rangée 3 : 116,95 px
```

soit 220 / 134 / 100 mis à l'échelle 1,178. **Le compartiment film, signature
de la boîte, perd 73 px, soit 31 % de sa hauteur, dans chaque aperçu de lien
partagé.** La rangée basse en gagne 54, soit 51 %. Le contour de la boîte est
juste : le rapport mesuré vaut 0,7066 pour 0,7051 attendu. Aucun test ne
couvre l'écart.

Traité tout de suite, en PR séparée (D9).

### 4.6 L'intitulé d'une case, mesuré avec la vraie police

Une case vide affiche son libellé en Bungee capitales, interlettrage 1,2,
taille `Math.round(10 × échelle)` (`tile-text.ts:165-173`), sur **deux lignes
au plus et sans réduction de police** dès que le texte fait plus d'un mot :

```ts
// src/components/bento/tile-title.ts:47-53
const singleWord = !BREAKING_SPACE.test(text) && !BREAKS_BETWEEN_CHARACTERS.test(text);
return singleWord
  ? { numberOfLines: 1, adjustsFontSizeToFit: true }
  : { numberOfLines: 2, adjustsFontSizeToFit: false };
```

Largeurs utiles à l'échelle de référence (361 × 512), case moins son cadre
2,5 et sa marge 8 (`tile-text.ts:159`) :

| Cases dans la rangée | Largeur de case | Largeur utile |
| --- | --- | --- |
| 1 | 323,0 | 302,0 |
| 2 | 156,5 | 135,5 |
| 3 | 101,0 | 80,0 |

Retour à la ligne glouton, deux lignes, police réelle :

| Intitulé | 1 case | 2 cases | 3 cases |
| --- | --- | --- | --- |
| `CRÉATEUR DE CONTENU`, le plus long d'aujourd'hui | tient | tient | tient |
| `TON PLAT RÉCONFORT` | tient | tient | tient |
| `LE FILM QUI T'A FAIT PLEURER` | tient | tient | **3 lignes** |
| `TA PIRE SÉANCE CINÉ` | tient | tient | **3 lignes** |
| `LE JEU QUI T'A VOLÉ TON ÉTÉ` | tient | tient | **3 lignes** |
| `LA SÉRIE QUE TU CACHES` | tient | tient | **3 lignes** |

> **Une case d'une rangée à trois n'accepte pas une question.** C'est la
> contrainte qui structure la planche demandée à la direction artistique, et la
> règle que le back-office applique.

### 4.7 Rien ne sait agir à une date, et ce n'est pas un problème

`pg_net` est installé (`20260911000000_revalidate_landing_on_publish.sql:23`),
**`pg_cron` ne l'est pas** : aucune migration ne le crée, aucun `cron.schedule`
n'existe dans le dépôt.

Ce n'est pas bloquant : montrer une édition à partir de sa sortie est un filtre
de lecture, `released_at <= now()`. Une heure ne coûte donc pas plus cher qu'un
jour, ce qui rend D4 gratuit. Ce qui manquerait est de **prévenir** à cette
heure-là, et c'est le chantier 17.

### 4.8 Les quatre types dormants n'ont aucun item, et c'est un préalable

Le chantier 15 a créé neuf types, les quatre derniers inactifs « jusqu'au
chantier 13 » (`20260915100000_item_types_and_cases.sql:40-42, 72-82`).

Mesuré en production, clé anonyme :

```
item_types visibles (RLS : is_active seulement)
  1 film Film · 2 series Série · 3 person Personne · 4 song Chanson · 5 place Lieu

items par type_id
  [(1, 53), (2, 43), (3, 87), (4, 54), (5, 40)]   → 277 items, tous validés
```

**Zéro item de type Jeu vidéo, Livre, Plat ou Activité.** Les 446 candidats
existent dans le dépôt, comptés par l'AST TypeScript :

```
activity 111 · book 110 · dish 115 · video-game 110   → 446
apps/admin/src/lib/starter-lists/
```

Ils n'ont jamais été importés. Or `search_items` résout la case vers son type
et filtre sur `t.is_active` (`20260915100000:272-274`) : activer un type sans
catalogue produit une recherche vide, donc une case que personne ne peut
remplir.

> **Préalable, hors de ce chantier** : l'équipe importe et relit les quatre
> listes depuis l'écran Types du back-office. C'est la DoD restante du
> chantier 15. Tant que ce n'est pas fait, une édition ne peut utiliser que les
> cinq types actifs.

### 4.9 Ce que le chantier 16 a déjà posé, et qu'on ne refait pas

- `bentos` porte `slug` et `is_primary`, appliqués en production, vérifiés :
  `{"slug": "mon-bento", "is_primary": true}` sur chacun des 27.
- `/u/<pseudo>/<slug>` existe dans l'app et sur le web, avec son aperçu.
- `create_bento(p_slug)` sait créer un bento secondaire, avec ses slugs
  réservés « gardés pour les chantiers 13 et 21 »
  (`20260916140000_bentos_lift_unique.sql:87`).
- Le composer a son sélecteur de bento, dimensionné par `composeSelectorHeight`
  (`compose-layout.ts:133`).
- La page publique liste les autres bentos du compte (`public-bento.ts:143`).
- Le fil lit une liste de bentos publiés et joint les comptes dans le bon sens
  (`src/lib/feed.ts:230-245`), trié `published_at desc` : **un bento d'édition
  y entre sans rien changer.**
- `ribbonFor` décide de l'étiquette d'un post
  (`src/components/feed/ribbon.ts:45-49`) : « BENTO DE LA SEMAINE » est une
  entrée de plus, et la règle de priorité y est déjà documentée et testée.

### 4.10 Deux plafonds posés par le chantier 16, à revoir ici

**Le plafond de 20 bentos** ne tient pas face à D5.

```sql
-- 20260916140000_bentos_lift_unique.sql:94-101
-- 20 est large pour l'usage prévu, une édition par semaine, et
-- ferme la porte à une insertion en boucle.
if v_count >= 20 then
  raise exception 'Tu as atteint la limite de bentos pour ce compte.' …
```

Sa propre justification le condamne : une édition par semaine, avec les
éditions passées qui restent composables, atteint 20 en **20 semaines, moins de
cinq mois**.

**Les slugs réservés** ne protègent pas les adresses d'édition. Si quelqu'un
crée un bento libre nommé `semaine-2026-38`, la création de son bento
d'édition échouera sur `bentos_user_slug unique (user_id, slug)`. Une liste en
dur ne pouvait de toute façon pas prévoir les éditions à venir.

Les deux vivent dans le corps de `create_bento` : la migration des éditions la
remplace, et le fichier de la migration B n'est pas touché (D10).

**Les deux défauts sont prouvés**, en remettant l'ancien code sur le Supabase
local :

```
témoin 1 : ancienne forme → « Un bento se publie complet. »
           un compte neuf envoyant ses six cases est refusé dès qu'UNE case
           d'édition existe
témoin 2 : après 20 semaines → « Tu as atteint la limite de bentos pour ce
           compte. »
```

### 4.11 Ce qui ne bouge pas

- Le bento principal, ses six cases, leurs intitulés et leurs tampons à
  l'écran. Le chantier 15 l'a décidé (son D8), et toute version déjà déployée
  en dépend.
- `bento_items` : ni colonne, ni clé, ni contrainte.
- Le trigger `bento_items_check_type` : il lit la case et son type, donc il
  vaut pour une case d'édition sans modification
  (`20260915100000:186-205`).
- Le modèle brouillon-publié du chantier 5 : `published_at` reste la seule
  vérité, par bento.
- Le nom de la table `bento_categories`. Le renommer coûterait un redéploiement
  coordonné du back-office pour zéro gain fonctionnel. Versé aux suivis (§12).

---

## 5. Design

### 5.1 Le modèle : une édition décrit des cases, un bento les remplit

Trois objets, dont deux existent déjà.

```
editions                     (nouveau)  titre, slug, sortie, statut
  └─ bento_categories        (existant) + edition_id, + stamp, + gender, + position
       └─ bento_items        (existant) inchangé, PK (bento_id, category_id)

bentos                       (existant) + edition_id
```

**Une édition est un modèle, pas un contenu.** Elle ne porte aucun item. Quand
quelqu'un la compose, `create_edition_bento(p_edition)` lui crée un bento
secondaire rattaché à l'édition, et il remplit les cases décrites par
l'édition, à travers le même `bento_items` que son bento principal.

Ce que cela donne gratuitement, parce que le bento d'édition est un bento :

| Fonctionnalité | D'où elle vient |
| --- | --- |
| Adresse `/u/<pseudo>/<slug>` | chantier 16, lot 1 |
| Aperçu de lien | chantier 16, lot 1 |
| Place dans le fil | `feed.ts:230`, inchangé |
| Partage 1080×1920 | `ShareImage`, une fois la grille généralisée |
| Signalement ciblé | chantier 16, lot 3 |
| Export RGPD | chantier 16, lot 4 |
| Modération des items | chantier 15 |

### 5.2 Les cases d'une édition sont des lignes de la table des cases

`bento_categories` gagne quatre colonnes :

| Colonne | Rôle |
| --- | --- |
| `edition_id` | `null` pour les six cases du bento principal, sinon l'édition |
| `stamp` | le tampon court affiché sur une tuile pleine, par exemple `FILM` |
| `gender` | `m` ou `f`, pour accorder « Cherche un film » et « Cherche une série » |
| `position` | rang dans la boîte, de 1 à 6 |

`label_fr`, `type_id` et `is_active` existent déjà.

**Les six cases existantes reçoivent leurs `stamp` et `gender` par la
migration**, aux valeurs exactes de `CATEGORY_META` (`bento.ts:71-76`), et
`position` aux valeurs de `CATEGORY_ORDER`. L'app continue de lire ses
constantes pour le bento principal, ce qui garantit qu'aucune version déployée
ne change d'affichage. **Un test lie les deux sources** et échoue si elles
divergent (§7.2). Les cases d'édition, elles, se lisent en base : elles n'ont
pas le choix, elles n'existent pas à la compilation.

`key` reste unique globalement, donc une case d'édition porte une clé
préfixée, par exemple `e38-film-pleurer`. C'est ce que `search_items` reçoit,
et il la résout vers son type sans modification
(`20260915100000:272-274`).

### 5.3 Les dispositions, et ce qu'on demande à la direction artistique

**Validées par Rob le 16 septembre 2026**, sur la planche rendue à la
géométrie réelle : [Dispositions du
bento](https://claude.ai/artifact/1Dv8w5pMswsBivrqzxTDCM). Neuf dispositions
proposées, les recommandées retenues.

| Cases | Rangées | Hauteurs | Rangée de trois ? |
| --- | --- | --- | --- |
| 6 | 1 + 2 + 3 | 220 / 134 / 100 | oui, l'existant |
| 5 | 1 + 2 + 2 | 220 / 134 / 100 | non |
| 4 | 1 + 2 + 1 | 220 / 134 / 100 | non |
| 3 | 1 + 2 | 220 / 244 | non |
| 2 | 1 + 1 | 280 / 184 | non |

**Deux règles les tiennent**, et elles se lisent dans les nombres :

- **le compartiment vedette reste** : toute disposition ouvre sur une rangée
  d'une seule case, parce que c'est ce qui fait lire une boîte bento plutôt
  qu'une grille ;
- **une rangée de trois n'apparaît qu'à six**, par la mesure de §4.6 : une
  case y offre 80 points utiles, et un intitulé tient sur deux lignes sans
  réduction. « Le film qui t'a fait pleurer » y demanderait trois lignes. Les
  éditions portent des questions, pas des mots courts.

**De 4 à 6 cases, les hauteurs ne changent pas.** Seule la dernière rangée se
divise autrement. Les cinq rendus gardent donc exactement les nombres qu'ils
avaient pour le bento principal, ce qui est la raison de ce découpage et ce
qui rend la preuve au pixel du lot 2 possible.

**Une table, pas une planche par disposition.** Les cinq rendus recopiaient
les mêmes nombres à la main, et c'est exactement ce qui a produit la
divergence de §4.5. `BOX_LAYOUTS` dans `packages/supabase-mobile/src/bento.ts`
est désormais la seule source, avec `boxPlacements(n)` qui rend pour chaque
case sa rangée, sa hauteur, son gabarit, sa portée web et sa rotation.

### 5.4 L'intitulé et le tampon

Une case d'édition porte les deux, et ils ne disent pas la même chose :

- le **tampon** est court et vient du type, comme aujourd'hui : `FILM`, `SÉRIE`,
  `JEU`. Il s'affiche sur la tuile pleine (`Tile.tsx:109`) ;
- l'**intitulé** est la question : « Le film qui t'a fait pleurer ». Il
  s'affiche dans la case vide (`EmptyTile.tsx:53`) et dans la modale de
  recherche.

**Le back-office refuse un intitulé qui ne tient pas** dans la disposition
choisie, et le montre avant l'enregistrement. La règle est celle de §4.6,
appliquée avec la largeur utile de la case à sa position, et elle vit dans un
module pur partagé entre l'app et le back-office, pour qu'il n'y ait pas deux
vérités.

### 5.5 Le rythme, la date, et les éditions passées

- **Hebdomadaire, jeudi 18 h de Paris** (D4). La date est un `timestamptz`, la
  saisie du back-office se fait en heure de Paris, et l'affichage aussi. Rien
  ne sort si rien n'est programmé : la sortie est une date sur une ligne, pas
  un déclencheur.
- **Une édition reste composable pour toujours** (D5). C'est la mesure de §1.2
  qui décide : après dix éditions, quelqu'un qui arrive a dix choses à
  composer. La contrepartie assumée est que la semaine perd son urgence, et
  c'est le chantier 17 qui la rendra.
- **L'édition suivante est annoncée sans être dévoilée** : son titre et sa date
  s'affichent, ses cases non. La lecture le garantit, pas l'écran : les cases
  d'une édition non sortie ne sont pas lisibles (§6.3).

### 5.6 Dans l'app

- **Le composer** : le sélecteur du chantier 16 liste le bento principal, puis
  les éditions composées, puis l'édition en cours si elle ne l'est pas encore.
  Il est déjà dimensionné pour plusieurs entrées
  (`composeSelectorHeight(fontScale, bentoCount)`).
- **« La table »** : un bento d'édition porte l'étiquette de son édition, une
  entrée de plus dans `ribbonFor`, dont la règle de priorité est déjà écrite et
  testée (`ribbon.ts:35-49`). Le titre de l'édition accompagne l'étiquette.
- **La page publique** : la boîte à sa disposition, le titre de l'édition
  au-dessus, et le lien vers l'édition elle-même.

### 5.7 Dans le back-office

Un écran Éditions : créer, décrire les cases une à une (intitulé, tampon,
genre, type, position), prévisualiser la boîte **au rendu réel** et non en
tableau, programmer la sortie, dépublier.

La prévisualisation est le seul endroit du back-office qui dessine une boîte :
aujourd'hui `bentos/[id]/page.tsx` rend un tableau HTML et l'assume
(commentaire lignes 12-17). Elle réutilise la grille web, qui devient un
composant partagé.

---

## 6. Contrat technique

### 6.1 Les migrations

**Deux fichiers, et la migration B n'est pas touchée** (D10, corrigée au
lot 1). Les deux défauts de §4.10 vivent dans le corps de `create_bento`,
qu'un `create or replace` reprend : l'append-only est préservé, et rien ne
diverge si la migration B a déjà été appliquée quelque part.

**`20260917100000_editions.sql`**, additif et invisible des versions
déployées :

```sql
create table public.editions (
  id smallint primary key generated always as identity,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title text not null check (length(btrim(title)) between 1 and 80),
  released_at timestamptz,          -- null = brouillon, jamais visible
  show_id uuid,                     -- réservé au chantier 19, non lu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bento_categories
  add column edition_id smallint references public.editions(id) on delete cascade,
  add column prompt text,
  add column stamp text,
  add column gender text check (gender in ('m','f'));

alter table public.bentos
  add column edition_id smallint references public.editions(id) on delete set null;

create unique index bentos_one_per_edition
  on public.bentos (user_id, edition_id) where edition_id is not null;
```

**`prompt` en plus de `label_fr`, et non à sa place.** Mesuré sur la base au
moment de l'écrire : `label_fr` vaut « Artiste musical » et « Lieu de voyage »
quand l'app affiche « Artiste » et « Lieu ». Les deux colonnes ne disent donc
pas la même chose, et les confondre obligerait à sacrifier l'une. `label_fr`
reste le mot du back-office, utile pour distinguer deux cases de type
Personne ; `prompt` est ce que lit l'utilisateur, et pour une édition c'est la
question.

Pas de colonne `position` : `display_order` existe déjà sur la table et dit
exactement cela, y compris pour une édition. En prime, `position` est un nom
de fonction Postgres.

**Deux correctifs bloquants, dans le même fichier**, sur du code écrit au
chantier 16 mais jamais appliqué (§4.3 et §4.10) :

```sql
-- publish_first_bento : la complétude ne compte que le bento principal.
-- Sans « and edition_id is null », la première édition créée refuse TOUTE
-- première publication de tout nouveau compte.
if v_count <> (select count(*) from public.bento_categories
                where is_active and edition_id is null) then

-- create_bento : le plafond ne compte que les bentos LIBRES, et l'adresse
-- d'une édition est réservée en interrogeant `editions` plutôt qu'une liste
-- en dur, qui ne pouvait pas prévoir les éditions à venir.
where b.user_id = v_uid and b.edition_id is null
…
if exists (select 1 from public.editions e where e.slug = p_slug) then
```

**`20260917110000_create_edition_bento.sql`** : la fonction `security definer`
qui crée le bento d'une édition sortie pour la personne connectée, refuse une
édition non sortie, refuse un doublon, et prend l'adresse de l'édition. Si un
bento libre occupe déjà cette adresse, créé avant que l'édition n'existe, une
boucle bornée suffixe l'adresse plutôt que d'échouer : la personne n'y est pour
rien.

**La purge de la landing au changement d'une édition part au lot 5**, avec le
lot qui affiche le titre d'édition sur la page publique. L'écrire ici aurait
dupliqué la logique de coffre et de `net.http_post` de
`20260916120000_bentos_slug_and_primary.sql:124-185`, avec le risque de
divergence que le chantier vient précisément de corriger ailleurs.

### 6.2 L'ordre de déploiement, et le mode maintenance

**Le blocage, énoncé une fois.** Une édition est un second bento. Un second
bento exige que `bentos_user_id_key` tombe, c'est-à-dire la migration B. Or la
migration B change la forme que PostgREST rend pour l'embed `users → bentos`,
d'objet à tableau, et **toute version déployée lit un objet**.

Vérifié en production le 16 septembre, avant toute décision :

```
users?select=pseudo,bentos(id,slug,is_primary)&pseudo=eq.dark_hifus
type de .bentos : OBJET
```

**L'état du parc, mesuré.** L'App Store sert la version **1.1**, sortie le 7
septembre. La 1.2.0 a été soumise le 13 septembre et ne l'a pas remplacée. Les
builds 1.3.0 sont terminées le 16 septembre au matin, iOS 12 et Android 14, et
ne sont soumises nulle part.

**Ce dont on dispose déjà, et qui n'était pas connu de la roadmap.** La table
`public.app_config` (`20260528000000_app_config.sql`) porte un mode maintenance
et un plancher de version par plateforme. L'app la lit au démarrage **et à
chaque retour au premier plan** (`src/state/app-status.ts:80-84`), en
défaillance ouverte. Elle est arrivée le 28 mai, donc **la 1.1 l'honore**.
État lu en production :

```
maintenance_mode false · ios_min_version 0.0.1 · ios_latest_version 1.1
android_min_version null · android_latest_version 0.1.0
```

`android_latest_version` est périmé : la bannière « nouvelle version » ne se
déclenche jamais sur Android. Versé aux suivis.

**La séquence retenue.**

1. **Pendant tout le développement, la production ne bouge pas.** Le modèle,
   les droits et les migrations s'éprouvent sur le Supabase local, comme au
   chantier 16. Aucune version déployée ne voit quoi que ce soit.
2. **La sortie store embarque les chantiers 13, 17, 21 et 29** (D7). Elle est
   soumise quand les quatre sont recettés.
3. **Le jour de la bascule**, dans cet ordre : `maintenance_mode` à vrai, les
   trois migrations et la migration B, redéploiement de la landing et du
   back-office, contrôles rejoués, `maintenance_mode` à faux.
4. **Une fois la nouvelle version servie par les deux stores**,
   `ios_min_version` et `android_min_version` passent à cette version (D8) :
   une version ancienne voit l'écran « mets à jour » plutôt qu'une page vide.
5. **La première édition n'est créée qu'après.** C'est ce qui rend l'étape 3
   sûre : aucune édition n'existe tant que l'équipe n'en crée pas une, donc
   aucun bento d'édition ne peut apparaître dans le fil d'une version qui ne
   saurait pas le dessiner.

Le point 5 est la différence de fond avec la migration B seule : ici, le
contenu qui déclencherait la casse est créé par l'équipe, à la date qu'elle
choisit.

### 6.3 Droits et garde-fous

- `editions` : lecture publique des seules éditions sorties,
  `using (released_at is not null and released_at <= now())`. Écriture
  service-role, comme `item_types` et `bento_categories`
  (`20260915100000:65, 108`).
- `bento_categories` : la policy de lecture gagne la même condition pour les
  cases d'édition. **Les cases d'une édition non sortie ne sont pas
  lisibles**, ce qui rend l'annonce « sans dévoiler » vraie en base et non à
  l'écran.
- `bentos.edition_id` : hors des droits colonne du client, écrit par la seule
  fonction `security definer`, comme `slug` et `is_primary`.
- Le trigger `bento_items_check_type` couvre les cases d'édition sans
  modification.
- `create_edition_bento` refuse une édition non sortie, un doublon
  (`bentos_one_per_edition`), et un compte sans profil.

---

## 7. Stratégie de test et de recette

### 7.1 Tests unitaires, `node:test` plus `tsx`

- La table des dispositions : pour chaque `n` de 2 à 6, la somme des cases par
  rangée vaut `n`, et la somme des hauteurs plus les écarts vaut la hauteur
  annoncée. C'est le test qui manquait à §4.5.
- **Un test qui compare les cinq rendus** : à `n` donné, les proportions de
  rangée sont identiques dans `geometry.ts`, `layout.ts` et l'aperçu. Il
  échouerait aujourd'hui sur l'aperçu de lien, ce qui est le but.
- La règle d'intitulé : pour chaque largeur utile, un jeu d'intitulés qui
  tiennent et un jeu qui ne tiennent pas, avec les valeurs mesurées en §4.6.
- `ribbonFor` avec l'étiquette d'édition, et sa priorité face à « invité » et
  « coup de cœur ».
- La correspondance case vers disposition, et le cas d'une case inconnue, qui
  doit rester sautée et non plantante.

### 7.2 Tests de base, sur Supabase local

`apps/mobile/scripts/check-editions.sql`, huit familles de contrôles et **18
assertions**, rejouables dans une transaction annulée. Livré au lot 1, sortie
`════ 18 tenus, 0 manqués ════`.

1. Une édition sans `released_at` est invisible de l'anonyme, ses cases aussi.
2. Une édition sortie est visible, ses cases aussi, et les six cases
   principales restent lisibles.
3. Deux cases du même type dans une édition : acceptées, et deux items
   distincts s'y posent.
4. Un item d'un autre type dans une case d'édition : refusé par le trigger.
5. Un seul bento par personne et par édition ; il porte l'adresse de
   l'édition ; une édition non sortie ne se compose pas ; son adresse est
   réservée à `create_bento` **avant même sa sortie**.
6. La première publication d'un compte neuf aboutit **après** création d'une
   édition. C'est le correctif de §6.1, et aucun test d'application ne le
   verrait.
7. Le plafond ne compte que les bentos libres, et une édition se compose
   malgré un plafond atteint.
8. Les six cases principales ont leur `prompt`, leur tampon et leur genre, et
   deux cases ne partagent pas un rang dans une édition.

**Il construit ses propres données**, contrairement à `check-bentos-multi.sql`
qui exige un bento publié préexistant : après un `supabase db reset` la base
locale est vide, et un contrôle qui ne se rejoue pas ne garde rien.

**Deux témoins hors script** prouvent que les correctifs de §4.10 portent : en
remettant l'ancien code, la première publication d'un compte neuf est refusée,
et le plafond bloque après vingt semaines. Sans eux, les contrôles 6 et 7
passeraient sans rien démontrer.

Côté application, `apps/mobile/src/lib/bento-cases-vs-app.test.ts` lie la base
et l'app : il lit le remplissage SQL des six cases et le compare à
`CATEGORY_META`, case par case. Il lit le SQL et non la base, parce que la CI
n'a pas de Postgres et qu'un test qui ne tourne qu'en local ne garde rien. Un
témoin échoue si l'extraction rend une table vide.

### 7.3 Recette, prête à dérouler

**Écrite pour être exécutée sans réfléchir**, dans l'ordre, le 17 septembre
2026. Chaque étape dit ce qu'on fait et ce qu'on doit voir ; une étape qui ne
donne pas le résultat annoncé est un défaut, pas une approximation.

Tout se passe contre le **Supabase local**. Aucune build ne pointe sur la
production, et le contrôle de cible se fait avant chaque installation, sur le
bundle **et** sur la clé de session dans AsyncStorage, comme l'exige
`RECETTE-MOBILE.md`.

#### A. Monter l'environnement

```bash
# 1. Supabase local, reconstruit depuis les migrations du dépôt
cd apps/mobile && npx supabase start && npx supabase db reset

# 2. Les contrôles de base : 20 tenus, 0 manqué
docker exec -i supabase_db_bento-pop-mobile \
  psql -U postgres -d postgres -q < scripts/check-editions.sql

# 3. Les droits : 42 contrôles, tous verts
SUPABASE_URL=http://127.0.0.1:54331 SUPABASE_ANON_KEY=<ANON_KEY locale> \
  npx tsx scripts/check-privileges.ts

# 4. Les éditions de recette : 2, 3 et 6 cases, plus une programmée
docker exec -i supabase_db_bento-pop-mobile \
  psql -U postgres -d postgres -q < scripts/seed-editions-local.sql
```

Le script de données **refuse de tourner sur la production** : il cherche les
pseudos de l'équipe et lève s'il en trouve un. Ce garde-fou a été éprouvé en
faisant passer la base locale pour la production, il refuse bien.

#### B. La build de recette, pointée sur le local

```bash
# Le Supabase local écoute en 54331 ; l'émulateur Android ne voit pas
# `127.0.0.1` de la machine hôte.
adb reverse tcp:54331 tcp:54331

# iOS, simulateur
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY locale> \
  npx expo run:ios

# Android, émulateur
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54331 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY locale> \
  npx expo run:android
```

**Avant de lancer l'app, vérifier la cible**, les deux contrôles :

```bash
# le bundle
unzip -p ios/build/.../MonBentoPop.app/EXConstants.bundle/app.config 2>/dev/null \
  | grep -o "127.0.0.1:54331\|ggjgktbcqumfxrixcdyx"
# la session déjà stockée
D=$(xcrun simctl get_app_container booted com.bentopop.mobile data)
cat "$D/Library/Application Support/com.bentopop.mobile/RCTAsyncLocalStorage_V1/manifest.json"
```

La seule réponse acceptable est `127.0.0.1:54331`. `ggjgktbcqumfxrixcdyx`, c'est
la production, et on s'arrête là.

#### C. Ce qui doit être vrai, dans l'ordre

| # | Geste | Ce qu'on doit voir |
| --- | --- | --- |
| 1 | Ouvrir le composer, compte neuf | Six cases, « 0 / 6 », « Commence par ton film ». **Aucune pastille d'édition** tant qu'il n'y a pas de profil |
| 2 | Publier un premier bento | Le parcours du chantier 9, inchangé |
| 3 | Revenir au composer | Trois pastilles pointillées, la plus récente d'abord : « Le grand inventaire », « La semaine du film qui pique », « Le duel du samedi ». **Jamais « Celle qu'on ne doit pas voir »** |
| 4 | Taper « Le duel du samedi » | La boîte devient **deux bandes**, 280 et 184. Compteur « 0 / 2 ». Intitulés entiers, non coupés |
| 5 | Taper la case du haut | Modale titrée « Le film qui t'a fait pleurer », champ « Cherche… » **sans article** |
| 6 | Remplir les deux cases | « 2 / 2 », bouton « Publier mon bento » actif |
| 7 | Publier | La page publique s'ouvre sur `/u/<pseudo>/rec-deux` |
| 8 | Regarder la page publique | Deux bandes, même géométrie qu'au composer. Sous le pseudo : « Le duel du samedi, publié le … » |
| 9 | Onglet « La table » | Le bento d'édition porte une étiquette **jaune** au titre de l'édition |
| 10 | Partager depuis la page publique | L'image 1080×1920 montre **deux cases**, pas six |
| 11 | Composer « Le grand inventaire » | Six cases, disposition 1 + 2 + 3, **identique au bento principal** |
| 12 | Comparer au pixel | Capture du bento principal et capture de `rec-six`, même géométrie de boîte. Différence d'image sur le cadre seul : nulle |
| 13 | Revenir au bento principal par le sélecteur | Les six cases d'origine, rien de perdu |
| 14 | Police système au maximum | Dispositions à 2 et 3 cases : les intitulés restent lisibles, la boîte ne déborde pas |
| 15 | Back-office, écran Éditions | Créer une édition à 6 cases, coller « Le film qui t'a fait pleurer » en case 6 : **refusé**, aperçu cerclé de rouge |
| 16 | Passer cette édition à 3 cases | Le même intitulé passe : la disposition décide |

#### D. Le contrôle qui ne se voit qu'au bon moment

**Une édition programmée sort sans relancer l'app.** C'est la promesse du
chantier, et elle ne se vérifie qu'en manipulant l'horloge de la base :

```sql
-- l'édition à venir sort maintenant
update public.editions set released_at = now() - interval '1 minute'
 where slug = 'rec-avenir';
```

Mettre l'app en arrière-plan, la ramener : la pastille doit apparaître **sans
redémarrage**, parce que le composer relit les éditions à chaque retour sur
l'onglet **et** à chaque retour de l'app au premier plan. Elle portera une case unique, hors des dispositions dessinées, et la
boîte refusera de se dessiner plutôt que d'inventer : c'est le comportement
voulu, `boxPlacements` rend un tableau vide.

#### E. Ce qui reste à l'appareil réel, et qui part au chantier 29

- la fluidité du fil avec des boîtes de tailles différentes qui se succèdent ;
- le partage dans deux messageries, et l'aperçu de lien tel qu'elles le
  rendent ;
- **« CRÉATEUR DE CONTENU », coupé ou non dans le fil sur iPhone SE.** Le
  calcul dit qu'il déborde (§4.6), aucun écran ne l'a confirmé ;
- la recette visuelle du back-office sur un écran étroit.

---

## 8. Plan de développement

Sept lots. Le lot 0 est un préalable qui ne nous appartient pas.

### Lot 0 · Préalables, hors développement

- L'équipe importe et relit les 446 candidats des quatre types dormants,
  depuis l'écran Types du back-office (§4.8). DoD restante du chantier 15.
- Rob livre la planche des dispositions 2, 3, 4 et 5 cases (§5.3).
- ~~La PR de correction de l'aperçu de lien est fusionnée (D9).~~ **Fait** :
  [PR #73](https://github.com/ClementSoulier/bento-pop/pull/73), fusionnée le
  16 septembre après CI verte. Mesuré après correction sur un vrai build :
  233 / 142 / 106.

### Lot 1 · Le modèle et les droits · livré

Les deux migrations de §6.1, les deux correctifs de code déjà écrit,
`check-editions.sql` et `bento-cases-vs-app.test.ts`. Rien de visible.

Éprouvé sur le Supabase local, reconstruit de zéro : les seize migrations
s'appliquent dans l'ordre, les 18 contrôles de `check-editions.sql` passent,
les **42 contrôles de `check-privileges.ts` restent verts**, les 475 tests
mobiles passent, `typecheck` est propre.

Deux écarts avec la spécification, tous deux corrigés dans ce document :

- **la migration B n'a pas été amendée** (D10), elle n'en avait pas besoin ;
- **la purge de la landing part au lot 5** : l'écrire ici dupliquait la
  logique de coffre et de `net.http_post` existante.

### Lot 2 · La table des dispositions, et les cinq rendus · livré

`BOX_LAYOUTS` dans le module de domaine partagé, à partir de la planche
validée par Rob. Les cinq rendus prennent une **liste ordonnée de cases** au
lieu d'un dictionnaire indexé par catégorie : c'était le vrai travail, une
vingtaine de fichiers, parce qu'une édition peut porter deux cases du même
type et que `CategoryKey` l'interdisait littéralement.

**Preuve au bit près**, sur un vrai build Next avec le bouchon d'e2e, avant et
après la conversion : l'aperçu de lien et le balisage de la boîte ont le même
SHA-256. Pas « visuellement identique », le même fichier.

Deux détails gardés à l'identique et documentés, qui expliquent que la
comparaison sorte à zéro : une rangée d'une seule case garde un conteneur nu
sans `flex: 1`, et une case vide applique toujours la moitié de la rotation de
sa tuile.

### Lot 3 · Le back-office des éditions · livré

La règle d'intitulé dans le module partagé, l'écran Éditions, l'éditeur de
cases et sa prévisualisation.

**La règle d'intitulé mesure du texte sans canevas.** Un back-office en Node
n'en a pas, et l'app ne peut pas mesurer avant de dessiner : `bento.ts` porte
donc les largeurs d'avance de Bungee, extraites du vrai fichier de police.
`bungee-metrics.test.ts` les redérive du `.ttf` à chaque exécution et recoupe
quatre mesures faites au canevas dans un navigateur, 0,3 % d'écart.

**Elle avertit au lieu de refuser, et c'est la mesure qui l'a imposé.** La
première version gardait 7 % de marge pour couvrir le fil sur iPhone SE. Elle
refusait « Créateur de contenu », affiché dans la rangée à trois du bento
principal depuis le premier jour. Une règle qui refuse ce qui existe est une
règle fausse. `promptFit` rend donc `fits`, qui bloque, et `tight`, qui
avertit au-delà de 90 % d'une ligne.

**Une correction de géométrie** : la largeur utile d'une case vide vaut sa
largeur moins la marge de 8 et le pointillé de **2**, pas 2,5. Elle passe de
80 à 81 points pour une rangée à trois.

**Un défaut évité au compilateur** : `caseKeyForType` cherchait la case d'un
type sans filtrer `edition_id`, et aurait renvoyé une case d'édition dès la
première créée.

**L'écran a été recetté**, en session simulée sur une copie détachée du dépôt
et le Supabase local, sans qu'aucun compte soit créé nulle part. Trois défauts
que ni les tests ni le typage ne voyaient :

- le sélecteur de genre, large de 60 points, affichait « ur » : la flèche
  native du `select` mangeait la fin du mot ;
- l'adresse d'une édition se coupait en deux lignes dans la liste ;
- la pastille d'état et le bouton de suppression passaient l'un sous l'autre.

**Le cas qui justifie l'écran, vérifié de bout en bout** : « Le film qui t'a
fait pleurer » affiche `TIENT · 66 %` en case 1, pleine largeur, et
`COUPÉ · 3 LIGNES` en case 6, dans la rangée à trois. L'aperçu l'y montre
tronquée et cerclée de rouge, et l'enregistrement est refusé. La même question,
deux verdicts, selon la seule position.

**Géométrie de l'aperçu mesurée dans le navigateur** : boîte 300 × 425,5 px et
rangées 182,8 / 202,8 pour une édition à trois cases, soit exactement 512, 220
et 244 à l'échelle 300/361.

### Lot 4 · L'app : découvrir et composer une édition · livré

Une case se désigne par sa **clé** et s'écrit par son **identifiant** : c'est
tout le lot. `Slots` s'indexe par clé, les écritures prennent
`bento_categories.id`, le store porte le jeu de cases, et en changer vide les
cases remplies. `composeCta` compte jusqu'au nombre de cases et nomme la
première au lieu de dire « ton film » en dur. Le sélecteur liste les éditions
sorties non composées, un tap crée leur bento.

Deux défauts trouvés en chemin, invisibles des tests : « Cherche une la série
que tu caches… », l'article ne s'accordant qu'à un nom commun ; et un module
de domaine qui importait le client Supabase, cassant le seul module conçu pour
rester testable sous node.

### Lot 5 · Le public : page, aperçu, fil · livré

Les cinq rendus lisent une édition. **Une seule requête**, parce que les cases
vides n'ont pas de ligne `bento_items` : les déduire des cases remplies ferait
rétrécir la boîte d'un bento incomplet au lieu d'y montrer des emplacements.
La liste complète vient de l'édition, imbriquée.

Les intitulés viennent désormais de la base et non de `CATEGORY_META` : seule
source possible pour une édition, et `bento-cases-vs-app.test.ts` lie les six
valeurs du bento principal à celles de l'app.

L'étiquette du fil porte le **titre** de l'édition, passe devant le coup de
cœur et cède devant « invité ». La purge de landing, reportée du lot 1, arrive
avec ce qui la rend nécessaire : modifier une édition ne touche aucun bento,
donc rien ne purgeait, et l'ancien titre serait resté servi pour toujours.

### Lot 6 · Recette et documents · parcourue sur simulateur et émulateur

**Le 16 septembre 2026**, sur iPhone 17 Pro (simulateur) et Pixel 8
(émulateur), contre le Supabase local. La cible a été vérifiée avant chaque
lancement, trois fois : `app.config` compilé dans la build, clé de session
stockée, et compte anonyme apparu dans la base locale, 8 puis 9 comptes. Aucune
build n'a pointé ailleurs.

**Les seize étapes de §7.3 C et le contrôle D passent sur les deux
plateformes, après quinze corrections.** Aucune n'était visible des 821 tests
(585 de l'app, 127 du back-office, 109 de la landing), tous verts à la fin.

| # | Ce que la recette a montré | Où | Correction |
| --- | --- | --- | --- |
| 1 | Cycle de `require` entre `session.ts` et `bento-actions.ts` | app | `caseSetFor` rangé dans `editions.ts` |
| 2 | Pastilles d'édition proposées sans profil, tap voué à l'échec | composer | masquées tant qu'il n'y a pas de profil |
| 3 | « Commence par film » : régression, et le test avait été ajusté pour l'accepter | composer | « Commence par ton film », test rétabli |
| 4 | « bento, publié le » : virgule en trop | page publique | rétabli |
| 5 | « REC-DEUX » : le slug en guise de nom | composer, sélecteur, profil, page publique, landing | `bentoName`, le titre de l'édition |
| 6 | Pastille active hors de l'écran après la création d'une édition | sélecteur | `selectorRevealOffset`, testé sur la géométrie relevée |
| 7 | Modale titrée « Case · Film », alors que les deux cases du duel sont des films | recherche | la question en titre, le tampon au-dessus |
| 8 | Publier une édition ouvrait la page du bento principal | composer | l'adresse du bento courant, `bentoRoute` |
| 9 | Titre d'un mot réduit à 5 pt à l'ouverture à froid, sur iOS | toutes les cases | taille mesurée, plus d'`adjustsFontSizeToFit` |
| 10 | VoiceOver annonçait une édition sans aucune de ses cases | fil | énumération des cases du bento |
| 11 | Titre d'édition long tronqué, y compris à la plus grande police | composer | réduit jusqu'à 21 pt, `composeTitleScale` |
| 12 | Intitulé sur deux lignes aligné à gauche sous un « + » centré | case vide | centré ligne à ligne |
| 13 | Changer de bento effaçait crédits d'image et état « en attente » | composer, dette du chantier 16 | une seule liste de colonnes, `REMOTE_SLOT_COLUMNS` |
| 14 | Édition sortie invisible au retour de l'app au premier plan | composer, contrôle D | relecture sur `AppState` |
| 15 | Case pas encore écrite affichée « coupé · 0 lignes » | back-office | « à écrire », et toujours refusée |

**Deux corrections changent volontairement le bento principal**, la 9 et la
12. Son cadre, lui, n'a pas bougé : différence nulle au pixel entre le bento
principal et l'édition à six cases, sur les deux plateformes.

**Ce qui a été mesuré, et pas seulement regardé :**

- **C-4**, deux bandes dans le rapport 280 / 184, soit 1,522 : 1,524 au
  composer iOS, 1,521 sur la page publique, 1,516 sur Android, moins d'un dp ;
- **C-12**, cadre de boîte : 0 pixel différent sur 326 306 comparés sur iOS,
  0 sur 263 867 sur Android, où l'écart résiduel, 13 sur 255 au plus, colle aux
  ombres des cases remplies ;
- **C-14**, police système au maximum sur iOS et à 2,0 sur Android, pour les
  dispositions à deux et trois cases, page publique comprise ;
- **défaut 9**, reproduit trois fois sur trois à froid avant correction, titre
  haut de 8 px, puis 51 px trois fois sur trois après ;
- **contrôle D**, même processus avant et après, pid 39308 sur iOS et 8914 sur
  Android, pastille présente 4 secondes après le retour au premier plan ;
- **C-15 et C-16**, dans le back-office en session simulée : « Le film qui
  t'a fait pleurer » refusé en case 6, cerclé de rouge, enregistrement
  désactivé ; à 77 % en case 3 d'une édition à trois cases, enregistrable.

**Arbitrages ouverts**, soumis en QCM : la longueur maximale d'un titre
d'édition, que le composer n'affiche entier que jusqu'à 28 caractères environ ;
deux cases au même tampon, indiscernables une fois remplies ; le titre de
l'édition, absent de l'image de partage.

**Vu et laissé en l'état**, faute d'être un défaut du chantier ou d'être
atteignable :

- sur la page d'une édition, la pastille du bento principal porte son slug,
  « MON-BENTO », règle du chantier 16 ;
- « Au menu » propose un item déjà posé dans l'autre case de la même édition ;
- le back-office ne normalise pas l'apostrophe droite en apostrophe
  typographique ;
- une édition à une seule case, possible seulement en SQL, offre une pastille
  dont la boîte refuse de se dessiner, comme §7.3 D l'annonce ;
- la modale de recherche n'a pas de repli quand elle devient l'écran racine,
  ce qui ne s'est vu qu'après un rechargement complet en développement.

Ce qui attend un appareil réel part au chantier 29, §7.3 E.

---

## 9. Livraison

- Une branche `feat/ux-13-bento-hebdomadaire`, une PR, fusionnée après CI
  verte.
- **Aucune migration appliquée en production avant la bascule de §6.2.**
- La sortie store embarque les chantiers 13, 17, 21 et 29 (D7), et n'est
  soumise qu'après recette des quatre.
- Le mode maintenance n'est activé que pour la fenêtre de bascule, minutes et
  non jours.

---

## 10. Definition of Done

**Douze points sur quatorze au 16 septembre 2026, recette parcourue.** Ce qui
reste demande soit un appareil réel, soit un déploiement, et aucun des deux ne
se simule.

| # | Point | État |
| --- | --- | --- |
| 1 | Une édition programmée sort à sa date, sans redéploiement ni nouvelle version | ✅ prouvé en base, contrôles 1 et 2 |
| 2 | Ses cases sont invisibles avant sa sortie, **en base** et non à l'écran | ✅ contrôles 1a et 1b |
| 3 | Deux cases du même type dans une édition, de la saisie à la page publique | ✅ contrôle 3b, plus les tests du back-office |
| 4 | Les dispositions de 2 à 6 cases sont identiques entre les cinq rendus | ✅ 41 tests sur la table, plus le garde-fou de l'aperçu de lien |
| 5 | Le bento principal est inchangé **au pixel** | ✅ pour le web, au bit près : mêmes SHA-256 avant et après. Natif : cadre de boîte identique au pixel entre principal et édition à six cases, iOS et Android (C-12) ; deux corrections de recette changent volontairement le rendu des cases, lot 6 défauts 9 et 12. ⬜ comparaison avant et après sur appareil réel |
| 6 | L'aperçu de lien dessine les bonnes hauteurs, et un test l'empêche de redivergir | ✅ mesuré 233 / 142 / 106 sur un vrai build, quatre tests plus un témoin |
| 7 | Un intitulé qui ne tient pas est refusé avant enregistrement | ✅ vérifié à l'écran : la même question tient en case 1, coupée en case 6 |
| 8 | Une édition passée reste composable après deux suivantes | ✅ « Le duel du samedi », sortie la première, composée et publiée alors que deux éditions plus récentes étaient sorties, iOS et Android |
| 9 | Le plafond permet une édition par semaine pendant des années | ✅ contrôles 7a à 7c, et le plafond ne compte plus que les bentos libres |
| 10 | La première publication d'un compte neuf marche alors que des éditions existent | ✅ contrôle 6, avec son témoin sur l'ancienne forme |
| 11 | Les **20** contrôles de `check-editions.sql` passent sur Supabase local | ✅ base reconstruite de zéro, 20 tenus, 0 manqué |
| 12 | Recette parcourue sur iPhone et Android, appareils réels compris | ✅ simulateur iOS et émulateur Android, seize étapes et contrôle D, lot 6. ⬜ appareils réels, chantier 29 |
| 13 | Aucun compte créé en production, aucune écriture non autorisée | ✅ lectures `GET` seulement, `.app` de production contrôlé et non installé |
| 14 | Les quatre types dormants ont du catalogue | ⬜ préalable du chantier 15 : 446 candidats dans le dépôt, zéro importé |

**Ce que « au pixel » veut dire ici, et ce qu'il ne veut pas dire.** Le web est
prouvé au bit : l'aperçu de lien et le balisage de la boîte sont les mêmes
fichiers avant et après la conversion des cinq rendus. Le rendu natif ne l'est
pas : la table reproduit hauteurs, rotations, gabarits et largeurs à
l'identique, et 41 tests le vérifient, mais aucun écran ne l'a confirmé. La
distinction est maintenue exprès.

---

## 11. Décisions

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | Les cases d'une édition sont des lignes de `bento_categories`, avec `edition_id` nullable | La table est déjà la table des cases depuis le chantier 15. `bento_items` ne bouge pas : PK, FK et trigger de type continuent de valoir, 162 lignes intactes |
| **D2** | Une édition composée est un bento secondaire, `is_primary = false`, rattaché par `edition_id` | Elle hérite de l'adresse, du fil, du partage, du signalement et de l'export, tous construits au chantier 16 |
| **D3** | Rob livre les dispositions 2, 3, 4 et 5 cases en une planche unique, avant le lot 1 | Cinq rendus recopient les mêmes nombres à la main ; c'est ce qui a produit la divergence de §4.5 |
| **D4** | Sortie hebdomadaire, jeudi 18 h de Paris | Le nom du chantier promet la semaine. L'heure ne coûte rien : la visibilité est un filtre de lecture, pas un ordonnanceur |
| **D5** | Les éditions passées restent composables pour toujours | 25 bentos sur 27 n'ont plus rien à faire depuis plus d'une semaine. Après dix éditions, un nouvel arrivant en a dix à composer |
| **D6** | Une case porte un tampon court et un intitulé long ; le back-office refuse un intitulé qui ne tient pas | Mesuré : une case d'une rangée à trois n'accepte pas une question (§4.6) |
| **D7** | La sortie store embarque les chantiers 13, 17, 21 et 29 | Choisi le 16 septembre. Une édition hebdomadaire sans notification n'atteint que ceux qui ouvrent l'app d'eux-mêmes |
| **D8** | À la bascule, `ios_min_version` et `android_min_version` passent à la nouvelle version | Le mécanisme existe depuis le 28 mai et la 1.1 l'honore. Une version ancienne voit « mets à jour » plutôt qu'une page vide |
| **D9** | La divergence de l'aperçu de lien se corrige tout de suite, en PR séparée | Le défaut est en production sur chaque lien partagé, et ce chantier est bloqué plusieurs semaines par les stores |
| **D10** | ~~La migration B est amendée dans son fichier~~ **La migration B n'est pas touchée** | **Corrigée au lot 1.** Les deux défauts vivent dans le corps de `create_bento`, qu'un `create or replace` reprend : l'append-only est préservé, et rien ne diverge si B a déjà été appliquée quelque part |

---

## 12. Suivis

- **Renommer `bento_categories` en `bento_cases`.** Le nom est documenté comme
  historique depuis le chantier 15. Le renommer impose un redéploiement
  coordonné du back-office, seul lecteur, pour zéro gain fonctionnel. À faire
  au prochain chantier qui touche déjà le back-office.
- **`android_latest_version` vaut `0.1.0` en production** : la bannière
  « nouvelle version » ne se déclenche jamais sur Android. À corriger à la
  bascule, avec le plancher de D8.
- **La requête d'adoption du chantier 16 est fausse** : `app_version` a
  déménagé de `public.users` vers `public.user_telemetry`
  (`20260915000000_close_privilege_gaps.sql:53-56`) et un trigger remet la
  colonne d'origine à `null` (ligne 110). La bonne requête lit
  `user_telemetry`, qui n'est pas accessible à la clé anonyme.
- **Le connecteur MCP Supabase est en `needs_auth`**, donc l'adoption ne se
  mesure pas depuis cette session. À reprendre hors remote control.
- **La hauteur 512 et le rayon 18 vivent en dur dans sept endroits** au total
  (§4.4). Le lot 2 en réduit le nombre ; ce qui restera est à lister.
- **Les trois comptes anonymes** créés par erreur le 16 septembre attendent
  toujours la requête de nettoyage, en §11.1 du chantier 16.
- **Une édition liée à une émission** : `editions.show_id` est réservé et non
  lu. Chantier 19.
