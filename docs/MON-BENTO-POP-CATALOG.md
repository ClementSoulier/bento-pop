# Mon Bento Pop — Catalogue maison

> **Statut : implémenté** (mai 2026, mobile v1.1+). Cette spec reste comme document de référence sur les décisions architecturales et le plan de déploiement initial. Voir les PRs #23 → #32 pour l'historique d'implémentation. Le strict `can_publish_bento` SQL reste volontairement non posé tant que la base d'utilisateurs n'est pas majoritairement sur 1.1.0+ ; la gate est appliquée côté UI uniquement.

Spécification du passage d'un catalogue alimenté par APIs externes (TMDb, MusicBrainz, Wikidata, OSM) à un catalogue **maison modéré**, alimenté par les utilisateurs et validé par l'équipe Bento Pop.

## 1. Objectif

Reprendre la main sur la donnée du catalogue (`items`) pour :

1. Éliminer les doublons et les données incomplètes héritées des APIs externes.
2. Garantir que chaque item visible dans la recherche est un item canonique, modéré, illustré.
3. Permettre à l'utilisateur d'ajouter ce qui lui manque (long-tail), sans pouvoir publier de contenu non modéré.

**Hors scope** : auth, bentos featured, pseudos, reports. On ne touche qu'à la couche `items + recherche + soumission + admin validation`.

## 2. Modèle de données

### 2.1 Évolution de `public.items`

```sql
alter type or create type item_status as enum (
  'draft',      -- créé en admin, pas encore prêt
  'pending',    -- proposé par un user, en attente de modération
  'validated',  -- visible en recherche publique
  'rejected',   -- refusé par un admin
  'merged'      -- fusionné dans un autre item canonique
);

alter table public.items
  add column status item_status not null default 'validated',
  add column submitted_by uuid references public.users(id) on delete set null,
  add column submitted_at timestamptz,
  add column validated_by uuid references public.admin_users(user_id) on delete set null,
  add column validated_at timestamptz,
  add column rejected_by uuid references public.admin_users(user_id) on delete set null,
  add column rejected_at timestamptz,
  add column merged_into_id uuid references public.items(id) on delete set null,
  add column image_credit text;  -- "Photo : Auteur — CC BY-SA via Wikimedia"
```

- `external_source` reste utilisé pour la traçabilité historique mais devient `'user'` ou `'admin'` pour les nouvelles soumissions, et son utilité opérationnelle disparait.
- `(external_source, external_id)` reste UNIQUE pour ne pas casser l'existant ; les nouveaux items ont `external_id = null`.

### 2.2 Aliases

```sql
create table public.item_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (item_id, lower(alias))
);

create index item_aliases_trgm_idx
  on public.item_aliases using gin (alias extensions.gin_trgm_ops);
```

- Alimentée **uniquement** par l'admin :
  - manuellement via la fiche item,
  - automatiquement au moment d'un merge (les titres des items perdants deviennent des alias du gagnant).

### 2.3 Suggestion d'illustration Wikipedia

```sql
create table public.item_image_suggestions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  source_url text not null,        -- URL Wikimedia originale
  thumbnail_url text,              -- 480px preview
  attribution text,                -- auteur + licence (à afficher mini)
  license_code text,               -- 'cc-by-sa-4.0', 'public-domain', etc.
  wikipedia_page_url text,         -- la page d'origine (pour l'admin)
  fetched_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  unique (item_id, source_url)
);
```

- Le background job peut créer plusieurs suggestions par item (top N résultats).
- L'admin n'en accepte qu'une à la fois ; au moment de l'accept on télécharge l'image dans Supabase Storage.

### 2.4 Storage

Bucket privé `item-images`, lecture publique via URL signée long-vie ou via `image_url` rendue publique :

```
item-images/
  {item_id}/main.{jpg|png|webp}
```

À l'acceptation d'une suggestion : download depuis `source_url` côté Edge Function → upload Storage → mise à jour `items.image_url` (URL Supabase publique) + `items.image_credit` (depuis `attribution`).

### 2.5 Récapitulatif RLS

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `items` | `status='validated' OR submitted_by=auth.uid()` | authenticated, force `status='pending'` et `submitted_by=auth.uid()` | admin uniquement (service role) | admin uniquement |
| `item_aliases` | public lecture | admin uniquement | admin uniquement | admin uniquement |
| `item_image_suggestions` | admin uniquement | service role (job) + admin | admin uniquement | admin uniquement |
| `bento_items` | lecture si bento publié **et** item `validated` ; le propriétaire lit toujours | inchangé | inchangé | inchangé |

Le filtre `item validated` dans la lecture publique de `bento_items` est une ceinture/bretelle : la règle "republication impossible si un item est non validé" est appliquée à l'écriture, mais on protège quand même la lecture si une régression arrive.

## 3. Cycle de vie d'un item

```
                  ┌───────────────┐
admin crée  ───▶  │     draft     │  ──▶ validated
                  └───────────────┘

user soumet ───▶  ┌───────────────┐  validate ─▶  validated
                  │    pending    │  reject   ─▶  rejected
                  └───────────────┘
                          │
                          └─ merge ──▶ merged (→ merged_into_id)

validated  ──┬─ merge ──▶ merged (→ merged_into_id)
             └─ reject ─▶ rejected  (dépublie tous les bentos qui le portent)
```

- **`pending` est invisible en recherche** pour tout le monde, y compris l'auteur (sauf via la lecture directe par `id` dans son propre bento).
- **`rejected` post-publication** dépublie tous les bentos qui le contiennent (trigger SQL : à la transition `validated → rejected`, set `published_at = null` sur les bentos concernés). Hypothèse : ça arrive rarement, c'est un cas explicite admin.
- **`merged`** : on **réécrit** physiquement `bento_items.item_id` du loser vers le winner au moment du merge (transaction). `merged_into_id` reste comme trace + redirect d'éventuels caches.
- **Pas de notification user** sur refus en V1.

## 4. Flow utilisateur (mobile)

### 4.1 Recherche

`search-modal.tsx` n'appelle plus les APIs externes. Au lieu de ça :

```ts
// pseudo-code
const { data } = await supabase
  .rpc('search_items', { q: query, category_key: categoryKey, limit: 20 });
```

La fonction SQL `search_items(q text, category_key text, limit int)` :
- filtre `items.status = 'validated'` et `items.category_id = ...`,
- score par `similarity(title, q)` + `max(similarity(alias, q))` joint sur `item_aliases`,
- retourne les meilleurs résultats triés par score.

### 4.2 Pas trouvé → ajouter

Si aucun résultat ou si l'utilisateur veut quand même soumettre :

1. CTA "Ajouter `{query}`".
2. **Anti-doublon** : avant de créer, on fait un second appel `similar_items(q, category_key, threshold=0.4)`. Si match :
   - popup `On a trouvé "Inception (2010)" qui ressemble. C'est ce que tu cherchais ?`,
   - boutons : `Oui, prendre celui-là` (utilise l'item existant) / `Non, ajouter quand même`.
3. À la création : `insert into items (category_id, external_source='user', title=q, submitted_by, submitted_at, status='pending')` + insertion immédiate dans `bento_items` du user.
4. Le composer affiche le slot avec un badge `En attente de validation` et désactive le bouton `Publier`.

### 4.3 Composition / publication

- Le bento est publiable si et seulement si **tous** les `bento_items` pointent vers des items `status='validated'`.
- Côté UI : le bouton "Publier" est disabled tant qu'il y a un slot pending, avec tooltip explicite.
- Côté SQL : la mutation `set published_at = now()` est gardée par une fonction `can_publish_bento(bento_id) returns boolean`.

### 4.4 Que voit l'utilisateur si son item est validé / refusé ?

- **Validé** : la prochaine fois qu'il ouvre l'app, le badge disparait, le bouton "Publier" est dispo. Pas de notif (V1).
- **Refusé** : le `bento_items` correspondant est supprimé par un trigger ou par l'action admin. Le slot redevient vide, l'utilisateur le verra à sa prochaine ouverture.
- **Mergé** : transparent (le `item_id` a été réécrit vers le canonique).

## 5. Flow admin (apps/admin)

Nouvelle section dans l'admin : **Catalogue**, avec 3 sous-pages.

### 5.1 `/catalogue/queue` — file de modération

Liste des `items where status = 'pending'`, triés par défaut **FIFO** (`submitted_at ASC`).

Filtres :
- par catégorie,
- recherche libre,
- "regrouper par similarité" (similarity > 0.5 sur le titre, pour faciliter les merges immédiats).

Pour chaque item, panneau latéral montrant :
- Le titre soumis et la catégorie.
- L'auteur (pseudo) + lien vers son profil.
- **Items similaires** déjà validés (top 5 par similarity), pour offrir un merge immédiat plutôt qu'une validation en doublon.
- Les suggestions d'illustration Wikipedia déjà préparées en background (cf. §6).

Actions disponibles :
- `Valider` (avec ou sans modif titre/sous-titre/année/image),
- `Refuser` (prompt optionnel `Bloquer aussi {pseudo} ?` qui marque l'user comme `blocked` — réutilise le mécanisme existant des blocked_pseudos),
- `Fusionner avec existant` (ouvre un sélecteur d'item validé).

### 5.2 `/catalogue/items` — catalogue complet

Liste paginée de tous les items, filtres par status et catégorie. Édition fiche par fiche : titre, sous-titre, année, image (upload manuel ou via suggestion), aliases (ajout/suppression).

### 5.3 `/catalogue/merge` — outil de fusion

UI :
1. Recherche d'items (toutes catégories, tous statuts sauf `merged`).
2. Sélection multiple (checkbox).
3. Choix du **canonique** (radio).
4. Preview du résultat : `N items → 1, M bento_items réécrits, K alias créés`.
5. Confirmation.

Côté SQL, fonction `admin_merge_items(canonical_id uuid, loser_ids uuid[])` (security definer, callable admin only) :

```sql
-- En une transaction :
update bento_items set item_id = canonical
  where item_id = any(loser_ids);
insert into item_aliases (item_id, alias)
  select canonical, title from items where id = any(loser_ids)
  on conflict do nothing;
update items
  set status = 'merged', merged_into_id = canonical
  where id = any(loser_ids);
```

### 5.4 Création admin manuelle

Sur `/catalogue/items` : bouton `Nouveau`. Crée un item `status='draft'`, l'admin remplit tout, valide quand prêt → `status='validated'`. Un `draft` n'apparait jamais dans la recherche user ni dans la queue user.

### 5.5 Permissions

- `role='admin'` : tout.
- `role='editor'` : valider/refuser/éditer items, mais pas le merge ni le bloc user (à confirmer plus tard si besoin).

## 6. Suggestion d'illustration Wikipedia (background)

### 6.1 Stratégie de source

**MediaWiki Search API** (Wikipedia FR puis EN) comme source principale :
- Plus large couverture qu'une recherche Wikidata pure (notamment pour les artistes, lieux peu connus).
- API simple, sans authentification.

Pour chaque résultat top 3 :
1. `https://fr.wikipedia.org/w/api.php?action=query&titles={title}&prop=pageimages|pageprops&pithumbsize=480`
2. Récupère `thumbnail.source` et `pageimage`.
3. Pour les crédits : `action=query&titles=File:{pageimage}&prop=imageinfo&iiprop=extmetadata` → `Artist`, `LicenseShortName`.

Si rien trouvé en FR, retry en EN.

Wikidata (P18) en backup V2 si la couverture FR/EN ne suffit pas pour les artistes français de niche par exemple.

### 6.2 Déclenchement

> **Périmé (septembre 2026)** : le Database Webhook n'a jamais été posé, et l'Edge Function a été supprimée au profit de `apps/admin/src/lib/wikimedia.ts`. Voir §10.3.

Edge Function Supabase `suggest-item-image`, déclenchée par un **Database Webhook** sur `items` INSERT où `status = 'pending' OR status = 'draft'`.

La fonction :
1. Cherche dans Wikipedia avec `items.title + ' ' + categorie_label` (ex: `"Inception film"`).
2. Pour les 3 meilleurs candidats, insère dans `item_image_suggestions` (status `pending`).
3. Pas de download de l'image à ce stade (on garde juste l'URL et les métadonnées).

### 6.3 Acceptation côté admin

L'admin voit les suggestions dans la fiche item. Click `Utiliser celle-ci` :
- Edge Function `accept-item-image(item_id, suggestion_id)` : download depuis `source_url`, upload vers `item-images/{item_id}/main.ext`, set `items.image_url` + `items.image_credit = attribution`.
- Suggestion passe en `accepted`, les autres `pending` du même item passent en `dismissed`.

Si aucune suggestion ne convient → upload manuel via le formulaire (image_credit reste vide ou à remplir à la main).

### 6.4 Affichage du crédit

Sur la landing (bento public) et sur l'app mobile (bento profil public), si `items.image_credit` non null, on l'affiche en mini sous le visuel : `Crédit : {attribution}` en `text-xs opacity-70`.

## 7. Migration de l'existant

### 7.1 Migration SQL

`supabase/migrations/2026MMDDHHMMSS_items_catalog_maison.sql` (mobile project) :
1. Crée le type `item_status`.
2. Alter `items` (cf. §2.1) — toutes les lignes existantes prennent `status = 'validated'` (default).
3. Crée `item_aliases`, `item_image_suggestions`.
4. Trigger sur transition `validated → rejected` qui dépublie les bentos concernés.
5. Trigger sur insert de `bento_items` qui interdit `published_at != null` si l'item n'est pas `validated`.
6. Met à jour les RLS (cf. §2.5).
7. Crée les fonctions `search_items`, `similar_items`, `admin_merge_items`, `can_publish_bento`.
8. Configure le bucket Storage `item-images`.

### 7.2 Nettoyage code

À supprimer (ou réduire au strict nécessaire) :

```
apps/mobile/src/api/
  ├─ tmdb.ts          [DELETE]
  ├─ musicbrainz.ts   [DELETE]
  ├─ osm.ts           [DELETE]
  ├─ wikidata.ts      [DELETE]
  ├─ wikipedia.ts     [DELETE]
  ├─ search.ts        [DELETE]
  ├─ types.ts         [DELETE]
  └─ items.ts         [NEW] -- wrapper Supabase pour search/submit
```

- `apps/mobile/app/search-modal.tsx` : refactor pour utiliser le wrapper Supabase + gérer la branche "ajouter".
- `apps/mobile/.env.example` : retirer les clés TMDb/MusicBrainz/etc.
- `bento_categories.api_source` : on garde la colonne pour mémoire historique mais on n'en dépend plus côté code. À terme, drop dans une migration V2.

### 7.3 Données

- Items existants : tous `status = 'validated'` (cf. §7.1).
- Aucune purge automatique : si on repère des doublons hérités des APIs, on les nettoie au cas par cas via l'outil de merge admin (§5.3).

## 8. Plan d'implémentation suggéré

Ordre proposé, chaque étape mergeable indépendamment :

1. **Migration SQL** + RLS + seed minimal (PR `feat/catalog-schema`).
2. **Wrapper mobile `items.ts`** + recherche côté app branchée sur Supabase, **sans** flow de soumission. La recherche revient juste sur les items existants. Permet de retirer les APIs externes dès cette étape (PR `feat/mobile-search-supabase`).
3. **Flow soumission user** + popup anti-doublon + badge bento (PR `feat/mobile-item-submission`).
4. **Admin queue + fiche item + validate/reject** (PR `feat/admin-catalog-queue`).
5. **Outil merge admin** + fonction SQL (PR `feat/admin-catalog-merge`).
6. **Edge Function Wikipedia + acceptation admin + Storage** (PR `feat/admin-wikipedia-suggestions`).
7. **Affichage crédit photo** sur la landing + le profil public mobile (PR `feat/image-credit-display`).
8. Nettoyage final : drop colonnes/fichiers devenus inutiles (PR `chore/catalog-cleanup`).

## 9. Questions ouvertes / V2

- Notifications utilisateur (push Expo) sur validation/refus.
- Auto-rejet des items pending non-référencés dans un bento depuis > 7 jours.
- Quotas anti-abus automatiques (combien d'items pending par user).
- ~~Wikidata P18 + P31 sanity check comme deuxième source d'illustration.~~ → fait autrement, cf. §10 (description Wikidata comme contrôle de type).
- ~~Suggestion de merge automatique côté admin via similarity > 0.7 + même catégorie.~~ → fait, cf. §10.
- ~~Source d'images dédiée pour `film` / `series` (TMDb), là où Wikimedia n'a structurellement rien de réutilisable.~~ → fait, cf. §10.2.
- Possibilité pour l'admin de "promouvoir" un alias en titre principal (utile si l'admin change d'avis sur le canonique).

## 10. Automatisation du catalogue (septembre 2026)

Trois scripts Node dans `apps/admin/scripts/`, plus un écran de revue en BO.
Ils tapent le projet Supabase mobile en REST avec la service-role
(`MOBILE_SUPABASE_URL` / `MOBILE_SUPABASE_SERVICE_ROLE_KEY` dans
`apps/admin/.env`). Tous sont en dry-run par défaut : sans `--apply`, rien
n'est écrit.

```bash
pnpm --filter @bento-pop/admin catalog:audit               # état des lieux, lecture seule
pnpm --filter @bento-pop/admin catalog:merge               # doublons : ce qui serait fusionné
pnpm --filter @bento-pop/admin catalog:merge -- --apply
pnpm --filter @bento-pop/admin catalog:merge -- --same-image --apply
pnpm --filter @bento-pop/admin catalog:images -- --limit 10
pnpm --filter @bento-pop/admin catalog:images -- --apply --category place
pnpm --filter @bento-pop/admin catalog:images -- --rehost --apply   # mise en règle du stock
```

Le mode `--rehost` ne cherche rien : il rapatrie dans notre bucket les
images qui pointaient encore sur `upload.wikimedia.org` (héritage des APIs
externes) et leur pose enfin leur crédit. Wikimedia demande de ne pas être
hotlinké par une app, et une image CC BY-SA affichée sans attribution n'est
pas en règle. Les fichiers servis depuis un wiki local (`/wikipedia/en/`)
ne sont pas sur Commons : ce sont des fichiers en fair use, le script les
signale et n'y touche pas.

### 10.1 Dédoublonnage : deux niveaux de confiance

La similarité trigramme seule ne suffit pas à décider : `Rocky 2` et
`Rocky 3` sont à 0.86 l'un de l'autre. Le script sépare donc :

- **Fusion automatique** (`catalog:merge --apply`) : uniquement les titres
  identiques une fois neutralisés casse, accents, ponctuation et année entre
  parenthèses (`joueur du grenier` = `Joueur du Grenier`). Aucune perte
  possible, c'est le doublon d'import ou de saisie.
- **Même illustration** (`catalog:merge --same-image`) : deux items d'une
  même catégorie qui portent la même image sont le même item. Signal gratuit
  depuis que les affiches sont posées automatiquement, et il rattrape ce que
  la similarité de titre rate (« V pour Vendetta » et « V for Vendetta » sont
  à 0.53, sous le seuil). Hors défaut parce qu'il dépend d'un état du
  catalogue plutôt que du seul contenu des items.
- **Suggestion** (rapport `catalog:audit`) : score ≥ 0.55 sans être
  identique. Listé pour arbitrage humain, jamais appliqué.

Garde-fous communs, qui bloquent la fusion dans les deux cas : catégories
différentes, numérotation de franchise différente (chiffres arabes ou
romains), années renseignées et contradictoires, sous-titres renseignés et
contradictoires.

Le canonique est choisi dans cet ordre : le plus référencé dans les bentos,
puis illustré, puis complet, puis le plus ancien. Il hérite ensuite de ce
qui lui manque (image + crédit, année, sous-titre) et des alias de ses
perdants, et prend la meilleure graphie du groupe comme titre affiché
(`joueur du grenier` → `Joueur du Grenier`), l'ancienne devenant un alias.

L'héritage est aussi implémenté côté SQL par la migration
`20260907000000_admin_merge_items_enrichment.sql`, pour que le bouton
« fusionner » du BO se comporte comme le script.

### 10.2 Illustrations : Commons uniquement

`catalog:images` traite les items sans `image_url`, les plus utilisés dans
les bentos d'abord :

1. recherche Wikipedia FR puis EN, avec un indice de catégorie dans la
   requête (`Seven film`) ;
2. typage du candidat par sa **description Wikidata** (« film de Christopher
   Nolan », « vidéaste web française », « commune de France »), comparée à un
   motif par catégorie. C'est ce qui écarte les homonymes ;
3. **le fichier doit être hébergé sur Wikimedia Commons**. Commons n'accepte
   que du réutilisable ; en.wikipedia héberge en local les affiches et
   pochettes sous fair use, qu'on n'a pas le droit de republier. Un fichier
   absent de Commons est écarté ;
4. si titre (similarité ≥ 0.75), type, année et sous-titre concordent :
   téléchargement du rendu 800px, upload dans `item-images/{id}/main.ext`,
   `image_url` + `image_credit` posés sur l'item ;
5. sinon les candidats partent dans `item_image_suggestions` (`pending`).

**`film` et `series` ne passent pas par Wikimedia mais par TMDb.** L'affiche
n'étant jamais libre, ce que Commons propose pour ces pages est une image de
substitution, et 2 acceptations sur 3 étaient fausses (« Braveheart »
renvoyait le film de 1925 tombé dans le domaine public, « Iron Man » une
photo de cosplay).

Le chemin TMDb est plus simple et plus sûr : on interroge `/search/movie` ou
`/search/tv`, donc le type est garanti, et l'année sert à départager
homonymes et remakes (une année d'écart tolérée, TMDb datant la sortie
salle). Auto-acceptation si la similarité de titre est ≥ 0.75 et que l'année
concorde. **L'affiche reste servie par le CDN TMDb** plutôt que copiée dans
notre bucket : c'est ce que font déjà les items historiques, c'est prévu
pour par TMDb, et ça évite de payer l'egress Supabase sur des images qui ne
nous appartiennent pas. Crédit posé : `Affiche : The Movie Database (TMDb)`,
la mention complète exigée par leurs CGU vivant dans l'écran Crédits de
l'app.

Le token est le `EXPO_PUBLIC_TMDB_TOKEN` de `apps/mobile/.env` (token de
lecture v4), lu directement par le script pour ne pas le dupliquer. Il peut
être surchargé par `TMDB_READ_TOKEN` dans l'env du BO. Sans token, les deux
catégories retombent sur Wikimedia en suggestions uniquement.

### 10.3 Revue en BO

`/catalogue/illustrations` liste les items qui ont des suggestions
`pending`, triés par nombre de bentos. Une carte par item, ses candidats
avec vignette, description Wikidata, crédit et lien vers l'article : un clic
pour retenir une image (copiée dans le bucket, créditée), un clic pour tout
écarter. Un item illustré entre-temps sort de la file automatiquement.

La recherche live depuis la file de modération applique le même filtre
Commons et affiche la description Wikidata. Elle vit dans
`apps/admin/src/lib/wikimedia.ts` et non plus dans l'Edge Function
`suggest-item-image`, qui a été supprimée : elle n'avait besoin ni de secret
ni d'accès base, donc la garder imposait un artefact à déployer à part sur
Supabase, avec un compte qui n'est pas forcément celui du poste de travail.
Côté BO, le correctif part avec le déploiement Coolify habituel.

L'instance déployée sur le projet mobile n'appelle plus rien et n'écrit
rien ; elle peut être supprimée depuis le dashboard (Edge Functions →
suggest-item-image → Delete) quand l'occasion se présente.

## 11. Sous-titres (septembre 2026)

Le sous-titre est la seule ligne d'information sous le titre d'un élément :
dans les cases du composer, du fil et des bentos publics de l'app, dans les
résultats de recherche, sur la page publique de la landing et dans son image
de partage. Il tient sur une ligne, le reste est coupé. Mesuré le
17 septembre 2026 sur `bento-pop.com/u/dark_hifus`, à 375 px de large : une
case d'une rangée à deux en affiche environ 23 caractères (la case Artiste du
bento principal), une case d'une rangée à trois environ 16.

### 11.1 La règle

Arbitrée par Clément le 17 septembre 2026.

- **En français, court, et seulement quand il est sûr.** Sinon aucun
  sous-titre, ce qui est un cas normal. Jamais de code (« JP »), de
  vocabulaire de base de données (« Person ») ni de texte en anglais.
- **Ce qu'il dit dépend du type** :

| Type | Sous-titre | Exemples |
|---|---|---|
| Film, Série | l'année de sortie | 2010 |
| Personne | le rôle, en minuscules, avec la nationalité quand elle tient et qu'elle est sûre | rappeur français, compositeur de films |
| Chanson | l'artiste, sans année | Linkin Park |
| Lieu | le pays, dans sa forme courante | États-Unis |
| Livre | l'auteur | Victor Hugo |
| Jeu vidéo | le studio, rien quand il prête à discussion | Nintendo |
| Plat, Activité | rien | |

Les trois dernières lignes sont celles des listes de départ du chantier 15
(§5.7 de `UX-15-NOUVELLES-CATEGORIES.md`). Une chanson ne reprend pas
l'année : celle des anciens imports était souvent celle d'une réédition, et
une année douteuse est pire qu'une année absente. Les descriptions de
créateurs héritées de Wikidata (« vidéaste web et musicien français ») restent
telles quelles, même quand la petite case les coupe.

### 11.2 L'inventaire du 17 septembre 2026

Relevé en lecture seule (GET PostgREST, clé anonyme) après avoir vu
« 浦沢直樹 · JP · Person » sur la page de dark_hifus : 277 items validés, dont
151 avec un sous-titre, et 27 bentos publiés. Les types Jeu vidéo, Livre,
Plat et Activité n'avaient encore aucun item validé.

| Case d'origine | Items | Avec sous-titre | Source | Constat |
|---|---|---|---|---|
| Artiste | 48 | 25 | MusicBrainz | « pays · type · précision », en anglais, sur 19 des 27 bentos publiés |
| Créateur | 39 | 24 | Wikidata | en français, dont 4 hors sujet : Botch (en anglais), Ego, J., Laos |
| Chanson | 54 | 32 | MusicBrainz | « artiste · année », année fausse pour au moins 4 (Lithium 1994 pour 1991) |
| Film | 53 | 30 | TMDb | année de sortie |
| Série | 43 | 22 | TMDb | année de sortie |
| Lieu | 40 | 17 | OSM | pays en français, dont 2 « États-Unis d'Amérique » coupés sur téléphone |

Les items proposés depuis l'app n'ont presque jamais de sous-titre : 5 sur
130. Ces formats ne se recréent plus, les versions publiées n'appelant plus
aucune API (vérifié sur le code de la 0.1.0 du Play Store) : ils ne peuvent
revenir que par une saisie au back-office.

### 11.3 Le correctif

`apps/mobile/supabase/corrections/20260917130000_sous_titres_catalogue.sql`
change la seule colonne `subtitle` de 55 items, sans rien supprimer :

- **25 artistes** : 20 rôles (« mangaka japonais », « compositeur de
  films »…) et 5 sous-titres vidés faute de certitude ([unknown],
  AJ DiSpirito, Alan Lee, Interstate Intercourse, Yuston XIII) ;
- **5 créateurs** : les 4 descriptions hors sujet vidées, « Streameuse
  québécoise » en minuscule ;
- **23 chansons** : l'année retirée, l'artiste gardé ;
- **2 lieux** : « États-Unis d'Amérique » devient « États-Unis ».

Ce n'est pas une migration : aucun schéma ne change, et ces identifiants
n'existent qu'en production. Aucun outil ne lit le dossier `corrections/`.
Le fichier porte son mode d'emploi : aperçu en lecture seule, écriture qui
n'écrase jamais une retouche faite entre-temps, contrôle, retour arrière. Il
a été éprouvé sur le Supabase local, dans une transaction annulée.

**Appliqué en production le 17 septembre 2026**, par le serveur MCP, sur le
feu vert de Clément :

- la requête A a rendu les 55 items `validated`, et un doublon « Daft Punk »
  au statut `merged` qui portait le même sous-titre anglais, laissé tel quel
  puisqu'il ne s'affiche nulle part ;
- la requête B a écrit les 55 items, sans en ignorer aucun, et A relancée ne
  rend plus que ce doublon ;
- vérifié ensuite par GET : les 55 sous-titres sont ceux du fichier, et les
  222 autres items visibles n'ont pas bougé ;
- la page de dark_hifus affiche « 浦沢直樹 · mangaka japonais » depuis sa
  régénération, sous-titre entier à 375 px.

Restent hors du correctif : la colonne `year` des chansons, qui garde ces
années douteuses mais ne s'affiche nulle part hors du back-office, et le
titre « [unknown] », qui s'affiche vide (suivi ouvert par le chantier 7 dans
la roadmap).
