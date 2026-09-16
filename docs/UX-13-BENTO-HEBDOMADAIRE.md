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

**Les slugs réservés** ne protègent pas le préfixe des éditions. Si quelqu'un
crée un bento secondaire nommé `semaine-2026-38`, la création de son bento
d'édition échouera sur `bentos_user_slug unique (user_id, slug)`.

Les deux se corrigent dans le fichier de la migration B, qui **n'a jamais été
appliquée ailleurs que sur un Supabase local reconstructible** (D10).

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

**Demande à Rob, avant le premier lot (D3).** Une planche unique, à l'échelle
de référence 361 × 512, donnant pour 2, 3, 4 et 5 cases :

- le nombre de rangées et, pour chacune, sa hauteur et son nombre de cases ;
- la hauteur totale de la boîte quand elle a moins de six cases, si elle
  change ;
- les micro-rotations de chaque case, dans l'esprit de celles du bento
  principal (`BentoGrid.tsx:148-161`).

**Contrainte à lui transmettre, mesurée** : une case d'une rangée à trois
n'accepte pas une question de plus de deux mots courts (§4.6). Les intitulés
longs qui font l'intérêt des éditions supposent des rangées de une ou deux
cases. Une disposition à six cases reste possible, avec des intitulés courts.

**Pourquoi une planche unique et non quatre.** Les cinq rendus recopient
aujourd'hui les mêmes nombres à la main, et c'est exactement ce qui a produit
la divergence de §4.5. La planche devient une table de données unique,
`LAYOUTS[n]`, dans `packages/supabase-mobile`, lue par les cinq.

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

**Trois fichiers, dans cet ordre.**

**`…_bentos_lift_unique.sql`, amendé et non remplacé** (D10). Deux corrections
de §4.10, dans le fichier qui n'a jamais tourné ailleurs qu'en local :

- le plafond de 20 bentos passe à un seuil compatible avec une édition par
  semaine tenue plusieurs années, et distingue les bentos d'édition des bentos
  libres ;
- le préfixe des slugs d'édition rejoint la liste des slugs réservés.

**`…_editions.sql`**, additif et invisible des versions déployées :

```sql
create table public.editions (
  id smallint primary key generated always as identity,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title text not null,
  released_at timestamptz,          -- null = brouillon, jamais visible
  show_id uuid,                     -- réservé au chantier 19, non lu
  created_at timestamptz not null default now()
);

alter table public.bento_categories
  add column edition_id smallint references public.editions(id),
  add column stamp text,
  add column gender char(1) check (gender in ('m','f')),
  add column position smallint;

-- Les six cases du bento principal reçoivent les valeurs de CATEGORY_META.
-- Un test lie les deux sources (§7.2).

alter table public.bentos
  add column edition_id smallint references public.editions(id);

create unique index bentos_one_per_edition
  on public.bentos (user_id, edition_id) where edition_id is not null;
```

**Correctif bloquant, dans le même fichier.** Le contrôle de complétude du
serveur doit ignorer les cases d'édition, sinon toute première publication est
refusée dès la première édition créée :

```sql
-- 20260916180000_publish_first_bento.sql:82, à reprendre
if v_count <> (select count(*) from public.bento_categories
                where is_active and edition_id is null) then
```

**`…_create_edition_bento.sql`** : la fonction `security definer` qui crée le
bento d'une édition pour la personne connectée, refuse une édition non sortie,
refuse un doublon, et dérive le slug de l'édition.

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

Un `check-editions.sql` sur le modèle de `check-bentos-multi.sql` : contrôles
rejouables dans une transaction annulée, avec un **témoin** qui échoue si le
jeu de données ne prouve rien.

Contrôles minimaux :

1. Une édition sans `released_at` est invisible de l'anonyme, ses cases aussi.
2. Une édition sortie est visible, ses cases aussi.
3. Deux cases du même type dans une édition : acceptées, et deux items
   distincts s'y posent.
4. Un item d'un autre type dans une case d'édition : refusé par le trigger.
5. `create_edition_bento` deux fois pour la même personne et la même édition :
   la seconde échoue.
6. La première publication d'un compte neuf reste possible **après** création
   d'une édition : c'est le correctif de §6.1, et sans ce contrôle il passe
   inaperçu.
7. Le plafond de bentos, à la valeur retenue.
8. **Le lien entre la base et l'app** : les `stamp`, `gender` et `position` des
   six cases principales valent exactement `CATEGORY_META` et `CATEGORY_ORDER`.

### 7.3 Recette

Sur simulateur iOS et émulateur Android d'abord, **sur appareil réel ensuite**,
avec le chantier 29 qui solde la dette au passage.

- Le bento principal, identique au pixel avant et après, dans les trois
  rendus. Comparaison A/B par différence d'image, comme au chantier 16.
- Une édition de 2, 3, 4, 5 et 6 cases, composée de bout en bout.
- Un intitulé trop long, refusé dans le back-office, avec sa prévisualisation.
- Une édition programmée, invisible avant l'heure, visible après, **sans
  relancer l'app** : le rafraîchissement au retour au premier plan doit
  suffire.
- Le partage d'un bento d'édition dans deux messageries, et son aperçu de lien.
- Une édition passée composée après la sortie de deux suivantes.
- La plus grande taille de police système, sur les dispositions à 2 et 3
  cases, où les intitulés sont les plus longs.

**Aucune build pointée sur la production.** Le contrôle de cible est fait avant
chaque installation, sur le bundle **et** sur la clé de session dans
AsyncStorage, comme l'exige `RECETTE-MOBILE.md`.

---

## 8. Plan de développement

Sept lots. Le lot 0 est un préalable qui ne nous appartient pas.

### Lot 0 · Préalables, hors développement

- L'équipe importe et relit les 446 candidats des quatre types dormants,
  depuis l'écran Types du back-office (§4.8). DoD restante du chantier 15.
- Rob livre la planche des dispositions 2, 3, 4 et 5 cases (§5.3).
- La PR de correction de l'aperçu de lien est fusionnée (D9).

### Lot 1 · Le modèle et les droits

Les trois migrations de §6.1, l'amendement de la migration B, le correctif de
`publish_first_bento`, et `check-editions.sql` avec ses huit contrôles. Rien de
visible.

### Lot 2 · La table des dispositions, et les cinq rendus

`LAYOUTS` dans `packages/supabase-mobile`, à partir de la planche. Les cinq
rendus la lisent. Le test qui compare les proportions entre rendus. Le bento
principal doit être inchangé au pixel, prouvé par différence d'image.

### Lot 3 · Le back-office des éditions

Créer, décrire les cases, prévisualiser au rendu réel, programmer, dépublier.
La règle d'intitulé, partagée avec l'app.

### Lot 4 · L'app : découvrir et composer une édition

Le sélecteur du composer, la lecture des cases d'édition en base,
`create_edition_bento`, la publication. La modale de recherche paramétrée par
case et non par catégorie.

### Lot 5 · Le public : page, aperçu, fil

La page `/u/<pseudo>/<slug>` d'un bento d'édition, son aperçu, l'étiquette et
le titre dans « La table », l'image de partage.

### Lot 6 · Recette et documents

La recette de §7.3, les pièges ajoutés à `RECETTE-MOBILE.md`, la roadmap, la
DoD.

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

1. Une édition créée et programmée dans le back-office sort à sa date, sans
   redéploiement ni nouvelle version.
2. Ses cases sont invisibles avant sa sortie, vérifié en base et non à l'écran.
3. Deux cases du même type dans une édition fonctionnent, de la saisie à la
   page publique.
4. Les dispositions de 2 à 6 cases sont identiques entre les cinq rendus, à
   l'échelle près, prouvé par test.
5. Le bento principal est inchangé au pixel dans les trois rendus visibles.
6. L'aperçu de lien dessine les bonnes hauteurs de rangée, et un test l'empêche
   de redivergir.
7. Un intitulé qui ne tient pas est refusé dans le back-office, avant
   enregistrement.
8. Une édition passée reste composable après la sortie de deux suivantes.
9. Le plafond de bentos permet une édition par semaine pendant au moins trois
   ans.
10. La première publication d'un compte neuf fonctionne alors que des éditions
    existent.
11. Les huit contrôles de `check-editions.sql` passent sur Supabase local.
12. Recette parcourue sur iPhone et Android, appareils réels compris.
13. Aucun compte créé en production, aucune écriture non autorisée.

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
| **D10** | La migration B est amendée dans son fichier plutôt que corrigée par un fichier de plus | **Valable tant qu'elle n'a pas été appliquée en production.** À réexaminer si ce n'est plus vrai |

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
