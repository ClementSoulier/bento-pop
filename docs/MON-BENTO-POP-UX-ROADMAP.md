# Mon Bento Pop · Roadmap UX

> **Statut au 13 septembre 2026 : chantiers 1 à 4 et 14 livrés, version 0.2.0 envoyée aux deux stores.** Rédigé le 11 septembre 2026 à partir d'un audit du code de `apps/mobile` (routes, composants bento, state, libs) et de `apps/landing`.
>
> Chaque chantier se traite **un par un**, avec une étape de planification dédiée avant implémentation. Cocher au fur et à mesure et noter la PR en face.

**Légende effort** : S = moins d'une journée · M = 1 à 3 jours · L = plus de 3 jours ou arbitrage produit nécessaire.
**Légende statut** : ⬜ à faire · 🟡 en cours · ✅ livré et vérifié.
**Le numéro est un identifiant stable**, pas un rang : l'ordre d'attaque est celui du tableau. Un chantier inséré prend le numéro suivant disponible et se place à sa position d'attaque, pour ne pas renuméroter des références déjà écrites ailleurs.

**Recette sur simulateur** : mode d'emploi et pièges dans [`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md). Le proxy `apps/mobile/scripts/readonly-proxy.mjs` permet de faire tourner l'app sur les données de production sans rien y écrire.

## Le déploiement du 13 septembre

La **0.2.0** est partie aux deux stores le 13 septembre à 18 h 07, par
`eas build --auto-submit`, sans passer par les consoles. iOS en build 9 sur
TestFlight, Android en versionCode 11 sur le canal interne. Les deux
soumissions ont réussi, ce qui valide au passage que le compte de service
Google est bien rattaché au compte développeur Play, la seule chose qu'aucune
vérification préalable ne pouvait trancher.

Elle embarque les chantiers 2, 3 et 14 côté mobile, plus les deux mécanismes
de mise à jour ajoutés juste avant
([`MISES-A-JOUR-APP.md`](./MISES-A-JOUR-APP.md)).

| Quoi | Où | État |
|---|---|---|
| Migrations SQL du projet mobile | Supabase hébergé | **Appliquées** |
| Back-office et landing | Coolify | **À déployer**, le code est sur `main` |
| App mobile 0.2.0 | TestFlight et canal interne | **Envoyée**, recette appareil à faire |
| Mise en revue App Store | App Store Connect | Geste manuel, volontairement |

## Le versionnage iOS bloque la mise en ligne publique

Découvert le 13 septembre 2026 en réglant `app_config`, et jamais vu avant
parce que personne n'avait comparé le dépôt à ce que les stores servent.

| Où | Version servie |
|---|---|
| App Store, public | **1.1**, depuis le 7 septembre |
| Play Store, public | **0.1.0** |
| `app.json`, TestFlight, canal interne | **0.2.0** |

`app.json` n'a jamais porté `1.1` : son historique est `0.0.1` → `0.1.0` →
`0.2.0`. La version `1.1` a donc été posée hors du dépôt, et les deux
plateformes ont divergé sans que rien ne le signale.

**Conséquence immédiate.** `compareVersions('0.2.0', '1.1')` vaut `-1` : la
build qu'on vient d'envoyer se déclare **plus ancienne** que ce qui est déjà
en ligne sur l'App Store.

**Conséquence bloquante.** App Store Connect refuse de créer une version dont
le numéro n'est pas supérieur au précédent publié. **La 0.2.0 ne peut pas
sortir publiquement sur iOS.** Elle vit sur TestFlight, elle n'ira pas plus
loin sous ce numéro.

**À trancher.** Repartir d'un numéro supérieur à `1.1`, aligné sur les deux
plateformes, `1.2.0` par exemple. Play ne demande que des `versionCode`
croissants, la version affichée peut sauter de `0.1.0` à `1.2.0` sans
problème. Attention : changer `version` change la `runtimeVersion`, donc la
mise à jour à distance publiée aujourd'hui ne s'appliquera pas au nouveau
binaire, et il faudra en republier une.

**Effet de bord assumé sur la recette.** `ios_latest_version` porte désormais
`1.1`, la vérité. La build 0.2.0 de TestFlight, se croyant plus ancienne,
affiche donc le bandeau « nouvelle version dispo ». Ne pas le suivre : il
mène à du code plus ancien. Le bandeau disparaîtra dès que la version sera
repartie au dessus de `1.1`, et en attendant il sert de démonstration que le
mécanisme fonctionne en conditions réelles.

## Les valeurs de `app_config`

Réglées le 13 septembre 2026, elles portaient `0.0.1` et `null` depuis le
28 mai.

| Champ | Valeur | Pourquoi |
|---|---|---|
| `ios_latest_version` | `1.1` | ce que l'App Store sert |
| `android_latest_version` | `0.1.0` | ce que le Play Store sert |
| `ios_min_version` | `0.0.1` | inchangé |
| `android_min_version` | `null` | inchangé |

**Les `min_version` restent volontairement permissives.** Les relever au
niveau du store bloquerait durement la build 0.2.0, qui se déclare plus
ancienne que `1.1` : plus aucun accès à l'app, et aucune issue depuis
l'écran de blocage. Le blocage dur ne se pose qu'en connaissance de cause,
pour retirer de la circulation une version cassée.

**Deux choses à ne pas oublier après la mise en ligne.**

`app_config` est réglé, cf. ci-dessus. À remettre à jour à chaque mise en
ligne, sans quoi le bandeau ne se déclenchera pas.
Back-office → Configuration → Mobile.

Le **lot B, la mise à jour appliquée au lancement, n'a jamais tourné pour de
vrai**. Onze tests unitaires et sa garde `__DEV__` vérifiée, mais aucun
`checkForUpdateAsync` réel. Il ne se recette qu'en publiant une vraie mise à
jour sur la branche `production`, une fois la build installée.

**La checklist appareil accumule quatre chantiers** : haptique du chantier 3,
VoiceOver, taille de police système, fluidité du fil sur build de production,
aperçus de partage, plus les deux cas réseau du démarrage, avion et réseau
très lent.

Reste côté Coolify : `MOBILE_SUPABASE_URL` doit porter `.supabase.co` et non
`.com` (la valeur locale était fausse), et `MOBILE_SUPABASE_SERVICE_ROLE_KEY`
doit être présente en **runtime**, jamais préfixée `NEXT_PUBLIC_`.

---

---

## Ménage en attente

- **36 installations sans pseudo** dans `auth.users`. Volontairement conservées :
  elles sont le compteur d'installations, et les effacer rendrait invisible la
  perte d'un tiers à l'inscription. Arbitrage produit à trancher.
- **Compte d'administration de recette** `recette.bo@bento-pop.com`, à retirer
  de `admin_users` et `auth.users` quand il ne sert plus.
- **Migration `20260911000000_revalidate_landing_on_publish.sql`** du chantier 1,
  toujours pas appliquée, ainsi que ses deux secrets Vault. Sans elle, la page
  publique se rafraîchit toutes les cinq minutes au lieu d'immédiatement.

---

## 0. Ordre d'attaque

| # | Chantier | Impact | Effort | Dépend de | Statut |
|---|---|---|---|---|---|
| 1 | Page web `/u/[pseudo]` + OG image | Acquisition | M | rien | ✅ en production, validée 25/25 · QA device restante · [spec](./UX-01-PAGE-BENTO-PUBLIQUE.md) |
| 2 | « La table » : fil de bentos complets | Rétention | M | rien | 🟡 fusionné (PR #47, CI verte) · DoD 6 remplis / 1 partiel / 1 ouvert · reste la fluidité sur appareil réel · [spec](./UX-02-FIL-LA-TABLE.md) |
| 3 | Recherche d'item : suggestions, autofocus, haptique | Complétion | M | rien | 🟡 fusionné (PR #50) · DoD 9 remplis / 1 partiel · reste l'haptique et VoiceOver sur appareil · [spec](./UX-03-RECHERCHE-ITEM.md) |
| 14 | Back-office : utilisateurs, suppression, bentos éditoriaux | Exploitation | L | rien | 🟡 fusionné (PR #51) · DoD 9 remplis / 1 en attente de livraison mobile · [spec](./UX-14-BACK-OFFICE-UTILISATEURS.md) |
| 4 | `expo-image` sur le reste de l'app | Perf + egress | S | 2 | ✅ **absorbé** par les chantiers 2 et 3, vérifié le 13/09 : les deux seules images distantes de l'app sont sur `expo-image` |
| 5 | Modèle brouillon / publié + dépublication | Confiance | M | rien | 🟡 4 lots livrés, recette faite · reste la migration des privilèges de colonne à appliquer · [spec](./UX-05-BROUILLON-PUBLIE.md) |
| 6 | Onglet « Trouver » : recherche par item | Découverte | M | 2 | ⬜ **prochain** |
| 7 | Page bento public : scale + React Query | Bug + perf | S | rien | ⬜ |
| 8 | Signaux de retour (vues, item validé, réactions) | Rétention | L | 1 | ⬜ |
| 9 | Onboarding : pseudo au moment de publier | Activation | M | 5 | ⬜ |
| 10 | Profil éditable (nom, pseudo, Popy) | Appropriation | S | rien | ⬜ |
| 11 | Accessibilité et polish | Qualité | S | rien | ⬜ |
| 12 | Le « pourquoi » par case | Contenu | L | arbitrage modération | ⬜ |
| 13 | Types de bento (hebdo, thématiques) | Contenu | L | 2 | ⬜ nouveau, à cadrer |

---

## 1. Page web `/u/[pseudo]` + OG image

> **Spécification détaillée : [`UX-01-PAGE-BENTO-PUBLIQUE.md`](./UX-01-PAGE-BENTO-PUBLIQUE.md)** (architecture, UX, SEO, perf, plan de dev en 9 lots, stratégie de test).
>
> **Livré.** PR #45 et #46, fusionnées et déployées. Validateur de production `apps/landing/scripts/verify-prod.sh` : 25 contrôles au vert. Restent la checklist QA sur devices réels (§11.4 de la spec) et l'application de la migration de revalidation côté Supabase mobile.

**Constat.** `shareBento()` partage `https://bento-pop.com/u/<pseudo>` (`apps/mobile/src/lib/share.ts:19`). Cette route **n'existe pas** sur la landing : `apps/landing/src/app/` ne contient que `emissions`, `podcasts` et les pages légales. Les universal links sont bien servis (`apps/landing/src/app/.well-known/apple-app-site-association/route.ts` et `assetlinks.json/route.ts`), donc l'app s'ouvre si elle est installée, mais :

- toute personne sans l'app tombe sur `not-found.tsx` ;
- aucune `opengraph-image`, donc aucun aperçu quand le lien est collé dans Discord, iMessage ou Twitter.

Chaque partage réussi est aujourd'hui une acquisition perdue.

**Proposition.**

- `apps/landing/src/app/u/[pseudo]/page.tsx` en SSR, lecture via le client Supabase **mobile** (`apps/admin/src/lib/supabase/mobile.ts` montre le pattern des deux projets distincts). La RLS autorise déjà la lecture publique des bentos publiés.
- `generateMetadata` avec titre, description et image.
- `apps/landing/src/app/u/[pseudo]/opengraph-image.tsx` : rendu 1200×630 de la grille bento.
- Deux CTA store plus un lien « Compose le tien ».
- Page 404 propre si le pseudo n'existe pas ou si le bento n'est pas publié.

**Bonus même chantier.** `ShareImage.tsx` ne porte que le pseudo. Ajouter `bento-pop.com/u/<pseudo>` en bas de l'image PNG pour fermer la boucle même quand elle circule en capture d'écran.

**Attention.** Voir la note mémoire sur l'egress Supabase : les images du catalogue doivent passer par `next/image` sur la landing, le CDN ignore `cacheControl`.

**Fait quand** : un lien partagé depuis l'app, ouvert sur un device sans l'app, affiche le bento complet et un aperçu riche dans les messageries.

---

## 2. « La table » : fil de bentos complets

> **Spécification détaillée : [`UX-02-FIL-LA-TABLE.md`](./UX-02-FIL-LA-TABLE.md)** (coût des images mesuré, design du post, plan de dev en 6 lots, stratégie de test).

**Constat.** `featured.tsx` n'affiche que les bentos cochés `is_featured` côté BO, sous forme de mini-cartes à dégradés sur lesquelles il faut taper pour voir quoi que ce soit. Relevé en production le 11 septembre 2026 : **3 featured sur 26 bentos publiés**, pour 69 comptes, le plus récent datant du 10 août. L'onglet montre 12 % du contenu, et sa fraîcheur dépend d'un geste manuel mensuel pour un rythme de publication d'un bento tous les deux jours.

**Proposition.** L'onglet devient un **fil social de bentos complets**, renommé « La table ». Un post = l'étiquette d'identité (Popy, pseudo, date relative) plus la boîte bento entière, à l'échelle, tapable vers `/u/[pseudo]`. Pas de carte autour de la boîte : la grille est déjà un objet clos et bordé, l'emballer donnerait deux cadres concentriques.

Les featured restent distingués **à l'intérieur du fil**, à leur date de publication, par une étiquette « COUP DE CŒUR » et une bordure épaissie. Le carrousel de curation et `MiniBentoCard` disparaissent.

**Le point structurant : le coût des images.** Un fil de bentos complets charge 4,25 images par post à 165 Ko de moyenne, soit environ 18 Mo pour les 26 bentos, dont 76 % facturés en egress Supabase. Trois verrous mesurés : les objets Storage sortent en `cache-control: no-cache`, la transformation d'image serveur répond `FeatureNotEnabled`, et les visuels sont compressés trop faiblement (274 Ko pour du 960×540). **`expo-image` et son cache disque deviennent un préalable**, pas une optimisation : c'est le seul levier disponible. La migration de `Tile` est donc absorbée ici, ce qui allège le chantier 4.

**Deux défauts corrigés au passage.** `publishBento` réécrit `published_at` à chaque appel (`bento-actions.ts:66`), donc republier ferait remonter un vieux bento en tête d'un fil où chaque post occupe un écran (correctif avancé depuis le chantier 5). Et `loadFeaturedBentos` avale toute erreur en `return []`, ce qui affiche l'état vide quand Supabase est tombé.

**Fait quand** : l'onglet n'est jamais vide dès qu'un bento est publié, chaque bento est lisible sans taper, et le second passage sur le fil ne retélécharge aucune image.

**Où on en est.** Les cinq lots sont développés et le code est vert (lint, typecheck, 69 tests mobile, `expo export` iOS et Android). La recette a tourné sur simulateur iOS **et sur émulateur Android**, avec les données de production : pagination sur les 26 bentos en 4 pages, cache disque à 106 fichiers pour 17 Mo sur iOS et 107 pour 18 Mo sur Android, capture de partage fonctionnelle sur les deux plateformes, état d'erreur atteint, coup de cœur vu en situation. La DoD compte 6 items remplis, 1 partiel et 1 ouvert (cf. §12 de la spec).

**Deux points restent ouverts.** Ce qui demande une écriture en base (publier, republier, bloquer), qui n'est pas faisable sans toucher à la production. Et **la fluidité, mesurée et non tenue** : 62 % de trames saccadées au défilement rapide sur émulateur Pixel 8, contre 1,3 % pour une application système sur le même appareil. Le chiffre vient d'un build de débogage, donc il exagère, mais l'écart avec le témoin est trop large pour être ignoré. Détail et piste écartée en §12.2 de la spec.

**Confirmé au passage** : le projet Supabase est sur le plan gratuit, 5 Go d'egress par mois, 0,01 consommé. Le fil est le premier écran à charger de vraies photos en volume, donc c'est le premier mois qui dira si le cache disque suffit.

---

## 3. Recherche d'item : suggestions, autofocus, haptique

> **Spécification détaillée : [`UX-03-RECHERCHE-ITEM.md`](./UX-03-RECHERCHE-ITEM.md)**
> (mesures de production, design, contrat de données, plan en 7 lots, DoD, décisions).
>
> **Livré, 7 lots.** Remplir une case passe de 4 taps à 2, soit 12 pour un
> bento complet au lieu de 24. L'écran d'ouverture passe de 78,3 % de crème
> vide à douze propositions du catalogue.
>
> Trois écarts avec le constat ci-dessous, tranchés par la mesure : le
> classement par popularité **n'a pas encore de signal** (au plus 3 items
> choisis 2 fois par catégorie, 0 pour « Chanson »), donc le bloc s'appelle
> « Au menu » et non « Populaires » ; l'`Alert` anti-doublon est
> **démontrablement redondante** avec les résultats déjà affichés (24 cas sur
> 24, toujours au rang 1), elle est supprimée ; et le double tap proposé est
> remplacé par un **tap unique avec annulation par toast**.
>
> Restent l'haptique et VoiceOver sur appareil réel, qu'aucun simulateur ne
> restitue (DoD §11.2).

**Constat** (tout dans `apps/mobile/app/search-modal.tsx`) :

- écran vide à l'ouverture, « Tape pour chercher », alors que six cases sont à remplir ;
- pas d'`autoFocus` ni de `returnKeyType="search"` sur le `TextInput` : un tap perdu, six fois ;
- deux taps pour valider (sélection de la tuile puis « Choisir X » en bas) ;
- le popup anti-doublon est une `Alert` native à trois boutons dont « Ajouter quand même » en `destructive` rouge, ce qui casse la DA et culpabilise une action légitime ;
- pas de `KeyboardAvoidingView` : sur petit écran le clavier peut recouvrir le CTA ;
- `TILE_WIDTH` est figé au chargement du module via `Dimensions.get('window')`.

Côté composer (`apps/mobile/app/(tabs)/compose.tsx`) :

- aucun feedback quand une case se remplit : la modale se ferme, la tuile est là. Pas d'`expo-haptics` dans les dépendances, `react-native-reanimated` est installé mais inutilisé sur cet écran ;
- le CTA principal est `disabled` quand `filled === 0` (`compose.tsx:181`) : un nouvel utilisateur arrive sur un gros bouton grisé.

**Proposition.**

- Suggestions par défaut à l'ouverture : items les plus choisis de la catégorie, via un `count` groupé par `item_id` sur `bento_items` (nouvelle fonction SQL ou vue matérialisée, mise en cache React Query).
- `autoFocus`, `returnKeyType="search"`, `KeyboardAvoidingView`.
- Second tap sur une tuile déjà sélectionnée = validation.
- Remplacer l'`Alert` anti-doublon par une ligne « On a peut-être déjà ça » injectée dans la liste des résultats, ou à défaut par une feuille custom aux couleurs Bento.
- `expo-haptics` sur la validation d'une case, animation Reanimated d'entrée de la tuile, barre de progression animée.
- CTA « Commence par ton film » quand le bento est vide, qui ouvre directement la modale.

**Fait quand** : remplir les six cases se fait sans écran vide, sans tap superflu, et chaque case validée produit une réponse tactile et visuelle.

---

## 14. Back-office : utilisateurs, suppression, bentos éditoriaux

> **Spécification détaillée : [`UX-14-BACK-OFFICE-UTILISATEURS.md`](./UX-14-BACK-OFFICE-UTILISATEURS.md)**
> (entonnoir mesuré, contrat de données, plan en 8 lots, DoD, 11 décisions).
>
> Trois choses que la mesure a apprises et qui commandent le chantier : un
> compte d'authentification **exige un email** (vérifié, 400), donc les
> profils éditoriaux se feront sans compte ; `last_sign_in_at` **ne dit rien**
> de la dernière visite (écart médian de 0,0 s avec la création, 0 cas sur
> 106) ; et **36 installations sur 106 n'ont jamais choisi de pseudo**, un
> tiers, que personne ne voyait.

**Constat.** Le BO admin (`apps/admin`) couvre aujourd'hui le catalogue
d'items, sa modération, les signalements, la configuration mobile et la mise
en avant des bentos publiés (`/bentos`, toggle `is_featured` et
`featured_order`). Il ne sait rien faire des **utilisateurs** eux-mêmes : ni
les lister, ni les supprimer, ni en créer.

Trois manques, de nature différente.

**1. Voir les utilisateurs, avec des statistiques d'usage.** Aucune vue ne
liste les comptes. Les statistiques demandées (dernière connexion, iOS ou
Android, version de l'app) **n'existent nulle part** : `public.users` porte
`pseudo`, `display_name`, `terms_accepted_at`, `created_at`, `updated_at`, et
rien d'autre. L'app lit bien sa propre version et `Platform.OS`, mais
seulement pour le garde-fou de mise à jour forcée
(`src/lib/app-config.ts:88`), et ne les envoie jamais. `auth.users`
(service-role) porte `last_sign_in_at`, mais avec l'anonymous sign-in la
session persiste : cette date vaut en pratique la date de création du compte,
pas une date de dernière visite. **Ce point demande donc une instrumentation
de l'app mobile, pas seulement un écran d'admin**, et les données
n'existeront que pour les comptes qui ouvriront une version postérieure.

**2. Supprimer des utilisateurs, avec un motif tracé.** Rien côté admin.
Côté app, `deleteOwnAccount` supprime la ligne `public.users` et laisse
**`auth.users` orpheline**, ce que la migration `20260511120000` assume
explicitement. Une suppression admin devrait au contraire passer par
`auth.admin.deleteUser`, dont la cascade
(`users.id references auth.users(id) on delete cascade`) nettoie tout. Le
motif de suppression demande une table de journal, et son contenu est un
arbitrage RGPD : conserver un motif et une date se défend, conserver le
pseudo beaucoup moins.

**3. Composer un bento depuis l'admin, pour un créateur.** Des créateurs ont
composé leur bento en vidéo ; il faut pouvoir le recréer dans l'app et le
mettre en avant. Le verrou est structurel :
`public.users.id references auth.users(id)`, donc **un profil ne peut pas
exister sans compte d'authentification**. Créer un tel compte est possible en
service-role, mais la forme qu'on lui donne décide si le créateur pourra un
jour le revendiquer.

**Fait quand** : l'équipe peut, sans toucher au SQL, lister et supprimer un
utilisateur avec traçabilité, et publier le bento d'un créateur invité qui
apparaît dans le fil comme les autres.

**Livré.** Trois migrations, un espace « Utilisateurs » dans le BO, et une
instrumentation de l'app. Ce que la mesure a appris en chemin : un compte
d'authentification exige un email, donc les profils éditoriaux se font sans
compte ; `last_sign_in_at` ne dit rien de la dernière visite ; et **36
installations sur 105 n'ont jamais choisi de pseudo**, un tiers que personne
ne voyait. Restent l'étiquette du fil et la télémétrie, qui partent avec la
prochaine version mobile.

---

## 4. `expo-image` sur le reste de l'app

> **Terminé sans chantier dédié.** Audit du 13 septembre 2026 : l'app ne
> charge d'image distante qu'à **deux endroits**, `components/bento/Tile.tsx`
> et `components/search/ItemTile.tsx`, tous deux sur `expo-image` avec
> `cachePolicy="memory-disk"`, `transition` et `recyclingKey`. Les chantiers 2
> et 3 les ont migrés, chacun pour ses propres besoins.
>
> Tous les `Image` de `react-native` qui subsistent (`AppBlocker`, `Splash`,
> `TopChip`, `ShareImage`, `FeedPostHeader`, `compose`, `profile`,
> `u/[pseudo]`, `onboarding/splash`) portent des **assets locaux** : le logo et
> les mascottes Popy. Ils sont dans le bundle, `expo-image` ne leur
> apporterait aucun cache et ajouterait une dépendance de rendu pour rien.
>
> Le piège du `prefetch` signalé ci-dessous a été traité en même temps :
> `share-image.ts` utilise bien `Image.prefetch` d'`expo-image`, avec la même
> `cachePolicy` que le composant, un appel par URL et un délai de 3 s.

**Constat d'origine.** Toutes les images distantes passent par `<Image>` de React Native : pas de cache disque, pas de placeholder, pas de fondu. Les mêmes visuels du catalogue sont retéléchargés à chaque scroll de À la une.

**Proposition.** Migrer vers `expo-image` : cache disque, `placeholder`, `transition`, `contentFit`. Gain visuel immédiat et réduction directe de l'egress Supabase Storage.

**Périmètre réduit.** `Tile.tsx` et `share-image.ts` sont migrés par le chantier 2, dont ils sont un préalable technique. Il reste `search-modal.tsx`, `search.tsx`, `profile.tsx` et `u/[pseudo].tsx`.

**Fichiers restants** : `search-modal.tsx`, `search.tsx`, `profile.tsx`, `u/[pseudo].tsx`. (`MiniBentoCard.tsx` est supprimé par le chantier 2.)

**Attention.** `share-image.ts` utilise `Image.prefetch` de React Native pour précharger avant `captureRef` (`apps/mobile/src/lib/share-image.ts:18`). À adapter à l'API `expo-image` et à retester sur device réel, la capture est sensible aux races de chargement.

**Fait quand** : plus aucun `Image` de `react-native` sur une URL distante, et le second affichage d'une même liste est instantané.

---

## 5. Modèle brouillon / publié + dépublication

**Constat.** `setBentoSlot` écrit en base immédiatement (`apps/mobile/src/lib/bento-actions.ts:44`), donc toute édition après publication est live tout de suite alors que l'utilisateur croit modifier un brouillon. En plus `publishBento` refait `published_at = now()` à chaque appel (`bento-actions.ts:66`), donc la date « bento publié le X » se réinitialise à chaque republication. Et il n'existe aucun moyen de dépublier son bento sans supprimer son compte.

**Proposition.** Deux options à trancher en planification :

- **A, assumer le live** : une fois publié, le bouton « Publier mon bento » devient « Voir mon bento public », et un bandeau discret indique « Tes modifications sont visibles tout de suite ». Ne pas toucher à `published_at` s'il est déjà posé. Faible coût.
- **B, vrai brouillon** : les modifications restent locales jusqu'au tap sur Publier. Coût plus élevé, réécriture du flux d'écriture des slots, mais modèle mental plus sain.

Dans les deux cas : ajouter « Dépublier mon bento » dans le profil. Le correctif de `publishBento` (ne pas écraser un `published_at` existant) est **avancé au chantier 2**, dont il conditionne le tri du flux.

**Fait quand** : l'utilisateur sait à tout instant si ce qu'il voit est public, et peut se retirer sans supprimer son compte.

---

## 6. Onglet « Trouver » : recherche par item

**Constat.** `search.tsx` ne cherche que par préfixe de pseudo (`apps/mobile/app/(tabs)/search.tsx:44`). On ne connaît pas les pseudos des autres, c'est le paradoxe de l'annuaire. Pire : la requête ne filtre pas les users sans bento publié, donc on peut taper « Voir » et arriver sur « Bento introuvable » (`u/[pseudo].tsx:365`).

**Proposition.** Le chantier 2 ayant absorbé la découverte passive dans « La table », cet onglet se concentre sur la recherche active, en deux entrées :

- la **recherche par item** : « qui a mis Interstellar dans sa case film ? ». La donnée est déjà là dans `bento_items`, c'est le geste social naturel ;
- la recherche par pseudo, avec un `inner join` sur les bentos publiés pour supprimer les résultats morts.

**À cadrer en planification** : sous quelle forme afficher un résultat. Le post plein format de « La table » est trop lourd pour une liste de résultats, et `MiniBentoCard` aura été supprimé. Une variante compacte est à concevoir, ou à récupérer dans l'historique git.

**Fait quand** : on peut trouver quelqu'un sans connaître son pseudo, et aucun résultat de recherche ne mène à un cul-de-sac.

---

## 7. Page bento public : scale et React Query

**Constat.** `u/[pseudo].tsx:322` utilise `scale={0.94}` en dur alors que le composer calcule un scale dynamique (`compose.tsx:110`). Hauteur native de la grille : environ 512pt, soit 481pt à 0.94. Sur un iPhone SE, header profil et grille dépassent la hauteur disponible et les CTA sticky recouvrent la dernière rangée.

Par ailleurs l'écran n'utilise pas React Query : `useEffect` plus `useState` maison, donc pas de cache, pas de retry, rechargement complet à chaque visite. `loadPublicBentoByPseudo` fait deux requêtes séquentielles (`bento-actions.ts:135`).

**Proposition.** Reprendre le calcul de scale dynamique du composer, ou rendre la page scrollable. Passer le chargement en `useQuery`. Fusionner les deux requêtes en une jointure.

**Fait quand** : la grille est entièrement visible sur iPhone SE, et revenir sur un bento déjà consulté est instantané.

---

## 8. Signaux de retour

**Constat.** Une fois publié, il ne se passe plus rien : pas de compteur de vues, pas de réaction, pas de notification (`expo-notifications` absent des dépendances). Cas le plus dur : un utilisateur qui propose un item au catalogue voit sa publication bloquée (`compose.tsx:57`) sans aucun moyen de savoir quand la modération le débloque, sinon rouvrir l'app au hasard.

**Proposition**, par ordre de rapport effort sur impact :

1. **Compteur de vues** : table `bento_views`, affichage sur le profil (« 47 personnes ont ouvert ton bento »). À alimenter aussi depuis la page web du chantier 1.
2. **Notification item validé** : `expo-notifications` plus un trigger côté modération quand un item passe `pending` vers `validated`. Débloque un cul-de-sac réel.
3. **Réaction par case** plutôt que like global : « 12 personnes ont le même film ». Un `count` par `item_id` sur `bento_items`, aucune modération supplémentaire à prévoir.

**Préparé par le chantier 2.** Le post de « La table » réserve le budget de mise en page d'une barre d'actions (`ACTIONS_HEIGHT = 0`), sans rien rendre : pas d'affordance inerte en attendant. L'ajout des likes et commentaires est un changement de constante, pas une reprise de la mise en page.

**Fait quand** : un utilisateur qui rouvre l'app une semaine plus tard trouve quelque chose de nouveau qui le concerne.

---

## 9. Onboarding : pseudo au moment de publier

**Constat.** Parcours actuel : splash, CGU, pseudo, mécanique, composer. On exige un identifiant unique, avec check réseau, avant que l'utilisateur ait vu la moindre valeur.

Détail au passage : la pagination affiche 3 points (`splash.tsx:103` actif 0, `mechanics.tsx:116` actif 2) et l'écran pseudo annonce « ÉTAPE 2 / 3 », mais l'écran CGU s'intercale sans être compté. Le parcours réel fait quatre écrans.

**Proposition.** Laisser composer la case film dès l'entrée, demander le pseudo au moment de publier, quand il y a quelque chose à perdre. Le pseudo peut être pré-généré (`generatePseudoSuggestions` existe déjà dans `apps/mobile/src/lib/pseudo.ts`) et modifiable ensuite.

**Attention.** La gate CGU est une obligation App Store Guideline 1.2 (cf. `docs/STORE-COMPLIANCE.md`), elle doit rester avant toute contribution publique. Et `terms_accepted_at` est posé dans l'`INSERT` de la ligne `users` (`pseudo.tsx:66`), donc décaler la création du profil implique de revoir ce couplage. À cadrer en planification, dépend du chantier 5.

**Fait quand** : un nouvel utilisateur peut remplir sa première case sans avoir créé de compte, et la conformité CGU est préservée.

---

## 10. Profil éditable

**Constat.** Pas d'édition du `display_name`, pas de changement de pseudo, pas de choix du Popy (dérivé d'un hash du pseudo, `apps/mobile/src/lib/popy-avatar.ts:38`).

**Proposition.** Trois formulaires simples. Le choix du Popy nécessite une colonne `users.avatar` (déjà anticipée en commentaire dans `popy-avatar.ts`). Le changement de pseudo doit gérer la redirection des anciens liens ou au minimum prévenir que l'ancienne URL cassera.

**Fait quand** : l'utilisateur peut personnaliser son identité sans supprimer et recréer son compte.

---

## 11. Accessibilité et polish

- La loupe est un **emoji** 🔍 (`search-modal.tsx:238`, `search.tsx:106`) alors que `react-native-svg` et `@expo/vector-icons` sont installés : rendu différent iOS et Android, et lu à voix haute par VoiceOver.
- Plusieurs titres ont un `lineHeight` inférieur au `fontSize` (`fontSize: 28, lineHeight: 26` dans compose, featured, search) : avec la taille de police système augmentée, les glyphes Extenda se font rogner. Aucun `allowFontScaling={false}` ni `maxFontSizeMultiplier` nulle part dans l'app.
- ~~Le crédit image en `rgba(255,255,255,0.5)` sur photo (`Tile.tsx:283`) est sous le seuil de contraste~~. La recette du chantier 2 a montré qu'il se superpose en plus au sous-titre, les deux occupant la même bande basse de la tuile. **Arbitré : accepté tel quel** (cf. D8 de la spec du chantier 2). La mention légale CC-BY-SA reste présente, ce qui est l'obligation ; corriger toucherait `Tile`, donc trois écrans.
- Faute dans le menu de signalement : « Confirme-tu ? » (`u/[pseudo].tsx:427`).
- Les états de chargement sont des `ActivityIndicator` centrés : les remplacer par des squelettes de tuiles sur featured et bento public. *Traité pour « La table » par le chantier 2 ; reste la page bento public.*

---

## 12. Le « pourquoi » par case

**Constat.** Un bento est une image. Rien n'explique pourquoi ces six choix.

**Proposition.** Un champ facultatif d'une ligne par case. C'est ce qui ferait passer le bento du statut d'image à celui de contenu qu'on a envie de lire, et ce qui donnerait matière à une rubrique dans l'émission.

**Arbitrage nécessaire.** C'est du texte libre utilisateur : charge de modération, obligations UGC Apple 1.2, stockage, affichage dans la grille déjà dense. À trancher avant toute implémentation.

---

## 13. Types de bento (hebdo, thématiques)

**Constat.** Un utilisateur, un bento, pour toujours : la table `bentos` porte une contrainte `unique` sur `user_id` (`20260511000000_initial_schema.sql:88`). Une fois les six cases remplies, il n'y a plus rien à composer, et le fil n'a plus rien de neuf à montrer de la part de quelqu'un qui a déjà publié.

**Proposition.** Plusieurs types de bento coexistant dans « La table » : le bento de référence actuel, plus des bentos datés (le bento de la semaine, un bento thématique lié à une émission). Le fil est déjà conçu pour : l'étiquette du post est exposée en prop `ribbon`, pas en booléen `isFeatured`, donc un nouveau type est un libellé et une couleur.

**À cadrer avant toute implémentation** : lever la contrainte `unique (user_id)` et ce que cela implique sur `/u/[pseudo]` (quel bento la page publique montre-t-elle ?), sur l'image de partage, sur les liens déjà en circulation. C'est un changement de modèle, pas un écran.

**Fait quand** : quelqu'un qui a déjà publié son bento a une raison de revenir composer.

---

## Hors périmètre de cette roadmap

Reste hors scope tant que ce n'est pas explicitement demandé : auth avec mot de passe (« claim » de compte), messagerie, commentaires sur les bentos des autres, plusieurs bentos par utilisateur, internationalisation.
