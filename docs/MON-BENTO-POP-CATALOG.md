# Mon Bento Pop — Catalogue maison

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
- Wikidata P18 + P31 sanity check comme deuxième source d'illustration.
- Suggestion de merge automatique côté admin via similarity > 0.7 + même catégorie.
- Possibilité pour l'admin de "promouvoir" un alias en titre principal (utile si l'admin change d'avis sur le canonique).
