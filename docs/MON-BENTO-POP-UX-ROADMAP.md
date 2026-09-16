# Mon Bento Pop · Roadmap UX

> **Statut au 15 septembre 2026 : chantiers 1 à 7 et 14 livrés, prochain le 15.** Les chantiers 6 et 7 sont sur `main`, dans aucune build ni mise à jour à distance. La 1.2.0 n'est publique sur aucun store : l'App Store sert toujours la 1.1, le Play Store la 0.1.0, relevé le 15 septembre. **Le 15 septembre, l'équipe a donné la suite du produit** : quinze sujets, versés dans les chantiers 15 à 27 et dans le 13 qu'ils recadrent, plus un chantier 28 que la liste supposait. Elle passe devant les chantiers 8 à 12, cf. [la roadmap produit](#la-roadmap-produit-du-15-septembre). Rédigé le 11 septembre 2026 à partir d'un audit du code de `apps/mobile` (routes, composants bento, state, libs) et de `apps/landing`.
>
> Chaque chantier se traite **un par un**, avec une étape de planification dédiée avant implémentation. Cocher au fur et à mesure et noter la PR en face.

**Légende effort** : S = moins d'une journée · M = 1 à 3 jours · L = plus de 3 jours ou arbitrage produit nécessaire.
**Légende statut** : ⬜ à faire · 🟡 en cours · ✅ livré et vérifié.
**Le numéro est un identifiant stable**, pas un rang : l'ordre d'attaque est celui du tableau. Un chantier inséré prend le numéro suivant disponible et se place à sa position d'attaque, pour ne pas renuméroter des références déjà écrites ailleurs.

**Recette sur simulateur** : mode d'emploi et pièges dans [`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md). Le proxy `apps/mobile/scripts/readonly-proxy.mjs` permet de faire tourner l'app sur les données de production sans rien y écrire.

## Le déploiement du 13 septembre

La **0.2.0** est partie aux deux stores le 13 septembre à 18 h 07, par
`eas build --auto-submit`, sans passer par les consoles. iOS en build 9 sur
TestFlight, Android en versionCode 11 sur le canal interne. Elle **restera sur
TestFlight** : son numéro est inférieur à celui déjà publié sur l'App Store,
cf. la section sur le versionnage. La **1.2.0** la remplace. Les deux
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
| App mobile 1.2.0 | TestFlight et canal interne | **livrée** le 13/09 à 22 h 25, iOS build 10, Android versionCode 12, les deux soumissions ont abouti |
| Mise en revue App Store | App Store Connect | geste manuel, volontairement |

## Le versionnage : pourquoi on est passé directement en 1.2.0

Découvert le 13 septembre 2026 en réglant `app_config`, et jamais vu avant
parce que personne n'avait comparé le dépôt à ce que les stores servent.

| Où | Version servie |
|---|---|
| App Store, public | **1.1**, depuis le 7 septembre |
| Play Store, public | **0.1.0** |
| `app.json` avant correction | **0.2.0** |

`app.json` n'a jamais porté `1.1` : son historique est `0.0.1` → `0.1.0` →
`0.2.0`. La version `1.1` a donc été posée hors du dépôt, et les deux
plateformes ont divergé sans que rien ne le signale.

Deux conséquences, dont une bloquante. `compareVersions('0.2.0', '1.1')` vaut
`-1`, donc la build envoyée à 18 h 07 se déclarait **plus ancienne** que ce
qui était déjà en ligne. Et surtout, App Store Connect refuse une version dont
le numéro n'est pas supérieur au précédent publié : **la 0.2.0 ne pouvait pas
sortir publiquement sur iOS.**

**Corrigé en passant `app.json` à `1.2.0`**, supérieure à `1.1` donc
acceptable par Apple, et alignée sur les deux plateformes. Play n'exige que
des `versionCode` croissants, la version affichée peut sauter de `0.1.0` à
`1.2.0` sans difficulté. La 0.2.0 reste sur TestFlight et n'ira pas plus loin.

**Le prix du bump.** `runtimeVersion` suit `version`, donc la mise à jour à
distance publiée à 20 h 09 sur la runtime `0.2.0` **ne s'appliquera pas** au
nouveau binaire. Ce n'est pas une perte : la 1.2.0 est construite depuis le
même code, elle l'embarque déjà. Mais toute mise à jour à distance future
devra viser la runtime `1.2.0`.

**Vérifier avant chaque bump**, c'est désormais dans
[`DEPLOIEMENT-MOBILE.md`](./DEPLOIEMENT-MOBILE.md) :

```bash
curl -s "https://itunes.apple.com/lookup?id=6768764158" | grep -o '"version":"[^"]*"'
```

## Les mises à jour à distance publiées

| Date | Runtime | Contenu | Portée |
|---|---|---|---|
| 13/09, 20 h 09 | `0.2.0` | chantier 5 | build 0.2.0 de TestFlight uniquement, **orpheline** depuis le passage en 1.2.0 |

La 1.2.0 embarque le même code, elle n'a donc besoin d'aucune mise à jour pour
le chantier 5. **Elle n'a pas les chantiers 6 et 7**, fusionnés après elle, et
la runtime `1.2.0` ne sert encore aucune mise à jour : réponse 204 sur iOS
comme sur Android, relevé le 15 septembre.

Aucune dépendance ni configuration native n'a bougé depuis la build 1.2.0 :
`package.json`, `app.json` et `pnpm-lock.yaml` n'ont changé depuis que par le
numéro de version. Les chantiers 6 et 7 peuvent donc partir en mise à jour à
distance sur cette runtime, ou dans une nouvelle build 1.2.0 avant la mise en
revue. À trancher.

La prochaine mise à jour devra viser la runtime **`1.2.0`** :

```bash
npx eas-cli update --branch production --environment production --message "…"
```

Vérifier ce que le serveur sert réellement, plutôt que de le supposer, en
l'interrogeant comme le ferait l'app :

```bash
curl -s "https://u.expo.dev/eecbef8a-0943-4bec-b592-59e4b5016e5f" \
  -H "expo-runtime-version: 1.2.0" -H "expo-platform: ios" \
  -H "expo-channel-name: production" -H "expo-protocol-version: 1" \
  -H "expo-api-version: 1" -H "expo-expect-signature: false" \
  -H "accept: multipart/mixed"
```

C'est ce contrôle qui a confirmé que `extra.SUPABASE_URL` du manifeste pointe
bien sur le bon projet, le piège le plus coûteux du dépôt.

## Les valeurs de `app_config`

Réglées le 13 septembre 2026, elles portaient `0.0.1` et `null` depuis le
28 mai.

| Champ | Valeur | Pourquoi |
|---|---|---|
| `ios_latest_version` | `1.1` | ce que l'App Store sert **aujourd'hui** |
| `android_latest_version` | `0.1.0` | ce que le Play Store sert **aujourd'hui** |
| `ios_min_version` | `0.0.1` | inchangé |
| `android_min_version` | `null` | inchangé |

**À repasser à `1.2.0` le jour où la 1.2.0 est réellement publique**, pas
avant : un `latest_version` qui annonce une version indisponible envoie les
gens sur une fiche de store inchangée.

**Les `min_version` restent volontairement permissives.** Le blocage dur ne
se pose qu'en connaissance de cause, pour retirer de la circulation une
version cassée. Relever cette borne n'offre aucune issue depuis l'écran de
blocage, c'est le geste le plus définitif de toute la configuration.

**Deux choses à ne pas oublier après la mise en ligne.**

`app_config` est réglé, cf. ci-dessus. À remettre à jour à chaque mise en
ligne, sans quoi le bandeau ne se déclenchera pas.
Back-office → Configuration → Mobile.

Le **lot B, la mise à jour appliquée au lancement, n'a jamais tourné pour de
vrai**. Onze tests unitaires et sa garde `__DEV__` vérifiée, mais aucun
`checkForUpdateAsync` réel. Il ne se recette qu'en publiant une vraie mise à
jour sur la branche `production`, une fois la build installée.

**La checklist appareil, allégée par le chantier 11.** Tranchés au simulateur et
à l'émulateur : la taille de police système sur tous les écrans (§4.2 à §4.4 de
la spec), les rôles et libellés du lecteur d'écran (§4.5), le démarrage en réseau
très lent (§4.6). **Restent à l'appareil réel** : l'haptique du chantier 3, la
lecture VoiceOver et TalkBack d'un parcours complet, la fluidité du fil sur une
build de production, les aperçus de partage dans deux messageries, et le
démarrage en mode avion, qu'une build de développement ne peut pas montrer
puisqu'elle charge son code depuis Metro.

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
- **Quatre failles de privilèges, relevées, corrigées et fermées en production
  le 15 septembre 2026**, de la même famille que `is_featured` (PR #61).
  Migration `20260915000000_close_privilege_gaps.sql` appliquée le jour même :
  les trois requêtes de contrôle rendent exactement l'attendu, la clé anonyme
  ne lit plus aucune télémétrie (1 compte l'exposait avant, 0 après) et reçoit
  « permission denied » sur `user_telemetry`, et la sonde
  `check-write-path.mjs` passe douze contrôles sur douze, compte de sonde
  supprimé et compteurs revenus à l'identique (99 comptes, 59 profils,
  50 bentos). **Reste le back-office à redéployer sur Coolify** : l'ancien lit
  la télémétrie dans `users`, désormais vide, et affiche « inconnu » partout.
  - **La télémétrie du chantier 14 était lisible par tout le monde**, mesuré à
    la clé anonyme sur la production : `last_seen_at`, `platform` et
    `app_version` sortaient de `users`, dont la lecture est `using (true)`.
    Retirer la lecture de ces colonnes aurait cassé le `select('*')` du profil
    dans toutes les versions publiées, mesuré en local : un trigger les range
    donc dans `user_telemetry`, que seul le back-office lit. La politique de
    confidentialité de la landing ne mentionne toujours pas ces données.
  - **Un membre pouvait se déclarer créateur invité** (`kind = 'editorial'`),
    ou naître ainsi. Les écritures de `users` sont désormais accordées colonne
    par colonne, exactement celles des versions publiées.
  - **Un client pouvait insérer un item déjà validé**, titre libre compris.
    Toute insertion venue de l'API passe désormais par la modération.
  - **La correction de `is_featured` se contournait** en supprimant puis
    réinsérant son bento déjà en coup de cœur. L'insertion ne pose plus que
    `user_id`.

  Plus deux points d'hygiène : un signalement ne peut plus naître classé, et
  `admin_merge_items` n'est plus exécutable par les clients. Les trois
  dernières failles ont été reproduites sur un Supabase local construit depuis
  les migrations, jamais en production : `apps/mobile/scripts/check-privileges.ts`
  y rejoue les attaques et tout le parcours de l'app, 11 contrôles en échec
  avant la migration, 42 sur 42 après.

---

## 0. Ordre d'attaque

| # | Chantier | Impact | Effort | Dépend de | Statut |
|---|---|---|---|---|---|
| 1 | Page web `/u/[pseudo]` + OG image | Acquisition | M | rien | ✅ en production, validée 25/25 · QA device restante · [spec](./UX-01-PAGE-BENTO-PUBLIQUE.md) |
| 2 | « La table » : fil de bentos complets | Rétention | M | rien | 🟡 fusionné (PR #47, CI verte) · DoD 6 remplis / 1 partiel / 1 ouvert · reste la fluidité sur appareil réel · [spec](./UX-02-FIL-LA-TABLE.md) |
| 3 | Recherche d'item : suggestions, autofocus, haptique | Complétion | M | rien | 🟡 fusionné (PR #50) · DoD 9 remplis / 1 partiel · reste l'haptique et VoiceOver sur appareil · [spec](./UX-03-RECHERCHE-ITEM.md) |
| 14 | Back-office : utilisateurs, suppression, bentos éditoriaux | Exploitation | L | rien | 🟡 fusionné (PR #51) · DoD 9 remplis / 1 en attente de livraison mobile · [spec](./UX-14-BACK-OFFICE-UTILISATEURS.md) |
| 4 | `expo-image` sur le reste de l'app | Perf + egress | S | 2 | ✅ **absorbé** par les chantiers 2 et 3, vérifié le 13/09 : les deux seules images distantes de l'app sont sur `expo-image` |
| 5 | Modèle brouillon / publié + dépublication | Confiance | M | rien | ✅ 4 lots livrés (PR #54), recette faite, migration appliquée et faille `is_featured` vérifiée fermée · [spec](./UX-05-BROUILLON-PUBLIE.md) |
| 6 | Onglet « Trouver » : recherche par item | Découverte | M | 2 | ✅ 4 lots livrés (PR #58), recette faite, DoD 12/12, migration appliquée · [spec](./UX-06-TROUVER.md) |
| 7 | Page bento public : scale + React Query | Bug + perf | **M** | rien | ✅ 4 lots livrés (PR #59), recette faite (trois iPhone, quinze cas Android, compte de recette en production), DoD 19/19 · [spec](./UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md) |
| 15 | Types d'éléments et cases : jeux vidéo, livres, plats, activités | Contenu | L | rien | 🟡 spécification validée le 15/09 · lot 0 livré (PR #63), migration appliquée et vérifiée en production · lot 1 (back-office) livré et recetté (PR #64 et #65) · lot 2 (446 candidats en quatre listes, import depuis l'écran Types) livré (PR #66) · lot 3 recetté : bento principal identique au pixel sur iPhone et Android, recherche élargie vue en production · DoD 7 sur 9, restent à l'équipe après redéploiement du back-office sur Coolify : importer et relire jusqu'à 50 validés par type, fusionner les deux doublons · [spec](./UX-15-NOUVELLES-CATEGORIES.md) |
| 11 | Accessibilité et polish | Qualité | **L** | rien | ✅ 5 lots livrés (PR #68, CI verte, fusionnée le 16/09) · effort réévalué S → L à la mesure · DoD 23/23 au simulateur, 432 tests verts, matrice parcourue sur 17 Pro, SE et Pixel 8 · build production 1.2.0 lancée (iOS 11, Android versionCode 13) · restent cinq points d'appareil réel (§7.3) · [spec](./UX-11-ACCESSIBILITE-POLISH.md) |
| 16 | Plusieurs bentos par compte | Contenu | L | 5 | ⬜ roadmap produit · planifié avec le 9 |
| 9 | Onboarding : pseudo au moment de publier | Activation | M | 5 | ⬜ planifié avec le 16, qui touche les mêmes écrans |
| 13 | Bento hebdomadaire | Rétention | L | 15, 16 | ⬜ roadmap produit, recadré le 15/09 |
| 17 | Notifications push | Rétention | L | build native | ⬜ roadmap produit |
| 18 | Publication automatique à la validation | Activation | M | 5 | ⬜ roadmap produit |
| 8 | Signaux de retour : compteur de vues, relance | Rétention | M | 17 | ⬜ recadré le 15/09, le reste réparti dans les 17, 18 et 22 |
| 19 | Émissions et podcasts dans « La table » | Contenu | M | 2 | ⬜ roadmap produit |
| 20 | Recherche « match » par bento | Découverte | M | 6, 16 | ⬜ roadmap produit · avec son réglage de confidentialité |
| 26 | Paramètres de confidentialité | Confiance | M | 20 | ⬜ réparti dans les 20, 22, 23 et 25 : chaque réglage part avec sa fonctionnalité, l'écran naît avec le 20 |
| 21 | Profil : tous les bentos d'un compte | Appropriation | L | 16 | ⬜ roadmap produit · absorbe le 10 |
| 10 | Profil éditable (nom, pseudo, Popy) | Appropriation | S | 21 | ⬜ fondu dans le 21 |
| 28 | Compte récupérable | Confiance | L | build native | ⬜ ajouté le 15/09, supposé par la roadmap produit |
| 22 | Likes, commentaires et modération | Engagement | L | 28 | ⬜ roadmap produit |
| 12 | Le « pourquoi » par case | Contenu | L | 22 | ⬜ après le 22, dont il reprend la modération |
| 23 | Suivre un compte | Engagement | M | 21, 28 | ⬜ roadmap produit |
| 24 | Zone de notifications dans l'app | Rétention | M | 22, 23 | ⬜ roadmap produit |
| 25 | Comptes Instagram et TikTok | Appropriation | L | 21 | ⬜ roadmap produit |
| 27 | Succès | Rétention | L | 13, 21 | ⬜ roadmap produit |

**Arbitré le 15 septembre 2026 : la roadmap produit passe devant les
chantiers 8 à 12.** Elle suit l'ordre donné par l'équipe, le 13 y prenant la
place du bento hebdomadaire, après les 15 et 16 dont il dépend. Les chantiers
8 à 12 s'y rangent ainsi :

- **le 8** est réparti dans les 17, 18 et 22. Il ne garde que le compteur de
  vues et la relance des bentos complets jamais publiés, placé après le 18
  parce que la relance passe par les notifications ;
- **le 9** est planifié avec le 16, qui touche les mêmes écrans ;
- **le 10** est fondu dans le 21 ;
- **le 11**, effort S sans dépendance, se glisse entre deux chantiers ;
- **le 12** passe après le 22, dont il reprend la modération.

Deux autres arbitrages du même jour : **le chantier 28, compte récupérable**,
est ajouté avant le 22, et **les réglages de confidentialité partent chacun
avec leur fonctionnalité** plutôt qu'en un chantier à part.

---

## La roadmap produit du 15 septembre

Donnée par l'équipe le 15 septembre 2026. Chaque sujet sera repris un par un,
avec sa planification, quand on y arrivera. Cette section dit où chacun est
rangé, ce que le code et la production en disent déjà, et ce que la liste
suppose sans le dire. Mesures du 15 septembre, en lecture seule.

| Sujet donné par l'équipe | Chantier | Recoupe |
|---|---|---|
| Nouvelles catégories (jeux vidéo, livres, plats, activités), et leur création depuis l'administration | 15, devenu types et cases | |
| Plusieurs bentos par compte : le principal et des hebdomadaires | 16 | 13 |
| Bento hebdomadaire configuré depuis l'administration | 13, recadré | |
| Notifications push : un bento à compléter, un bento prêt à être publié | 17 | 8 |
| Publication automatique après validation des éléments | 18 | 8 |
| Émissions et podcasts Bento Pop dans le fil, via l'API de la landing | 19 | |
| Recherche « match » par bento | 20 | 6 |
| Vue profil avec les différents bentos de l'utilisateur | 21 | 10 |
| Likes et commentaires, signalement et modération, mails Resend | 22 | 8, 12 |
| Suivre un créateur | 23 | |
| Zone de notifications dans l'app | 24 | 8 |
| Associer Instagram, associer TikTok | 25 | |
| Paramètres de confidentialité | 26 | |
| Système de succès | 27 | |

**Ce que la production dit déjà.**

- **27 bentos publiés, tous complets**, dont 3 coups de cœur.
- **277 items validés, dont 130 proposés par des utilisateurs**, soit 47 %.
  72 n'ont pas d'image, 26 %.
- **137 items distincts posés, dont 120 dans un seul bento.** Sur 351 paires
  de bentos, 31 partagent au moins un item, 3 en partagent deux, aucune plus
  de trois.
- **Les catégories sont déjà des données** (`bento_categories`, six lignes),
  mais le code ne sait dessiner que ces six-là, cf. chantier 15.

**Quatre fondations que la liste suppose sans les nommer.** Aucune n'existe.
Chacune coûte moins cher posée une fois que redécouverte à chaque chantier.

1. **Un compte qu'on ne perd pas.** Tous les comptes sont anonymes
   (`session.ts:68`), leur session vit dans le stockage de l'app
   (`supabase/client.ts:29`) : une réinstallation suffit à perdre le sien, et
   l'app n'offre aucun moyen de le retrouver sur un autre téléphone. La conversion en
   compte permanent est prévue en commentaire (`supabase/config.toml:33`),
   jamais faite. Aujourd'hui, perdre son compte coûte un bento ; demain, des
   abonnés, des likes, des commentaires, des succès et plusieurs bentos. Un lien
   Instagram ou TikTok n'y répond pas : s'il servait à se reconnecter, la règle
   4.8 d'Apple exigerait d'offrir aussi une connexion équivalente à Sign in
   with Apple. **Non demandé par l'équipe, ajouté le 15 septembre : chantier
   28, placé avant le 22.**
2. **Une modération côté serveur.** Aujourd'hui le blocage est une liste de
   pseudos **stockée sur le téléphone** (`src/state/blocked.ts`), qu'aucun
   serveur ne connaît et qu'un changement de pseudo contourne. Un signalement
   ne transmet qu'un pseudo, sans motif ni bento (`u/[pseudo].tsx:687`). Le
   filtre de texte ne couvre que les pseudos, par motifs non ancrés :
   `p[uv]t[ae]` refuse « réputation » et « dispute », tolérable pour un pseudo,
   pas pour un commentaire. Aucune alerte ne prévient l'équipe. Or des
   commentaires publics exigent, chez Apple (1.2), un filtrage avant
   publication, un signalement suivi d'une réponse rapide, le blocage des
   utilisateurs et un contact publié ; chez Google, le signalement des
   contenus **et des utilisateurs** dans l'app. Et le questionnaire de
   classification d'âge d'Apple, exigé pour les soumissions depuis septembre
   2026, interroge désormais sur les fonctions sociales.
   [`STORE-COMPLIANCE.md`](./STORE-COMPLIANCE.md) date du 11 mai et ne décrit
   plus l'app.
3. **Un envoi et un ordonnanceur côté serveur.** Le projet mobile n'a ni tâche
   planifiée (« le projet n'a pas d'ordonnanceur »,
   `20260913000000_admin_users.sql:145`), ni Edge Function dans le dépôt, ni
   webhook, ni Realtime. `pg_net` n'apparaît que dans la migration de
   revalidation, toujours pas appliquée. Or une sortie datée (13), un push (17,
   18), un mail (22), une purge (24) et un succès attribué (27) doivent tous
   agir sans qu'un client ouvre l'app. Le lieu se choisit une fois : Supabase,
   dont le plan gratuit comprend les Edge Functions et a priori `pg_cron`, ou
   le serveur Coolify qui héberge déjà le back-office et sa clé de service.
4. **Une build native.** `expo-notifications` impose une nouvelle build, pas
   une mise à jour à distance, plus une clé APNs et un compte de service FCM.
   Une adresse hors de `/u/` aussi : les liens universels ne déclarent que ce
   chemin (`app.json`, `apple-app-site-association`). Le chantier 28 en
   demandera probablement une aussi, selon la connexion retenue. Regrouper ces
   changements dans une même version évite une revue par chantier.

**Quatre failles relevées en chemin**, sans rapport avec la liste, corrigées
et fermées en production le même jour, cf.
[ménage en attente](#ménage-en-attente).

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

**Spécification** : [`UX-06-TROUVER.md`](./UX-06-TROUVER.md), écrite le 13 septembre 2026 à partir de mesures sur la production.

**Constat.** `search.tsx` ne cherche que par préfixe de pseudo (`apps/mobile/app/(tabs)/search.tsx:47`). On ne connaît pas les pseudos des autres, c'est le paradoxe de l'annuaire. Pire : la requête ne filtre pas les users sans bento publié, donc on peut taper « Voir » et arriver sur « Bento introuvable » (`u/[pseudo].tsx:348`).

**Ce que la mesure a changé au cadrage.** Trois chiffres, et ils déplacent le chantier.

- **46 des 72 comptes, soit 64 %, mènent à « Bento introuvable ».** Le cul-de-sac n'est pas un cas limite, c'est la majorité des résultats. Même classe de défaut que le bouton mort du chantier 5, à une échelle vingt fois supérieure.
- **126 des 137 items posés ne sont que dans un seul bento.** La recherche par item n'est donc pas un outil d'affinité à ce volume, mais un moyen d'atteindre une personne qu'on ne saurait pas nommer. Un résultat unique est une réussite, et l'écran ne doit pas être dessiné pour en afficher douze.
- **51 % du catalogue validé n'est dans aucun bento publié.** Autocompléter sur le catalogue enverrait une recherche sur deux dans le vide.

D'où la règle qui tient le chantier entier : **on ne propose que ce qui mène quelque part.** Elle couvre les trois points d'un coup, le filtre sur les bentos publiés, la recherche restreinte aux items réellement posés, et les suggestions limitées aux items partagés.

**Deux corrections qui n'étaient pas prévues.** Le préfixe rate `dark_hifus` quand on tape `hifus`, alors que 19 % des pseudos contiennent un `_` : passage en sous-chaîne. Et ni la sous-chaîne ni la similarité ne dominent l'autre, mesuré : union des deux, seuil de similarité relevé de 0,15 à 0,3.

**La question ouverte est tranchée.** La forme du résultat n'est ni le post plein format (614 pt, deux résultats ne tiennent pas à l'écran) ni `MiniBentoCard` (dessiné pour un carrousel, et muet sur la raison du résultat). C'est la ligne existante avec une ligne de plus, `Film · Inception`, qui tient dans la place déjà vide sous le pseudo : la hauteur ne bouge pas.

**L'audit des autres culs-de-sac est clos.** Les six navigations vers `/u/[pseudo]` ont été relues : `search.tsx:202` est la seule non protégée. Le fil ne sert que des bentos publiés, le composer et le profil ont été protégés au chantier 5.

**Livré le 13 septembre 2026.** Recette sur simulateur, sur les données de production. La démonstration tient en une requête : taper « bento » correspond à 20 pseudos, dont 19 sans bento publié, et l'écran en affiche **un**. Latence p50 de 48 ms sur 37 requêtes, pour un budget de 200. 212 tests verts.

Trois défauts trouvés en recette et corrigés dans la foulée : les titres longs occupaient une rangée entière de puces, et à la plus grande taille de police système le titre se rognait en « TROUV » pendant que le bloc de suggestions dépassait l'écran sans pouvoir défiler.

Deux défauts trouvés et **non** corrigés, parce qu'ils débordent du chantier, tous deux versés au chantier 11 : bloquer quelqu'un est une porte à sens unique, la page qui porte le bouton « Débloquer » n'étant plus atteignable une fois le blocage posé ; et 20 usages d'`Extenda` plus `TopChip` n'ont aucun plafond de grossissement, ce qui les casse à la plus grande taille système.

**Fait quand** : on peut trouver quelqu'un sans connaître son pseudo, et aucun résultat de recherche ne mène à un cul-de-sac. **Fait.**

---

## 7. Page bento public : scale et React Query

> **Spécification détaillée : [`UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`](./UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md)** (géométrie mesurée sur trois écrans, contrat de données, plan en 4 lots, recette).
>
> **La mesure a élargi le constat.** Le recouvrement des CTA n'est pas propre à l'iPhone SE : il vaut 3 pt sur un 17 Pro, 18 sur un 17e et 134 sur un SE. Et `BentoGrid` ne met à l'échelle que les hauteurs, donc la boîte est écrasée de 8 % sur le téléphone le plus courant. L'effort passe de S à M.
>
> **Lots 1 et 2 livrés le 14 septembre 2026** (`0000f74`, `b36a489`). La boîte a la largeur du fil sur les trois iPhone et l'émulateur Android, ses proportions à 0,07 % près partout où elles ont été mesurées, la page distingue ses états, et un bento déjà vu se rouvre sans requête. La recette a trouvé deux attentes que la spec ignorait : les réessais cachés de `postgrest-js`, coupés sur cette page, et l'attente de l'authentification, levée par un client sans session.
>
> **Lot 3 livré le 15 septembre 2026** (`9907507`). La page, les cases et l'image de partage tiennent à la plus grande police sur les trois iPhone et l'émulateur, et aucun titre de case ne se coupe plus au milieu d'un mot, sur iOS comme sur Android : un premier mot trop large fait rétrécir son titre, mesuré sur les glyphes d'Extenda. La recette a trouvé ce que la spec ignorait : React Native ne plafonne pas la hauteur de ligne sur Android et y arrondit la police au pixel supérieur, iOS coupait aussi les titres, et les cases vides débordaient de leur pointillé.
>
> **Lot 4 livré le 15 septembre 2026, chantier clos.** Recette complète : les treize points sur les trois iPhone, quinze cas sur les émulateurs Android dont la tablette, la latence contre la production (p50 45 à 48 ms), et la publication recettée pour de vrai, avec un compte de recette en production passé par un proxy bridé, puis supprimé. Dix-neuf critères sur dix-neuf. Deux défauts trouvés, versés ci-dessous.
>
> **Fusionné le 15 septembre 2026** (PR #59, `bff9aed`), CI verte. Sur `main`, mais dans aucune build ni mise à jour à distance pour l'instant, cf. [les mises à jour à distance publiées](#les-mises-à-jour-à-distance-publiées).

**Constat.** `u/[pseudo].tsx:322` utilise `scale={0.94}` en dur alors que le composer calcule un scale dynamique (`compose.tsx:110`). Hauteur native de la grille : environ 512pt, soit 481pt à 0.94. Sur un iPhone SE, header profil et grille dépassent la hauteur disponible et les CTA sticky recouvrent la dernière rangée.

Par ailleurs l'écran n'utilise pas React Query : `useEffect` plus `useState` maison, donc pas de cache, pas de retry, rechargement complet à chaque visite. `loadPublicBentoByPseudo` fait deux requêtes séquentielles (`bento-actions.ts:135`).

**Proposition.** Reprendre le calcul de scale dynamique du composer, ou rendre la page scrollable. Passer le chargement en `useQuery`. Fusionner les deux requêtes en une jointure.

**Ce que le chantier 6 y ajoute.** La recherche envoie désormais bien plus de monde sur cette page, et par un chemin nouveau : on y arrive depuis un item, donc en s'attendant à voir une case précise. Deux conséquences à cadrer en planification. La page est le point d'arrivée de tout l'onglet « Trouver », donc son coût de chargement est devenu le coût perçu de la recherche. Et la case qui a motivé le clic mériterait peut-être d'être signalée à l'arrivée, ce qui n'était pas un sujet quand on n'y venait que par un pseudo.

**Tranché par la spécification.** Le coût de chargement est mesuré : p50 de 45 à 48 ms contre la production, et zéro requête au retour sur un bento déjà vu. La case d'où l'on vient ne sera **pas** signalée (§5.5 de la spec) : la ligne de résultat nomme déjà la case et le titre, et les six cases sont désormais visibles d'un coup. À rouvrir au chantier 8.

**Suivis ouverts par le chantier 7**, hors de son périmètre, détaillés en §12 de la spec :

- **Les réessais cachés de `postgrest-js` restent sur le fil, la recherche et l'inscription.** Trois réessais silencieux après 1, 2 puis 4 s sous chaque tentative de React Query : en panne réseau, le fil attendrait environ 24 s avant son erreur, calcul à confirmer par une mesure. `supabase-js` 2.105 ne permet pas de les couper globalement, donc un réglage et une recette par écran.
- **Le client principal attend l'authentification.** Session proche de l'expiration et authentification en panne : des boucles de 8 tentatives sur 25,5 s, enchaînées sans pause, pendant lesquelles toutes ses requêtes attendent, lectures comprises. Mesuré au lot 2 ; au démarrage, le profil a attendu 25,5 s. Le fil et la recherche pourraient lire par le client sans session après vérification de leur RLS, les écritures non.
- **Les sous-titres d'artistes sont en anglais** (« US · Person », « FR · Person · French rapper ») : données héritées d'anciens imports, à mesurer puis corriger à part.
- **Une case Artiste s'affiche sans titre** : l'item « [unknown] », un artiste spécial de MusicBrainz, dont `cleanTitle` retire tout ce qui est entre crochets. Donnée à corriger, import à fermer à ces artistes.
- **En navigation à trois boutons, la barre d'onglets passe sous les boutons système** (Android) : sa hauteur est fixée à 84 dans `app/(tabs)/_layout.tsx`, et la marge basse de 48 dp de cette navigation écrase icônes et libellés. Le composer lit cette hauteur pour son budget vertical, à revérifier avec le correctif. Tâche séparée proposée.

**Fait quand** : la grille est entièrement visible sur iPhone SE, et revenir sur un bento déjà consulté est instantané. **Fait**, en défilant sur iPhone SE, où la rangée basse s'atteint en fin de page aux trois tailles de police ; le retour sur un bento déjà vu ne fait ni requête ni squelette.

---

## 15. Types d'éléments et cases : jeux vidéo, livres, plats, activités

> **Spécification détaillée : [`UX-15-NOUVELLES-CATEGORIES.md`](./UX-15-NOUVELLES-CATEGORIES.md)**, écrite, réécrite et validée le 15 septembre 2026. La recherche élargie aux Personnes est assumée, une case refuse en base un item d'un autre type, et les listes de départ seront grand public, au goût Bento Pop.
>
> **La relecture a déplacé le chantier.** Clément : « il faut qu'on décorrèle la typologie de case et l'intitulé. Créateur de contenu = Personne, Artiste musical = Personne, Mangaka = Personne… Lieu de voyage = Lieu, Lieu de vie = Lieu, Lieu de rêve = Lieu. » Le chantier ne rend plus des catégories pilotables : il sépare **le type** d'un élément, qui décide où l'on cherche, de **la case**, qui porte un intitulé, un tampon et un type.

**Demandé.** Quatre catégories d'éléments de plus : jeux vidéo, livres, plats, activités. Et une question de l'équipe : pourquoi pas les créer depuis l'administration ?

**Arbitré le 15 septembre.**

- **Neuf types au départ**, d'autres créables depuis le back-office : Film, Série, Chanson, Personne, Lieu, Jeu vidéo, Livre, Plat, Activité. Les quatre derniers restent inactifs jusqu'au chantier 13.
- **Le tampon appartient à la case**, ce qui ouvre les cases personnalisées des éditions hebdomadaires.
- **Le bento principal garde ses six cases et ses intitulés à l'écran.** Artiste et Créateur de contenu y deviennent deux cases de type Personne.
- **Le catalogue reste interne** : saisie par l'équipe, propositions modérées, aucune API externe. Seules les images peuvent venir de dehors, avec leur crédit. Les listes de départ se préparent dans le dépôt et se valident dans le back-office.
- **Pas de couleur par type ni par case** : la palette d'une tuile dépend de l'item, mesuré.

**Constat.**

- **`bento_categories` joue deux rôles** : le type d'un item (`items.category_id`) et la case qu'il occupe (`bento_items.category_id`). D'où Joueur du Grenier et lesadpanda en double, artistes et créateurs à la fois, et Squeezie introuvable dans la case Artiste : la recherche y répond « Queen », mesuré en production.
- **Les versions publiées ne lisent que la case, jamais `items.category_id`**, et appellent la recherche par clé de case. Garder les six cases telles quelles et résoudre case vers type dans les fonctions change donc la recherche de toutes les versions d'un coup, sans mise à jour.
- **Aucune des 162 cases publiées** ne porte un item d'une autre catégorie que la sienne : imposer en base qu'une case n'accepte que son type ne casse rien.
- **Éprouvé en brouillon sur le Supabase local** : la migration s'applique, les 42 contrôles de `check-privileges.ts` restent verts, et les 15 contrôles du modèle passent.

**Fait quand** : un item a un type et une case aussi, la recherche d'une case cherche dans son type sans casser aucune version publiée, le bento principal est inchangé à l'écran, et les quatre nouveaux types ont chacun au moins 50 items validés, saisis en interne.

---

## 11. Accessibilité et polish

> **À glisser entre deux chantiers**, arbitré le 15 septembre 2026 : effort S, aucune dépendance.
>
> **Livré le 16 septembre 2026**, cinq lots, PR #68 fusionnée, build production
> 1.2.0 lancée : [`UX-11-ACCESSIBILITE-POLISH.md`](./UX-11-ACCESSIBILITE-POLISH.md).
> **L'effort passe de S à L** : la mesure a montré que l'inscription se ferme à
> la plus grande taille de police standard, que le lecteur d'écran lit une case
> en trois morceaux, et que le bouton signature de l'app avait perdu son ombre,
> son enfoncement et son grisé désactivé sans que rien ne le signale. Les points
> listés ci-dessous sont tous traités, sauf ceux marqués comme arbitrés ou
> absorbés. Les arbitrages sont **provisoires**, à relire, cf. §11 de la spec.

- La loupe est un **emoji** 🔍 (`search-modal.tsx:457`, `search.tsx:164`) alors que `react-native-svg` et `@expo/vector-icons` sont installés : rendu différent iOS et Android, et lu à voix haute par VoiceOver.
- Plusieurs titres ont un `lineHeight` inférieur au `fontSize` (`fontSize: 28, lineHeight: 26` dans compose et search ; celui de « La table » est passé à 30) : avec la taille de police système augmentée, les glyphes Extenda se font rogner. Les plafonds de grossissement sont suivis plus bas.
- ~~Le crédit image en `rgba(255,255,255,0.5)` sur photo (`Tile.tsx:283`) est sous le seuil de contraste~~. La recette du chantier 2 a montré qu'il se superpose en plus au sous-titre, les deux occupant la même bande basse de la tuile. **Arbitré : accepté tel quel** (cf. D8 de la spec du chantier 2). La mention légale CC-BY-SA reste présente, ce qui est l'obligation ; corriger toucherait `Tile`, donc trois écrans.
- ~~Faute dans le menu de signalement : « Confirme-tu ? » (`u/[pseudo].tsx:427`).~~ **Corrigée** par le chantier 7, en « Confirmes-tu ? ».
- ~~Les états de chargement sont des `ActivityIndicator` centrés : les remplacer par des squelettes de tuiles sur featured et bento public.~~ **Traité**, par le chantier 2 pour « La table » et par le chantier 7 pour la page bento public.

---

**Versé par le chantier 6, le 13 septembre 2026.**

- **Le texte ne plafonne son grossissement nulle part.** 20 usages d'`Extenda` dans l'app n'ont pas de `maxFontSizeMultiplier`, plus `TopChip` : à la plus grande taille de police système, les titres se rognent en débordant de l'écran. Seul `app/(tabs)/search.tsx` a été traité, parce qu'on ne livre pas un écran au titre cassé. *Au 15 septembre, le chantier 7 a plafonné la page bento publique et les cases, et figé l'image de partage. Parmi les usages d'`Extenda`, restent sans aucun plafond le composer, le profil, les crédits, l'onboarding (`splash`, `pseudo`, `mechanics`), `PageTitle` et `ItemTile`, plus `TopChip`.*
- **Bloquer quelqu'un est une porte à sens unique.** La boîte de dialogue promet « Tu peux annuler à tout moment depuis ce menu », or ce menu vit sur `/u/[pseudo]`, filtrée du fil comme de la recherche. Il n'existe aucune liste des comptes bloqués. Le correctif est une ligne « Comptes bloqués » dans le profil.

**Versé par le chantier 7, le 14 septembre 2026.**

- **Le bandeau « Pas de connexion » recouvre le bouton retour.** Sur la page bento publique, il le masque justement dans l'état « Connexion perdue ». Le bandeau est commun à tous les écrans : le corriger sur une seule page créerait deux comportements.
- **Le composer ne tient pas à la plus grande police.** Sur iPhone SE, « MON / BENT / O » et une grille cachée sous la barre d'onglets, sans défilement ; sur Android, le bouton passe sous la barre d'onglets dès la taille 1,3. Les cases, elles, sont traitées depuis le chantier 7.
- **Les libellés de la barre d'onglets se tronquent sur Android à la taille 2,0** : « COMP… », « LA TA… ».

**Versé par le chantier 7, le 15 septembre 2026.**

- **Des boutons sans rôle pour VoiceOver.** Sur la page bento publique, « Réessayer » et « Reprendre mon bento » sont exposés comme éléments génériques, alors qu'ils déclarent `accessibilityRole="button"` comme « Retour », lu comme un bouton sur le même écran. Quatre pistes écartées sur appareil, cause non établie : à reprendre sur cet écran, puis à vérifier sur les autres `Pressable` de l'app en relevant le `role` dans `idb`.

---

## 16. Plusieurs bentos par compte

**Demandé.** Qu'un compte puisse avoir plusieurs bentos : son bento Bento Pop principal, plus des bentos hebdomadaires.

**Constat.** « Un bento par user (au MVP, contrainte UNIQUE). Levable plus tard » (`initial_schema.sql:84-88`). Lever la contrainte tient en une ligne ; ce qu'elle garantit en silence, non.

- **`ensureBento` créerait un bento à chaque écriture.** Il cherche le bento du compte avec `maybeSingle()` et en crée un s'il ne trouve rien (`bento-actions.ts:12-29`). Avec deux bentos, `maybeSingle()` rend une erreur que la fonction ignore : chaque case remplie ajouterait un bento. Le composer, la recherche et le profil l'appellent avant chaque écriture.
- **La page publique afficherait « Rien en ligne ».** Sa requête reçoit le bento en objet parce que `user_id` est unique (`public-bento.ts:35-36`) ; sans la contrainte, PostgREST rend un tableau.
- **Tout passe par le pseudo** : le lien partagé `bento-pop.com/u/<pseudo>`, la navigation dans l'app, le signalement (sans identifiant de bento), la purge de la page web, le sitemap, et la landing qui prend le premier bento venu (`firstBento`, `raw[0]` sans tri, `apps/landing/src/lib/bento/queries.ts:89-92`).
- **Les compteurs compteraient des bentos, pas des gens** : `popular_items`, `shared_items`, l'entonnoir du back-office. `search_bentos` dédoublonne par bento, donc une personne y sortirait une fois par bento.
- **Une case est une catégorie** : un bento hebdomadaire ne pourrait pas demander deux films.
- **Le back-office crée exactement un bento par profil éditorial** (`utilisateurs/nouveau/actions.ts`), sans moyen d'en ajouter un.
- **Aucune policy ne limite le nombre de bentos** qu'un membre peut insérer : sans la contrainte, il faudra une autre garde.

**Proposition.**

- Un type de bento (principal, hebdomadaire) et le lien vers son édition ; unicité du principal par compte, et d'un bento par compte et par édition.
- `bento_items` indexé par position de case, la catégorie venant du modèle de l'édition.
- `/u/<pseudo>` continue d'afficher le bento principal, donc aucun lien en circulation ne casse. Les autres bentos vivent sous `/u/<pseudo>/…` : les liens universels actuels couvrent ce chemin, il n'a simplement pas de route dans l'app.
- Chaque requête qui prenait « le » bento d'un compte nomme désormais lequel, et un test verrouille chacune.

**À trancher quand on y arrive.**

- L'adresse d'un bento hebdomadaire, et ce que partage le bouton « Partager ».
- Un signalement vise-t-il un bento ou un compte ?
- Dépublier le bento principal dépublie-t-il le reste ?

**Fait quand** : un compte publie son bento principal et un bento hebdomadaire, chacun à son adresse, et tous les liens déjà partagés affichent toujours le bento principal.

---

## 9. Onboarding : pseudo au moment de publier

**Constat.** Parcours actuel : splash, CGU, pseudo, mécanique, composer. On exige un identifiant unique, avec check réseau, avant que l'utilisateur ait vu la moindre valeur.

Détail au passage : la pagination affiche 3 points (`splash.tsx:103` actif 0, `mechanics.tsx:116` actif 2) et l'écran pseudo annonce « ÉTAPE 2 / 3 », mais l'écran CGU s'intercale sans être compté. Le parcours réel fait quatre écrans.

**Proposition.** Laisser composer la case film dès l'entrée, demander le pseudo au moment de publier, quand il y a quelque chose à perdre. Le pseudo peut être pré-généré (`generatePseudoSuggestions` existe déjà dans `apps/mobile/src/lib/pseudo.ts`) et modifiable ensuite.

**Attention.** La gate CGU est une obligation App Store Guideline 1.2 (cf. `docs/STORE-COMPLIANCE.md`), elle doit rester avant toute contribution publique. Et `terms_accepted_at` est posé dans l'`INSERT` de la ligne `users` (`pseudo.tsx:66`), donc décaler la création du profil implique de revoir ce couplage. À cadrer en planification, dépend du chantier 5.

**Planifié avec le chantier 16**, arbitré le 15 septembre 2026. Les deux touchent l'entrée dans le composer et le moment de publier : l'un décale la demande de pseudo jusqu'à la publication, l'autre fait de la publication un geste par bento. Les planifier ensemble évite de reprendre deux fois les mêmes écrans.

**Fait quand** : un nouvel utilisateur peut remplir sa première case sans avoir créé de compte, et la conformité CGU est préservée.

---

## 13. Bento hebdomadaire

> **Recadré le 15 septembre 2026 par la roadmap produit.** Il s'appelait « Types de bento (hebdo, thématiques) » et commençait par lever la contrainte `unique (user_id)` : c'est désormais le chantier 16, dont celui-ci dépend.

**Demandé.** Un système de bento hebdomadaire, configuré depuis l'administration : un titre, de 2 à 6 cases avec chacune un nom et une catégorie, une date de sortie.

**Constat.**

- **Un utilisateur, un bento, pour toujours.** Une fois les six cases remplies, il n'y a plus rien à composer, et le fil n'a plus rien de neuf à montrer de la part de quelqu'un qui a déjà publié. Les 27 bentos publiés sont complets.
- **La grille ne sait dessiner que six cases** : trois rangées de 1, 2 et 3 cases (`geometry.ts`, hauteur 512), chaque place liée à sa catégorie (`BentoGrid.tsx:148-160`). Ce dessin existe en trois exemplaires : `BentoGrid` dans l'app, qui sert aussi l'image de partage, la grille de la page web, et son aperçu 1200×630. Deux, trois, quatre et cinq cases font quatre mises en page à dessiner, et à coder trois fois.
- **Le fil est prêt pour une étiquette.** Un post reçoit un `ribbon` (libellé, couleur, `components/feed/ribbon.ts:45`) : « BENTO DE LA SEMAINE » est une entrée de plus.
- **Rien ne sait agir à une date.** Montrer une édition à partir de sa sortie se fait à la lecture, sans ordonnanceur ; prévenir à cette heure-là, non (fondation 3).

**Proposition.**

- Une table des éditions (titre, sortie, statut) et une table de leurs cases (position, intitulé, tampon, genre grammatical, type). Le type vient du chantier 15, qui sépare ce qu'est un élément de la case qui l'accueille : « Ton lieu de rêve » est une case de type Lieu. Dans le back-office : créer, prévisualiser la grille, programmer.
- Dans l'app, l'édition en cours à côté du bento principal, et la suivante annoncée sans être dévoilée.
- Dans « La table », l'étiquette et le titre de l'édition.
- Les grilles de 2 à 5 cases dessinées par la direction artistique avant tout développement.

**À trancher quand on y arrive.**

- Une édition se remplit-elle seulement pendant sa semaine, ou à tout moment ? Et les éditions passées ?
- La sortie : un jour et une heure de Paris, ou un jour ?
- Le nom de la case (« Le film qui t'a fait pleurer ») remplace-t-il le tampon de catégorie ?
- Une édition peut-elle être liée à une émission (19) ?

**Fait quand** : l'équipe programme une édition dans le back-office, elle sort à sa date sans nouvelle version de l'app, et quelqu'un qui a déjà publié son bento a une raison de revenir composer.

---

## 17. Notifications push

**Demandé.** Deux notifications : un nouveau bento à compléter, et un bento prêt à être publié parce que tous ses éléments sont validés.

**Constat.**

- **Rien n'existe** : ni `expo-notifications`, ni table de jetons, ni envoi côté serveur. Pas même pour la modération : un item proposé est validé ou refusé sans que son auteur le sache (« pas de notification user en V1 », `apps/admin/src/app/(protected)/catalogue/actions.ts:102`).
- **Le besoin est mesuré** : au chantier 5, 15 bentos complets et non bloqués n'étaient pas publiés, leur dernière case remplie depuis 26 jours en médiane.
- **Il faut une nouvelle build**, pas une mise à jour à distance, ainsi qu'une clé APNs, un compte de service FCM, et sur Android 13 et au-delà une autorisation demandée à l'exécution. Le service d'envoi d'Expo est gratuit, jusqu'à 600 notifications par seconde.
- **Apple, règle 4.5.4** : l'app ne doit pas dépendre des notifications, et une notification promotionnelle exige un consentement explicite dans l'app et un moyen de s'en retirer. « Un nouveau bento à compléter » s'en approche.

**Proposition.**

- Une table des jetons par compte et par appareil, purgée quand Expo répond `DeviceNotRegistered` aux accusés de réception.
- Un seul point d'envoi côté serveur (fondation 3).
- La demande d'autorisation au moment où elle a un sens, par exemple juste après avoir proposé un item, plutôt qu'au premier lancement.
- Un réglage par type de notification (26), et un tap qui ouvre le bon écran.

**À trancher quand on y arrive.**

- Où vit l'envoi : Supabase, ou le serveur Coolify du back-office ?
- Quand demander l'autorisation, et quelles notifications sont actives par défaut.
- Un compte anonyme perdu laisse des jetons orphelins : acceptable avant la fondation 1 ?

**Fait quand** : sur iOS et Android, en build de production, quelqu'un qui l'a autorisé est prévenu de la sortie d'une édition et de la validation de ses items, arrive au bon écran d'un tap, et peut couper chaque type.

---

## 18. Publication automatique à la validation

**Demandé.** Publier automatiquement un bento dès que ses éléments sont validés.

**Constat.**

- **Le blocage n'existe que dans l'app** : bouton « En attente de validation », désactivé, dès qu'une case porte un item en attente (`compose.tsx:51`, `compose-cta.ts:86`). Aucune règle en base : `can_publish_bento` est annoncé depuis le 28 mai (`20260528120000_catalog_status_and_moderation.sql:205`) et n'existe pas.
- **L'état n'est relu qu'à l'ouverture du composer** (`compose.tsx:65-69`) : il faut revenir dans l'app, au bon onglet, pour découvrir qu'on peut publier.
- **Un item refusé passerait inaperçu**, d'après le code : son auteur continue de le voir, la case ne compte plus comme en attente, et le bento peut sortir avec une case que les visiteurs voient vide. `rejected_reason` existe, l'app ne le lit nulle part. À confirmer en recette.
- Le chantier 5 a retenu l'option A, et sa promesse : l'utilisateur sait à tout instant si ce qu'il voit est public. Publier à sa place doit la tenir.

**Proposition.**

- Le bouton désactivé devient « Publier dès que c'est validé » : l'intention est enregistrée sur le bento.
- À la validation du dernier item en attente, la base publie le bento et produit l'événement que 17 et 24 transmettront. Une fusion d'items (`admin_merge_items`) vaut validation.
- Un refus annule l'intention et prévient l'auteur, motif compris.

**À trancher quand on y arrive.**

- Automatique pour tous, ou seulement sur demande ? La demande explicite est la seule qui tienne la promesse du chantier 5.
- Et si l'utilisateur modifie son bento pendant l'attente ?
- « Ton bento est prêt » (17) ou « ton bento est publié » : l'un remplace l'autre selon le choix précédent.

**Fait quand** : quelqu'un qui a proposé un item appuie une fois sur « Publier », et son bento sort à la validation sans qu'il rouvre l'app, en le sachant.

---

## 8. Signaux de retour

> **Recadré le 15 septembre 2026 par la roadmap produit.** La notification d'item validé part au chantier 17, avec la publication automatique du 18. La réaction par case croise les likes demandés au 22, où se tranchera like du bento ou like par case. **Le chantier 8 ne garde que le compteur de vues et la relance des bentos complets jamais publiés** : 15 au chantier 5, leur dernière case remplie depuis 26 jours en médiane. Placé après le 18, parce que la relance passe par les notifications.

**Constat.** Une fois publié, il ne se passe plus rien : pas de compteur de vues, pas de réaction, pas de notification (`expo-notifications` absent des dépendances). Cas le plus dur : un utilisateur qui propose un item au catalogue voit sa publication bloquée (`compose-cta.ts:86`) sans aucun moyen de savoir quand la modération le débloque, sinon rouvrir l'app au hasard.

**Proposition**, par ordre de rapport effort sur impact :

1. **Compteur de vues** : table `bento_views`, affichage sur le profil (« 47 personnes ont ouvert ton bento »). À alimenter aussi depuis la page web du chantier 1.
2. ~~**Notification item validé** : `expo-notifications` plus un trigger côté modération quand un item passe `pending` vers `validated`. Débloque un cul-de-sac réel.~~ **Parti aux chantiers 17 et 18.**
3. ~~**Réaction par case** plutôt que like global : « 12 personnes ont le même film ». Un `count` par `item_id` sur `bento_items`, aucune modération supplémentaire à prévoir.~~ **Parti au chantier 22**, où se tranchera like du bento ou like par case.
4. **Relance des bentos complets jamais publiés**, ajoutée au recadrage : elle passera par les notifications du chantier 17.

**Préparé par le chantier 2.** Le post de « La table » réserve le budget de mise en page d'une barre d'actions (`ACTIONS_HEIGHT = 0`), sans rien rendre : pas d'affordance inerte en attendant. L'ajout des likes et commentaires est un changement de constante, pas une reprise de la mise en page.

**Légué par le chantier 7.** Signaler, à l'arrivée sur une page bento, la case d'où l'on vient a été écarté pour l'instant (§5.5 de sa spec), avec rendez-vous ici : les signaux par case lui donneront un endroit naturel où s'accrocher. `TilePulse` existe et `BentoGrid` accepte déjà `pulse`, il manque un paramètre de route et une prop.

**Fait quand** : le propriétaire d'un bento sait combien de personnes l'ont ouvert, et quelqu'un qui a rempli toutes ses cases sans publier est relancé. *Avant le recadrage : un utilisateur qui rouvre l'app une semaine plus tard trouve quelque chose de nouveau qui le concerne, promesse que portent désormais les chantiers 17, 22 et 24.*

---

## 19. Émissions et podcasts dans « La table »

**Demandé.** Faire entrer dans le fil les épisodes de l'émission et du podcast Bento Pop, via l'API de la landing.

**Constat.**

- **Les épisodes vivent dans l'autre projet Supabase**, celui de la landing, auto-hébergé sur `supabase.bento-pop.com` : `landing_show_episodes` (identifiant YouTube) et `landing_podcast_episodes` (identifiant Spotify, Deezer ou Apple), saisis à la main dans le back-office. **34 sont en ligne, 17 émissions et 17 podcasts**, à raison d'environ deux de chaque par mois depuis janvier 2026, relevé sur les pages publiques.
- **La landing n'a aucune API de lecture.** Sa seule route est `POST /api/revalidate`, protégée par jeton. L'app ne connaît aucun épisode : « La table » ne lit que les bentos.
- **Passer par la landing est aussi la bonne réponse technique.** La règle « publié mais daté dans le futur » n'est appliquée que par le code de la landing (`apps/landing/src/content/episodes.ts:195`), pas par la RLS : lire sa base depuis l'app montrerait les épisodes programmés avant leur sortie.
- Les vignettes d'émission viennent de YouTube (`i.ytimg.com`), sans coût d'egress pour nous ; celles des podcasts sont dans le Storage de la landing.
- `mentions` liste déjà les œuvres citées dans un épisode (type, titre, lien, visuel) : un pont possible vers les items des bentos.

**Proposition.**

- Une route de lecture sur la landing, qui réutilise `getShowEpisodes` et `getPodcastEpisodes`, ne rend que les champs affichés, se met en cache, et que le back-office purge à chaque enregistrement.
- Un second type de post dans le fil : vignette, titre, durée, et un tap qui ouvre YouTube ou la plateforme du podcast. Le fil est dessiné pour des bentos : la hauteur estimée par type de post est à reprendre dans `components/feed/layout.ts`.

**À trancher quand on y arrive.**

- Tout l'historique, ou seulement les sorties à venir ? 34 épisodes contre 27 bentos : verser l'historique ferait de « La table » un fil d'émissions.
- Ouvrir YouTube ou Spotify, ou une fiche dans l'app ?
- Rangé à sa date, ou épinglé en tête la semaine de sa sortie ?
- Relier un épisode à l'édition hebdomadaire qu'il lance (13) ?

**Fait quand** : un épisode publié dans le back-office apparaît dans « La table » à sa date de sortie et pas avant, sans nouvelle version de l'app, et s'ouvre en un tap.

---

## 20. Recherche « match » par bento

**Demandé.** Une recherche « match » par bento.

**Constat.**

- **Le signal est encore mince**, mesuré le 15 septembre : 137 items distincts posés, dont 120 dans un seul bento. Sur 351 paires de bentos, 31 partagent au moins un item, 3 en partagent deux, aucune plus de trois. 19 bentos sur 27 auraient un « match », presque toujours sur un seul item.
- **La brique existe** : `search_bentos` trouve déjà les bentos qui contiennent un item (chantier 6), en 48 ms au p50.
- **Le bento hebdomadaire devrait changer la donne.** Six catégories larges dispersent les choix ; une même case posée à tout le monde la même semaine devrait les rapprocher. C'est une hypothèse, à mesurer sur les premières éditions.

**Proposition.** Depuis un bento, « Ils ont les mêmes goûts » : les bentos qui partagent le plus d'items à case égale, un item rare pesant plus qu'un item que tout le monde a. Une fonction SQL.

**Son réglage de confidentialité part avec lui** (arbitré le 15 septembre, cf. chantier 26) : la visibilité dans la recherche, appliquée par `search_bentos` et par la fonction de match, pas par l'écran. C'est aussi le chantier où naît l'écran des réglages.

**À trancher quand on y arrive.**

- Un match, c'est le même item dans la même case, ou n'importe où dans le bento ?
- Sur le bento principal, sur les éditions, ou partout ?
- À partir de combien d'items communs montre-t-on un résultat ?
- Attendre quelques éditions hebdomadaires, pour que le chantier ait de quoi matcher ?

**Fait quand** : depuis n'importe quel bento, un tap montre ceux qui lui ressemblent le plus en disant pourquoi, dans le budget de latence de « Trouver », et un compte retiré de la recherche n'apparaît ni dans « Trouver » ni dans les matchs, vérifié à la clé anonyme.

---

## 26. Paramètres de confidentialité

> **Arbitré le 15 septembre 2026 : pas de chantier à part.** Chaque réglage part avec sa fonctionnalité, qui ne sort pas sans lui : la visibilité dans la recherche avec le 20, l'approbation des abonnés avec le 23, likes et commentaires avec le 22, les liens sociaux avec le 25. L'écran naît avec le 20. Cette section reste la référence commune des quatre réglages.

**Demandé.** Visibilité dans la recherche ; accepter d'être suivi, ou seulement sur validation ; accepter likes et commentaires ; visibilité des profils TikTok et Instagram.

**Constat.**

- **Aucun réglage n'existe.** Le seul geste de confidentialité est la dépublication, depuis le chantier 5.
- **La première atteinte à la confidentialité n'était pas un réglage manquant** : la télémétrie du chantier 14 était lisible par tout le monde. Fermée en production le 15 septembre, cf. [ménage en attente](#ménage-en-attente).
- **Un réglage appliqué par l'interface seule ne protège rien** : l'API se lit avec la clé anonyme embarquée dans l'app.

**Principe commun.** Chaque réglage s'applique en base, dans les policies et les fonctions SQL, jamais seulement dans l'écran. Chacun est prouvé par un test qui tente l'accès interdit à la clé anonyme. Tous se retrouvent au même endroit dans l'app.

**À trancher avec le chantier 20**, qui crée l'écran.

- « Visibilité dans la recherche » couvre-t-elle les moteurs de recherche, donc un `noindex` sur la page web du chantier 1 ?
- Les valeurs par défaut.
- Un compte entièrement privé, bento visible des seuls abonnés : dans le périmètre ?

**Fait quand** : chaque réglage est respecté par l'API elle-même, prouvé par un test à la clé anonyme, et l'utilisateur les retrouve tous au même endroit.

---

## 21. Profil : tous les bentos d'un compte

**Demandé.** Une nouvelle vue profil, avec les différents bentos de l'utilisateur.

**Constat.**

- **L'onglet profil est le tableau de bord de son propre compte** : Popy, pseudo, état de publication, liens vers son bento, crédits, export des données, dépublication, suppression (`app/(tabs)/profile.tsx`). Rien n'y est public.
- **La page d'un autre est la page d'un bento** : `/u/<pseudo>`, avec le Popy, le pseudo et « bento publié le … », plus « Partager » et le menu signaler ou bloquer (`app/u/[pseudo].tsx`).
- **Le chantier 10 y est fondu**, arbitré le 15 septembre : éditer nom, pseudo et Popy se fera depuis cette vue.

**Proposition.** `/u/<pseudo>` devient le profil : l'identité (Popy, pseudo, nom, puis abonnés, liens sociaux et succès), le bento principal en tête, les éditions ensuite. Même adresse, donc les liens partagés et leurs aperçus restent valables. Son propre profil est la même vue, avec les réglages. La page web du chantier 1 suit.

**À trancher quand on y arrive.**

- `/u/<pseudo>` devient-il le profil, ou reste-t-il le bento principal avec un lien vers le profil ?
- Comment montrer un bento dans une liste, sachant que `MiniBentoCard` a été retirée au chantier 2 ?
- Le changement de pseudo hérité du chantier 10 : rediriger les anciens liens, ou prévenir qu'ils casseront ?

**Fait quand** : depuis n'importe quel pseudo, on voit tous les bentos publiés de la personne, un lien partagé il y a trois mois montre toujours son bento principal, et chacun peut modifier son nom, son pseudo et son Popy sans recréer son compte.

---

## 10. Profil éditable

**Constat.** Pas d'édition du `display_name`, pas de changement de pseudo, pas de choix du Popy (dérivé d'un hash du pseudo, `apps/mobile/src/lib/popy-avatar.ts:38`).

**Proposition.** Trois formulaires simples. Le choix du Popy nécessite une colonne `users.avatar` (déjà anticipée en commentaire dans `popy-avatar.ts`). Le changement de pseudo doit gérer la redirection des anciens liens ou au minimum prévenir que l'ancienne URL cassera.

**Fondu dans le chantier 21**, arbitré le 15 septembre 2026. La vue profil demandée par l'équipe est l'endroit naturel de ces trois formulaires. Un changement de pseudo contourne aussi le blocage, qui retient des pseudos (fondation 2 de la roadmap produit).

**Fait quand** : l'utilisateur peut personnaliser son identité sans supprimer et recréer son compte.

---

## 28. Compte récupérable

> **Ajouté le 15 septembre 2026.** Non demandé par l'équipe : c'est la première des quatre fondations que la roadmap produit suppose. Placé avant le chantier 22, pour que likes, commentaires et abonnés tiennent à un compte qu'on ne perd pas.

**Constat.**

- **Tous les comptes sont anonymes.** Le premier lancement crée le compte (`session.ts:68`), et sa session vit dans le stockage de l'app (`supabase/client.ts:29`) : désinstaller l'app efface la session, et le lancement suivant crée un compte neuf, au bento vide. Rien, dans l'app, ne permet de retrouver son compte sur un autre téléphone.
- **La perte est déjà arrivée en recette.** Un jeton de rafraîchissement invalide vide la session, l'app relance une connexion anonyme et l'utilisateur repart avec un nouvel identifiant, donc un bento vide (constaté au chantier 3). Le chantier 14 a trouvé pire : pendant les réessais de rafraîchissement, l'app ne montre plus rien.
- **La conversion est prévue depuis mai, jamais faite** : `apps/mobile/supabase/config.toml:30-35` la décrit, par `updateUser`, identifiant préservé.
- **Supabase la permet sans migration**, d'après sa documentation relevée le 15 septembre : `updateUser` rattache un email ou un téléphone au compte connecté, `linkIdentity` une identité Apple ou Google, y compris par jeton natif. Le rattachement manuel est désactivé par défaut et s'active dans la configuration du projet. Si l'identité appartient déjà à un autre compte, l'appel échoue, et c'est à l'app de décider quelles données garder.
- **`deleteOwnAccount` laisse le compte d'authentification orphelin** (chantier 14) : une fois une identité rattachée, supprimer son compte devra aussi l'effacer.

**Proposition.** Un écran « Garder mon compte », proposé au moment où il y a quelque chose à perdre, par exemple après la première publication, qui rattache une connexion au compte anonyme sans changer d'identifiant. Et, sur un téléphone neuf, « J'ai déjà un compte », qui retrouve l'ancien.

**À trancher quand on y arrive.**

- Quelle connexion : Apple, Google, email ? Proposer Google sur iOS pour se connecter oblige à proposer aussi une connexion équivalente à Sign in with Apple (règle 4.8). L'email demande un envoi de mail, que le chantier 22 installe avec Resend.
- Sur un téléphone neuf, l'app a déjà créé un compte anonyme au lancement : on l'abandonne, ou on fusionne ce qu'il contient ?
- Proposer le rattachement, ou l'exiger avant de commenter ou de suivre quelqu'un ?

**Fait quand** : quelqu'un qui réinstalle l'app ou change de téléphone retrouve, en se reconnectant, son pseudo, ses bentos et son identifiant, et supprimer son compte efface aussi l'identité rattachée.

---

## 22. Likes, commentaires et modération

**Demandé.** Liker et commenter un bento ; signaler et modérer, avec un mail envoyé par Resend pour une modération rapide depuis l'administration.

**Constat.**

- **Ni like, ni commentaire, ni compteur.** Le fil a réservé la place d'une barre d'actions, `ACTIONS_HEIGHT = 0` (`components/feed/layout.ts:79`), pour que son ajout soit un changement de constante.
- **La modération actuelle ne tiendra pas des commentaires** (fondation 2) : blocage sur le téléphone, signalement sans motif ni cible précise, filtre réservé aux pseudos, aucune alerte.
- **Le bannissement du back-office supprime la ligne `users` directement** (`reports/actions.ts`), sans passer par `admin_delete_user` : ni motif au registre des suppressions, ni suppression du compte d'authentification.
- **Aucun envoi de mail dans le dépôt**, ni Resend ni autre. L'offre gratuite de Resend couvre 3 000 mails par mois et 100 par jour, largement de quoi alerter une équipe, mais exige un domaine vérifié : des enregistrements SPF et DKIM sur un sous-domaine de `bento-pop.com`.
- **3 signalements** en quatre mois, au comptage du 13 septembre.
- Le chantier 8 proposait une réaction par case plutôt qu'un like global. Et « commentaires sur les bentos des autres » était hors périmètre : il ne l'est plus.

**Proposition.**

- Likes : une table (bento, compte), un compteur, le cœur dans la barre réservée.
- Commentaires : texte court, filtré avant publication, supprimable par le propriétaire du bento, signalable, invisible pour qui a bloqué son auteur.
- Blocage et signalement côté serveur : le blocage devient une table, le signalement porte un motif et sa cible (bento, commentaire, compte).
- Resend : un mail à l'équipe par signalement, avec le lien vers l'écran de modération, où masquer prend un geste. Envoyé depuis le serveur, clé en variable d'environnement **runtime** sur Coolify, jamais `NEXT_PUBLIC_`.
- Un interrupteur dans `app_config` pour couper les commentaires sans nouvelle version.

**Son réglage de confidentialité part avec lui** (cf. chantier 26) : accepter ou non likes et commentaires, appliqué par les policies de la base. **Placé après le chantier 28**, pour que likes et commentaires tiennent à un compte qu'on ne perd pas à la réinstallation.

**À trancher quand on y arrive.**

- Like du bento entier, ou par case ?
- Modération a priori (validé avant d'être visible) ou a posteriori (visible, puis signalé) ? Apple exige au minimum un filtrage avant publication.
- Qui reçoit les mails, et quel délai de réponse l'équipe s'engage à tenir.
- Réponses, mentions, emojis ?

**Fait quand** : on peut aimer et commenter un bento, signaler un commentaire ou son auteur, l'équipe reçoit un mail qui mène à l'écran où masquer le commentaire prend un geste, et un compte qui refuse les commentaires n'en reçoit aucun, vérifié à la clé anonyme.

---

## 12. Le « pourquoi » par case

**Constat.** Un bento est une image. Rien n'explique pourquoi ces six choix.

**Proposition.** Un champ facultatif d'une ligne par case. C'est ce qui ferait passer le bento du statut d'image à celui de contenu qu'on a envie de lire, et ce qui donnerait matière à une rubrique dans l'émission.

**Arbitrage nécessaire.** C'est du texte libre utilisateur : charge de modération, obligations UGC Apple 1.2, stockage, affichage dans la grille déjà dense. À trancher avant toute implémentation.

**Placé après le chantier 22**, arbitré le 15 septembre 2026. Filtrer un texte libre, le signaler, prévenir l'équipe : c'est la modération que les commentaires doivent installer. Le « pourquoi » par case la reprend, plutôt que d'en construire une seconde.

---

## 23. Suivre un compte

**Demandé.** Suivre un créateur, avec la notion d'abonnés et d'abonnements sur le profil.

**Constat.** Rien n'existe. Deux contraintes du modèle : les profils éditoriaux du chantier 14 n'ont pas de compte, ils peuvent être suivis mais ne suivront personne et ne recevront rien ; et un blocage stocké sur le téléphone ne peut rien interdire à un abonné.

**Proposition.** Une table d'abonnements (abonné, suivi, accepté ou en attente), les compteurs sur le profil (21), les bentos des comptes suivis dans « La table », et le blocage qui retire l'abonnement.

**Son réglage de confidentialité part avec lui** (cf. chantier 26) : accepter d'être suivi par tous, ou seulement sur validation, appliqué par la base au moment de l'abonnement.

**À trancher quand on y arrive.**

- Un fil « Abonnements » séparé, ou un filtre de « La table » ?
- Des compteurs publics ?
- Suivre les profils éditoriaux ?

**Fait quand** : on suit un compte en un tap depuis son profil, ses nouveaux bentos arrivent dans le fil de ses abonnements, et un compte qui exige l'approbation voit les demandes et y répond.

---

## 24. Zone de notifications dans l'app

**Demandé.** Une zone de notifications dans l'app : un nouveau bento d'un compte suivi, un nouveau like ou commentaire sur un de ses bentos.

**Constat.** Rien n'existe, ni table ni Realtime. La cloche du back-office est un bouton sans action (`apps/admin/src/components/AppShell/Topbar.tsx:32-38`), sans rapport avec l'app.

**Proposition.** Une table de notifications (destinataire, type, auteur, cible, lue ou non), alimentée par la base au moment de l'événement : la même source que les push (17). Regroupement (« 12 personnes ont aimé ton bento »), pastille de non-lus, purge au-delà d'une durée à fixer. Lecture au retour dans l'app plutôt qu'en temps réel : Realtime n'est pas ouvert, et le plan gratuit le plafonne à 200 connexions simultanées.

**À trancher quand on y arrive.**

- Un onglet, ou une cloche en tête de « La table » ? Les libellés de la barre d'onglets se tronquent déjà sur Android (chantier 11).
- Les validations et refus d'items (18) y entrent-ils ?
- Combien de temps garder une notification ?

**Fait quand** : chaque like, commentaire et nouveau bento d'un compte suivi apparaît dans la zone, regroupé, avec un compteur de non-lus exact.

---

## 25. Comptes Instagram et TikTok

**Demandé.** Associer son compte Instagram et son compte TikTok : photo de profil, et lien sur le profil.

**Constat côté plateformes**, documentation officielle relevée le 15 septembre.

- **Instagram n'offre plus rien aux comptes personnels.** L'API Basic Display s'est arrêtée le 4 décembre 2024. La seule restante, « Instagram API with Instagram Login », ne sert que les comptes professionnels (Business ou Creator), et l'ouvrir au public exige l'App Review de Meta et une vérification d'entreprise. Pour un compte personnel, le seul chemin conforme est un pseudo saisi à la main : sans photo, et sans preuve qu'il appartient à la personne.
- **TikTok le permet, sous conditions.** Login Kit donne la photo et le nom affiché (`user.info.basic`), le pseudo et le lien du profil (`user.info.profile`). Mais sa revue exige une app **déjà publiée** sur les stores et une vidéo de démonstration ; hors revue, dix comptes de test au plus. L'adresse de la photo semble signée, donc temporaire : à recopier chez nous.
- **Apple, règle 5.1.1** : pas de jeton de réseau social conservé hors de l'appareil, et un moyen de délier dans l'app. Lire le profil, puis jeter le jeton.
- **Apple, règle 4.8** : tant que ces comptes ne servent pas à se connecter, rien n'oblige à ajouter Sign in with Apple. C'est une lecture de la règle, pas une confirmation d'Apple.

**Constat côté app.** Le visage d'un compte est son Popy, dérivé du pseudo (`popy-avatar.ts`). Une photo importée est une image d'utilisateur, à modérer comme le reste (22).

**Proposition.** TikTok par Login Kit, la photo recopiée dans le Storage, le jeton jeté. Instagram par pseudo saisi, avec une connexion vérifiée pour les comptes professionnels seulement si l'App Review l'accepte. Délier efface photo et lien.

**Son réglage de confidentialité part avec lui** (cf. chantier 26) : la visibilité des liens Instagram et TikTok, appliquée par la base et non par l'écran.

**À trancher quand on y arrive.**

- La photo remplace-t-elle le Popy, ou s'y ajoute-t-elle ? Le Popy porte l'identité visuelle du produit.
- Instagram : accepter un pseudo non vérifié, donc qu'on puisse afficher @darkhifus sans l'être ?
- Garder une copie de la photo TikTok : les conditions développeur de TikTok interdisent de constituer des bases de profils (III.3.h), lecture juridique à faire.

**Fait quand** : quelqu'un relie son TikTok en quelques taps, son profil montre sa photo et un lien qui ouvre TikTok, délier efface les deux, et un lien masqué ne sort pas de l'API, vérifié à la clé anonyme.

---

## 27. Succès

**Demandé.** Un système de succès, par exemple trois bentos complétés, ou dix fois le même item dans des bentos différents.

**Constat.** Rien n'existe. Les deux exemples supposent plusieurs bentos par compte (16) et un rythme d'éditions (13) : « dix fois le même item dans des bentos différents » demande au moins dix bentos, soit le principal et neuf semaines d'éditions.

**Proposition.** La règle de chaque succès écrite dans le code, son texte et son visuel éditables ; l'attribution faite par la base au moment du geste ; rétroactifs au lancement pour les comptes existants ; visibles sur le profil (21), annoncés par la zone de notifications (24). Les visuels : des Popys, par la direction artistique.

**À trancher quand on y arrive.**

- Des règles figées dans le code, ou paramétrables depuis l'administration ?
- Publics sur le profil, ou privés ?
- Ce qu'on accepte de laisser tricher, par exemple créer des bentos pour cumuler.

**Fait quand** : un succès se débloque au geste qui le mérite, s'affiche sur le profil, et les comptes existants reçoivent ceux qu'ils méritaient déjà.

---

## Hors périmètre de cette roadmap

Reste hors scope tant que ce n'est pas explicitement demandé : auth avec mot de passe, messagerie, internationalisation.

**Sortis de cette liste le 15 septembre 2026**, parce que l'équipe les a demandés : les commentaires sur les bentos des autres (chantier 22) et plusieurs bentos par utilisateur (chantier 16). Le « claim » de compte en sort aussi, sans mot de passe : c'est le chantier 28, ajouté le même jour.
