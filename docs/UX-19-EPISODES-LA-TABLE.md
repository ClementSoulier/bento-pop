# Chantier 19 · Émissions et podcasts dans « La table »

> Spécification écrite le 23 octobre 2026, à partir du code de `main`
> (`e6be769`) et de lectures sur la production, en lecture seule : les pages
> publiques de la landing, son flux RSS et la base mobile. Aucune écriture en
> production.
>
> **Arbitrages rendus le 23 octobre 2026**, les cinq premiers de §11, les huit
> suivants pris par la spécification, D13 au lot 1, D14 au lot 3, et ouverts à
> la contestation. En résumé :
> tous les épisodes publiés entrent dans « La table », chacun à sa date, parmi
> les bentos et sans épinglage ; un épisode y prend la forme de la carte
> d'épisode de la landing ; son tap ouvre la plateforme, YouTube pour
> l'émission, celle du podcast pour le podcast ; le lien avec l'édition
> hebdomadaire attend un autre chantier.
>
> **Lot 1 fait le 23 octobre 2026** : la route `GET /api/episodes` sur la
> landing, ses tests et la politique de confidentialité. Prédite sur les
> pages publiques, sa réponse réelle compte les 40 épisodes : 20 émissions
> sur YouTube, 17 podcasts sur Spotify, et 3 podcasts que Spotify n'a pas
> encore repris, ouverts sur leur page du site (D13, §8, lot 1).
>
> **Lot 2 fait le 23 octobre 2026** : dans l'app, la lecture de la route, la
> validation de chaque épisode et sa fusion par date avec les bentos, pures et
> testées, et `EXPO_PUBLIC_LANDING_URL`. Rien encore à l'écran : le lot 3 les
> branche sur « La table » (§8, lot 2).
>
> **Lot 3 fait le 23 octobre 2026** : la carte, son tap et les épisodes dans
> « La table », recettés au simulateur sur les 40 épisodes réels. Le fil attend
> ses épisodes au plus une seconde après ses bentos (D14, §8, lot 3).
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
  bas à droite ; titre sur trois lignes au plus ; **puis où mène le tap, à la
  place de la date que porte l'étiquette (lot 3)**. Environ 300 pt de haut sur
  un iPhone 15, contre 614 pour un bento.
- **Ni animateurs ni invités sur la carte** (D7).

### 5.3 Le tap (D3, D8)

- **Une émission** ouvre sa vidéo sur YouTube
  (`https://www.youtube.com/watch?v=<id>`), dans l'app YouTube si elle est
  installée.
- **Un podcast** ouvre sa page sur sa plateforme, Spotify, Deezer ou Apple
  Podcasts : l'adresse que calcule déjà la landing.
- **Un épisode que sa plateforme n'a pas encore repris** ouvre sa page sur
  bento-pop.com, qui le lit avec son propre fichier, comme le fait déjà le
  site (D13, lot 1). Sa fiche porte alors `A_REMPLACER` ou `TODO_…` au lieu
  d'un identifiant : 3 podcasts sur 20 au 23 octobre 2026.
- **L'app n'ouvre que des adresses `https` de ces quatre plateformes** (D8),
  **et la page du site d'un épisode (D13)**.
- **Le libellé accessible**, d'un seul élément : « Émission Bento Pop, saison
  2, épisode 5 : *titre*. 42 min. Publiée il y a 3 jours. », avec
  l'indication « S'ouvre dans YouTube. ».

### 5.4 Quand la landing ne répond pas (D9)

Le fil s'affiche sans épisode, sans message : les bentos sont le fil, les
épisodes un ajout. ~~La prochaine ouverture de l'onglet~~ **Le prochain
lancement de l'app**, ou un tirer pour rafraîchir, les redemande **: l'onglet
reste monté, comme pour les bentos (lot 3)**.

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

- **Les épisodes** ~~de `getShowEpisodes` et `getPodcastEpisodes`~~ **d'un
  chargeur léger, `getApiEpisodeRows`, au même filtre de visibilité (lot
  1)**, sans date écartés, triés par `publishedAt` décroissant. La vignette :
  `thumbnail_url` en `https`, sinon `youtubeThumbnail(id, 'hq')` pour une
  émission, sinon nulle. `openUrl` : la vidéo YouTube, ou la `pageUrl` de
  `resolveAudioPlatform`, **ou la page de l'épisode sur le site,
  `platform: "site"`, quand l'identifiant n'est pas réel (D13)**.
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
  `bento` ou `episode`, de clés `bento:<id>` et `episode:<kind>:<id>`. **Le
  fil attend les épisodes au plus une seconde après ses bentos (D14, lot 3).**
- **`src/components/feed/~~FeedEpisode.tsx~~ FeedEpisodePost.tsx`** (lot 3) :
  la carte, son étiquette et son tap, `Linking.openURL`.
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

> **Fait le 23 octobre 2026**, sur la branche `feat/ux-19-episodes-la-table`.
>
> - **`src/lib/episodes-api.ts`**, pur : la forme de la réponse, la date
>   (sans date, illisible ou future : écarté), la vignette en `https`
>   seulement, l'adresse du tap par plateforme, et l'ordre total, date
>   décroissante, émission d'abord à date égale, puis l'identifiant.
> - **`getApiEpisodeRows`**, dans `src/content/episodes.ts`, à côté de
>   `getLatestShowEpisode` dont il suit le modèle.
> - **`src/app/api/episodes/route.ts`** : `force-dynamic`, une minute de
>   cache, 503 et `no-store` quand la base ne répond pas, `X-Robots-Tag:
>   noindex`.
> - **La politique de confidentialité**, §2.2 : les vignettes chargées chez
>   YouTube, et le tap qui quitte l'app pour la plateforme.
>
> **Trois écarts à la spécification** :
>
> 1. **Un chargeur léger plutôt que `getShowEpisodes` et
>    `getPodcastEpisodes`.** Ceux du catalogue rendent une liste vide quand
>    la base ne répond pas : la route n'aurait pas pu dire 503, et l'app
>    aurait gardé une minute un « aucun épisode » faux. Ils lisent aussi la
>    description, les invités et les animateurs, que la carte n'affiche pas.
> 2. **D13, la page du site pour un épisode pas encore repris.** Les pages
>    publiques le montrent : 3 podcasts sur 20, dont « Du mont Fuji à
>    Fukushima » du 13 octobre, se lisent sur le site avec le propre fichier
>    de la landing, leur fiche portant `A_REMPLACER` au lieu de l'identifiant
>    Spotify. La route les aurait d'abord envoyés vers
>    `open.spotify.com/episode/A_REMPLACER`. Elle reprend désormais la règle
>    de la page du podcast, `isRealEpisodeId`, et ouvre leur page du site.
>    Même règle pour une émission : `A_REMPLACER` fait onze caractères, la
>    longueur d'un identifiant YouTube, et il est écarté à part.
> 3. **La politique au §2.2, la section de l'app, et non au §2.3.** Le §2.3
>    est périmé : il dit que l'app interroge TMDb, MusicBrainz, Nominatim et
>    Wikidata en temps réel, ce qu'elle ne fait plus depuis le catalogue
>    interne (`src/lib/items.ts`). Laissé tel quel, et signalé à Clément.
>
> **Pour le lot 2** : l'adresse de la page du site suit `NEXT_PUBLIC_SITE_URL`
> de la landing. En recette locale, c'est `http://127.0.0.1:<port>` : l'app
> doit accepter, en plus des quatre plateformes, l'adresse de la landing
> qu'elle a reçue à la compilation (D12), sans exiger `https` pour elle.
>
> **Tests** : 15 unitaires (`episodes-api.test.ts`), et 5 de plus en e2e,
> 38 sur 38. Le Supabase de la landing est désormais branché sur le bouchon,
> qui ne sert des données qu'à la sélection de la route : le reste de la
> landing garde son repli, et ses lectures ne comptent pas parmi celles de
> la base mobile. Sept défauts introduits exprès, tous attrapés : le filtre
> de visibilité retiré et la panne rendue comme une liste vide (e2e), les
> épisodes programmés laissés passer, Apple Podcasts sans son émission, un
> identifiant YouTube qui fabriquerait une autre adresse, une vignette en
> `http`, et `A_REMPLACER` pris pour un identifiant (unitaires).
>
> **Recette locale** : la landing de ce worktree en développement, son
> Supabase sur le bouchon. `/api/episodes` rend six épisodes dans l'ordre
> attendu, une plateforme juste pour chacun, la page du site pour le podcast
> pas encore repris ; `/confidentialite` porte la nouvelle ligne ; aucune
> erreur dans la console ni dans les journaux du serveur.
>
> **Les données réelles**, relevées en lecture seule sur les pages publiques
> faute de clé locale pour le Supabase auto-hébergé : les 20 émissions ont
> leur vidéo YouTube, 17 podcasts leur épisode Spotify, et 3 aucun encore. La
> route en production rendra donc les 40 épisodes, dont 3 ouverts sur le
> site.
>
> **La CI, rejouée en local**, les Actions du dépôt étant désactivées : les
> six étapes de `ci.yml`, sans cache. Lint et typage 8 sur 8 ; tests 226 pour
> l'admin, 192 pour la landing, 726 pour l'app ; e2e 38 sur 38 ; build 3 sur
> 3, `/api/episodes` en route dynamique. Le build de l'admin a d'abord échoué
> dans le chargeur de polices Google (`next/font`, une réponse de Google
> illisible), puis il est passé à la relance : rien de ce lot ne le touche.

### Lot 2 · L'app : les données et la fusion

`src/lib/episodes.ts`, la fusion, leurs tests, `EXPO_PUBLIC_LANDING_URL`.

> **Fait le 23 octobre 2026**, sur la même branche. Rien encore à l'écran :
> `table.tsx` ne lit ni les épisodes ni la fusion avant le lot 3.
>
> - **`src/lib/episodes.ts`**, pur : le type `FeedEpisode` ; `loadEpisodes`,
>   à `fetch` et adresse injectés, et ses options de requête, 5 s de délai, 5
>   minutes de fraîcheur, aucun réessai ; la validation champ par champ, un
>   épisode invalide écarté seul, une vignette douteuse remplacée par le fond
>   plein plutôt que d'écarter l'épisode ; l'adresse du tap (D8) ; la
>   pastille, la durée, le libellé accessible et l'indication du tap.
> - **`src/lib/feed-merge.ts`**, pur :
>   `interleaveFeed(bentos, episodes, complete)` et le type `FeedItem` des
>   éléments de la liste.
> - **`EXPO_PUBLIC_LANDING_URL`** (D12) : lue par `src/lib/landing-url.ts`,
>   passée par `app.config.ts`, documentée dans `.env.example`. Absente ou
>   illisible, elle retombe sur `https://bento-pop.com`.
>
> **Quatre choix que la spécification laissait ouverts** :
>
> 1. **Les adresses lues par une expression régulière, et non par `URL`.**
>    Sous Hermes, `URL` ne tient que par le polyfill qu'importe le client
>    Supabase : le module ne dépend de rien et se teste tel quel dans node.
> 2. **La page du site acceptée en `http`**, mais seulement sur l'origine
>    exacte de la landing compilée, et pour un chemin `/emissions/<slug>` ou
>    `/podcasts/<slug>` : c'est l'adresse de la recette locale,
>    `http://127.0.0.1:<port>`. En production, la landing et ses pages sont
>    en `https`.
> 3. **Un épisode plus ancien que le dernier bento chargé attend la page
>    suivante**, au lieu d'être placé au bout puis de remonter quand elle
>    arrive. La liste d'une page est ainsi le début de la suivante : rien ne
>    saute sous le doigt en défilant. Un test le vérifie.
> 4. **Les dates ramenées à la milliseconde avant `Date.parse`**, par
>    prudence : PostgREST rend jusqu'à six chiffres après la seconde. `relativeDate`
>    les lit déjà telles quelles sous Hermes, mais l'ordre du fil ne doit
>    dépendre d'aucun moteur.
>
> **Tests** : 31 unitaires, 23 pour les épisodes (validation, adresses
> refusées, dates, libellés, chargement et délai) et 8 pour la fusion (tête,
> milieu et fin du fil, page incomplète, dates égales, ordre reçu, aucun
> épisode ou aucun bento, date de bento illisible, clés uniques). Sept
> défauts introduits exprès, tous attrapés : l'épisode après le bento à date
> égale, les épisodes anciens ajoutés avant la fin du fil, les épisodes pris
> dans l'ordre reçu, tout hôte en `https` accepté, la page du site sur
> n'importe quelle origine, une plateforme sans rapport avec le type, une
> vignette en `http` gardée. La plateforme sans rapport a d'abord échappé :
> l'épisode du test portait aussi l'adresse d'une autre plateforme, qui
> suffisait à l'écarter. Le test lui donne désormais une adresse valide pour
> la plateforme annoncée.
>
> **Pour le lot 3** :
>
> - **Les deux requêtes partent ensemble.** Si les épisodes arrivent après
>   la première page de bentos, l'épisode le plus récent s'insère au-dessus
>   d'un fil déjà affiché. À mesurer au simulateur avant de décider s'il faut
>   attendre les deux.
> - **Les vignettes des podcasts sont sur `supabase.bento-pop.com`**,
>   l'instance de l'équipe, en WebP de 78 à 166 ko pour les trois mesurées,
>   qu'`expo-image` lit. Aucun tiers de plus pour la politique de
>   confidentialité.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226 pour
> l'admin, 192 pour la landing, 757 pour l'app, dont les 31 du lot ; e2e 38
> sur 38 ; build 3 sur 3.

### Lot 3 · L'app : la carte et le tap

`FeedEpisode`, son étiquette, le tap, `table.tsx`, l'accessibilité.

> **Fait le 23 octobre 2026**, sur la même branche.
>
> - **`src/components/feed/FeedEpisodePost.tsx`** : l'étiquette, la carte et
>   le tap. La carte reprend celle du site à la largeur des boîtes : bordure de
>   4, rayon de 22, ombre stamp, vignette 16:9 sur fond plein, pastille et
>   durée en chasse fixe, titre en Fredoka sur trois lignes au plus. Le tap
>   passe par `Linking.openURL`. Un seul élément pour VoiceOver et TalkBack,
>   de rôle lien, avec son libellé et l'indication du tap.
> - **`src/components/feed/FeedLabel.tsx`** : l'étiquette des posts, sortie
>   de `FeedPostHeader`, qui garde son interface et son rendu. Celle d'un
>   épisode porte le Popy de la marque sur son jaune, « Bento Pop ·
>   Émission » ou « Bento Pop · Podcast », et la date relative.
> - **`app/(tabs)/table.tsx`** : la requête des épisodes à côté de celle des
>   bentos, la fusion, une liste d'éléments `bento` ou `episode`, et le tirer
>   pour rafraîchir qui redemande les deux.
>
> **Cinq écarts à la spécification** :
>
> 1. **`FeedEpisodePost.tsx` et non `FeedEpisode.tsx`** : `FeedEpisode` est
>    déjà le nom du type, et `table.tsx` importe les deux.
> 2. **La dernière ligne de la carte dit où mène le tap**, « Regarder sur
>    YouTube ↗ », « Écouter sur Spotify ↗ », à la place de la date de la
>    carte du site, que porte l'étiquette comme pour un bento. Le tap quitte
>    l'app : la carte le dit avant.
> 3. **D14, le fil attend ses épisodes au plus une seconde.** Sans attente,
>    des épisodes arrivés après les bentos pousseraient d'un écran un fil déjà
>    affiché, l'épisode le plus récent se plaçant souvent en tête. Au-delà
>    d'une seconde, le fil s'affiche sans eux, et ils s'insèrent à leur
>    arrivée.
> 4. **L'étiquette réserve la place des accents d'Extenda**
>    (`extendaAccentRoom`), comme les titres du chantier 11 : sans elle, le
>    « É » d'« ÉMISSION » serait rogné. Nulle pour un pseudo, elle ne change
>    rien aux bentos.
> 5. **Le titre à 22 pt d'interligne**, et non aux 1,15 em du site : sous la
>    hauteur naturelle de Fredoka, 1,21 em, iOS rognerait les accents des
>    capitales. La pastille, la durée et la dernière ligne prennent Menlo sur
>    iOS et la chasse fixe du système sur Android, comme `font-mono` sur le
>    site : la première police à chasse fixe de l'app.
>
> **Tests** : 2 unitaires de plus, 33 pour les épisodes et la fusion, 759
> pour l'app. Sept défauts introduits exprès, tous attrapés : un podcast
> qu'on « regarderait », une émission du site qu'on « regarderait », les
> étiquettes inversées et le site sans son nom (unitaires), puis une carte
> sans rôle, une carte sans libellé et une pastille sans plafond de police
> (les tests qui lisent le code). L'attente et la fusion dans `table.tsx`
> n'ont pas de test unitaire : elles sont mesurées à la recette ci-dessous.
>
> **Recette au simulateur iPhone 17 Pro**, sur un banc aux données réelles :
> les 40 épisodes reconstitués depuis les pages publiques enregistrées au
> lot 1, servis par un bouchon à la route de la landing de ce worktree, l'app
> sur le Supabase local. Trois dates déplacées parmi les bentos locaux du
> 23 octobre, pour voir la fusion.
>
> - **La route rend les 40 épisodes**, 20 sur YouTube, 17 sur Spotify et 3
>   sur le site, comme prédit au lot 1.
> - **Le fil** : l'émission de 19 h 30 en tête, au-dessus du bento de
>   18 h 37 ; le podcast de 17 h 15 entre les bentos de 17 h 42 et de
>   16 h 54 ; l'émission de 16 h 30 après eux ; puis les 37 autres, de
>   janvier à octobre, après le dernier bento. Le bento local
>   d'« invite5311806 », sans case, n'y est pas : le fil écarte déjà les
>   bentos vides (`mapFeedRow`).
> - **Mesuré au pixel** : la carte fait 338 pt de large, comme la boîte d'un
>   bento ; bordure de 4 pt ; vignette de 330 × 186 pt, du 16:9 ; l'accent du
>   « É » entier. Un titre trop long s'arrête sur trois lignes, par des points
>   de suspension.
> - **Le tap** : la carte Spotify ouvre `open.spotify.com` et l'émission
>   `youtube.com`, dans Safari faute des apps au simulateur, avec le retour
>   vers l'app. Le podcast pas encore repris ouvre
>   `http://127.0.0.1:3212/podcasts/du-mont-fuji-…`, sa page sur la landing
>   compilée (D13) ; le 404 qu'elle y rend vient du bouchon, qui ignore les
>   filtres de la page.
> - **L'accessibilité**, lue dans l'arbre d'iOS : un seul élément, de rôle
>   lien, « Podcast Bento Pop, saison 2, épisode 1 : … 23 minutes. Publié il
>   y a 1 mois. », avec l'indication « S'ouvre dans Spotify. ».
> - **D9 et D14, mesurés à la milliseconde** par un journal provisoire,
>   retiré depuis :
>   - landing à 0,6 s : bentos à +38 ms, fil en attente, puis tout d'un coup
>     à +0,78 s, sans saut ;
>   - landing à 4 s : bentos à +37 ms, fil affiché sans épisode à +1,1 s,
>     épisodes insérés à +4,2 s ;
>   - landing à 7 s : fil sans épisode à +1,1 s, abandon des épisodes à
>     +5,1 s, sans message ;
>   - landing coupée : le fil, sans épisode et sans message.
> - **Le cache HTTP d'iOS garde la réponse de la route une minute**
>   (`max-age=60`), d'un lancement à l'autre : relancée dans la minute,
>   l'app a lu ses épisodes en 17 ms.
>
> **Pour le lot 4** : l'iPhone SE, l'émulateur Pixel 8, VoiceOver et TalkBack
> à la voix, les grandes tailles de police, et l'épisode programmé qui
> apparaît une fois sa date passée (§7.2).
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226 pour
> l'admin, 192 pour la landing, 759 pour l'app ; e2e 38 sur 38 ; build 3 sur
> 3.

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
| **D8** | L'app n'ouvre que des adresses `https` des quatre plateformes, et la page du site d'un épisode (D13) | Pris par la spécification. Une route compromise ne doit pas pouvoir faire ouvrir n'importe quelle adresse |
| **D9** | La landing en panne, le fil s'affiche sans épisode et sans message | Pris par la spécification. Les bentos sont le fil, les épisodes un ajout |
| **D10** | La route se calcule à chaque lecture, avec une minute de cache, comme `feed.xml` | Pris par la spécification. Un épisode programmé apparaît dans la minute qui suit sa date, sans tâche programmée ni purge du back-office |
| **D11** | La route ne rend que les champs que la carte affiche | Pris par la spécification. Ni description, ni invités, ni œuvres citées, ni lien audio : ils viendront avec leur usage |
| **D12** | L'adresse de la landing devient une variable compilée de l'app, `bento-pop.com` par défaut | Pris par la spécification. La recette doit pouvoir pointer une landing locale, comme elle pointe le Supabase local |
| **D13** | Un épisode que sa plateforme n'a pas encore repris garde sa place dans le fil, et s'ouvre sur sa page du site | Pris au lot 1, sur les données réelles : 3 podcasts sur 20, dont le plus récent, n'ont qu'un marqueur `A_REMPLACER` au lieu de leur identifiant Spotify. Les écarter contredirait D1 ; leur page du site les lit avec son propre fichier |
| **D14** | Le fil attend ses épisodes au plus une seconde après ses bentos | Pris au lot 3, sur une mesure : les deux requêtes répondent en des temps voisins, de 125 à 210 ms pour la landing, de 145 à 175 ms pour le Supabase de l'app. Arrivés après, les épisodes pousseraient d'un écran un fil déjà affiché, l'épisode le plus récent se plaçant souvent en tête ; au-delà d'une seconde, le fil s'affiche sans eux (D9) |

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
