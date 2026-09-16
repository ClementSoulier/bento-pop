# Chantiers 16 et 9 · Plusieurs bentos par compte, et le pseudo au moment de publier

> Spécification écrite le 16 septembre 2026, à partir du code de `main`
> (`795871d`), d'un Supabase local construit depuis les migrations du dépôt, de
> relevés sur simulateur iPhone 17 Pro, et de lectures `GET` sur la production
> avec la clé anonyme.
>
> Les deux chantiers sont planifiés ensemble depuis le 15 septembre : ils
> touchent la même entrée du composer et le même moment de publier.
>
> **Arbitrages rendus le 16 septembre 2026**, les neuf de §11. En résumé : le 16
> fait la place et le 13 fera les éditions ; le code part avant la migration ;
> `/u/<pseudo>` devient une page de profil dont le contenu principal reste le
> bento principal, donc aucun lien en circulation ne change de contenu ; le
> chantier 9 passe par un brouillon local ; tout se livre en une seule PR.
>

> **Incident de méthode, consigné ici parce qu'il a coûté des comptes.** En
> réinstallant l'app sur le simulateur, le fichier `apps/mobile/MonBentoPop.app`
> du dépôt a écrasé le dev client pointé sur le proxy lecture seule. Ce fichier
> est une build EAS de canal `preview`, version 0.0.1, datée du 12 mai 2026,
> avec les mises à jour OTA activées : elle ignore Metro et vise la production.
> Trois lancements ont donc fait trois `signInAnonymously` sur le projet de
> production, dont un confirmé par son jeton stocké
> (`465f0ad6-f48a-4bf3-8905-5e57bd250782`, `is_anonymous: true`,
> `2026-09-16T05:41:55Z`). Aucun n'a de ligne dans `public.users`. La requête de
> nettoyage est en §11.1, à exécuter par Clément (D9). **Le contrôle qui aurait
> évité cela était déjà écrit dans `RECETTE-MOBILE.md` et n'a pas été fait**
> (§7.4).
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md), chantiers 16 et 9, et
> [le chantier 5](./UX-05-BROUILLON-PUBLIE.md) pour le modèle brouillon-publié.

---

## 1. Intention

### 1.1 Ce que la contrainte garantit en silence

La roadmap résume le chantier 16 en une ligne : « Lever la contrainte tient en
une ligne ; ce qu'elle garantit en silence, non. » La mesure donne à cette
phrase un contenu précis, et un ordre de grandeur plus grand que prévu.

`bentos.user_id` porte un `unique` inline
(`apps/mobile/supabase/migrations/20260511000000_initial_schema.sql:88`). De là
découlent trois garanties que personne n'a écrites et que tout le code utilise :

1. **un pseudo vaut une adresse**, parce que `users_pseudo_lower_idx` rend le
   pseudo unique et que `bentos.user_id` rend le bento unique. `/u/<pseudo>`
   désigne donc un objet et un seul ;
2. **PostgREST expose la relation en un-à-un**, donc `users.bentos` revient en
   objet, pas en tableau. La page publique de l'app le dit explicitement
   (`apps/mobile/src/lib/public-bento.ts:35-37`) ;
3. **`maybeSingle()` est un raccourci légitime** partout où l'on cherche « le »
   bento d'un compte, ce que fait `ensureBento`
   (`apps/mobile/src/lib/bento-actions.ts:13-17`).

### 1.2 Le constat qui commande tout le reste

**L'index unique partiel ne suffit pas.** La migration évidente consiste à
remplacer `unique (user_id)` par un index unique partiel, du genre « un seul
bento principal par compte ». Mesuré sur le Supabase local (§4.3) : dès que la
contrainte devient partielle, **PostgREST rend `bentos` en tableau, alors même
qu'aucun compte n'a deux bentos**. La page publique affiche « rien en ligne »
pour tout le monde, le jour de la migration, sans qu'un seul deuxième bento
existe.

La conséquence est structurante : **la levée de la contrainte ne peut pas
précéder le code qui la rend inoffensive.** C'est ce qui décide l'ordre de tout
le chantier, et c'est l'arbitrage D3.

**Mais seule la levée est dangereuse.** Mesuré en écrivant le lot 1 : une
migration qui n'ajoute que des colonnes laisse `bentos_user_id_key` en place,
donc la relation reste un un-à-un et les apps en circulation ne voient
strictement rien. D'où deux migrations et non une (§6.1), la première sans
aucun risque et la seconde seule soumise à un calendrier.

Reste à écrire une lecture qui traverse la bascule. Deux formes ont été
mesurées (§4.3, mesures 4 et 5), et **c'est la jointure externe qui l'emporte** :
partir de `bentos` pour remonter vers `users` aurait été insensible à la
contrainte, mais aurait rendu zéro ligne aussi bien pour un pseudo inconnu que
pour un pseudo sans rien en ligne, perdant la distinction que le chantier 7
avait gagnée en une seule requête. La jointure est donc gardée, la réponse est
normalisée en liste, et **le bento est choisi explicitement** sur `is_primary`
ou sur le slug demandé (§5.2). Trois lignes de normalisation, pas une béquille :
elles restent justes des deux côtés de la migration.

### 1.3 Pourquoi le 9 vient avec le 16

Le chantier 9 déplace la demande de pseudo à l'instant de publier. Le chantier
16 fait de la publication un geste par bento. Les deux réécrivent le même
chemin : entrée dans le composer, création du profil, création du bento,
publication.

Et la mesure donne au 9 son chiffre : **34 comptes sur 61, soit 56 %, portent
un pseudo unique et n'ont jamais rien publié** (§4.2). Le pseudo est exigé à
l'écran 3 sur 4, avant que quiconque ait vu une case remplie.

### 1.4 La règle qui tient le chantier

**Plus aucune requête ne demande « le » bento d'un compte.** Chaque lecture,
chaque écriture, chaque lien et chaque compteur nomme un bento par son
identifiant, ou dit explicitement qu'il veut le principal. Un test de source
échoue sur tout `eq('user_id', …)` visant `bentos` qui ne nomme pas lequel.

---

## 2. Objectif et critères de succès

**Objectif.** Un compte peut porter plusieurs bentos, chacun à son adresse,
sans qu'aucun lien déjà partagé change de destination ; et un nouveau venu
remplit sa première case avant qu'on lui demande un pseudo.

| # | Critère | Mesure |
|---|---|---|
| 1 | Aucun lien en circulation ne change de contenu | `/u/<pseudo>` montre toujours le bento principal en entier, même titre et même image d'aperçu, sur les 27 pseudos publiés |
| 2 | Un deuxième bento est adressable | `/u/<pseudo>/<slug>` répond 200, dans l'app et sur le web, et l'ouverture par lien universel arrive sur le bon bento |
| 3 | Aucune requête ne devine | zéro `maybeSingle()` sur `bentos` filtré par `user_id` dans le dépôt, garde-fou de test |
| 4 | Les compteurs comptent des gens | `shared_items` et l'entonnoir du back-office ne bougent pas quand un compte porte deux bentos avec les mêmes items |
| 5 | La modération vise ce qui a été signalé | `reports.target_bento_id` renseigné à 100 % des signalements de bento |
| 6 | Le pseudo arrive tard | un nouveau venu remplit les six cases sans avoir choisi de pseudo, et la conformité CGU reste avant toute contribution publique |
| 7 | Rien ne régresse | les 432 tests existants passent, plus les nouveaux |

---

## 3. Périmètre

**Dans le périmètre.**

- La base : schéma `bentos`, index, droits colonne, policies, fonctions
  `search_bentos`, `shared_items`, `popular_items`, déclencheur de purge.
- L'app mobile : `ensureBento` et tous ses appelants, le store `useBento`, la
  page publique, le partage, la recherche, le fil, le profil, l'export RGPD,
  le signalement.
- La landing : `firstBento`, la route `/u/[pseudo]`, l'image d'aperçu, le
  sitemap, le lien profond, le lien de signalement.
- Le back-office : l'entonnoir, la liste des comptes, la liste des bentos, la
  modération, la création de profil éditorial.
- L'onboarding : les quatre écrans, le couplage `terms_accepted_at`, le
  brouillon avant compte.

**Hors périmètre, et pourquoi.**

- **Le système d'éditions hebdomadaires** (chantier 13) : titre, cases nommées,
  date de sortie, programmation. Le 13 dépend du 16, pas l'inverse.
- **Les grilles de 2 à 5 cases** (chantier 13) : elles demandent un dessin de
  la direction artistique avant tout développement.
- **Le profil listant tous les bentos d'un compte** (chantier 21).
- **La recherche « match » par bento** (chantier 20).
- **Le « claim » de compte** (chantier 28).

### 3.1 Une incohérence de la roadmap, et sa résolution

Le « Fait quand » du chantier 16 dit : « un compte publie son bento principal
**et un bento hebdomadaire** ». Or le bento hebdomadaire est le chantier 13,
qui **dépend du 16**. Le critère du 16 ne peut donc pas être atteint sans le
13 : la dépendance est circulaire.

**Tranché (D1).** Le critère du 16 devient « un compte porte deux bentos
publiés, chacun à son adresse, et tous les liens déjà partagés montrent toujours
le principal », le deuxième bento étant créé **depuis le back-office**, qui sait
déjà créer un bento éditorial. Le 13 ajoute ensuite la programmation et la
boucle hebdomadaire côté app. La roadmap sera corrigée en conséquence.

---

## 4. Ce que disent le code, la base et les appareils

### 4.1 Méthode

- **Production, lecture seule.** Uniquement des `GET` PostgREST avec la clé
  anonyme, et des `GET` HTTP sur `bento-pop.com`. Aucun `POST`, `PATCH` ni
  `DELETE`. La clé anonyme ne voit que la surface publiée : les brouillons
  restent invisibles, les chiffres correspondants viennent du chantier 5.
- **Supabase local** (`supabase_db_bento-pop-mobile`, API sur 54331) pour
  éprouver la migration et les droits : contrainte retirée, index partiel posé,
  deuxième bento inséré, mesures, puis schéma rétabli et vérifié.
- **Simulateur iPhone 17 Pro**, dev client reconstruit depuis le worktree et
  pointé sur le proxy lecture seule. Cible vérifiée **dans le conteneur de
  l'app** : la clé `sb-127-auth-token` d'AsyncStorage prouve que le client vise
  `127.0.0.1`, pas la production (§7.4).
- Arbre d'accessibilité lu avec `idb ui describe-all`, coordonnées en points.

### 4.2 Les données de production, le 16 septembre 2026

Clé anonyme, donc surface publiée seulement.

| | |
|---|---|
| Comptes | **61** |
| dont portant un pseudo | **61**, soit 100 % |
| Bentos publiés visibles | **27** |
| Comptes ayant publié | **27** |
| **Comptes avec pseudo et sans rien de publié** | **34**, soit **56 %** |
| Cases publiées | 162 |
| Items au catalogue | 277 |
| Bentos mis en avant | 3 |

Et sur les 27 bentos publiés :

| | |
|---|---|
| Bentos par compte | **1**, pour les 27 |
| Cases par bento | **6 sur 6**, pour les 27 |
| Couples (bento, catégorie) en double | **0** |
| Même item dans deux cases d'un même bento | **0** |

**Délai entre la création du compte et la publication** (27 bentos) : médiane
**2 h 22**, minimum 3 min 33, maximum 75 jours. **13 sur 27 publient dans
l'heure**, 16 sur 27 dans la journée. Autrement dit : qui publie, publie vite ;
et 34 comptes ne publient jamais.

Deux relevés annexes :

- **59 comptes sur 61 portent `terms_accepted_at`.** Les deux sans datent des
  14 et 15 mai 2026, avant la migration `20260515000000_users_terms_accepted_at`.
- **`last_seen_at`, `display_name` et `platform` reviennent nuls** pour les 61
  lignes lues à la clé anonyme. L'analyse du retour après première visite n'est
  donc pas faisable en lecture seule.

Pour mémoire, mesuré au chantier 5 le 13 septembre avec la clé service-role :
58 bentos, dont 26 publiés et **32 brouillons**. La clé anonyme ne les voit
pas, mais ils existent : presque chaque compte a déjà une ligne `bentos`, créée
paresseusement par `ensureBento` à la première case remplie.

### 4.3 La contrainte, éprouvée sur le Supabase local

Le schéma, tel qu'il est
(`apps/mobile/supabase/migrations/20260511000000_initial_schema.sql:86-94`) :

```sql
create table public.bentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  is_featured boolean not null default false,
  featured_order int,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Pas de titre, pas de slug, pas de type, pas d'ordre. **Rien ne permettrait
aujourd'hui de distinguer deux bentos d'un même compte**, ni en base, ni dans
les types (`packages/supabase-mobile/src/types.ts:237-262`).

Trois mesures, dans cet ordre.

**Mesure 1, état actuel.** Un compte, un bento publié.

| Requête | Résultat |
|---|---|
| `users?select=pseudo,bentos(id,published_at)` | `bentos` est un **objet** |
| `bentos?user_id=eq.<id>` avec `Accept: …object+json` | **200**, un objet |

**Mesure 2, contrainte retirée et deuxième bento inséré.**

| Requête | Résultat |
|---|---|
| `users?select=pseudo,bentos(…)` | `bentos` est un **tableau de 2** |
| `bentos?user_id=eq.<id>` avec `Accept: …object+json` | **406**, `PGRST116`, « The result contains 2 rows » |
| `users?…&bentos.published_at=not.is.null` | tableau de 2, le filtre imbriqué n'élague pas |

**Mesure 3, la décisive. Index unique partiel seul, un seul bento en base.**

```sql
alter table public.bentos drop constraint bentos_user_id_key;
create unique index bentos_one_principal on public.bentos (user_id) where slug is null;
```

| Requête | Résultat |
|---|---|
| `users?select=pseudo,bentos(…)` | **`bentos` est déjà un tableau** |
| `bentos?user_id=eq.<id>` avec `Accept: …object+json` | 200, tant qu'il n'y a qu'une ligne |

PostgREST ne détecte la relation un-à-un que sur une contrainte unique
**totale**. Un index partiel ne compte pas. **Le jour de la migration, sans
qu'aucun deuxième bento existe, `mapPublicBento` lit `.published_at` sur un
tableau, obtient `undefined`, et rend « rien en ligne » pour les 27 bentos
publiés** (`apps/mobile/src/lib/public-bento.ts:113-115`). Côté web, `firstBento`
absorbe le tableau (`apps/landing/src/lib/bento/queries.ts:89-92`), donc la
landing survit ; l'app, non.

**Mesure 4, la sortie.** La même lecture, écrite dans l'autre sens : partir de
`bentos`, remonter vers `users` par la clé étrangère, filtrer explicitement.

```
GET /rest/v1/bentos?select=id,published_at,users!inner(pseudo,display_name),
    bento_items(category_id,items(title))
    &published_at=not.is.null&users.pseudo=ilike.<pseudo>&limit=1
```

| État du schéma | Résultat |
|---|---|
| Contrainte unique totale, état actuel | `users` en **objet**, 6 cases, id attendu |
| Contrainte retirée, index partiel | `users` en **objet**, 6 cases, **id identique** |
| Deux bentos, filtre `slug=is.null` | une seule ligne, le principal |

**La relation `bentos` vers `users` est un plusieurs-vers-un porté par une clé
étrangère : la contrainte unique sur `user_id` ne la concerne pas.** Cette
requête traverse donc la migration sans rien changer.

**Mesure 5, et c'est elle qui décide.** La requête renversée perd quelque
chose : un pseudo inconnu et un pseudo sans rien en ligne rendent tous deux
zéro ligne. La distinction que le chantier 7 avait gagnée en une seule requête
demanderait une seconde lecture. La jointure externe, elle, la garde, et le
filtre imbriqué suffit à tout le reste :

| Requête, après migration A | Résultat |
|---|---|
| `users?select=pseudo,bentos(…)` d'un compte à 1 bento | `bentos` en **objet** |
| le même, après migration B | `bentos` en **tableau de 1** |
| compte existant sans rien en ligne | `[{pseudo, bentos: null}]`, **la distinction tient** |
| pseudo inconnu | `[]` |
| deux bentos publiés | tableau de 2, **ce dont la page de compte a besoin** |
| `&bentos.is_primary=eq.true` | élague à 1 |
| `&bentos.slug=eq.hebdo-38` | élague à 1 |

La jointure est donc gardée, et le tableau absorbé par trois lignes. Le choix
du bento, lui, devient explicite : c'est tout l'objet de §5.2.

**Ce qui casse, et ce qui ne casse pas.** `ensureBento` ne casse pas au moment
de la migration : `maybeSingle()` tolère 0 ou 1 ligne. Il casse le jour où un
compte en a deux, et il casse mal :

```ts
const { data: existing } = await supabase
  .from('bentos').select('id').eq('user_id', userId).maybeSingle();
if (existing) return existing.id;
```

L'erreur n'est pas déstructurée (`apps/mobile/src/lib/bento-actions.ts:13-17`).
Avec deux bentos, la lecture répond 406, `existing` vaut `undefined`, et la
fonction **insère un bento de plus**. Sans la contrainte, l'insertion réussit.
**Chaque case remplie ajouterait un bento.** Six cases, six bentos.

**Les droits colonne, que la roadmap ne mentionne pas.** Relevé sur le local :

| Rôle | Privilège | Colonnes |
|---|---|---|
| `authenticated` | `INSERT` | **`user_id` seulement** |
| `authenticated` | `UPDATE` | **`published_at` seulement** |

(`20260915000000_close_privilege_gaps.sql:225-226` et
`20260913200000_bentos_column_privileges.sql:34,39`.)

Conséquence directe : **toute nouvelle colonne, `slug`, `kind` ou `edition_id`,
est hors de portée du client.** Un `grant insert (slug)` laisserait n'importe
qui choisir l'adresse d'un de ses bentos, y compris une adresse qui ressemble à
une route du site. La création d'un bento non principal passe donc par une
fonction `security definer`, pas par un `insert` client. C'est le point D4.

**Les policies ne limitent rien.** `bentos_insert_own` vérifie seulement
`user_id = auth.uid()` (`initial_schema.sql:171-175`). Le plafond d'un bento par
compte vient uniquement de l'index unique. Sans lui, rien n'empêche un membre
d'insérer mille bentos.

### 4.4 Les compteurs comptent des bentos, pas des gens

`shared_items` promet « les items présents dans au moins deux bentos publiés »,
et le type le documente comme un nombre de bentos
(`packages/supabase-mobile/src/types.ts:516`). L'intention produit, elle, est
« au moins deux personnes ».

Mesuré sur le local, en dupliquant les six cases d'un bento dans un deuxième
bento du **même** compte :

| Item | `picks` avant | après |
|---|---|---|
| Squeezie | 5 | **6** |
| Arcane | 4 | **5** |
| Inception | 3 | **4** |
| Kyoto | 3 | **4** |
| Bohemian Rhapsody | 1 | **2**, entre dans le top 5 |
| One More Time | 2 | 2, inchangé, mais **sort du top 5** |

**Une seule personne peut donc faire entrer un item dans la liste des choix
partagés, et en faire sortir un autre.** « Bohemian Rhapsody » passe de 1 à 2
sans que personne d'autre ne l'ait choisi, et prend la place de « One More
Time » par l'ordre alphabétique à égalité de compte. Même mécanique pour
`popular_items`
(`20260915100000_item_types_and_cases.sql:401-407`).

`search_bentos` rend une ligne par bento, sans dédoublonnage par personne
(`20260913210000_search_bentos.sql:53-56`, `101-111`). Mesuré : avec deux
bentos, la recherche « luna » rend **deux lignes portant le même pseudo**, qui
mènent toutes deux à `/u/lunadesbois`.

Et un défaut qui existe **déjà**, sans deuxième bento : les cases `artist` et
`creator` partagent le type `person` (`bento_categories.type_id = 3` pour les
deux). Le déclencheur `bento_items_check_type` n'impose que l'égalité de type,
donc un même item peut occuper les deux cases d'un seul bento et satisfaire
`having count(*) >= 2` à lui tout seul. C'est le suivi ouvert en §12 du
chantier 11.

### 4.5 L'app mobile

`ensureBento` est appelé avant chaque écriture, depuis quatre endroits, et
aucun ne sait nommer un bento :

| Appelant | Ligne | Ce qu'il fait ensuite |
|---|---|---|
| Composer | `app/(tabs)/compose.tsx:113` | `publishBento(bentoId)` |
| Profil | `app/(tabs)/profile.tsx:84` | `unpublishBento(bentoId)` |
| Recherche, choix d'un item | `app/search-modal.tsx:270` | `setBentoSlot(…)` |
| Recherche, item proposé | `app/search-modal.tsx:318` | `setBentoSlot(…)` |
| Recherche, vider une case | `app/search-modal.tsx:349` | `clearBentoSlot(…)` |

Les lectures de `bentos` filtrées par `user_id`, toutes en `maybeSingle()` :

- `src/lib/bento-actions.ts:164-178`, `loadOwnBento` ;
- `src/state/session.ts:196-213`, `readBento`, l'hydratation au démarrage ;
- `src/lib/data-export.ts:24-34`, l'export RGPD, dont la charge utile porte une
  clé `bento` **au singulier** (`:36-41`).

**Le store ne sait pas ce qu'est un bento.** `src/state/bento.ts` tient
`slots` (une table plate de six clés de catégorie), `publishedAt` (un scalaire),
`hydrated`, `pendingWrites`. **Il ne stocke aucun identifiant de bento.**
`hydrate(slots)` remplace la totalité des cases (`:126-134`).

**Le partage est adressé par pseudo**, jamais par bento :
`shareBentoImage(pseudo, ref, imageUrls)` (`src/lib/share-image.ts:57-61`),
`publicBentoUrl(pseudo)` (`src/lib/share.ts:31-33`), et le pied de l'image
imprime `bento-pop.com/u/<pseudo>` (`ShareImage.tsx:179`).

**La grille est figée à six cases nommées par catégorie**, en trois rangées de
1, 2 et 3 (`BentoGrid.tsx:147-161`, `geometry.ts:15-45`, hauteur 512). Cela ne
casse pas avec N bentos, mais **rien n'y distingue un bento d'un autre** : deux
grilles côte à côte seraient identiques.

**La navigation n'a qu'une adresse de bento** : `app/u/[pseudo].tsx:58-67`, dont
le segment est le pseudo. Le fil et la recherche portent pourtant un `bentoId`
qu'ils jettent au moment de naviguer (`table.tsx:86`, `search.tsx:494`).

**Le signalement porte déjà le champ, et ne le remplit pas.** La table a
`target_bento_id` (`20260511130000_reports_and_blocked_pseudos.sql:12-14`), le
type d'entrée aussi (`src/lib/report.ts:3-8`), mais le seul appelant ne le passe
jamais : `submitReport({ targetKind: 'bento', targetPseudo: pseudo })`
(`app/u/[pseudo].tsx:695`). La roadmap dit « sans identifiant de bento » ; c'est
vrai en effet, faux en cause. **Il n'y a rien à ajouter en base, seulement un
argument à passer.**

Relevé au simulateur, compte `@bento_culture`, bento publié complet :

| Écran | Libellé mesuré |
|---|---|
| Composer | titre de niveau 1 « **MON BENTO** », constant |
| Composer | « En ligne · tes modifications sont visibles tout de suite » |
| Composer | bouton « **Voir mon bento public** » |
| Profil | « **Voir mon bento public** » |
| Profil | « **Éditer mon bento** » |
| Profil | « **Retirer mon bento du fil** » |
| Profil | « Efface définitivement ton pseudo, **ton bento** et… » |

Quatre libellés au singulier défini sur le seul écran de profil.

### 4.6 La page publique et la landing

- **Le point de rupture unique du web** : `firstBento`
  (`apps/landing/src/lib/bento/queries.ts:89-92`), `raw[0] ?? null`, **sans
  `order by` ni dans la requête ni dans la relation imbriquée**. Avec deux
  bentos, la page peut changer de bento d'une régénération ISR à l'autre.
- **Pire que non déterministe** : si `raw[0]` tombe sur un brouillon alors qu'un
  bento publié existe, la page rend l'écran « pas encore terminé » et passe en
  `noindex` (`queries.ts:143-145`, `page.tsx:106`).
- **L'image d'aperçu décide séparément.** `page.tsx:46` mémoïse la lecture par
  requête, mais `opengraph-image.tsx:73` appelle `lookupPublicBento` en direct,
  dans une autre requête HTTP. **Le HTML et son aperçu peuvent montrer deux
  bentos différents.**
- **Le sitemap et `generateStaticParams` dédoublent.** `listFeaturedPseudos`
  rend un pseudo **par bento mis en avant**, sans dédoublonnage
  (`queries.ts:189-191`), consommé tel quel par `sitemap.ts:23-28` et
  `page.tsx:52-57`.
- **Une seule fonction construit les URL** : `bentoPath(pseudo)`
  (`src/lib/bento/metadata.ts:17-19`). Tous les liens des deux applications en
  dérivent.
- **Le lien de signalement web ne transmet rien** : un `mailto:` dont le sujet
  est « Signalement du bento @X » (`BentoPageShell.tsx:110-126`).
- **La purge ISR est indexée par pseudo.** Le déclencheur
  `revalidate_landing_bento` résout le `user_id` en un pseudo et purge
  `['/u/<pseudo>', '/sitemap.xml']`
  (`20260911000000_revalidate_landing_on_publish.sql:49-51, 76-81`).

Relevé sur la production, le 16 septembre :

| | |
|---|---|
| URL du sitemap | 42, dont **3** `/u/<pseudo>` : `noxito`, `keremasan`, `sparkay` |
| `/u/noxito` | titre « Le bento de @noxito · Bento Pop », `robots: index, follow` |
| canonique | `https://bento-pop.com/u/noxito` |
| aperçu | `…/u/noxito/opengraph-image/**bento**?<hash>` |
| `/u/tounty`, publié non mis en avant | 200, `robots: noindex, follow` |

**Le segment `bento` de l'URL d'aperçu est l'`id` de `generateImageMetadata`**
(`opengraph-image.tsx:64-67`), aujourd'hui figé à une seule descriptrice. C'est
exactement le mécanisme prévu par Next pour émettre plusieurs images par route.

**Les liens universels couvrent déjà le chemin.** `paths: ['/u/*']` côté iOS
(`.well-known/apple-app-site-association/route.ts:34`) et `pathPrefix: "/u/"`
côté Android (`app.json:27-43`). **Une adresse `/u/<pseudo>/<slug>` est donc
déjà revendiquée par l'app, sans nouveau déploiement de fichier de liaison.**

### 4.7 Le back-office

- **L'entonnoir compte des bentos et les affiche comme des gens.**
  `started: memberBentos.length` et `published: …filter(…).length`
  (`apps/admin/src/lib/user-funnel.ts:105-106`), lus dans la documentation du
  fichier comme « 106 personnes ont installé, 70 ont choisi un pseudo, 26 ont
  publié ». Avec deux bentos, l'entonnoir cesse d'être monotone et
  `funnelShare` peut dépasser 100 %.
- **La liste des comptes perd des bentos en silence** :
  `new Map(bentos.map((b) => [b.user_id, b]))` (`user-funnel.ts:148`), dernier
  arrivé gagnant, sur une requête sans `order by`.
- **La confirmation de suppression sous-déclare** : « Son bento (N cases…) est
  supprimé » (`UsersClient.tsx:563-568`), alors que la cascade en supprime
  autant qu'il y en a.
- **La liste des bentos est déjà correcte**, elle navigue par `id`
  (`bentos/BentosClient.tsx:103-104`), mais son lien « Voir » sort vers
  `/u/<pseudo>` (`:148-152`), donc deux lignes distinctes mènent à la même page.
- **La modération ne sait que bannir.** Le seul remède est
  `delete from public.users` (`reports/actions.ts:61`). `target_bento_id` est lu
  (`reports/page.tsx:51-52`) puis jamais utilisé.
- **Le back-office ne purge jamais la landing** après avoir mis en avant ou
  publié un bento : aucun appel à `revalidateLanding` dans `bentos/actions.ts`
  ni dans `utilisateurs/nouveau/actions.ts`. La fenêtre de fraîcheur est celle
  de l'ISR, 300 s.
- **Il crée exactement un bento par profil éditorial**
  (`utilisateurs/nouveau/actions.ts:146-153`), sans moyen d'en ajouter un.

### 4.8 L'onboarding, écran par écran

Relevé sur iPhone 17 Pro, code courant, à travers le proxy.

| # | Fichier | Titre mesuré | Repère d'étape |
|---|---|---|---|
| 1 | `app/onboarding/splash.tsx` | « COMPOSE TON BENTO POP CULTURE. » | 3 points, actif 0 (`:169`) |
| 2 | `app/onboarding/terms.tsx` | « LES RÈGLES DU JEU. » | « AVANT DE COMMENCER » (`:75`), **aucun point** |
| 3 | `app/onboarding/pseudo.tsx` | « CHOISIS TON PSEUDO. » | « **ÉTAPE 2 / 3** » (`:96`), aucun point |
| 4 | `app/onboarding/mechanics.tsx` | la mécanique, grille vide | 3 points, actif 2 (`:157`) |

**Quatre écrans comptés comme trois**, l'écran de règles s'intercalant sans
être compté. La roadmap donne `splash.tsx:103` et `mechanics.tsx:116` : ces
numéros datent d'avant le chantier 11, les bons sont 169 et 157.

L'écran 3 annonce à l'utilisateur, avant toute valeur vue : « C'est l'adresse de
ton bento », avec l'aperçu `bento-pop.com/u/ton_pseudo`. **Le pseudo est
présenté comme l'adresse du bento au moment même où il est exigé.**

**Ce qui empêche de décaler simplement le pseudo.** Trois contraintes mesurées :

1. `users.pseudo` est **`not null`**, avec un contrôle de forme
   `^[A-Za-z0-9_.]{3,20}$`. **Une ligne de profil ne peut pas exister sans
   pseudo valide.**
2. `bentos.user_id` référence `users(id)`. **Aucune case ne peut être écrite
   côté serveur sans ligne de profil.**
3. `terms_accepted_at` est posé dans l'`INSERT` du profil
   (`app/onboarding/pseudo.tsx:67-69`), qui ne pose que trois colonnes :
   ```ts
   .from('users').insert({ id: userId, pseudo, terms_accepted_at: new Date().toISOString() });
   ```

Autrement dit : **composer avant d'avoir un pseudo impose soit un brouillon
purement local, soit un pseudo généré posé dès l'acceptation des règles.** C'est
le point D7.

`generatePseudoSuggestions(base)` est **synchrone, pure et sans réseau**
(`src/lib/pseudo.ts:54-66`) : cinq motifs dérivés d'un slug, filtrés des pseudos
réservés. Elle **ne vérifie pas la disponibilité** ; c'est
`checkPseudoAvailability` qui interroge le réseau, avec une temporisation de
350 ms (`app/onboarding/pseudo.tsx:46-57`).

### 4.9 Ce qui est déjà prêt pour plusieurs bentos

À ne pas retoucher, et à ne pas flaguer en revue :

- `src/lib/feed.ts:216`, le fil lit une liste de bentos publiés et joint les
  comptes dans le bon sens ;
- `search_bentos` est **la seule signature du dépôt qui porte déjà `bento_id`
  et `pseudo` sur la même ligne** (`types.ts:484`) ;
- `apps/admin/.../bentos/page.tsx` et `bentos/[id]/page.tsx`, adressés par `id` ;
- `setBentoSlot`, `clearBentoSlot`, `publishBento`, `unpublishBento` prennent
  déjà un `bentoId` (`bento-actions.ts:35-157`) : **seuls leurs appelants
  devinent** ;
- `bento_items`, dont la PK `(bento_id, category_id)` est déjà par bento ;
- `apps/admin/.../catalogue/[id]/page.tsx`, l'usage d'un item, par bento.

### 4.10 Ce qui ne bouge pas

- La grille six cases et sa géométrie : les grilles de 2 à 5 cases sont au 13.
- Le modèle brouillon-publié du chantier 5 : `published_at` reste la seule
  vérité, par bento.
- `is_featured` et `featured_order` restent des colonnes de bento, écrites par
  le seul back-office.
- Le contrôle de type des cases, posé au chantier 15.

---

## 5. Design

### 5.1 Le modèle : tout bento a une adresse, un seul est le principal

Deux colonnes, et c'est tout (D2, D5).

- **`slug text not null`**, unique par compte : **tout** bento a une adresse
  lisible, les existants compris.
- **`is_primary boolean`**, vrai pour **au plus un** bento par compte : c'est
  celui que `/u/<pseudo>` met en avant.

```sql
alter table public.bentos add column slug text;
alter table public.bentos add column is_primary boolean not null default false;

-- Rétroactif : chaque bento existant est le principal de son compte et prend
-- une adresse. Un seul par compte aujourd'hui, la contrainte unique le garantit
-- encore au moment où cette migration s'exécute.
update public.bentos set slug = 'mon-bento', is_primary = true;

alter table public.bentos alter column slug set not null;
alter table public.bentos add constraint bentos_slug_format
  check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');
alter table public.bentos add constraint bentos_user_slug unique (user_id, slug);

alter table public.bentos drop constraint bentos_user_id_key;
create unique index bentos_one_primary on public.bentos (user_id) where is_primary;
```

Pourquoi un `slug` plutôt qu'un `kind` énuméré : le chantier 13 donnera aux
éditions un titre, donc un slug, et une adresse lisible est ce que le partage
demande. Le `kind` viendra du 13, dérivé de l'édition liée, pas source de
vérité ici.

Pourquoi `is_primary` séparé du slug : parce que le principal doit pouvoir
changer sans que son adresse bouge, et qu'un booléen indexable dit ce qu'un
slug conventionnel ne ferait que suggérer.

**Les bentos existants gardent leur contenu et leur place.** L'`update`
rétroactif touche deux colonnes neuves, jamais une donnée d'utilisateur, et il
couvre les brouillons comme les publiés. Le principal reste joignable à
`/u/<pseudo>`, et gagne au passage sa propre adresse `/u/<pseudo>/mon-bento`,
dont la canonique renvoie sur `/u/<pseudo>`.

### 5.2 Une seule lecture, et un choix explicite

La jointure externe est conservée (§4.3, mesure 5). Ce qui change, c'est qu'on
cesse de prendre « le » bento pour en choisir un, et qu'on le dit :

```ts
// La relation, toujours en liste, quelle que soit la forme rendue.
function bentoRows(raw) {
  if (raw === null || raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// Le bento demandé. Avec un slug, c'est celui-là ou rien ; sans, le
// principal, et à défaut le plus ancien publié.
const published = bentoRows(row.bentos)
  .filter((b) => b.published_at)
  .sort((a, b) => a.published_at.localeCompare(b.published_at));
const chosen = slug
  ? published.find((b) => b.slug === slug)
  : (published.find((b) => b.is_primary) ?? published[0]);
```

Quatre défauts mesurés en §4.6 disparaissent d'un coup : le choix non
déterministe de `raw[0]` sur une requête sans `order by`, le brouillon qui
masque un publié et force un `noindex`, le désaccord possible entre le HTML et
son image d'aperçu, et l'absence d'ordre entre deux bentos.

Le repli « à défaut le plus ancien publié » n'est pas décoratif : sans lui, un
compte dont le principal est en brouillon afficherait « rien en ligne » alors
qu'un autre de ses bentos est public.

**Une seule requête, des deux côtés, et les autres bentos viennent avec.** Le
filtre imbriqué sur le slug a été écrit puis retiré : il aurait fait de la page
d'un bento nommé un cul-de-sac, sans aucun lien vers le reste du compte. Les
bentos d'un compte se comptent sur les doigts d'une main, ils reviennent tous,
et le choix se fait à l'arrivée. L'app et la landing rendent ainsi exactement
la même page.

### 5.3 Les adresses

| Adresse | Ce qu'elle rend |
|---|---|
| `/u/<pseudo>` | **la page de profil du compte**, dont le contenu principal est le bento principal affiché en entier, les autres bentos listés dessous |
| `/u/<pseudo>/<slug>` | le bento nommé, seul |
| `/u/<pseudo>/mon-bento` | le principal, avec une canonique vers `/u/<pseudo>` |
| `/u/<pseudo>/<slug>` inexistant | 404 de segment, jamais un repli sur le principal |

**Pourquoi le profil ne remplace pas le bento, il l'entoure (D5).** Les 27 liens
en circulation gardent leur contenu : même bento en haut de page, même titre
`Le bento de @X`, même image d'aperçu, donc les vignettes déjà en cache dans les
messageries restent justes. Le compte gagne une page qui le représente, ce que
le chantier 21 achèvera ; le chantier 16 ne pose ici que la liste de ses bentos.

Les liens universels couvrent déjà `/u/*` des deux côtés (§4.6) : **aucune
nouvelle déclaration de domaine associé n'est nécessaire.** Côté app, une route
`app/u/[pseudo]/[slug].tsx` s'ajoute à côté de l'actuelle.

Le sitemap gagne une entrée par bento mis en avant, dédoublonnée par adresse et
non par pseudo. L'image d'aperçu devient une descriptrice par bento, en
réutilisant l'`id` de `generateImageMetadata`, déjà présent dans l'URL mesurée
en §4.6.

### 5.4 Le composer, le profil, le partage

**Tant qu'un compte n'a qu'un bento, rien ne change à l'écran.** C'est la
promesse : un sélecteur n'apparaît qu'à partir du deuxième.

- **Composer** : le titre « MON BENTO » devient le nom du bento courant, et
  reste « MON BENTO » pour le principal. Au-delà d'un bento, une ligne de
  sélection au-dessus de la grille, chaque entrée nommée.
- **Profil** : « Voir mon bento public » et « Éditer mon bento » restent tels
  quels avec un seul bento ; avec plusieurs, ils deviennent une liste. « Retirer
  mon bento du fil » nomme le bento retiré.
- **Partage** : `shareBentoImage` et `publicBentoUrl` prennent le bento, pas le
  pseudo. Le pied de l'image imprime l'adresse **canonique** du bento partagé,
  donc `bento-pop.com/u/<pseudo>` pour le principal, inchangé, et
  `bento-pop.com/u/<pseudo>/<slug>` pour les autres.
- **Page publique dans l'app** : `app/u/[pseudo].tsx` devient le profil, avec le
  bento principal en contenu principal, comme sur le web (§5.3).
- **Store** : `useBento` gagne l'identifiant et le slug du bento courant. Sa
  forme « une table de six cases » ne change pas : c'est le bento **courant**
  qui change.

### 5.5 Les compteurs et la modération

- `shared_items` et `popular_items` comptent **des personnes** :
  `count(distinct b.user_id)`, ce qui corrige du même coup le défaut
  `artist`/`creator` ouvert au chantier 11.
- `search_bentos` dédoublonne par bento comme aujourd'hui, et rend le `slug`
  pour que l'appelant construise la bonne adresse.
- L'entonnoir du back-office compte des personnes : `distinct user_id` pour
  « a commencé » et « a publié », et la liste des comptes affiche le nombre de
  bentos plutôt qu'un seul.
- **Le signalement passe `targetBentoId`.** Rien à migrer, la colonne existe
  (§4.5). Le lien de modération pointe alors le bento signalé, pas le pseudo.
- Le remède par bento (dépublier plutôt que bannir) est **hors périmètre** ;
  il est noté en §12.

### 5.6 Le pseudo au moment de publier

L'obligation CGU reste **avant toute contribution publique**
(`docs/STORE-COMPLIANCE.md`, Guideline 1.2). Elle ne bouge pas de place : c'est
le pseudo qui recule.

Parcours visé, quatre écrans devenant trois plus une étape tardive :

1. **splash** ;
2. **règles du jeu**, inchangé, avec sa case à cocher ;
3. **la mécanique**, qui devient l'écran 2 sur 2 ;
4. **le composer**, directement, cases vides ;
5. **le pseudo**, demandé au tap sur « Publier mon bento », quand six cases
   sont remplies et qu'il y a quelque chose à perdre.

**Le brouillon reste sur l'appareil jusqu'à la publication (D7).** Aucune ligne
serveur n'est créée avant le pseudo :

- `useBento.slots` est persisté sur l'appareil, ce qui manquait : le store tient
  déjà les cases en mémoire et `setSlot` est déjà optimiste
  (`src/state/bento.ts:51-105`), il n'y a que la persistance et la reprise à
  ajouter ;
- la recherche d'items fonctionne sans compte, la lecture publique étant déjà
  ouverte au rôle anonyme ;
- au tap sur « Publier », le pseudo est demandé, puis **une fonction
  `security definer` crée profil, bento et cases en une seule transaction**. Ni
  profil orphelin si la création des cases échoue, ni cases orphelines.

Ce que cela règle, mesuré : **les 34 pseudos dormants, 56 % des comptes, cessent
d'être créés**, l'espace de noms arrête de se remplir de réservations mortes, et
l'entonnoir du back-office cesse de compter comme « a choisi un pseudo »
quelqu'un qui n'a rien vu de l'app.

Le coût, assumé : le chemin d'écriture du composer a deux régimes, avant et
après compte. Le test doit couvrir les deux, et la bascule de l'un à l'autre.

`terms_accepted_at` est posé au moment où les règles sont acceptées, et non plus
au choix du pseudo. Comme la ligne `users` n'existe pas encore à cet instant,
l'acceptation est gardée sur l'appareil et **passée en argument à la fonction de
création**, qui la pose dans l'`INSERT`. La gate CGU ne bouge donc pas de place :
elle reste avant toute contribution publique, comme l'exige la Guideline 1.2.

La pagination est recomptée sur le parcours réel, qui passe de quatre écrans
comptés trois à trois écrans comptés trois.

---

## 6. Contrat technique

### 6.1 Migration, en deux fichiers et non un

Appliqués à la main dans l'éditeur SQL du projet mobile, comme les précédentes
(`20260915000000_close_privilege_gaps.sql:32-33`).

**Le découpage vient d'une mesure faite en écrivant le lot 1.** Une migration
qui n'ajoute que des colonnes **ne change pas la forme** des réponses
PostgREST : `bentos_user_id_key` reste en place, la relation reste un un-à-un,
et les apps en circulation ne voient rien. C'est la levée de la contrainte, et
elle seule, qui fait basculer en tableau. Les deux n'ont donc pas les mêmes
contraintes de calendrier, et les séparer supprime tout risque.

**Migration A, `20260916120000_bentos_slug_and_primary.sql`, sans risque.**

1. Les colonnes `slug` et `is_primary`, l'`update` rétroactif, le contrôle de
   forme et l'unicité `(user_id, slug)`. **`bentos_user_id_key` n'est pas
   touchée.**
2. `grant select (slug, is_primary)` pour `anon` et `authenticated`. **Aucun
   `grant insert` ni `update` sur ces colonnes** : le client ne choisit ni
   l'adresse d'un bento ni lequel est le principal.
3. Le déclencheur `revalidate_landing_bento` émet `/u/<pseudo>`,
   `/u/<pseudo>/<slug>` et `/sitemap.xml`.

**Migration B, au lot 2, celle qui demande un calendrier.**

4. Bascule de `bentos_user_id_key` vers `bentos_one_primary`, l'index unique
   partiel de §5.1.
5. `create function public.create_bento(p_slug text)`, `security definer`,
   `set search_path = ''`, qui vérifie la forme du slug, refuse les slugs
   réservés, applique un plafond de bentos par compte, et insère pour
   `auth.uid()` avec `is_primary = false`.
6. Réécriture de `shared_items`, `popular_items` et `search_bentos` en
   `distinct user_id`, et ajout du `slug` au retour de `search_bentos`.
7. Le passage de `terms_accepted_at` dans la fonction de création de profil du
   chantier 9.

### 6.2 L'ordre de déploiement, et pourquoi il tient

**Corrigé le 16 septembre 2026, en écrivant le lot 1.** La première version de
cette section mettait la migration après la fusion. C'est faux, et le build de
la landing l'a dit tout seul : le code du lot 1 demande `slug` à PostgREST, et
contre une base qui ne l'a pas encore, la réponse est
`400 · 42703 column bentos_1.slug does not exist`. Vérifié en lecture seule
contre la production. **La landing déployée avant la migration A rendrait 404
sur les 27 pages de bento.**

L'ordre juste, les deux migrations n'ayant pas les mêmes contraintes (§6.1) :

| # | Étape | Risque |
|---|---|---|
| 1 | **Migration A** appliquée en production ✅ **faite le 16/09** | **aucun** : elle n'ajoute que des colonnes, la relation reste un un-à-un, les apps en circulation ne voient rien |
| 2 | **Fusion de la PR** : landing et back-office se déploient | aucun : la base sait déjà répondre |
| 3 | **Build mobile 1.3.0**, puis adoption | aucun : dormante pour tout ce qui concerne les secondaires |
| 4 | **Migration B**, sur feu vert, quand l'adoption suffit | c'est **la** fenêtre : une app restée sur l'ancienne requête dirait « rien en ligne » |
| 5 | **Premier bento secondaire** créé depuis le back-office | aucun |

Entre les étapes 1 et 4, rien ne change pour personne.

C'est tout le gain : le moment de l'étape 4 devient un choix, pas une
conséquence.

**Ce que l'étape 4 coûte quand même, et qu'il ne faut pas se cacher.** Une app
restée sur l'ancienne requête lit `.published_at` sur un tableau et affiche
« rien en ligne » sur **toutes** les pages publiques, pas seulement celles des
comptes à plusieurs bentos. La page web, elle, n'est pas concernée : la landing
se redéploie à la fusion. Deux leviers pour réduire la fenêtre :

- **mesurer l'adoption avant de décider.** `users.app_version` est renseigné par
  la télémétrie et lisible avec une clé privilégiée, donc par toi, pas par moi ;
- **pousser une mise à jour OTA** en complément de la sortie store. Attention :
  `runtimeVersion` suit `appVersion` (`app.json:82`), donc une OTA construite
  pour 1.3.0 ne touchera **que** les appareils déjà en 1.3.0. Elle accélère la
  diffusion d'un correctif, elle ne rattrape pas les versions antérieures.

### 6.3 Types et garde-fous

- `packages/supabase-mobile/src/types.ts` : `slug` et `is_primary` sur `Row`,
  **absents de `Insert` et de `Update`**, ce qui rend l'erreur de droits visible
  à la compilation plutôt qu'à l'exécution.
- `PublicBentoResult` cesse d'être `{ pseudo, bento | null }` et devient un
  résultat de bento portant son pseudo.
- Un test de source refuse tout `.from('bentos')` suivi d'un
  `.eq('user_id', …)` qui ne dit pas quel bento, sur le modèle de
  `accessibilite.test.ts`.

---

## 7. Stratégie de test et de recette

### 7.1 Tests unitaires, `node:test` plus `tsx`

- Le choix du bento : principal, secondaire nommé, slug inconnu, compte sans
  bento, compte avec brouillon seul.
- Le slug : forme acceptée, refusée, réservée, collision par compte.
- Les compteurs : deux bentos d'un même compte portant le même item ne
  déplacent ni `shared_items` ni `popular_items`.
- Le brouillon local : reprise après fermeture, publication hors ligne refusée
  proprement, six cases puis pseudo.
- Garde-fou de source, §6.3.

### 7.2 Tests de base, sur Supabase local

Rejoués depuis les migrations du dépôt, à chaque lot :

- `bentos_one_primary` accepte un principal et N secondaires, refuse deux
  principaux pour un même compte ;
- `bentos_user_slug` refuse deux bentos de même slug pour un compte, en accepte
  deux de même slug pour deux comptes ;
- `create_bento` refuse un slug pris, un slug mal formé, un slug réservé, et un
  appel non authentifié ; le bento créé naît avec `is_primary = false` ;
- un client `authenticated` ne peut écrire ni `slug` ni `is_primary` en direct ;
- **la traversée de la migration** : la même lecture rend le même bento avant
  et après, l'objet comme le tableau, mesures 4 et 5 de §4.3 rejouées en test.

### 7.3 Recette, bloquante

Sur iPhone 17 Pro, iPhone SE et Pixel 8, contre le Supabase local :

1. un compte avec un seul bento ne voit **aucun** changement d'écran ;
2. `/u/<pseudo>` rend le principal, avant et après migration ;
3. un deuxième bento créé par le back-office apparaît, est adressable, et se
   partage à sa propre adresse ;
4. un lien `/u/<pseudo>/<slug>` ouvre l'app sur le bon bento ;
5. un signalement depuis un bento secondaire arrive avec son `target_bento_id` ;
6. le parcours nouveau venu : règles, mécanique, composer, six cases, pseudo,
   publication.

### 7.4 La règle existait déjà, elle n'a pas été appliquée

**Le contrôle de la clé `sb-<ref>-auth-token` est écrit dans
`RECETTE-MOBILE.md` depuis une session précédente**, lignes 406 à 417, avec le
récit d'un incident identique. Il n'a pas été fait ce matin : la vérification
s'est arrêtée à l'environnement de Metro, qui ne prouve rien.

Ce qui manquait vraiment au document, et qui y est ajouté : **une build à canal
de mise à jour (`EXUpdatesEnabled = true`) ignore Metro en silence**, donc le
fichier `apps/mobile/MonBentoPop.app` du dépôt, build `preview` 0.0.1 du 12 mai
2026, vise la production quelles que soient les variables passées à Metro.

La conclusion pour la suite du chantier : **ne jamais réinstaller un `.app`
trouvé dans le dépôt**, reconstruire avec `expo run:ios`, et lire la clé
d'AsyncStorage **après** le lancement, avant toute interaction.

---

## 8. Plan de développement

Les six lots sont des **jalons de relecture dans la branche**, pas des
livraisons : tout part en une seule PR (D8). Leur ordre reste celui-ci parce
que le lot 1 est ce qui protège tout le reste.

### Lot 1 · Migration A, la lecture et les adresses · livré

Migration A de §6.1, choix explicite du bento des deux côtés (§5.2), route
`app/u/[pseudo]/[slug].tsx` et son équivalent web, `/u/<pseudo>` devenu page de
compte avec le principal en contenu principal, sitemap et image d'aperçu par
bento, purge des deux adresses, `firstBento` retiré.

### Lot 2 · Migration B, les droits et les compteurs · livré

Levée de `bentos_user_id_key` vers l'index partiel, fonction `create_bento`,
compteurs en `distinct user_id`, `search_bentos` qui rend le slug, types, et
deux garde-fous. **Rien n'est appliqué en production à ce stade** : c'est
l'étape 5 de §6.2, sur feu vert, une fois la build adoptée.

**Un slug réservé que la spéc n'avait pas vu.** Next expose l'aperçu d'un bento
à `/u/<pseudo>/opengraph-image/…` par convention de fichier, et une route de
convention l'emporte sur un segment dynamique : un bento portant ce slug serait
**définitivement inatteignable**. `create_bento` refuse donc `opengraph-image`,
`twitter-image`, `icon`, `apple-icon`, `sitemap`, `robots`, plus quelques noms
gardés pour les chantiers 13 et 21.

**Le garde-fou de source porte sa dette.** `src/lib/bento-queries.test.ts` lit
l'arbre syntaxique et refuse tout `.from('bentos')` filtré par `user_id` qui ne
dit pas quel bento, ainsi que tout `maybeSingle()` sur un tel filtre. Trois
fichiers restent fautifs et sont listés nommément dans la constante `DETTE` :
`bento-actions.ts`, `session.ts` et `data-export.ts`. Un quatrième test échoue
si une entrée de cette liste n'est plus fautive, pour qu'elle ne survive pas à
sa correction. **Le lot 4 doit la vider.**

### Lot 3 · Les compteurs, la modération et le back-office

`shared_items`, `popular_items`, `search_bentos` par personne ; entonnoir et
liste de comptes par personne ; `target_bento_id` passé au signalement et suivi
jusqu'au lien de modération ; création d'un deuxième bento depuis le
back-office ; confirmation de suppression qui dit le vrai nombre.

### Lot 4 · Le composer, le profil et le partage à plusieurs bentos

Sélecteur au-delà d'un bento, store qui porte l'identifiant courant, partage
adressé par bento, export RGPD au pluriel avec montée de `schema_version`.

### Lot 5 · Le pseudo au moment de publier

Chantier 9 : brouillon persisté sur l'appareil, parcours à trois écrans plus
l'étape tardive, fonction de création atomique portant `terms_accepted_at`,
pagination recomptée.

### Lot 6 · Recette et documents

Matrice sur les trois appareils, `RECETTE-MOBILE.md` enrichi de §7.4, roadmap et
spécification à jour.

---

## 9. Livraison

**Une seule PR à la fin (D8)**, les six lots servant de jalons de relecture dans
la branche. Ce qui suit la fusion, dans l'ordre de §6.2 :

| # | Étape | Qui |
|---|---|---|
| 1 | **Migration A** dans l'éditeur SQL, avant toute fusion | toi |
| 2 | Fusion après CI verte, déploiement des deux apps web | moi, sur ton accord |
| 3 | Build mobile 1.3.0, iOS et Android, profil `production` | moi, sur ton accord |
| 4 | Mesure de l'adoption de la 1.3.0 | toi, clé privilégiée |
| 5 | **Migration B** dans l'éditeur SQL | toi |
| 6 | Création d'un premier bento secondaire depuis le back-office | toi ou moi |
| 7 | Recette de bout en bout sur les trois appareils | moi |

Rien n'est soumis aux stores sans décision explicite, et la migration n'est
appliquée que par toi.

---

## 10. Definition of Done

| # | Critère |
|---|---|
| 1 | Les 27 adresses `/u/<pseudo>` montrent le même bento qu'aujourd'hui, avec le même titre et la même image d'aperçu, avant et après migration |
| 2 | Un compte porte deux bentos publiés, chacun à son adresse, dans l'app et sur le web |
| 3 | Zéro `maybeSingle()` sur `bentos` filtré par `user_id` dans le dépôt |
| 4 | Aucun `.eq('user_id', …)` sur `bentos` sans dire quel bento, garde-fou vert |
| 5 | Deux bentos d'un compte portant le même item ne déplacent aucun compteur |
| 6 | L'entonnoir du back-office reste monotone avec des comptes à plusieurs bentos |
| 7 | 100 % des signalements de bento portent `target_bento_id` |
| 8 | Un nouveau venu remplit six cases sans pseudo, et accepte les règles avant |
| 9 | `terms_accepted_at` est posé à l'acceptation, plus au choix du pseudo |
| 10 | La pagination compte le nombre réel d'écrans |
| 11 | Les tests existants passent, plus les nouveaux |
| 12 | `RECETTE-MOBILE.md` porte la règle de vérification de cible de §7.4 |

---

## 11. Décisions

**Les neuf sont prises, le 16 septembre 2026, avant écriture d'une seule ligne
de code.**

| # | Question | Tranché |
|---|---|---|
| D1 | Périmètre du 16 face au 13, vu la dépendance circulaire de §3.1 | **Le 16 fait la place, le 13 fera les éditions.** Le deuxième bento se crée depuis le back-office ; le « Fait quand » de la roadmap est réécrit |
| D2 | Que deviennent les bentos existants | **Tous principaux, avec un slug rétroactif** : `slug = 'mon-bento'`, `is_primary = true`, brouillons compris. Deux colonnes neuves, aucune donnée d'utilisateur touchée |
| D3 | Comment franchir la fenêtre où l'app en circulation lit un tableau | **Le code part avant la levée de la contrainte.** Affiné en écrivant le lot 1 : la migration se coupe en deux, et seule la seconde moitié demande un calendrier (§6.1, §6.2) |
| D4 | Comment un bento secondaire est créé | **Fonction `security definer`**, jamais un `insert` client : les droits colonne ne laissent au client que `user_id` en écriture (§4.3) |
| D5 | Ce que devient `/u/<pseudo>` | **Page de profil dont le contenu principal est le bento principal affiché en entier**, les autres listés dessous. `/u/<pseudo>/<slug>` adresse un bento seul. Les 27 liens en circulation gardent leur contenu |
| D6 | Un signalement vise-t-il un bento ou un compte | **Le bento.** La colonne `target_bento_id` existe déjà et n'est jamais remplie : il n'y a qu'un argument à passer (§4.5) |
| D7 | Brouillon local ou pseudo généré, pour le chantier 9 | **Brouillon local jusqu'à la publication.** Les 34 pseudos dormants, 56 % des comptes, cessent d'être créés |
| D8 | Ordre et découpage de la livraison | **Une seule PR à la fin**, six lots comme jalons de relecture. Ordre des lots : lecture et adresses, migration, compteurs, composer, pseudo, recette |
| D9 | Nettoyage des comptes anonymes créés par erreur (en-tête) | **Clément les supprime lui-même**, avec la requête donnée ci-dessous. Aucune clé privilégiée ne passe par l'agent |

### 11.1 La requête de nettoyage, à exécuter par Clément

À coller dans l'éditeur SQL du projet mobile `ggjgktbcqumfxrixcdyx`. **Lire
d'abord, supprimer ensuite.**

```sql
-- 1. Voir ce qui serait supprimé. Attendu : au plus 3 lignes.
select u.id, u.created_at, u.is_anonymous, u.email
from auth.users u
left join public.users p on p.id = u.id
where u.is_anonymous
  and p.id is null
  and u.created_at >= '2026-09-16T05:25:00Z'
  and u.created_at <  '2026-09-16T05:50:00Z'
order by u.created_at;

-- 2. Supprimer, une fois la liste vérifiée.
delete from auth.users u
using (
  select u2.id from auth.users u2
  left join public.users p on p.id = u2.id
  where u2.is_anonymous and p.id is null
    and u2.created_at >= '2026-09-16T05:25:00Z'
    and u2.created_at <  '2026-09-16T05:50:00Z'
) cible
where u.id = cible.id;
```

Le `left join public.users` est la garde qui compte : il exclut tout compte
anonyme ayant choisi un pseudo, donc tout compte réel. L'un des trois porte
l'identifiant `465f0ad6-f48a-4bf3-8905-5e57bd250782`, relevé dans le jeton
stocké par le simulateur.

---

## 12. Suivis

- **Dépublier le principal dépublie-t-il le reste ?** Question ouverte de la
  roadmap, sans réponse tant qu'il n'y a pas de secondaire réel.
- **Un remède de modération par bento** : aujourd'hui le seul geste possible est
  la suppression du compte (§4.7).
- **Le back-office ne purge jamais la landing** après mise en avant ou
  publication d'un bento éditorial. Défaut préexistant, hors périmètre.
- **`artist` et `creator` partagent le type `person`** : un même item peut
  occuper deux cases d'un seul bento. Corrigé de fait par le passage des
  compteurs à `distinct user_id`, à vérifier.
- **La grille ne sait dessiner que six cases** : les mises en page de 2 à 5
  cases attendent la direction artistique, chantier 13.
- **`last_seen_at` n'est pas lisible à la clé anonyme**, donc l'effet du
  chantier 9 sur le retour ne sera mesurable qu'avec un relevé privilégié.
- **Les branches Supabase, pour le chantier 13.** Question posée le 16
  septembre. Le *branching* crée une base éphémère par branche Git, avec ses
  clés, et rejoue les migrations. Trois obstacles aujourd'hui : le projet mobile
  est sur le **plan gratuit** alors que la fonction est payante ; **aucune
  migration n'est marquée comme appliquée**, donc un rejeu tenterait de refaire
  les vingt fichiers depuis mai, et il faudrait poser une ligne de base ; et
  surtout **cela ne répond pas au risque de ce chantier**, qui vient des builds
  en circulation, pas de l'environnement de développement, que le Supabase local
  couvre déjà. À rouvrir au 13, dont les changements de schéma sont plus lourds,
  avec la remise en ordre de l'historique comme préalable.
