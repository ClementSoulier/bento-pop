# Chantier 19 · Émissions et podcasts dans « La table »

> Spécification écrite le 23 octobre 2026, à partir du code de `main`
> (`e6be769`) et de lectures sur la production, en lecture seule : les pages
> publiques de la landing, son flux RSS et la base mobile. Aucune écriture en
> production.
>
> **Arbitrages rendus le 23 octobre 2026**, les cinq premiers de §11, les sept
> suivants pris par la spécification et ouverts à la contestation. En résumé :
> tous les épisodes publiés entrent dans « La table », chacun à sa date, parmi
> les bentos et sans épinglage ; un épisode y prend la forme de la carte
> d'épisode de la landing ; son tap ouvre la plateforme, YouTube pour
> l'émission, celle du podcast pour le podcast ; le lien avec l'édition
> hebdomadaire attend un autre chantier.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 19, [le chantier
> 2](./UX-02-FIL-LA-TABLE.md) pour le fil et [le chantier
> 13](./UX-13-BENTO-HEBDOMADAIRE.md) pour `editions.show_id`. Même sortie store
> unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

« Faire entrer dans le fil les épisodes de l'émission et du podcast Bento Pop,
via l'API de la landing. » Fait quand : un épisode publié dans le back-office
apparaît dans « La table » à sa date de sortie et pas avant, sans nouvelle
version de l'app, et s'ouvre en un tap.

### 1.2 Mesuré le 23 octobre 2026

- **40 épisodes en ligne**, 20 émissions et 20 podcasts, sur les pages
  publiques comme dans le flux RSS, contre 34 au 15 septembre.
- **Un par semaine, le mardi à 18 h** (Paris), depuis janvier : de 3 à 5 par
  mois. Depuis septembre, émission et podcast alternent : podcast le 15/09,
  émission le 22/09, podcast le 29/09, émission le 6/10, podcast le 13/10,
  émission le 20/10.
- **28 bentos publiés**, le premier en mai. Premières publications par mois :
  7 en mai, 1 en juin, 3 en juillet, 9 en août, 4 en septembre, 4 en octobre.
- **Mêlés par date**, la tête du fil compterait depuis septembre 8 bentos et 8
  épisodes ; de janvier à avril, avant le premier bento, 16 épisodes seuls.
- **Aucun épisode publié n'est sans date** (40 sur 40), mais la colonne
  l'accepte, et la landing affiche un épisode sans date.

---

## 2. Objectif et critères de succès

- Un épisode publié dans le back-office apparaît dans « La table » à sa date
  de sortie, et pas avant, sans nouvelle version de l'app ; il s'ouvre en un
  tap sur sa plateforme.
- Le fil reste celui des bentos : un épisode s'y reconnaît au premier coup
  d'œil, et une panne de la landing n'empêche pas le fil de s'afficher.
- Aucun épisode programmé ne se voit avant sa date, ni dans l'app ni par la
  route.

---

## 3. Périmètre

**Dans le chantier** : la route de lecture de la landing ; les épisodes dans
« La table », à leur date ; leur carte et son tap ; l'accessibilité ; la
politique de confidentialité, pour les vignettes que l'app charge chez
YouTube.

**Hors du chantier** :

- les œuvres citées dans un épisode (`mentions`), et leur pont vers les items
  des bentos (§12) ;
- une notification à la sortie d'un épisode : le chantier 17 prévient des
  éditions, pas des épisodes (§12) ;
- l'onglet « Trouver » ;
- une fiche d'épisode dans l'app (D3) ;
- le lien entre un épisode et l'édition qu'il lance (D4) ;
- les visites : le compteur du chantier 8 ne vaut que pour les bentos ;
- le signalement : un épisode est un contenu de l'équipe ;
- les versions publiées, 1.1 et 0.1.0, qui n'appelleront jamais la route.

---

## 4. Ce que disent le code et la base

### 4.1 Le fil

- **`apps/mobile/src/lib/feed.ts`** : `loadFeedPage` lit 8 bentos par page,
  triés `published_at desc, id desc`, par curseur `(published_at, id)` et
  jamais par décalage. Le client Supabase est injecté, donc testable dans
  node.
- **`app/(tabs)/table.tsx`** : `useInfiniteQuery(['feed'])`, une `FlatList`
  dont la clé est l'identifiant du bento, `onEndReached` à 0,6, le tirer pour
  rafraîchir, l'en-tête « Composer mon bento », les états vide et erreur. Un
  post de bento fait environ 614 pt.
- **`src/components/feed/`** : `FeedPost` (l'étiquette d'identité, puis la
  boîte), `FeedPostHeader`, `ribbon.ts` (invité, édition, coup de cœur) et
  `layout.ts` : marge de 32 pt, boîte plafonnée à 420 pt, 8 pt entre
  l'étiquette et sa boîte, 72 pt entre deux posts.

### 4.2 Les épisodes

- **Ils vivent dans le Supabase de la landing**, auto-hébergé sur
  `supabase.bento-pop.com` : `landing_show_episodes` (`youtube_id`) et
  `landing_podcast_episodes` (`spotify_episode_id`, `audio_platform` parmi
  `spotify`, `deezer` et `apple`, `audio_show_id`), créées par
  `supabase/migrations/20260513000000_landing_episodes.sql`. `published_at`
  y est nullable.
- **Seule la landing applique la date**, pas la RLS :
  `apps/landing/src/content/episodes.ts` lit `getShowEpisodes` et
  `getPodcastEpisodes` avec `status = published`, et `publicVisibilityFilter`
  (l. 203) garde les épisodes dont `published_at` est nul ou passé. Lire la
  base de la landing depuis l'app montrerait les épisodes programmés.
- **Les podcasts portent une seconde date**, `audio_published_at`, celle de
  la sortie audio que suit le flux RSS. La page publique suit `published_at`.
- **`src/lib/podcast-platform.ts`** calcule déjà la page d'un épisode sur sa
  plateforme : `open.spotify.com/episode/…`, `www.deezer.com/episode/…` ou
  `podcasts.apple.com/fr/podcast/id…?i=…`.
- **`src/lib/episodes.ts`** : `youtubeThumbnail`, qui donne
  `i.ytimg.com/vi/<id>/hqdefault.jpg`, et `formatDurationShort`.
- **`src/components/EpisodeCard.tsx`** : la carte d'épisode du site, au cadre
  crème, bord de 4, rayon de 22 et ombre stamp ; vignette 16:9, pastille
  « S2 · E5 » en haut à gauche, durée en bas à droite, puis titre, animateurs
  et date. Un podcast sans vignette prend un fond plein et un pictogramme.
- **`src/app/feed.xml/route.ts`**, le flux RSS, est `force-dynamic` avec une
  minute de cache : un épisode y entre à la minute où sa date passe, sans
  tâche programmée. C'est le modèle de la route.
- **La landing n'a aucune API de lecture** : `api/revalidate` (POST, à
  jeton), `api/bento-opened` (chantier 8), `feed.xml` et `.well-known`.
  `robots.ts` ferme `/api/` aux moteurs.
- **Le back-office revalide la landing à chaque enregistrement d'épisode** :
  `/emissions/<slug>` ou `/podcasts/<slug>`, `/sitemap.xml` et `/feed.xml`
  (`apps/admin/src/app/(protected)/emissions/actions.ts:21`,
  `podcasts/actions.ts:20`).

### 4.3 L'app et la landing

- **L'adresse de la landing est en dur dans l'app** (`src/lib/share.ts:15`,
  `app/credits.tsx`, `app/(tabs)/profile.tsx`, `app/onboarding/terms.tsx`) :
  rien ne permet de pointer une landing locale.
- **`expo-linking` est là, `expo-web-browser` non** : `Linking.openURL` ouvre
  l'app de la plateforme quand elle est installée, par ses liens universels,
  et le navigateur sinon.
- **`editions.show_id`**, uuid nullable
  (`apps/mobile/supabase/migrations/20260917100000_editions.sql:48`), est
  réservé par le chantier 13 et lu nulle part.
- **La politique de confidentialité** décrit les lecteurs YouTube, Spotify et
  TikTok de la page d'accueil (§7), pas des vignettes que chargerait l'app.

---

## 5. Design

### 5.1 Ce qui entre dans le fil (D1, D2, D6)

- **Tout épisode publié**, émission ou podcast, dont la date de publication
  est passée, entre dans « La table » à cette date, parmi les bentos, sans
  épinglage.
- **Un épisode programmé n'existe pour l'app qu'à sa date** : la route ne le
  rend pas avant.
- **Un épisode sans date n'entre pas dans le fil** : un fil trié par date n'a
  pas de place pour lui. Il n'y en a aucun aujourd'hui.
- **L'ordre** : date décroissante ; à date égale, l'épisode avant le bento.
  Les épisodes de janvier à avril, plus anciens que le premier bento,
  arrivent après le dernier bento, au bout du fil.

### 5.2 La carte (D5, D7)

- **Une étiquette au-dessus**, comme celle d'un bento : Popy, « BENTO POP ·
  ÉMISSION » ou « BENTO POP · PODCAST », et la date relative, comme un bento.
- **La carte d'épisode de la landing**, à la largeur des boîtes du fil :
  vignette 16:9, YouTube pour l'émission, la vignette du podcast sinon un fond
  plein et un pictogramme ; pastille « S2 · E5 » en haut à gauche ; durée en
  bas à droite ; titre sur trois lignes au plus. Environ 300 pt de haut sur un
  iPhone 15, contre 614 pour un bento.
- **Ni animateurs ni invités sur la carte** (D7).

### 5.3 Le tap (D3, D8)

- **Une émission** ouvre sa vidéo sur YouTube
  (`https://www.youtube.com/watch?v=<id>`), dans l'app YouTube si elle est
  installée.
- **Un podcast** ouvre sa page sur sa plateforme, Spotify, Deezer ou Apple
  Podcasts : l'adresse que calcule déjà la landing.
- **L'app n'ouvre que des adresses `https` de ces quatre plateformes** (D8).
- **Le libellé accessible**, d'un seul élément : « Émission Bento Pop, saison
  2, épisode 5 : *titre*. 42 min. Publiée il y a 3 jours. », avec
  l'indication « S'ouvre dans YouTube. ».

### 5.4 Quand la landing ne répond pas (D9)

Le fil s'affiche sans épisode, sans message : les bentos sont le fil, les
épisodes un ajout. La prochaine ouverture de l'onglet, ou un tirer pour
rafraîchir, les redemande.

---

## 6. Contrat technique

### 6.1 La landing

- **`GET /api/episodes`**, `apps/landing/src/app/api/episodes/route.ts`,
  `force-dynamic` comme `feed.xml` : la visibilité se calcule à la lecture.
  `Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300`
  (D10).
- **La réponse** ne porte que ce que la carte affiche (D11) :

```json
{
  "episodes": [
    {
      "id": "…",
      "kind": "show",
      "slug": "il-reprend-les-generiques-avec-les-vraies-voix-fr",
      "title": "…",
      "publishedAt": "2026-10-20T16:00:00.000Z",
      "season": 2,
      "episodeNumber": 5,
      "durationSeconds": 2530,
      "thumbnailUrl": "https://i.ytimg.com/vi/…/hqdefault.jpg",
      "platform": "youtube",
      "openUrl": "https://www.youtube.com/watch?v=…"
    }
  ]
}
```

- **Les épisodes** de `getShowEpisodes` et `getPodcastEpisodes`, sans date
  écartés, triés par `publishedAt` décroissant. La vignette : `thumbnail_url`,
  sinon `youtubeThumbnail(id, 'hq')` pour une émission, sinon nulle.
  `openUrl` : la vidéo YouTube, ou la `pageUrl` de `resolveAudioPlatform`.
- **La base injoignable** : 503 et `no-store`, comme `feed.xml`.
- **Rien à revalider côté back-office** : la route n'a qu'une minute de cache.

### 6.2 L'app

- **`src/lib/episodes.ts`**, pur et testé sous `node:test` : le type
  `FeedEpisode`, `loadEpisodes` à `fetch` injecté, la validation de chaque
  épisode (champs requis, date lisible, adresse permise, D8 : un épisode
  invalide est écarté, jamais la liste), et le libellé accessible.
- **La fusion**, pure et testée : `interleaveFeed(bentos, episodes,
  complete)` place chaque épisode avant le premier bento plus ancien que lui.
  Un épisode plus ancien que le dernier bento chargé attend la page suivante,
  sauf quand le fil est complet (`!hasNextPage`) : il s'ajoute alors à la
  fin. Les dates se comparent en millisecondes (`Date.parse`), les chaînes de
  PostgREST, à la microseconde, et celles de la landing, à la milliseconde,
  n'ayant pas le même format.
- **`table.tsx`** : une seconde requête, `useQuery(['episodes'])`, valable 5
  minutes et refaite au tirer pour rafraîchir ; la liste rend des éléments
  `bento` ou `episode`, de clés `bento:<id>` et `episode:<kind>:<id>`.
- **`src/components/feed/FeedEpisode.tsx`** : la carte, son étiquette et son
  tap, `Linking.openURL`.
- **`EXPO_PUBLIC_LANDING_URL`** (D12), par défaut `https://bento-pop.com`,
  compilée dans l'app comme l'adresse Supabase.

### 6.3 Garde-fous

- **Aucune fuite d'épisode programmé** : la route filtre à la lecture, et un
  test e2e le vérifie avec un épisode daté du lendemain.
- **Les versions publiées ne voient rien** : elles n'appellent pas la route.
- **La route est publique et sans jeton** : elle ne rend que ce que les pages
  publiques montrent déjà.
- **La politique de confidentialité** : l'app charge les vignettes des
  émissions chez YouTube, qui voit l'adresse IP de l'appareil, comme sur le
  site ; ouvrir un épisode quitte l'app pour la plateforme.

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **La landing** : la route en e2e, contre le bouchon PostgREST, sur les
  champs rendus, le tri, l'épisode futur et l'épisode sans date écartés, la
  vignette résolue, le lien par plateforme et le 503 en panne ; ses fonctions
  de mise en forme en unitaires.
- **L'app** : `episodes.test.ts` (validation, adresses refusées, libellé) et
  la fusion (tête, milieu et fin du fil, page incomplète, dates égales, aucun
  épisode, aucun bento).

### 7.2 Recette

Au simulateur iPhone 17 Pro et SE et à l'émulateur Pixel 8, la landing en
local, l'app pointée dessus par `EXPO_PUBLIC_LANDING_URL` :

1. Les épisodes entre les bentos, à leur date ; le fil défile jusqu'au bout,
   les épisodes de janvier à avril après le dernier bento, sans doublon ni
   trou.
2. Un épisode daté dans quelques minutes : absent, puis présent une fois sa
   date passée, après un tirer pour rafraîchir.
3. Le tap : YouTube pour une émission ; Spotify, Deezer et Apple Podcasts
   pour les podcasts ; au simulateur, sans ces apps, le navigateur.
4. La landing coupée : le fil sans épisode, sans message.
5. VoiceOver et TalkBack sur une carte.
6. L'iPhone SE : la carte et son titre sur trois lignes.

---

## 8. Plan de développement

Effort **M**, comme à la roadmap.

### Lot 1 · La route de la landing

La route, ses tests, la politique de confidentialité.

### Lot 2 · L'app : les données et la fusion

`src/lib/episodes.ts`, la fusion, leurs tests, `EXPO_PUBLIC_LANDING_URL`.

### Lot 3 · L'app : la carte et le tap

`FeedEpisode`, son étiquette, le tap, `table.tsx`, l'accessibilité.

### Lot 4 · Recette et documents

La recette de §7.2, la DoD point par point, la roadmap, la liste du chantier
29.

---

## 9. Livraison

- **Une PR** pour les quatre lots. La route part en production à la fusion,
  la landing se redéployant d'elle-même, et reste inutilisée jusqu'à la
  sortie store ; aucune migration.
- **À la sortie store** : les épisodes dans « La table ».

---

## 10. Definition of Done

- [ ] Un épisode publié, à date passée, apparaît dans « La table » à sa date,
      entre les bentos
- [ ] Un épisode programmé n'apparaît ni dans l'app ni par la route avant sa
      date, et apparaît dans la minute qui la suit
- [ ] Un épisode sans date n'apparaît pas
- [ ] La carte reprend celle de la landing et se distingue d'un bento au
      premier coup d'œil
- [ ] Le tap ouvre YouTube pour une émission, la plateforme du podcast pour un
      podcast, et rien d'autre
- [ ] Le fil défile jusqu'au bout sans perdre ni doubler un épisode
- [ ] La landing en panne, le fil s'affiche sans épisode et sans message
- [ ] VoiceOver et TalkBack lisent une carte en un seul élément
- [ ] La politique de confidentialité dit que l'app charge les vignettes chez
      YouTube
- [ ] Tests, typage, lint et build verts, CI rejouée en local

---

## 11. Décisions

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | Tous les épisodes publiés entrent dans « La table », chacun à sa date | Choisi le 23 octobre 2026. 40 épisodes contre 28 bentos ; la tête du fil compterait 8 bentos et 8 épisodes depuis septembre. Une seule règle : publié, il apparaît à sa date |
| **D2** | Rangé à sa date, sans épinglage | Choisi le 23 octobre 2026. À un épisode et environ un bento par semaine, le nouvel épisode reste dans les premiers posts toute sa semaine |
| **D3** | Le tap ouvre la plateforme : YouTube, Spotify, Deezer ou Apple Podcasts | Choisi le 23 octobre 2026. Aucun écran à construire ; l'app de la plateforme si elle est installée |
| **D4** | Pas de lien entre un épisode et l'édition qu'il lance dans ce chantier | Choisi le 23 octobre 2026. Aucune édition ne se compose en production avant la sortie store (13, D8) ; `editions.show_id` reste réservé |
| **D5** | La carte d'épisode de la landing, à la largeur des boîtes du fil | Choisi le 23 octobre 2026. Environ 300 pt contre 614 pour un bento : on la distingue au premier coup d'œil |
| **D6** | Un épisode sans date n'entre pas dans le fil | Pris par la spécification. Un fil trié par date n'a pas de place pour lui ; aucun aujourd'hui, sur 40 |
| **D7** | Ni animateurs ni invités sur la carte | Pris par la spécification. Les animateurs sont les mêmes chaque semaine, les invités sont dans le titre ; la carte reste lisible à 300 pt |
| **D8** | L'app n'ouvre que des adresses `https` des quatre plateformes | Pris par la spécification. Une route compromise ne doit pas pouvoir faire ouvrir n'importe quelle adresse |
| **D9** | La landing en panne, le fil s'affiche sans épisode et sans message | Pris par la spécification. Les bentos sont le fil, les épisodes un ajout |
| **D10** | La route se calcule à chaque lecture, avec une minute de cache, comme `feed.xml` | Pris par la spécification. Un épisode programmé apparaît dans la minute qui suit sa date, sans tâche programmée ni purge du back-office |
| **D11** | La route ne rend que les champs que la carte affiche | Pris par la spécification. Ni description, ni invités, ni œuvres citées, ni lien audio : ils viendront avec leur usage |
| **D12** | L'adresse de la landing devient une variable compilée de l'app, `bento-pop.com` par défaut | Pris par la spécification. La recette doit pouvoir pointer une landing locale, comme elle pointe le Supabase local |

---

## 12. Suivis

- **Les œuvres citées** (`mentions`) : un pont vers les items des bentos,
  « cet épisode parle de Dune, présent dans 4 bentos ».
- **Une notification à la sortie d'un épisode**, au régime éditorial du
  chantier 17.
- **Le lien entre un épisode et son édition** (13), par `editions.show_id`.
- **Les épisodes dans « Trouver »**.
- **Après la sortie** : la part des taps qui vont aux épisodes, pour revoir
  D1 et D2 avec des chiffres.
