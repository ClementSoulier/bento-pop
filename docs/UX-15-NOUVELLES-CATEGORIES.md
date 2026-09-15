# Chantier 15 · Types d'éléments et cases

> Les « nouvelles catégories » de la roadmap produit : jeux vidéo, livres,
> plats, activités.
>
> Spécification écrite le 15 septembre 2026, **réécrite le même jour** après la
> relecture de Clément, qui a déplacé le chantier : il faut séparer le type d'un
> élément de l'intitulé de la case qui l'accueille. Écrite à partir du code de
> `main` (`1f9dbaf`), de mesures en lecture seule sur la production, et d'un
> brouillon de migration éprouvé sur le Supabase local. **Relue et validée le
> 15 septembre** : les quatre points ouverts sont tranchés en §11.2.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md), chantier 15.

---

## 1. Intention

L'équipe a demandé, le 15 septembre 2026 :

> Préparer de nouvelles catégories d'éléments pour les Bento : Jeux-Vidéo,
> Livre, Plats, Activités. Pourquoi pas permettre la création de catégorie
> depuis l'administration ?

La relecture de la première version a posé le vrai sujet, dans les mots de
Clément : « il faut qu'on décorrèle la typologie de case et l'intitulé.
Créateur de contenu = Personne, Artiste musical = Personne, Mangaka =
Personne… Lieu de voyage = Lieu, Lieu de vie = Lieu, Lieu de rêve = Lieu. »

D'où deux notions, que la base confond aujourd'hui :

- **le type** : ce qu'est un élément, et donc le catalogue où l'on cherche.
  Joueur du Grenier est une Personne, Tokyo un Lieu ;
- **la case** : un intitulé, un tampon et un type. « Artiste musical » et
  « Créateur de contenu » sont deux cases de type Personne. L'intitulé est ce
  qu'on lit, le type est où l'on cherche.

Le bento principal est un jeu de six cases. Une édition hebdomadaire du
chantier 13 en sera un autre, de deux à six cases personnalisées.

### 1.1 Le défaut de fond

**`bento_categories` joue deux rôles à la fois.** `items.category_id` y dit ce
qu'est un élément, et `bento_items.category_id` quelle case il occupe. Une
personne est donc « artiste » ou « créateur » pour toujours : Joueur du Grenier
et lesadpanda existent chacun deux fois dans le catalogue, et chercher Squeezie
dans la case Artiste répond aujourd'hui « Queen », mesuré en production.

---

## 2. Objectif et critères de succès

**Objectif.** Qu'un élément ait un type, qu'une case ait un type, et que la
recherche d'une case cherche dans son type, sans casser aucune version publiée
et sans rien changer au bento principal à l'écran.

**Critères.**

1. **Les versions publiées marchent sans mise à jour** : leur parcours complet,
   rejoué par `check-privileges.ts`, reste vert.
2. **Le bento principal ne change pas à l'écran** : intitulés, tampons, grille,
   page publique, image de partage, vérifié au pixel (§8.4).
3. **La recherche d'une case cherche dans son type** : dans la case Artiste,
   on trouve aussi les créateurs, et inversement. C'est le seul changement
   visible. Il est assumé plutôt que voulu : aux utilisateurs de jouer le jeu
   et de remplir correctement leurs cases (D11).
4. **Une case n'accepte que son type**, en base.
5. **Les neuf types existent**, les quatre nouveaux inactifs, chacun avec au
   moins **50 items validés**, saisis en interne.
6. **Le back-office crée un type** sans nouvelle version de l'app, et **aucun
   client n'écrit un type ni une case**.
7. **Les doublons de Personne sont fusionnés.**

---

## 3. Périmètre

**Dans le chantier.**

- La table `item_types`, et un type sur chaque item et sur chaque case du bento
  principal.
- Les trois fonctions de recherche, qui passent de la catégorie au type.
- Le contrôle qu'une case n'accepte que son type.
- Le back-office : un écran « Types », le catalogue rangé par type, la
  validation des brouillons par lot, la fusion des doublons.
- Les catalogues de départ des quatre nouveaux types, saisis en interne.

**Hors du chantier.**

- Les cases personnalisées des éditions hebdomadaires, avec leur intitulé et
  leur tampon (chantier 13), et plusieurs bentos par compte (chantier 16).
- L'app : elle ne lit rien de nouveau. Les six cases du bento principal restent
  ses constantes, et elle profite de la recherche par type sans être modifiée
  (§4.2).
- La landing, qui ne montre que des bentos principaux.
- **Toute source externe de données.** Le catalogue se remplit en interne ;
  seules les images peuvent venir de dehors, avec leur crédit (D9).

---

## 4. Ce que disent le code et la base

### 4.1 Une table, deux rôles

```sql
create table public.bento_categories (
  id smallint primary key generated always as identity,
  key text not null unique,
  label_fr text not null,
  display_order int not null default 0,
  api_source text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
```

- `items.category_id` la référence (`initial_schema.sql`, table `items`) :
  **le type**.
- `bento_items` a pour clé `(bento_id, category_id)` (`:112`) : **la case**.
- `search_items`, `find_similar_items` et `popular_items` retrouvent la
  catégorie par sa clé, active, puis filtrent `i.category_id`.

### 4.2 Ce que lisent et écrivent les versions publiées

Relevé sur `main` et sur `6426779`, le commit de la 0.1.0 du Play Store :

- **Lecture** : l'app ne lit que `bento_items.category_id`, la case
  (`feed.ts:57`, `public-bento.ts:46`, `state/session.ts:150`,
  `u/[pseudo].tsx:68` à la 0.1.0). **Jamais `items.category_id`.**
- **Écriture** : `items.category_id` à la proposition d'un item
  (`items.ts:112`), et `bento_items.category_id` en remplissant une case
  (`bento-actions.ts:45`).
- **Recherche** : les trois fonctions prennent une **clé de case** et rendent
  des items, sans leur catégorie.

Conséquences, qui tiennent tout le design :

- les six cases du bento principal peuvent **rester les lignes de
  `bento_categories`**, avec leurs identifiants : rien ne change pour les clients ;
- `items.category_id` peut devenir **facultatif**, un livre n'ayant pas de case
  dans le bento principal : aucun client ne le lit ;
- une fonction de recherche qui résout **case vers type** change le résultat de
  toutes les versions publiées d'un coup, **sans mise à jour**.

### 4.3 Le catalogue, relevé le 15 septembre

| Catégorie aujourd'hui | Items validés | Type |
|---|---|---|
| Film | 53 | Film |
| Série | 43 | Série |
| Artiste | 48 | **Personne** |
| Chanson | 54 | Chanson |
| Créateur de contenu | 39 | **Personne** |
| Lieu | 40 | Lieu |

- **85 Personnes** une fois réunis artistes et créateurs : deux noms existent
  des deux côtés, « lesadpanda » et « Joueur du Grenier ».
- **Aucun des 27 bentos publiés** n'a le même nom dans ses cases Artiste et
  Créateur.
- **Sur les 162 cases publiées, aucune** ne porte un item d'une autre catégorie
  que la sienne : le contrôle du critère 4 ne casse rien d'existant.
- 130 des 277 items validés viennent des propositions ; 72 n'ont pas d'image.
- **Aucun écran ne valide un brouillon** : le back-office ne valide que les
  items en attente (`catalogue/page.tsx:45`).

### 4.4 Ce qui ne bouge pas

- **Les 36 fichiers qui citent les six clés** citent en fait les six cases du
  bento principal, qui ne changent pas (D8). Ils n'ont pas à être repris dans
  ce chantier.
- **Les intitulés affichés** restent ceux de l'app : Artiste, Lieu. Ceux de la
  base, « Artiste musical » et « Lieu de voyage », sont des intitulés longs,
  pour le back-office.
- **Il n'existe aucune couleur par catégorie** : la palette d'une tuile dépend
  de l'item (D4).

---

## 5. Design

### 5.1 Le modèle

| Notion | Où | Porte |
|---|---|---|
| **Type** | `item_types`, nouvelle | clé, libellé, ordre, actif |
| **Item** | `items` | **un type**, obligatoire ; sa case d'origine, facultative |
| **Case du bento principal** | `bento_categories`, les six lignes actuelles | **un type** ; son intitulé et son tampon restent dans l'app (D8) |
| **Case d'une édition** | chantier 13 | intitulé, tampon, genre grammatical, type |

Le tampon et l'intitulé appartiennent à la case (D7) : c'est ce qui permettra
une case « Mangaka » de type Personne, avec son propre tampon.

### 5.2 Les six cases et leur type

| Case | Type |
|---|---|
| `film` | Film |
| `series` | Série |
| `artist` | **Personne** |
| `track` | Chanson |
| `creator` | **Personne** |
| `place` | Lieu |

### 5.3 La recherche par type

Les trois fonctions gardent leur signature, `category_key` compris, parce que
les versions publiées les appellent ainsi. Seule leur première étape change :
la clé désigne une case, dont on prend le type.

Ce que ça change, mesuré sur le brouillon local :

- chercher Squeezie dans la case Artiste le trouve ;
- « Au menu » de la case Artiste propose aussi les créateurs ;
- une personne additionne ses choix, qu'elle ait été posée comme artiste ou
  comme créateur ;
- la case Film ne trouve toujours que des films.

### 5.4 Une case n'accepte que son type

Un trigger sur `bento_items` refuse un item dont le type n'est pas celui de la
case : « Cet item n'est pas du type de la case. » Mesuré sur le brouillon : un
film est refusé dans la case Lieu, une Personne acceptée dans la case Artiste.
Il protège aussi la fusion : `admin_merge_items` ne peut pas reporter un film
dans une case Personne.

**L'autre porte est fermée aussi**, ajouté en écrivant le lot 0 : changer le
type d'un item déjà posé dans une case d'un autre type est refusé, « Cet item
est posé dans une case d'un autre type. » Le catalogue en aura besoin, des
items ont été proposés dans la mauvaise case : « Arcane », une série, et
« Glitch Productions », un studio, sont rangés en créateurs, donc Personnes
après la migration. Les retyper passera par le back-office (lot 1), après les
avoir retirés des bentos qui les portent ou fusionnés.

### 5.5 Le type d'un item suit sa case

Un trigger sur `items` pose le type à partir de la case quand l'item en a une.
Deux effets : une proposition envoyée par une version publiée, qui ne connaît
que la case, reçoit son type ; et un client ne peut pas annoncer un autre type
que celui de la case, mesuré. Un item sans case, un livre créé dans le
back-office par exemple, garde le type qu'on lui donne.

### 5.6 Le back-office

- **Écran « Types »** : liste, avec le nombre d'items validés, en attente et en
  brouillon ; création (clé, libellé, ordre) ; activation. Aucun type ne se
  supprime, ses items le référencent.
- **Catalogue** : filtres et fiches par type, au lieu du `z.enum` des six clés
  (`catalogue/[id]/actions.ts:34`) et de la liste figée
  (`CatalogueClient.tsx:77-84`).
- **Validation des brouillons par lot**, qui manque aujourd'hui.
- **Fusion des deux doublons** de Personne, par `admin_merge_items`, relue.

### 5.7 Les catalogues de départ, en interne

- **Aucun appel à une API externe** (D9). Les listes sont préparées dans le
  dépôt, un fichier par type, et importées en brouillon par le back-office.
- **Environ cent candidats par type**, pour atteindre 50 validés après relecture
  par l'équipe.
- **Des champs sobres** : titre, et un sous-titre seulement quand il est sûr
  (l'auteur d'un livre, le studio d'un jeu). Une année douteuse est pire qu'une
  année absente.
- **Les images viennent après, et à part** : piochées à la main quand elles
  sont libres ou autorisées, avec leur crédit, par les outils d'illustration
  existants. Un item sans image est un cas normal, 72 aujourd'hui.

---

## 6. Contrat de données

### 6.1 La migration, en résumé

Éprouvée en brouillon sur le Supabase local, le 15 septembre : elle s'applique
sans erreur, les 42 contrôles de `check-privileges.ts` restent verts et les 15
contrôles du modèle passent.

```sql
-- Les types, lisibles quand ils sont actifs, écrits par le seul back-office.
create table public.item_types (
  id smallint primary key generated always as identity,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{2,19}$'),
  label_fr text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.item_types enable row level security;
create policy "item_types_read_active" on public.item_types
  for select using (is_active = true);
revoke insert, update, delete on public.item_types from anon, authenticated;

insert into public.item_types (key, label_fr, display_order, is_active) values
  ('film', 'Film', 1, true), ('series', 'Série', 2, true),
  ('person', 'Personne', 3, true), ('song', 'Chanson', 4, true),
  ('place', 'Lieu', 5, true),
  ('video_game', 'Jeu vidéo', 6, false), ('book', 'Livre', 7, false),
  ('dish', 'Plat', 8, false), ('activity', 'Activité', 9, false);

-- Chaque case du bento principal a un type.
alter table public.bento_categories
  add column type_id smallint references public.item_types(id);
-- film → film, series → series, artist → person, track → song,
-- creator → person, place → place ; puis `set not null`.
revoke insert, update, delete on public.bento_categories from anon, authenticated;

-- Chaque item a un type ; la case devient facultative.
alter table public.items add column type_id smallint references public.item_types(id);
-- reprise depuis la case, puis `set not null`
alter table public.items alter column category_id drop not null;
create index items_type_status_idx on public.items (type_id, status);
```

Plus les deux triggers de §5.4 et §5.5, et les trois fonctions de recherche,
dont seule la première étape change :

```sql
with cat as (
  select c.type_id
  from public.bento_categories c
  join public.item_types t on t.id = c.type_id and t.is_active = true
  where c.key = category_key and c.is_active = true
  limit 1
)
-- … where i.type_id = (select type_id from cat)
```

La migration définitive portera les commentaires et les requêtes de contrôle,
comme celle du 15 septembre sur les privilèges.

### 6.2 Les types TypeScript

`packages/supabase-mobile/src/types.ts` gagne `item_types`, `items.type_id`,
`bento_categories.type_id`, et `items.category_id` devient `number | null`.
`CategoryKey` et les constantes de `bento.ts` ne bougent pas : elles décrivent
les six cases du bento principal.

---

## 7. Sécurité et conformité

- **Types et cases** : écrits par le seul back-office, en service-role.
  Retrait des privilèges d'écriture des clients, vérifié.
- **Types inactifs** : invisibles des clients.
- **Propositions** : toujours modérées, et typées par leur case.
- **Images** : crédit systématique, aucune image sans droit de réutilisation.

---

## 8. Stratégie de test et QA

### 8.1 Tests unitaires, `node:test` + `tsx`

- Le back-office : validation d'un type (clé, libellé), filtres du catalogue
  par type, validation par lot des brouillons.

### 8.2 Contre le Supabase local

- `check-privileges.ts` reste vert : c'est la preuve que les versions publiées
  ne cassent pas.
- **Nouveau `scripts/check-types.ts`**, 18 contrôles : neuf types dont quatre
  inactifs, types des six cases, recherche, « Au menu » et anti-doublon par
  type, proposition typée par sa case, type imposé par la case, refus d'un item
  d'un autre type, écriture des types et des cases refusée aux clients, fusion
  de deux Personnes, livre créé sans case, retypage d'un item posé refusé, et
  permis pour un item jamais posé.

### 8.3 Contre la production, après application

Lecture seule à la clé anonyme : types actifs visibles, inactifs non ;
recherche de la case Artiste qui trouve un créateur connu. Pas de sonde
d'écriture sans nouvel arbitrage.

### 8.4 Recette, bloquante

- **Non-régression au pixel** du composer vide, de la modale de recherche de
  chaque case, d'un bento complet, de « Trouver » et de l'image de partage, sur
  un iPhone et l'émulateur Android.
- **La recherche élargie, vue sur appareil** : Squeezie proposé dans la case
  Artiste, un artiste dans la case Créateur.

---

## 9. Plan de développement

### Lot 0 · La migration

Types, types des cases et des items, triggers, recherche par type, privilèges.
`check-types.ts`. Application en production par le SQL editor, puis lecture
seule (§8.3).

> **Écrit et vérifié le 15 septembre 2026**, pas encore appliqué.
> `20260915100000_item_types_and_cases.sql`, appliquée sur une base locale
> remise à zéro : `check-privileges.ts` 42 sur 42, donc aucune version publiée
> cassée, et `check-types.ts` 18 sur 18. Les requêtes de contrôle du fichier
> rendent l'attendu. Les types TypeScript suivent (`items.category_id`
> facultatif, `type_id`, `item_types`), et six lectures du back-office sont
> rendues sûres pour un item sans case, sans autre changement de comportement.
> 374 tests de l'app et 39 du back-office verts, typage et lint verts partout.

### Lot 1 · Le back-office

Écran « Types », catalogue par type, validation des brouillons par lot, fusion
des deux doublons.

### Lot 2 · Les catalogues de départ

Une liste d'environ cent candidats par nouveau type, importée en brouillon,
relue par l'équipe jusqu'à 50 validés.

### Lot 3 · Recette et mesures

§8.4, puis Definition of Done.

**Livraison.** Rien côté app : la migration change la recherche de toutes les
versions d'un coup, et le back-office part sur Coolify.

---

## 10. Definition of Done

- [ ] Les versions publiées passent `check-privileges.ts` sans échec
- [ ] `check-types.ts` passe entièrement sur le Supabase local
- [ ] La recherche d'une case cherche dans son type, vérifié en production en
      lecture seule
- [ ] Une case refuse un item d'un autre type
- [ ] Le back-office crée et active un type, et valide des brouillons par lot
- [ ] Les deux doublons de Personne sont fusionnés
- [ ] Les quatre nouveaux types ont chacun au moins 50 items validés
- [ ] Recette au pixel du bento principal sur iPhone et Android
- [ ] Tests, typage et lint verts sur l'app, le back-office, la landing et le
      package

---

## 11. Décisions

### 11.1 Tranchées le 15 septembre

| # | Décision | Pourquoi |
|---|---|---|
| D1 | Les nouveaux types servent les éditions hebdomadaires ; le bento principal garde ses six cases | 27 bentos publiés, une grille et trois rendus construits sur six cases |
| D2 | Le chantier 15 reste en tête, sans rien de visible avant le 13, hors recherche élargie | le 13 a besoin de types pour ses cases |
| D3 | Le back-office crée des types | l'équipe ne dépend pas d'un développeur pour un nouveau type |
| D4 | Pas de couleur par type ni par case | mesuré : la palette d'une tuile dépend de l'item |
| D5 | **Le type d'un élément est séparé de l'intitulé de la case** | Clément : « Créateur de contenu = Personne, Artiste musical = Personne, Mangaka = Personne » |
| D6 | **Neuf types au départ**, d'autres créables plus tard | Film, Série, Chanson, Personne, Lieu, Jeu vidéo, Livre, Plat, Activité |
| D7 | **Le tampon appartient à la case** | « C'est comme ça qu'on pourra faire des Bento avec des cases personnalisées » |
| D8 | **Les intitulés du bento principal restent inchangés à l'écran** | aucun changement visible |
| D9 | **Catalogue interne uniquement, sans appel d'API externe** ; seules les images peuvent venir de dehors | « on se source uniquement en interne par saisie et on enrichit notre catalogue » |

### 11.2 Tranchées en relecture, le 15 septembre

| # | Décision | Pourquoi |
|---|---|---|
| D10 | **Clés et libellés des neuf types validés** : `film` Film, `series` Série, `person` Personne, `song` Chanson, `place` Lieu, `video_game` Jeu vidéo, `book` Livre, `dish` Plat, `activity` Activité | les clés ne changeront plus ; les libellés restent modifiables dans le back-office |
| D11 | **La recherche élargie est assumée** : « Au menu » de la case Artiste propose aussi les créateurs, et inversement | Clément : « c'est pas que c'est voulu mais c'est assumé. On laisse ce côté permissif, après aux utilisateurs de jouer le jeu et de remplir correctement leurs Bento » |
| D12 | **Contrôle strict en base** : une case refuse un item d'un autre type | « si un item est de type Lieu il ne doit jamais se retrouver dans une case film, ça c'est sûr à 100 % » ; aucune des 162 cases publiées ne l'enfreint |
| D13 | **Listes de départ grand public, au goût Bento Pop** | des classiques et des récents que cite la communauté pop culture, en français, titre et sous-titre sûr seulement ; l'équipe coche et ajoute ses incontournables |

---

## 12. Suivis prévus

- **Chantier 13** : les cases d'une édition portent intitulé, tampon, genre
  grammatical et type, et la recherche prendra une clé de type. La nouvelle
  fonction naîtra avec lui.
- **Chantier 16** : `bento_items` indexé par case et non plus par catégorie
  reste nécessaire pour qu'une édition ait deux cases du même type.
- **Chantier 19** : les mentions d'un épisode ont déjà les types `game` et
  `book` (`apps/admin/src/lib/episodes/schemas.ts:14`), un pont possible vers
  les items de ces types.
- **Crédits de l'app** : à compléter des sources d'images réellement utilisées,
  au plus tard à l'activation d'un type.
