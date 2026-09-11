# UX-01 · Page bento publique `/u/[pseudo]` + image Open Graph

> Chantier 1 de [`MON-BENTO-POP-UX-ROADMAP.md`](./MON-BENTO-POP-UX-ROADMAP.md).
> **Statut : spécifié, pas encore développé.** Rédigé le 11 septembre 2026.
>
> Ce document est la référence d'implémentation. Toute divergence pendant le dev se règle en modifiant ce document, pas en silence.

---

## 1. Problème

`shareBento()` (`apps/mobile/src/lib/share.ts:19`) partage `https://bento-pop.com/u/<pseudo>`.

Cette route n'existe pas. `apps/landing/src/app/` ne contient que `emissions`, `podcasts` et les pages légales. Conséquences mesurées :

| Situation | Comportement actuel |
|---|---|
| Destinataire **sans** l'app, clic sur le lien | `not-found.tsx`, erreur 404 |
| Lien collé dans Discord, iMessage, WhatsApp, X | Aucun aperçu, juste une URL nue |
| Destinataire **avec** l'app | Ouvre l'app correctement (universal links OK) |

Les universal links sont bien câblés (`apps/landing/src/app/.well-known/apple-app-site-association/route.ts` déclare `paths: ['/u/*']`, et `assetlinks.json/route.ts` le pendant Android), donc le seul trou est la page web elle-même.

**Chaque partage réussi est aujourd'hui une acquisition perdue.**

## 2. Objectif et critères de succès

Transformer un lien partagé en page d'atterrissage qui affiche le bento immédiatement, puis convertit vers l'app.

**Critères d'acceptation, vérifiables :**

1. `GET /u/<pseudo publié>` renvoie 200 et le HTML contient les 6 cases du bento.
2. `GET /u/<pseudo inconnu>` renvoie **404** (pas 200 avec un message).
3. Le HTML contient `og:image`, `og:title`, `og:description`, `twitter:card`, en URLs absolues.
4. L'image OG renvoie un PNG 1200×630 valide, **inférieur à 300 Ko** (contrainte WhatsApp).
5. La page n'ajoute **aucun kilo-octet de JavaScript client** par rapport au layout racine.
6. LCP mobile inférieur à 1,8 s et CLS égal à 0, mesurés en local sur profil « Slow 4G ».
7. Lighthouse mobile : Performance ≥ 95, Accessibilité = 100, SEO ≥ 95, Bonnes pratiques ≥ 95.

## 3. Périmètre

**Dans le périmètre.**

- Page publique `/u/[pseudo]` sur `apps/landing`.
- Image Open Graph dédiée par bento.
- Accès en lecture au projet Supabase **mobile** depuis la landing (nouveau).
- Composants web de rendu du bento (grille, tuiles), réutilisés par la page et par l'image OG.
- Décision et implémentation de la politique d'indexation.
- Mise en place de l'infrastructure de test du monorepo (aujourd'hui absente de la CI).
- Ajout de l'URL publique sur l'image de partage générée par l'app mobile.

**Hors périmètre.**

- Comptage de vues (chantier 8).
- Toute modification de l'app mobile autre que l'URL sur `ShareImage`.
- Page d'index `/u` listant tous les bentos.
- Partage web (Web Share API) depuis la page.

---

## 4. Architecture d'accès aux données

### 4.1 Le problème des deux projets Supabase

La landing ne connaît que le projet **landing** (`src/lib/supabase/server.ts`, types `@bento-pop/supabase`). Les bentos vivent dans le projet **mobile** (types `@bento-pop/supabase-mobile`). Le BO admin gère déjà les deux (`apps/admin/src/lib/supabase/mobile.ts`), mais en **service-role**.

**Décision : la landing utilise la clé `anon` du projet mobile, jamais la service-role.**

Justification : la RLS du projet mobile autorise déjà exactement ce dont on a besoin, et rien de plus.

| Table | Policy | Lisible en anon |
|---|---|---|
| `users` | `users_read_all` `using (true)` | oui |
| `bentos` | `bentos_read_published` `using (published_at is not null or ...)` | oui, publiés seulement |
| `bento_items` | `bento_items_read_published` | oui, si bento publié |
| `items` | `items_read_validated_or_own_pending` | oui, `status='validated'` seulement |
| Storage `item-images` | `item_images_public_read` | oui, bucket public |

Mettre la service-role du projet mobile sur un site public serait une faute : elle bypasse la RLS et donnerait accès en écriture à toute la base depuis un serveur exposé.

### 4.2 Variables d'environnement

| Variable | Portée | Pourquoi |
|---|---|---|
| `NEXT_PUBLIC_MOBILE_SUPABASE_URL` | build + client | Nécessaire au **build** pour `images.remotePatterns` dans `next.config.ts` et pour l'allowlist de `src/lib/images.ts`, qui est inlinée dans le bundle client |
| `MOBILE_SUPABASE_ANON_KEY` | serveur uniquement | Pas de préfixe `NEXT_PUBLIC_` : la page est intégralement rendue côté serveur, la clé n'a aucune raison de partir au navigateur, même si elle est publique par nature |

**À propager dans quatre endroits, sinon ça casse silencieusement :**

1. `apps/landing/Dockerfile` : `ARG` plus `ENV` dans le stage `builder` pour `NEXT_PUBLIC_MOBILE_SUPABASE_URL` (les `NEXT_PUBLIC_*` sont inlinés au build).
2. `turbo.json` : ajouter les deux variables à `tasks.build.env`, sinon le cache Turbo produit un build avec les mauvaises valeurs.
3. Coolify : variables du service landing.
4. `apps/landing/.env.example` (à créer s'il n'existe pas).

**Piège Docker.** Le stage `deps` du Dockerfile copie explicitement chaque `package.json` du workspace. Ajouter `@bento-pop/supabase-mobile` en dépendance de la landing **sans** ajouter la ligne `COPY packages/supabase-mobile/package.json ./packages/supabase-mobile/` fait échouer `pnpm install --frozen-lockfile` dans l'image. À faire dans le même commit.

### 4.3 Nouveau module

`apps/landing/src/lib/supabase/mobile.ts`

```
createMobileAnonClient(): SupabaseClient<Database> | null
```

- Import des types depuis `@bento-pop/supabase-mobile/types`.
- Retourne `null` si les variables manquent, comme les clients existants. L'appelant traite ce cas comme « bento introuvable », pas comme un crash : une landing déployée sans les variables mobiles doit continuer à servir le reste du site.
- `auth: { persistSession: false, autoRefreshToken: false }`, pas de cookies. Le client doit être utilisable depuis `generateStaticParams`, le sitemap et les pages ISR, exactement comme `createAnonServerClient()`.

---

## 5. Contrat de données et normalisation

### 5.1 Validation du paramètre `pseudo`

Contrainte SQL existante (`20260511000000_initial_schema.sql:45`) :

```sql
constraint pseudo_format check (pseudo ~ '^[A-Za-z0-9_.]{3,20}$')
```

**La même expression régulière doit filtrer le paramètre d'URL avant toute requête**, pour trois raisons :

1. **Sécurité.** `loadPublicBentoByPseudo` côté mobile passe l'entrée brute à `.ilike('pseudo', pseudo)`. Un `%` dans le paramètre devient un joker PostgREST. Sur le web, ce serait une URL du type `/u/%25` capable de faire matcher des lignes arbitraires. La validation en amont ferme la porte.
2. **Coût.** Un crawler ou un scanner qui balaie `/u/<random>` ne doit pas générer un aller-retour Supabase par requête.
3. **Cache.** Un 404 décidé sans I/O est instantané.

Toute valeur qui ne matche pas : `notFound()` immédiat, zéro requête.

### 5.2 Canonicalisation de la casse

L'unicité est posée sur `lower(pseudo)` (`users_pseudo_lower_idx`), donc `/u/Keremasan` et `/u/keremasan` désignent le même utilisateur. Sans traitement, c'est du contenu dupliqué et deux entrées de cache distinctes.

**Règle :** la casse canonique est celle **stockée en base**. Si le segment d'URL en diffère, `permanentRedirect()` (308) vers l'URL canonique. Le `alternates.canonical` des métadonnées pointe toujours sur cette forme.

### 5.3 Requête

Une seule requête, pas deux comme dans `loadPublicBentoByPseudo` :

```
users
  .select('id, pseudo, display_name, bentos!inner(id, published_at, is_featured, bento_items(category_id, items(id, title, subtitle, year, image_url, image_credit)))')
  .ilike('pseudo', validatedPseudo)
  .not('bentos.published_at', 'is', null)
  .maybeSingle()
```

La forme exacte est à valider contre PostgREST au moment du dev ; le point non négociable est **une seule requête** et le filtre `published_at is not null` appliqué côté serveur, pas en JavaScript.

### 5.4 Mapping et cas limites

Le mapping `bento_items[]` vers un objet `Record<CategoryKey, TileData>` doit traiter explicitement :

| Cas | Origine | Comportement attendu |
|---|---|---|
| `items` vaut `null` | l'item a été rejeté ou fusionné après publication, la policy `items_read_validated_or_own_pending` le masque alors que `bento_items_read_published` laisse passer la ligne | case rendue vide, pas de crash, pas de `undefined` affiché |
| `category_id` inconnu | une 7e catégorie ajoutée en base avant le déploiement web | case ignorée |
| moins de 6 cases | bento publié avant que la règle des 6 cases existe | cases manquantes rendues en style « vide » |
| zéro case visible | tous les items rejetés | page rendue avec la frame vide et un message, toujours en 200 |
| `image_url` vaut `null` | item sans illustration | fallback dégradé plus initiale, comme dans l'app |

### 5.5 Palette déterministe (correction d'un défaut existant)

Aujourd'hui, la palette d'une tuile est choisie par l'**index de ligne** du résultat :

```ts
// apps/mobile/src/lib/featured.ts:51 et src/state/session.ts:172 et app/u/[pseudo].tsx:88
paletteKey: PALETTE_KEYS[idx % (PALETTE_KEYS.length - 1)]
```

PostgreSQL ne garantit aucun ordre de lignes sans `ORDER BY`. Le même bento peut donc changer de couleurs entre deux chargements, et n'aura aucune raison d'être identique entre l'app, la page web et l'image OG.

**Décision : la palette est dérivée d'un hash stable de `item.id`.** On réutilise `hashString` (djb2) déjà présent dans `apps/mobile/src/lib/popy-avatar.ts:29`, extrait dans un module partageable.

Conséquence : la page web et l'OG seront cohérents entre eux dès le lot 2. L'alignement de l'app mobile sur la même règle est un **suivi**, à traiter avec le chantier 4 pour ne pas déclencher une release mobile isolée. À noter dans la roadmap.

Même logique pour l'avatar : `popyForPseudo` doit être porté à l'identique côté web pour que l'avatar soit le même que dans l'app.

---

## 6. Spécification UX de la page

### 6.1 Contexte d'usage réel

Le visiteur type arrive **depuis un lien partagé dans une messagerie**, sur mobile, souvent dans un navigateur intégré (Instagram, Messenger, Discord, iMessage). Il ne connaît pas Bento Pop. Il vient voir le bento d'un proche.

Trois conséquences qui pilotent toutes les décisions de cette section :

1. Le bento doit être **visible sans scroller** et être le LCP.
2. Le `<Nav />` complet du site est un obstacle dans ce contexte, il pousse le contenu attendu hors de l'écran.
3. Les navigateurs intégrés **n'honorent pas toujours les universal links**. Un visiteur qui a pourtant l'app peut atterrir sur la page web. Il lui faut une porte de sortie explicite.

### 6.2 Structure

```
┌──────────────────────────────────────┐
│  [logo Bento Pop]        Découvrir → │  barre compacte, pas le Nav complet
├──────────────────────────────────────┤
│         (avatar Popy) ★              │  ★ = badge featured, conditionnel
│            @pseudo                   │  h1
│      Display name · publié le 3 mai  │
│                                      │
│   ┌────────────────────────────┐     │
│   │  ██████ FILM ██████████    │     │
│   │  ┌──────────┬──────────┐   │     │  grille identique à l'app :
│   │  │  SÉRIE   │ ARTISTE  │   │     │  film grand, 2 mid, 3 small
│   │  ├─────┬────┴───┬──────┤   │     │
│   │  │ SON │ CRÉA   │ LIEU │   │     │
│   │  └─────┴────────┴──────┘   │     │
│   └────────────────────────────┘     │
│                                      │
│   ┌────────────────────────────┐     │
│   │  Compose ton bento         │     │  bloc conversion
│   │  [App Store] [Play Store]  │     │
│   │  Déjà l'app ? Ouvrir →     │     │  bentopop://u/<pseudo>
│   └────────────────────────────┘     │
├──────────────────────────────────────┤
│  Footer standard (mentions, privacy) │  + « Signaler ce bento »
└──────────────────────────────────────┘
```

Desktop à partir de `lg` : deux colonnes, bento à gauche (max 520 px), identité plus bloc de conversion à droite, tout au-dessus de la ligne de flottaison.

### 6.3 Décisions de contenu

- **`h1` unique** : `Le bento de @<pseudo>`. Visible, pas un titre masqué. Un seul `h1` dans le document.
- **Barre haute compacte** plutôt que `<Nav />` : logo cliquable vers la home plus un lien discret. Réutiliser `Nav` ferait perdre environ 80 px sur mobile et introduirait un menu client-side inutile ici.
- **Footer standard** conservé : obligations légales et cohérence de site.
- **Signalement.** La page publie du contenu utilisateur sur le domaine de la marque. Il faut un chemin de signalement accessible sans compte : lien `mailto:contact@bento-pop.com` pré-rempli avec le pseudo en objet, dans le footer de la page. C'est le minimum en hébergement d'UGC, et c'est cohérent avec le `submitReport` de l'app.
- **Crédit image** obligatoire sous chaque visuel qui en porte un (`items.image_credit`), obligation CC-BY-SA. Contrairement à l'app (`Tile.tsx:283`, contraste insuffisant à `rgba(255,255,255,0.5)`), la version web respecte un ratio de contraste d'au moins 4,5:1.
- **Pas de compteur, pas de bouton de partage, pas de like.** Hors périmètre, et chaque élément ajouté dilue le CTA unique.

### 6.4 Conversion

- Deux badges store, tous les deux visibles. Pas de détection de plateforme côté serveur : lire le `user-agent` rendrait la page dynamique et tuerait l'ISR, pour un gain marginal.
- `<meta name="apple-itunes-app" content="app-id=6768764158, app-argument=https://bento-pop.com/u/<pseudo>">` : la bannière native Safari iOS, gratuite, qui règle le cas iOS proprement. L'identifiant est déjà connu (`apps/mobile/src/components/AppBlocker.tsx:15`).
- Lien secondaire « Déjà l'app ? Ouvrir dans Mon Bento Pop » vers `bentopop://u/<pseudo>`. Le schéma est déclaré (`app.json`, `scheme: 'bentopop'`) et la route existe. **À vérifier manuellement sur device réel** : avec `expo-router` et `extra.router.origin = false`, la forme exacte peut être `bentopop:///u/<pseudo>`.

### 6.5 États

| État | Statut HTTP | Rendu | Indexation |
|---|---|---|---|
| Bento publié | 200 | page complète | cf. §8 |
| Pseudo malformé | 404 | `not-found` du segment | `noindex` |
| Pseudo inconnu | 404 | `not-found` du segment | `noindex` |
| **Profil existant, bento non publié** | **200** | **écran « pas encore terminé », cf. §6.5.1** | **`noindex`** |
| Variables d'env absentes | 404 | `not-found` du segment | `noindex` |

Le `not-found.tsx` du segment `u/[pseudo]` est spécifique : il reprend le ton de `app/not-found.tsx` mais oriente vers le téléchargement de l'app plutôt que vers les émissions. **Il doit renvoyer un vrai 404**, ce que `notFound()` fait.

#### 6.5.1 Écran « pas encore terminé »

*Décision produit du 11 septembre 2026 : un profil qui existe mais dont le bento n'est pas publié répond **200** avec un écran dédié, pas un 404.*

Raison : le cas le plus fréquent est le propriétaire qui teste son lien avant d'avoir fini, ou un destinataire qui reçoit un lien envoyé trop tôt. Un 404 dit « cette personne n'existe pas », ce qui est faux et décourageant. Un écran d'attente dit « reviens », et convertit quand même.

**Contenu :**

- Avatar Popy et `@pseudo`, comme sur la page normale.
- Une frame bento **entièrement vide**, cases en pointillés, dans le style `EmptyTile` de l'app.
- Titre : `Ce bento n'est pas encore terminé !`
- Sous-titre orienté retour : indiquer que le bento apparaîtra ici dès qu'il sera publié.
- Le même bloc de conversion que la page normale.

**Contraintes techniques :**

- Aucune donnée du bento non publié n'est affichée, et ce n'est pas seulement une règle d'affichage : la policy `bentos_read_published` empêche le client anon de lire ces lignes. Il n'y a donc **rien à filtrer côté application**, l'absence de données est garantie par la base.
- `robots: { index: false, follow: true }` obligatoire. Une page en 200 sans contenu réel serait sinon interprétée par Google comme un *soft 404*, ce qui dégrade l'évaluation du domaine. Le `noindex` supprime le problème à la racine.
- Jamais dans le `sitemap.ts`.
- Même traitement pour un profil qui n'a aucune ligne `bentos` du tout.

### 6.6 Accessibilité, non négociable

- Un seul `h1`, hiérarchie de titres sans saut.
- Chaque tuile est une région étiquetée. Le texte alternatif suit le format déjà retenu dans l'app (`Tile.tsx:311`) : `Film : Interstellar, 2014`.
- Les visuels décoratifs (Popy, rivets de la frame) portent `alt=""` et `aria-hidden`.
- Contraste minimum 4,5:1 sur tout texte, y compris les titres blancs sur photo. La superposition sombre existante doit être vérifiée sur les visuels les plus clairs, pas supposée suffisante.
- Aucune information portée par la seule couleur. Le badge « featured » a un libellé texte, pas seulement une étoile rouge.
- Cibles tactiles d'au moins 44×44 px sur les badges store et le lien deep link.
- Focus visible sur tous les éléments interactifs.
- Le texte doit rester lisible à un zoom de 200 % sans perte de contenu. Attention aux `lineHeight` inférieurs au `fontSize`, un travers présent dans l'app mobile et à ne pas reproduire.
- `prefers-reduced-motion` respecté si une animation est introduite. Par défaut : aucune.

### 6.7 Responsive

- Point de départ 320 px de large (iPhone SE en navigateur intégré, barres comprises).
- La grille conserve **exactement** les proportions de l'app : film 220, mid 134, small 100, gap 10, padding 14, sur une base de 512 px de haut. En web, on exprime ces valeurs en ratio plutôt qu'en pixels fixes, pour éviter le défaut constaté sur `app/u/[pseudo].tsx:322` où un `scale` en dur fait déborder la grille sur petit écran.
- `aspect-ratio` CSS sur chaque tuile pour garantir **CLS = 0** avant chargement des images.

---

## 7. Image Open Graph

### 7.1 Contraintes des plateformes

| Plateforme | Contrainte |
|---|---|
| WhatsApp | image inférieure à environ 300 Ko, sinon aucun aperçu |
| iMessage, Discord, Slack | 1200×630 recommandé, URL absolue |
| X | `twitter:card = summary_large_image` requis pour le grand format |
| Tous | pas de JavaScript, pas de redirection en chaîne, réponse rapide |

La contrainte WhatsApp est la plus dure et c'est le canal de partage le plus probable en France.

**Stratégie :** commencer par la convention de fichier `opengraph-image.tsx` (idiomatique Next), et **faire échouer la CI si le PNG dépasse 300 Ko** (cf. §11.3). Si le budget est dépassé, plan de repli documenté : route handler dédiée qui passe la sortie d'`ImageResponse` dans `sharp` (déjà une dépendance de la landing) pour produire un JPEG qualité 82, et métadonnées pointées explicitement dessus.

### 7.2 Contenu de l'image

Fond jaune Bento, la grille du bento à gauche, à droite l'avatar Popy, `@pseudo`, le display name, le logo Bento Pop et l'URL `bento-pop.com/u/<pseudo>`. L'URL en clair sert quand l'image circule en capture d'écran, hors de tout lien.

### 7.3 Contraintes techniques

- **Polices.** `next/og` exige des buffers de police. Le précédent du repo est l'inlining base64 (`apps/landing/src/app/_og/assets.ts`, dont le commentaire explique que c'est la seule méthode fiable dans tous les runtimes). On suit ce précédent pour `extenda-100-yotta.otf` (174 Ko).
  **Le problème de couverture de glyphes est avéré, pas hypothétique.** Relevé du 11 septembre 2026 sur les 277 items du catalogue : 6 titres contiennent des caractères non latins, dont `ロストアンブレラ`, `稲葉曇`, `浦沢直樹`, `鷺巣詩郎`, ainsi que `Puella Magi Madoka★Magica` (U+2605) et `C‐C‐C` (tiret U+2010, pas un tiret ASCII). Satori rend un carré vide pour tout glyphe absent.
  **Décision :** Extenda est réservée au bloc identité (`@pseudo`, accroche). Les titres d'items utilisent une police à couverture large, embarquée en buffer. Une chaîne de repli par caractère est nécessaire, car aucune police unique ne couvrira latin, japonais et symboles.
  Même contrainte côté page web (§6), mais moins critique : le navigateur applique automatiquement sa propre chaîne de repli. Il faut malgré tout déclarer un `font-family` de secours après `--font-extenda`, sinon les titres japonais s'afficheront dans une police système arbitraire sans cohérence de taille.

  **Statistiques de titres**, utiles au dimensionnement typographique des tuiles et de l'OG : médiane 11 caractères, p95 28, maximum 70 (`Le Monde de Narnia : Le Lion, la sorcière blanche et l'armoire magique`). Le rendu doit être vérifié à 70 caractères, pas seulement sur des titres courts.
- **Images distantes.** `ImageResponse` télécharge lui-même les visuels, sans passer par `next/image`. Au maximum 6 requêtes. Chacune avec un **timeout de 2 s** et un `Promise.allSettled` ; toute image en échec retombe sur le dégradé plus initiale. Une image OG lente est pire qu'une image OG sans photos : le scraper abandonne et il n'y a plus d'aperçu du tout.
- **Ne jamais lever d'exception.** Tout le rendu est enveloppé dans un `try/catch` qui retombe sur une image de marque statique. Une route OG qui throw casse l'aperçu et, avec la convention de fichier, peut faire échouer le rendu de métadonnées.
- **Cache.** L'image est générée au plus une fois par fenêtre de revalidation grâce à l'ISR. Vérifier que le `revalidate` du segment s'applique bien à l'image générée, et sinon poser un `Cache-Control` explicite.
- **`twitter-image`.** Ne pas supposer que Next dérive `twitter:image` de `opengraph-image`. On crée un `twitter-image.tsx` qui réexporte le même composant, et le test de fumée (§11.3) vérifie la présence effective des deux balises dans le HTML.

---

## 8. SEO et politique d'indexation

**Décision proposée, à confirmer avant le lot 4 : `noindex, follow` par défaut, `index` uniquement pour les bentos `is_featured`.**

Raisons :

- Une page de bento, c'est six titres. C'est du contenu mince au sens de Google. Quelques centaines de pages minces quasi identiques peuvent peser sur l'évaluation globale d'un domaine qui ranke aujourd'hui sur la marque et les émissions.
- Le pseudo est du contenu utilisateur non modéré a priori. Un pseudo offensant indexé sur `bento-pop.com` est un risque de marque disproportionné par rapport au gain.
- La modération est manuelle avec un délai annoncé de 24 h. L'indexation, elle, est difficile à défaire vite.
- **L'aperçu Open Graph fonctionne indépendamment de `noindex`.** L'objectif d'acquisition du chantier est donc entièrement atteint dans les deux cas.

Les bentos featured sont curés par l'équipe, donc sûrs, et suffisamment mis en avant pour justifier l'indexation.

Conséquences :

- `generateMetadata` pose `robots: { index: bento.is_featured, follow: true }`.
- `sitemap.ts` ajoute les seules URL featured.
- `generateStaticParams` pré-génère les pseudos featured au build, les autres sont générés à la demande.
- `robots.ts` reste inchangé, on ne bloque pas `/u/` : les crawlers doivent pouvoir lire la page pour honorer le `noindex`, et les scrapers d'aperçu social doivent y accéder.

Données structurées : `ProfilePage` schema.org avec `mainEntity: Person`, uniquement sur les pages indexables.

---

## 9. Performance

### 9.1 Budget

| Métrique | Budget | Vérifié par |
|---|---|---|
| JS client ajouté par la page | **0 Ko** | inspection du build, aucun `'use client'` dans le segment |
| HTML gzip | < 60 Ko | test de fumée |
| LCP mobile Slow 4G | < 1,8 s | Lighthouse manuel |
| CLS | 0 | Lighthouse manuel |
| TTFB en cache ISR chaud | < 100 ms | test de fumée |
| Poids de l'image OG | < 300 Ko | test de fumée, assertion dure |

### 9.2 Rendu

**ISR avec `export const revalidate = 300`.** Un bento change rarement ; 5 minutes est un compromis acceptable entre fraîcheur et charge sur le VPS. Le rendu dynamique par requête est exclu : il ferait payer un aller-retour Supabase à chaque scraper social et à chaque partage viral.

Point d'attention Coolify : le cache incrémental vit dans `.next/cache`. Le Dockerfile documente déjà le montage d'un volume pour `.next/cache/images`. **Il faut étendre ce volume à `.next/cache` entier**, sinon chaque déploiement repart d'un cache froid, ce qui reste correct mais fait retomber temporairement tout le trafic sur Supabase.

Revalidation à la demande : l'endpoint `POST /api/revalidate` existe et est authentifié par token. L'app mobile publie directement dans Supabase sans passer par la landing, donc le câblage complet suppose un webhook base de données. **Hors périmètre de ce chantier**, mais l'endpoint accepte déjà `{ paths: ["/u/<pseudo>"] }` sans modification, ce qui laisse la porte ouverte.

### 9.3 Images

- Toutes les illustrations passent par `SmartImage`, donc par `next/image`, avec `sizes` explicite par taille de tuile.
- `priority` **uniquement** sur la tuile film, qui est le LCP. Le mettre partout annulerait le bénéfice du lazy loading.
- Ajouter les hôtes du catalogue à `images.remotePatterns` (`next.config.ts`) **et** à `OPTIMIZABLE_HOSTS` (`src/lib/images.ts`). Les deux, la duplication est volontaire et documentée dans le code. Un oubli côté `images.ts` fait silencieusement retomber sur un `<img>` brut, et tout le trafic image repart taper la source en taille d'origine.
- `minimumCacheTTL` est déjà à un an et les chemins Storage sont en UUID (`{itemId}/main.{ext}`), donc stables. Rien à changer.

**Relevé de production du 11 septembre 2026**, sur les 277 items validés du catalogue, dont 205 illustrés :

| Hôte | Items | Origine |
|---|---:|---|
| `<ref-mobile>.supabase.co` | 117 | bucket `item-images`, catalogue maison |
| `image.tmdb.org` | 82 | affiches TMDb, items historiques |
| `upload.wikimedia.org` | 5 | photos Wikimedia Commons |
| `coverartarchive.org` | 1 | pochettes MusicBrainz |

Le Storage mobile ne couvre donc que 57 % des illustrations. Se limiter à cet hôte, comme prévu initialement, aurait laissé 43 % des images hors de l'optimiseur. Les trois hôtes tiers sont ajoutés à l'allowlist. Ce sont des hostnames fixes sans joker, donc pas un proxy d'images ouvert, et l'attribution requise est déjà portée par `items.image_credit` (91 items en `Affiche : The Movie Database (TMDb)`).

**Note runtime.** `@supabase/supabase-js` refuse de s'instancier sur Node 20 sans `WebSocket` global. Ce n'est pas un problème dans la landing : Next 15.5 polyfille `globalThis.WebSocket` avec son `ws` embarqué (`next/dist/server/node-environment-baseline.js:9`). En revanche, tout script Node autonome du repo qui construirait un client Supabase sur Node 20 échouerait. À garder en tête pour les harnais de test du lot 7.

**Note egress.** C'est le point critique connu du projet. Sans `next/image`, chaque visiteur télécharge jusqu'à 6 visuels en taille d'origine depuis le Storage mobile. Avec, le serveur Next les récupère une fois et sert du WebP redimensionné depuis son disque.

---

## 10. Sécurité et vie privée

- **Aucune clé service-role** sur la landing pour le projet mobile.
- **Aucun secret dans le HTML.** Le test de fumée vérifie que `MOBILE_SUPABASE_ANON_KEY` n'apparaît nulle part dans la réponse.
- Validation stricte du paramètre d'URL avant toute requête (§5.1).
- La page n'expose que ce qui est déjà public via l'app : pseudo, display name, date de publication, six items. Aucun identifiant technique, aucun `user_id`, aucune donnée d'`auth.users`.
- Le middleware ne tourne que sur `/` (`src/middleware.ts`), donc aucun cookie n'est posé sur `/u/*` et la page reste cacheable au bord. **Ne pas élargir le `matcher`**, le commentaire du fichier explique pourquoi.
- Pas de cookie, pas de tracker, pas d'analytics ajouté par ce chantier. Le bandeau de consentement n'a donc pas à intervenir.

---

## 11. Stratégie de test et QA

### 11.1 État des lieux

Il n'y a **aucun test dans la CI**. `.github/workflows/ci.yml` fait `lint`, `typecheck`, `build`. `turbo.json` n'a pas de tâche `test`. Le seul test du repo, `apps/mobile/src/lib/with-timeout.test.ts`, tourne via `tsx --test` et n'est jamais exécuté automatiquement.

**Le lot 0 corrige ça**, parce qu'écrire des tests qui ne tournent pas en CI ne sert à rien.

- Ajouter une tâche `test` dans `turbo.json`.
- Ajouter une étape `pnpm turbo run test` dans le workflow, entre `typecheck` et `build`.
- Ajouter un script `test` à `apps/landing/package.json`.
- Convention retenue : **`node:test` plus `tsx`**, déjà en place côté mobile. Pas de nouveau framework. Vitest et Jest n'apportent rien de décisif ici et alourdiraient l'installation du monorepo.

### 11.2 Tests unitaires

Modules purs, sans I/O, testés exhaustivement.

**`isValidPseudo`**
- accepte : longueur 3, longueur 20, chiffres, `_`, `.`, majuscules
- rejette : longueur 2, longueur 21, chaîne vide, espace, `%`, `_%`, `/`, `..%2F`, accents, emoji, `null`-ish
- le cas `%` est un test de non-régression de sécurité, à commenter comme tel

**`mapBentoItems`**
- 6 items complets vers 6 cases
- item avec `items: null` vers case vide, pas de throw
- `category_id` inconnu ignoré
- 0 item vers objet vide
- **ordre des lignes inversé produit exactement le même résultat**, y compris les palettes : c'est le test qui verrouille la correction du §5.5

**`paletteForItemId`**
- déterminisme : deux appels, même résultat
- deux identifiants différents ne donnent pas systématiquement la même palette
- ne renvoie jamais `undefined`

**`popyForPseudo` (portage web)**
- résultat identique à l'implémentation mobile sur un jeu de pseudos figé, pour garantir que l'avatar est le même des deux côtés

**`initialOf`**
- accents (`Émilie` donne `É` ou `E`, à figer), chiffre en tête, emoji en tête, chaîne vide, espaces seuls

**`buildBentoMetadata`**
- titre, description, canonical en casse canonique
- `robots.index` vrai si featured, faux sinon
- description tronquée proprement, jamais coupée en plein milieu d'un mot ni au-delà de 160 caractères

### 11.3 Tests d'intégration HTTP

C'est le niveau qui attrape les vraies régressions de ce chantier. Approche : **stub PostgREST**, pas de mock du client Supabase.

Montage :

1. Un serveur Node minimal qui répond du JSON PostgREST canné, démarré sur un port libre.
2. `next build` puis `next start` avec `NEXT_PUBLIC_MOBILE_SUPABASE_URL` pointé sur ce stub.
3. Les assertions tapent le vrai serveur Next en HTTP.

Ce montage exerce le vrai client Supabase, le vrai routage, le vrai rendu et la vraie génération d'image, sans jamais brancher de code de test dans le code de production ni exiger d'identifiants en CI.

Cas couverts :

| Test | Assertion |
|---|---|
| Bento publié | 200, le HTML contient les 6 titres d'items et `@pseudo` |
| Pseudo inconnu | **404**, pas 200 |
| Pseudo malformé (`%`, trop court, trop long) | 404, et **zéro requête reçue par le stub** |
| Bento non publié | **200**, le HTML contient « pas encore terminé », porte `noindex`, et **ne contient aucun titre d'item** |
| Profil sans ligne `bentos` | 200, même écran |
| Casse différente | **308** vers la casse canonique |
| Item rejeté (`items: null`) | 200, la case est vide, aucune trace de `undefined` dans le HTML |
| Métadonnées | `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:image` présents, URLs absolues |
| Indexation | `noindex` présent sur un bento non featured, absent sur un featured |
| Image OG | 200, `content-type: image/png`, en-tête PNG valide, **taille inférieure à 300 Ko**, dimensions 1200×630 |
| Fuite de secret | la clé anon n'apparaît nulle part dans le HTML |
| Poids | HTML gzip inférieur à 60 Ko |
| JS client | aucun bundle de page spécifique au segment `/u` dans le HTML |
| Résilience | stub qui renvoie 500 : la page répond 404 proprement, sans stack trace ni page d'erreur Next |
| Structure a11y | exactement un `<h1>`, tout `<img>` porte un attribut `alt`, `<html lang="fr">` |

### 11.4 QA manuelle, checklist bloquante

À dérouler avant merge, résultats consignés dans la PR.

**Rendu**
- [ ] iPhone SE (375 px) : la grille tient entièrement, aucun débordement, le CTA ne recouvre rien
- [ ] iPhone 15 Pro Max, Pixel 8, iPad, desktop 1440 px
- [ ] Bento à 6 cases, à 3 cases, à 0 case visible
- [ ] Item sans image, item avec crédit long, titre très long, titre en japonais
- [ ] Pseudo de 3 et de 20 caractères, pseudo avec un point

**Partage, sur liens réels**
- [ ] WhatsApp : aperçu affiché avec image
- [ ] iMessage : aperçu affiché
- [ ] Discord : aperçu affiché
- [ ] X : grande carte
- [ ] LinkedIn, Facebook : via leurs débogueurs d'URL respectifs
- [ ] Slack

**Deep link**
- [ ] iOS avec l'app installée : le lien ouvre l'app, pas Safari
- [ ] iOS sans l'app : la page web s'affiche, la bannière Smart App apparaît dans Safari
- [ ] Android avec l'app : le lien ouvre l'app
- [ ] Navigateur intégré Instagram : la page web s'affiche, le lien `bentopop://` ouvre l'app
- [ ] Le lien `bentopop://` ne casse rien si l'app est absente

**Accessibilité**
- [ ] VoiceOver iOS : parcours complet, chaque case annoncée avec sa catégorie et son titre
- [ ] Navigation clavier complète, focus toujours visible
- [ ] Zoom 200 %, aucun texte tronqué ni chevauchement
- [ ] Vérification des contrastes à l'outil sur les tuiles à photo claire
- [ ] Lighthouse Accessibilité = 100

**Performance**
- [ ] Lighthouse mobile Slow 4G : Performance ≥ 95, SEO ≥ 95, Bonnes pratiques ≥ 95
- [ ] Onglet réseau : toutes les images servies en WebP via `/_next/image`, aucune requête directe vers `supabase.co`
- [ ] Second chargement : images servies depuis le cache

**Sécurité**
- [ ] `curl` de la page, recherche de la clé anon dans la sortie : absente
- [ ] `/u/%25`, `/u/../../etc/passwd`, `/u/<script>` : 404 propre

### 11.5 Ce qu'on ne teste pas, assumé

- Pas de Playwright ni de navigateur sans tête en CI : coût d'installation et de maintenance disproportionné pour une page sans JavaScript client. Les assertions structurelles du §11.3 couvrent l'essentiel, le reste passe par la checklist manuelle.
- Pas de test de rendu visuel par capture. À reconsidérer quand plusieurs pages partageront les composants bento.

---

## 12. Plan de développement

Un lot égale un commit. L'ordre est contraint : chaque lot doit laisser la branche verte.

### Lot 0 · Infrastructure de test ✅
- `turbo.json` : tâche `test`
- `.github/workflows/ci.yml` : étape `pnpm turbo run test`, entre `typecheck` et `build`
- Pas de test bidon pour amorcer la chaîne : `apps/mobile` a déjà un script `test` et 6 assertions réelles (`src/lib/with-timeout.test.ts`) qui n'étaient simplement jamais exécutées. Les brancher suffit à prouver le montage.
- Le script `test` de `apps/landing` arrive au lot 2, avec ses premiers vrais tests.
- **Vert quand** : `pnpm turbo run test` exécute la suite mobile. Vérifié, 6 tests passants.

### Lot 1 · Accès données
- `apps/landing/package.json` : dépendance `@bento-pop/supabase-mobile`
- `apps/landing/src/lib/supabase/mobile.ts`
- `next.config.ts` : hôte mobile dans `remotePatterns`
- `src/lib/images.ts` : hôte mobile dans l'allowlist
- `Dockerfile` : `COPY packages/supabase-mobile/package.json`, `ARG` et `ENV` pour `NEXT_PUBLIC_MOBILE_SUPABASE_URL`
- `turbo.json` : les deux variables dans `build.env`
- `.env.example`
- **Vert quand** : `pnpm build` passe avec et sans les variables définies

### Lot 2 · Couche domaine
- `src/lib/bento/pseudo.ts`, `palette.ts`, `popy.ts`, `map.ts`, `queries.ts`
- Tests unitaires du §11.2
- **Vert quand** : tous les tests unitaires passent, couverture complète des cas limites du §5.4

### Lot 3 · Composants de rendu
- `src/components/bento/PublicBentoGrid.tsx`, `PublicBentoTile.tsx`, `PublicBentoEmptyTile.tsx`
- Serveur uniquement, aucun `'use client'`
- Proportions et palettes strictement alignées sur l'app
- **Vert quand** : rendu conforme au visuel de l'app, vérifié côte à côte

### Lot 4 · Page
- `src/app/u/[pseudo]/page.tsx`, `not-found.tsx`
- `generateMetadata`, `generateStaticParams`, `revalidate`, redirection canonique
- Bloc conversion, bannière Smart App, deep link, lien de signalement
- **Vert quand** : la page s'affiche en local sur des données réelles

### Lot 5 · Open Graph
- `src/app/u/[pseudo]/opengraph-image.tsx` et `twitter-image.tsx`
- Police Extenda inlinée, après vérification de couverture de glyphes
- Timeouts, `allSettled`, `try/catch` avec repli de marque
- **Vert quand** : l'image est générée, sous 300 Ko, et validée par les débogueurs sociaux

### Lot 6 · SEO
- `sitemap.ts` : URL featured
- Données structurées `ProfilePage`
- **Vert quand** : le sitemap contient les featured et rien d'autre

### Lot 7 · Tests d'intégration et QA
- Stub PostgREST, harnais `next build` plus `next start`
- Tous les cas du §11.3
- Checklist du §11.4 déroulée et consignée
- **Vert quand** : la CI est verte et la checklist est complète

### Lot 8 · URL sur l'image de partage mobile
- `apps/mobile/src/components/bento/ShareImage.tsx` : ajout de `bento-pop.com/u/<pseudo>`
- **Vert quand** : le PNG capturé porte l'URL lisible
- Inclus dans ce chantier. Le changement partira avec la prochaine release mobile, qui embarquera aussi les chantiers suivants : pas de sortie déclenchée pour lui seul.

---

## 13. Definition of Done

- [ ] Les 7 critères d'acceptation du §2 sont vérifiés
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` passent à la racine
- [ ] Tous les tests du §11.2 et du §11.3 sont écrits et passent en CI
- [ ] La checklist du §11.4 est déroulée, résultats dans la PR
- [ ] Aucun `any`, aucun `@ts-ignore`, aucun `eslint-disable` non justifié par un commentaire
- [ ] Chaque décision non évidente est commentée dans le code, dans le style du repo
- [ ] Les variables d'environnement sont provisionnées dans Coolify **avant** le merge
- [ ] Le volume `.next/cache` est étendu dans Coolify
- [ ] La ligne du chantier 1 est cochée dans la roadmap, avec le numéro de PR

---

## 14. Décisions tranchées

Arbitrées le 11 septembre 2026.

1. **Indexation** (§8) : `noindex, follow` par défaut, `index` uniquement pour les bentos `is_featured`. Le sitemap ne liste que les featured.
2. **Bento non publié** (§6.5.1) : **200** avec l'écran « Ce bento n'est pas encore terminé ! », en `noindex`. Pas de 404.
3. **Lot 8** (§12) : inclus dans le chantier. Beaucoup de travail est prévu avant la prochaine release mobile, donc le changement sur `ShareImage` peut être livré maintenant sans forcer une sortie.

## 15. Suivis générés par ce chantier

À reporter dans la roadmap au moment du merge :

- Aligner l'app mobile sur la palette déterministe (§5.5), sinon l'app et le web afficheront des couleurs différentes pour le même bento.
- Corriger `loadPublicBentoByPseudo` côté mobile, qui passe une entrée non validée à `.ilike` (§5.1).
- Câbler un webhook Supabase vers `POST /api/revalidate` à la publication d'un bento, pour supprimer la fenêtre de 5 minutes (§9.2).
