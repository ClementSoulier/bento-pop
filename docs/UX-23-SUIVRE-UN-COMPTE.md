# Chantier 23 · Suivre un compte

> Spécification écrite le 27 octobre 2026, à partir du code de `main`
> (`5305ce9`, les chantiers 28, 22 et 12 fusionnés) et de lectures sur la
> production, en lecture seule : la base mobile, projet « My Bento Pop ».
> Aucune écriture en production.
>
> **Arbitrages rendus le 27 octobre 2026 par Clément**, en QCM, D1 à D4
> (§11), chaque fois l'option recommandée ; D5 à D22 sont pris par la
> spécification. En résumé : on suit un compte en un tap depuis sa page, où
> « Suivre » prend la place de « Compose le tien » ; ses bentos arrivent dans
> « Abonnements », un filtre en tête de « La table » ; le nombre d'abonnés se
> lit dans la ligne de date, qui ouvre les listes, publiques ; « Valider mes
> abonnés », éteint par défaut, fait de chaque abonnement une demande ; tout
> compte qui a un pseudo peut suivre. Bloquer retire l'abonnement, dans les
> deux sens.
>
> **Fait et recetté le 27 octobre 2026**, en cinq lots enchaînés : 80
> contrôles contre une pile Supabase locale à part, vingt-huit défauts
> introduits exprès et tous attrapés ; la recette au simulateur iPhone 17 Pro
> et iPhone SE et à l'émulateur Pixel 8, deux défauts trouvés et corrigés en
> chemin, dont une régression de « La table » que le filtre provoquait (§9).
> **Rien n'est appliqué en production** : la mise en service attend Clément,
> après celles du 22 et du 12 (§9.6).
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 23, et chantier 26
> pour son réglage ; [le chantier 21](./UX-21-PROFIL.md) pour la page du
> compte ; [le chantier 22](./UX-22-LIKES-COMMENTAIRES.md) pour le blocage en
> base ; [le chantier 28](./UX-28-COMPTE-RECUPERABLE.md) pour le compte ;
> [le chantier 7](./UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md) pour le budget de la
> page d'un bento.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

**Demandé** par l'équipe le 15 septembre : suivre un créateur, avec la
notion d'abonnés et d'abonnements sur le profil. La roadmap propose une table
d'abonnements, acceptés ou en attente, les compteurs sur le profil du 21, les
bentos des comptes suivis dans « La table », et le blocage qui retire
l'abonnement. Son réglage part avec lui (chantier 26) : accepter d'être suivi
par tous, ou seulement sur validation, appliqué par la base.

**Fait quand** : on suit un compte en un tap depuis son profil, ses nouveaux
bentos arrivent dans le fil de ses abonnements, et un compte qui exige
l'approbation voit les demandes et y répond.

Le chantier 20 lui a laissé une question (D8 du 20) : le compte privé, aux
bentos visibles des seuls abonnés. Elle est tranchée ici, hors du chantier
(D3).

### 1.2 Mesuré le 27 octobre 2026, en production

- **113 comptes, tous anonymes, aucun gardé** : aucune version publiée ne
  propose encore de garder son compte, le 28 partant avec la sortie store
  unique.
- **64 profils, tous membres** : aucun profil éditorial du chantier 14
  n'existe.
- **28 comptes ont un bento publié, un chacun** ; 36 profils n'en ont aucun.
- **4 bentos publiés en 30 jours, aucun en 7** ; le premier le 11 mai.
- **Rien n'existe pour suivre** : ni table, ni réglage, ni écran.

Au départ, « Abonnements » sera donc calme : un compte suivi y apporte son
seul bento. Les bentos multiples du 16 et les éditions du 13, à la sortie,
le nourriront.

### 1.3 La page d'un bento n'a plus de place

Mesuré par le modèle de `src/components/bento/public-layout.ts`, celui que
la page applique, à la taille de texte par défaut :

| Appareil | Hauteur laissée à la boîte | Boîte du fil | Marge |
| --- | --- | --- | --- |
| iPhone 17 Pro | 483,0 pt | 480,0 pt | 3,0 pt |
| iPhone 17e | 468,0 pt | 463,3 pt | 4,7 pt |
| iPhone SE | 352,0 pt | 440,5 pt | au plancher, la page défile de 88,5 pt |
| Pixel 8 | 572,0 pt | 493,9 pt | 78,1 pt |

Une ligne de 20 pt sous le pseudo ferait perdre 3,6 % à la boîte d'un
17 Pro (échelle 0,9363 → 0,9024) et 2,9 % à celle d'un 17e ; un bouton de
44 pt les mettrait toutes deux au plancher, 8 % sous la boîte du fil. C'est
la raison qui avait déjà sorti le cœur et la bulle du 22 de sous la boîte,
et le crayon du 21 de sous l'identité. D'où la ligne de date (D2) et la
barre du bas (D5) : ni l'une ni l'autre ne prend un point.

---

## 2. Objectif et critères de succès

Que suivre quelqu'un serve à quelque chose : retrouver ses bentos sans les
chercher, et savoir qui vous suit.

- **Suivre en un tap** depuis la page d'un compte, sans que la boîte perde un
  point.
- **Lire ses abonnements** dans « La table », d'un geste, sans onglet de plus.
- **Voir qui suit qui** : ses abonnés et ses abonnements, ceux des autres.
- **Choisir qui vous suit** : « Valider mes abonnés », appliqué par la base.
- **Se protéger** : bloquer retire l'abonnement et empêche d'en refaire un.
- **Ne rien casser** : la 1.1 et la 0.1.0 lisent comme avant, et une page
  sans abonné reste identique au pixel.
- **0 €** : une table et des fonctions, rien d'autre.

---

## 3. Périmètre

**Dans le chantier** :

- la table des abonnements, ses fonctions, son réglage et son interrupteur ;
- dans l'app : le bouton « Suivre », la ligne de date, l'écran des listes et
  des demandes, le filtre « Abonnements » de « La table », « Valider mes
  abonnés », l'export ;
- sur le web : le nombre d'abonnés dans la ligne de date, avec un repli avant
  la migration, et la politique de confidentialité.

**Hors du chantier** :

- le compte privé, aux bentos visibles des seuls abonnés (D3) ;
- les notifications, dans l'app ou par push : la zone de notifications est le
  chantier 24, qui lira cette table ;
- suivre depuis le fil, la recherche ou « Mêmes goûts » : depuis la page d'un
  compte et depuis les listes seulement ;
- des suggestions de comptes à suivre ;
- le back-office (D17).

---

## 4. Ce que disent le code et la base

### 4.1 La page d'un compte

`app/u/[pseudo].tsx`, profil et bento principal depuis le 21 :

- la barre du haut : « Retour » ou « Réglages », la pastille « Mêmes goûts »
  du 20, puis « Options », le menu signaler et bloquer, ou le crayon du 21
  sur sa propre page ;
- l'en-tête, `ProfileHeader` : le Popy flanqué du cœur et de la bulle du 22,
  le pseudo, puis la ligne de date, « bento publié le 12 septembre 2026 »,
  13 pt sur une ligne (`DATE_LINE_H`), comptée par le modèle ;
- la barre collante du bas, `CtaBar` : « Compose le tien », ou « Modifier »
  sur sa page, puis « Partager ».

`/u/<pseudo>/<slug>` est l'adresse d'un bento qui n'est pas le principal
(`app/u/[pseudo]/[slug].tsx`) : une liste à `/u/<pseudo>/abonnes`
masquerait le bento dont le titre donnerait ce slug. Les listes vivent donc
à part, comme les matchs du 20 et les commentaires du 22.

### 4.2 « La table »

`app/(tabs)/table.tsx` et `src/lib/feed.ts` : un `select` sur `bentos`
publiés, trié par date de publication puis par identifiant, paginé par
curseur, huit par page ; les épisodes du 19 s'y intercalent ; les comptes
bloqués sont retirés sur le téléphone. Le fil d'un seul compte (21) réutilise
la même requête avec un `FeedScope`. La règle `bentos_read_published` laisse
lire tout bento publié, et son brouillon à son auteur.

### 4.3 Les réglages

`src/components/PrivacySettings.tsx` tient la section Confidentialité de
Réglages : « Afficher mes visites » (8), « Apparaître dans la recherche »
(20), « Accepter les commentaires » et « Afficher les j'aime » (22). Chacun
est une colonne de `users`, écrite par le titulaire grâce à un droit
`update` limité à cette colonne, et à la règle `users_update_own` qui borne
les lignes.

### 4.4 Le blocage du 22

`account_blocks` (`blocker_id`, `blocked_id`, vers `auth.users`), écrite par
`set_block` et `sync_blocks` : le blocage suit le compte d'un téléphone à
l'autre. Il n'a, avant ce chantier, rien à retirer d'autre que les likes et
les commentaires.

### 4.5 Les comptes

Un profil est une ligne de `users` : `kind` vaut `member` ou `editorial`, un
profil éditorial (14) n'ayant pas de compte d'authentification. Supprimer son
compte (28) et bannir (14, 22) effacent la ligne de `users`.

### 4.6 Le web

`apps/landing/src/components/bento/BentoIdentity.tsx` écrit la même ligne,
« publié le … », sous le pseudo. La page se régénère au plus toutes les 5
minutes.

### 4.7 Les versions publiées

La 1.1 et la 0.1.0 lisent `users`, `bentos`, `bento_items` et `items`, et
n'ont jamais entendu parler d'abonnements. Une colonne de plus dans `users`
leur arrive dans les lignes lues, sans effet.

### 4.8 L'export

`src/lib/data-export.ts` assemble l'export de ses données, dont la partie
sociale rendue par `my_social_export`, redéfinie par le 22 puis par le 12.

---

## 5. Design

### 5.1 Le bouton « Suivre » (D5, D6)

Dans la barre du bas de la page d'un autre, à la place de « Compose le
tien », pour qui a un profil :

- « Suivre » : un tap, et le bouton passe aussitôt à « Abonné », ou à
  « Demandé » quand le compte valide ses abonnés ; rendu si l'écriture
  échoue, avec un toast ;
- « Abonné » : un tap ouvre la feuille d'actions, « Ne plus suivre @pseudo » ;
- « Demandé » : un tap ouvre « Annuler la demande ».

Sans profil, « Compose le tien » reste : on ne suit pas sans pseudo (D4), et
c'est ce qu'il faut faire d'abord. Sur sa propre page, « Modifier ». Un
profil éditorial se suit comme un autre, toujours ouvert, et ne suit
personne (D6).

### 5.2 La ligne de date (D2, D9)

Sans abonné ni abonnement, elle reste « bento publié le 12 septembre 2026 »,
au pixel près. Sinon elle devient « publié le 12 sept. 2026 · 4 abonnés » :

- le nombre d'abonnés, dès le premier ;
- à défaut d'abonné, celui des abonnements : « · 3 abonnements » ;
- sur sa propre page, les demandes en attente s'y ajoutent : « · 2 demandes ».

Alors la ligne entière est un bouton, qui ouvre les listes. Les nombres
s'écrivent comme les visites du 8, « 1 234 abonnés », par une fonction que
l'app et le web partagent (D14). Seuls les abonnements acceptés comptent
(D13).

### 5.3 Les listes (D8)

Un écran à part, `/follows/<id>`, ouvert par la ligne de date : deux onglets,
« Abonnés · 4 » et « Abonnements · 3 ». Chaque ligne montre le Popy, le
pseudo et le nom, et mène au profil. Les comptes que l'on a bloqués n'y
paraissent pas.

Sur sa propre liste :

- les demandes en tête des abonnés, chacune avec « Accepter » et
  « Refuser » ;
- « Retirer » sur chaque abonné, après confirmation : il ne vous suit plus,
  sans en être prévenu.

### 5.4 « Abonnements » dans « La table » (D1, D7)

Sous le titre, deux pastilles : « Tout le monde », le fil d'aujourd'hui, et
« Abonnements », les bentos publiés des comptes suivis, acceptés, du plus
récent au plus ancien, même pagination, sans épisodes. Le choix est retenu
sur le téléphone. Sans profil, pas de pastilles : « La table » reste celle
d'aujourd'hui.

Vide, « Abonnements » le dit : « Tu ne suis encore personne. » avec un lien
vers « Trouver », ou « Les comptes que tu suis n'ont encore rien publié. ».

### 5.5 Valider ses abonnés (D3, D11)

« Valider mes abonnés », cinquième interrupteur de Confidentialité, éteint
par défaut : « Chaque nouvel abonné attend ton accord. » Allumé, tout nouvel
abonnement est une demande, et rien ne change pour les abonnés déjà là.
Éteint, les demandes en attente sont acceptées.

Ce réglage choisit qui vous suit, pas qui vous lit : les bentos restent
publics, le compte privé étant hors du chantier (D3).

### 5.6 Bloquer (D10)

Bloquer un compte retire l'abonnement dans les deux sens, demandes
comprises ; tant que dure le blocage, ni l'un ni l'autre ne peut suivre
l'autre, ni le demander. Débloquer ne rend rien.

### 5.7 Le web (D16)

La ligne de date de la page web suit la règle de l'app (§5.2) pour les
abonnés et les abonnements, sans les demandes, ni liste, ni bouton : on suit
dans l'app. Avant la migration, la fonction manque et la page s'affiche
comme aujourd'hui. Le cache de 5 minutes suffit à un nombre.

### 5.8 L'interrupteur (D22)

`app_config.follows_enabled`, allumé : éteint, le bouton, les nombres, les
listes et le filtre disparaissent sans nouvelle version, et aucun abonnement
ne s'écrit ; ceux qui existent restent.

### 5.9 Les textes

La politique de confidentialité nomme les abonnements : qui l'on suit et qui
vous suit, publics, gardés jusqu'à ce qu'on les retire ou qu'on supprime son
compte, et rendus par l'export. Les règles de l'app ne changent pas : un
abonnement n'a pas de texte.

---

## 6. Contrat

### 6.1 Les tables

| Table | Colonnes | Clients |
| --- | --- | --- |
| `account_follows` | `follower_id` et `followed_id` → `users` (cascade), `status` (`accepted` ou `pending`), `created_at`, `accepted_at` ; clé des deux, et jamais soi-même | aucun droit direct |
| `account_follow_writes` | `user_id` → `auth.users` (cascade), `at` | aucun droit |

`users.follow_approval`, booléen, faux par défaut, écrit par son titulaire
seul (`grant update (follow_approval)`), comme `searchable`.
`app_config.follows_enabled`, vrai par défaut.

### 6.2 Les fonctions

Toutes en `security definer`, `search_path = ''`, sauf `following_bentos`.

- `set_follow(p_user, p_on)` : suivre, ou ne plus suivre, demande comprise.
  Rend `accepted`, `pending`, ou rien quand on ne suit plus. Refuse sans
  session, sans profil, quand l'interrupteur est éteint, soi-même ou un
  compte inconnu, un blocage dans un sens ou dans l'autre, et au-delà de
  60 abonnements par heure (D12). Suivre un compte déjà suivi ne fait rien.
- `answer_follow(p_follower, p_accept)` : accepter ou refuser une demande
  reçue.
- `remove_follower(p_follower)` : retirer un abonné, ou une demande.
- `follow_summary(p_user)` : les abonnés, les abonnements, les demandes au
  seul titulaire, le lien de qui lit vers ce compte, et son réglage. Ouverte
  à `anon`, pour le web.
- `follow_list(p_user, p_kind, p_before, p_limit)` : les abonnés, les
  abonnements, ou les demandes au seul titulaire ; 50 par page, du plus
  récent au plus ancien ; sans les comptes que qui lit a bloqués.
- `following_bentos()`, en `security invoker`, donc sous la règle
  `bentos_read_published` : les bentos publiés des comptes suivis, que
  PostgREST trie, pagine et complète avec la même sélection que « La table ».
  Elle lit les comptes suivis par `my_followed_ids()`.
- `my_social_export()`, redéfinie : les abonnements, les abonnés et les
  demandes, envoyées et reçues.

### 6.3 Les déclencheurs

- Après un blocage, `account_blocks_drop_follows` efface les abonnements
  entre les deux comptes, dans les deux sens (D10).
- Quand `follow_approval` s'éteint, `users_follow_approval_open` accepte les
  demandes en attente (D11).

### 6.4 L'ordre de mise en service

La migration suit celles du 22 et du 12 : son déclencheur porte sur
`account_blocks`, et `my_social_export` reprend les pourquoi du 12.

---

## 7. Recette

### 7.1 Les contrôles de la base

`scripts/check-follows.mjs`, contre une pile Supabase locale à part, comme
`check-whys.mjs` : chaque règle de §6, à la clé anonyme et par des comptes
jetables, puis des défauts introduits exprès, que les contrôles doivent tous
attraper. `scripts/check-follows.sql` : les contrôles en lecture de la mise
en service.

### 7.2 Aux trois appareils

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8 :

- suivre depuis la page d'un compte, la ligne de date qui change, ne plus
  suivre ;
- un compte qui valide : demander, voir la demande, accepter, refuser,
  retirer un abonné ;
- « Abonnements » dans « La table », vide puis rempli ;
- bloquer, et l'abonnement qui disparaît des deux côtés ;
- une page sans abonné identique au pixel à celle du 12 ;
- la plus grande taille de texte, 200 % sur Android, le lecteur d'écran sur
  le bouton et la ligne de date.

---

## 8. Lots

1. **La base** : la migration, `check-follows.mjs` et ses défauts introduits,
   `check-follows.sql`.
2. **Les données de l'app** : les types, `src/lib/follows.ts` et ses tests,
   les appels et leurs tests contre le bouchon PostgREST, le fil des
   abonnements.
3. **Les écrans** : le bouton, la ligne de date, les listes et les demandes,
   le filtre de « La table », « Valider mes abonnés », l'export.
4. **La landing** : le nombre dans la ligne de date et son repli, la
   politique de confidentialité, l'e2e.
5. **La recette et les documents** : §7.2, la DoD point par point,
   `RECETTE-MOBILE.md`, la roadmap et cette spécification.

---

## 9. Livraison

Fait et recetté le 27 octobre 2026, en cinq lots enchaînés, sur
`feat/ux-23-suivre-un-compte`, partie de la branche de la PR #101,
documentation seule, et ouverte en PR #102, empilée sur la #101. Rien n'est appliqué en production : la mise en service
attend Clément, après celles du 22 et du 12 (§9.6).

### 9.1 Lot 1 · La base

- `20261027100000_account_follows.sql` : les deux tables, le réglage,
  l'interrupteur, les deux déclencheurs et les fonctions de §6.2.
- `scripts/check-follows.mjs` : 81 contrôles en douze parties, contre la pile
  `bento-pop-follows`, puis vingt-huit défauts introduits exprès, un à un,
  tous attrapés. Un vingt-neuvième, le filtre `published_at` du fil retiré
  seul, est équivalent : sous `security invoker`, la règle de lecture de
  `bentos` cache déjà les brouillons des autres, et l'on ne se suit pas
  soi-même. Les deux protections retirées ensemble se voient.
- `scripts/check-follows.sql` : les contrôles en lecture de la mise en
  service, passés sur la pile locale, accents du commentaire compris.

### 9.2 Lot 2 · Les données de l'app

- Les types de `@bento-pop/supabase-mobile`, et dans son module partagé
  `formatFollowCount` et `followSegment`, que l'app et la landing appellent.
- `src/lib/follows.ts`, 24 tests ; `src/lib/follow-actions.ts` et le fil des
  abonnements de `feed.ts`, 13 tests contre le bouchon PostgREST.
- L'interrupteur dans `app-config.ts`, l'export, le filtre retenu par
  `state/table-filter.ts`.

### 9.3 Lot 3 · Les écrans

- La page d'un compte : la ligne de date et sa part soulignée, « Suivre »
  dans la barre du bas et sa feuille d'actions, le texte du blocage, « et
  vous ne vous suivrez plus ».
- `app/follows/[userId].tsx` : les deux onglets, les demandes, « Retirer ».
- « La table » : le filtre, le fil des abonnements, ses deux états vides.
- « Valider mes abonnés » dans Confidentialité.

### 9.4 Lot 4 · La landing

- Le nombre dans la ligne de date, lu par `follow_summary` en même temps que
  les visites, et son repli sur `PGRST202`.
- La politique de confidentialité : les abonnements, leur finalité, leur
  conservation.
- L'e2e : quatre tests neufs, dont celui d'avant la migration ; 57 sur 57.

### 9.5 Lot 5 · La recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur la pile
`bento-pop-follows`, la build de développement du 12 rebranchée sans
recompiler :

- suivre, puis ne plus suivre par la feuille ; demander à un compte qui
  valide, le toast, annuler la demande ;
- « Valider mes abonnés » : deux demandes dans sa ligne de date et en tête de
  ses abonnés, accepter, refuser, retirer avec confirmation ; éteindre le
  réglage accepte ce qui attendait ;
- bloquer : l'alerte le dit, les deux abonnements partent ; débloquer ne rend
  rien ;
- « Abonnements » vide, puis rempli, retenu après une relance à froid ;
  l'interrupteur éteint retire le filtre ;
- **identiques au pixel**, le code d'avant chaque fois prouvé chargé : son
  profil sans abonné au 17 Pro, la page de lea.cine vue sans profil au SE ;
- la plus grande taille de texte au SE, 200 % au Pixel 8 : la ligne de date
  sur une ligne, les listes, le filtre ; la pastille choisie annoncée
  « sélectionnée » à TalkBack.

**Deux défauts trouvés, corrigés, puis revérifiés à froid, trois fois sur
trois** :

- **le pseudo de la première ligne d'une liste tombait à la trace** sur iOS :
  `adjustsFontSizeToFit` avec une hauteur de ligne posée. Il prend désormais
  la taille que l'écran mesure, `lineFitScale` ;
- **une régression de « La table »** : l'étiquette du premier post tombait à
  la trace dès que le filtre s'ajoutait à l'en-tête, par le même défaut de
  plateforme, dans `FeedLabel`, que le 23 ne touchait pas. Son titre d'une
  ligne est mesuré de même, et rend au pixel près la taille d'avant, 342 ×
  80 px d'encre. Les titres de deux lignes des épisodes gardent leur
  réduction par la plateforme : la pile de recette n'a pas d'épisodes.

Deux pièges de recette, versés à `RECETTE-MOBILE.md` : sans `watchman`,
Metro servait d'anciens écrans chargés à la demande, d'où un `--clear` après
chaque lot ; et un port de Metro réécrit dans le fichier des préférences est
ignoré, `cfprefsd` gardant l'ancien. Le premier A/B comparait ainsi le 23 à
lui-même : refait par `defaults write` et un argument de lancement.

Non vérifiés : la voix de VoiceOver et de TalkBack, un vrai téléphone, au
chantier 29.

### 9.6 La mise en service, par Clément

Après celles du 22 et du 12, dont les migrations doivent précéder celle-ci :
son déclencheur porte sur `account_blocks`, et son export reprend les
pourquoi.

1. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-follows.sql`.
2. **La landing**, redéployée d'elle-même à la fusion ; le back-office n'a
   rien de neuf.
3. Aucune variable, aucun service : 0 €.

### 9.7 La CI, rejouée en local

Sur l'arbre de travail du 23, modifications non commitées comprises, sans
cache : install figée ; lint et typage 8 sur 8 ; tests 998 pour l'app, 251
pour l'admin et 202 pour la landing ; build 3 sur 3 ; e2e de la landing 57
sur 57, joué à part. Aucun échec. Les 81 contrôles de la base repassés après
la recette, sans échec.

---

## 10. Definition of Done

État au 27 octobre 2026 : 11 sur 13, les deux derniers à la fusion et à la
mise en service.

1. ✅ Suivre et ne plus suivre en un tap depuis la page d'un compte, sans que
   la boîte perde un point ; jamais soi-même : contrôles 1, recette aux trois
   appareils, « Suivre » à la place et à la taille de « Compose le tien ».
2. ✅ Les bentos des comptes suivis dans « Abonnements », et seulement eux :
   contrôles 5, recette au 17 Pro et au Pixel 8.
3. ✅ La ligne de date dit le nombre d'abonnés et ouvre les listes ; une page
   sans abonné ni abonnement identique au pixel : son profil au 17 Pro, la
   page d'un autre vue sans profil au SE (§9.5).
4. ✅ Un compte qui valide voit ses demandes, les accepte ou les refuse ;
   éteindre le réglage les accepte : contrôles 2, recette au 17 Pro.
5. ✅ Retirer un abonné : contrôles 3, recette au 17 Pro.
6. ✅ Bloquer retire l'abonnement dans les deux sens et empêche d'en refaire
   un, vérifié à la clé anonyme : contrôles 6, recette au 17 Pro.
7. ✅ Aucun chemin d'écriture hors des fonctions, et 60 abonnements par heure
   au plus, vérifié à la clé anonyme : contrôles 1 et 7.
8. ✅ `follows_enabled` coupe tout sans nouvelle version : contrôles 8, et le
   filtre retiré de « La table » au 17 Pro.
9. ✅ La 1.1 et la 0.1.0 lisent comme avant : leurs lectures embarquées et
   leur suppression d'un profil, contrôles 9.
10. ✅ Le web montre le nombre, et s'affiche comme avant sans la migration :
    l'e2e de la landing.
11. ⬜ La politique de confidentialité à jour, **en production** : écrite, la
    landing à redéployer après la fusion.
12. ✅ La recette de §7.2 aux trois appareils, §9.5.
13. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : compatible, et la CI rejouée sans échec (§9.7) ;
    l'application attend la mise en service.

---

## 11. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Les abonnements se lisent dans un filtre de « La table », « Tout le monde · Abonnements », sous le titre | QCM. Aucun onglet de plus : les quatre libellés de la barre se tronquent déjà sur Android (chantier 11) |
| **D2** | Les nombres sont publics, dans la ligne de date : « publié le 12 sept. 2026 · 4 abonnés », dès le premier abonné ; la ligne ouvre les listes, publiques | QCM. 0 pt pris à la boîte, que le 17 Pro tient à 3 pt près (§1.3) |
| **D3** | On suit en un tap ; « Valider mes abonnés », éteint par défaut, fait de chaque abonnement une demande ; le compte privé reste hors du chantier | QCM. Le réglage du 26 ; le compte privé reprendrait le fil, la page web, la recherche, les matchs et le sitemap |
| **D4** | Tout compte qui a un pseudo peut suivre | QCM. 64 profils ; un abonné se montre par son pseudo dans les listes et les demandes |
| **D5** | « Suivre » prend la place de « Compose le tien » dans la barre du bas, pour qui a un profil ; puis « Abonné » ou « Demandé » | §1.3 : aucune autre place ne laisse la boîte intacte ; sans profil, composer vient d'abord |
| **D6** | Un profil éditorial se suit comme un autre, toujours ouvert, et ne suit personne | Il n'a pas de compte (14) ; aucun n'existe au 27 octobre |
| **D7** | « Abonnements » montre tous les bentos publiés des comptes suivis et acceptés, sans épisodes ; le choix retenu sur le téléphone ; sans profil, pas de filtre | Un compte suivi apporte ce qu'il a déjà publié ; les épisodes ne sont pas un compte |
| **D8** | Les listes vivent à `/follows/<id>`, deux onglets ; sur la sienne, les demandes en tête et « Retirer » | `/u/<pseudo>/abonnes` masquerait un bento de ce slug (§4.1) |
| **D9** | Les demandes se lisent dans sa ligne de date et en tête de ses abonnés ; aucune notification | La zone de notifications est le chantier 24 |
| **D10** | Bloquer retire l'abonnement dans les deux sens, demandes comprises, et empêche d'en refaire un tant que dure le blocage ; débloquer ne rend rien | Ce que la roadmap demande ; le blocage vit en base depuis le 22 |
| **D11** | Éteindre « Valider mes abonnés » accepte les demandes en attente ; l'allumer ne retire personne | On ouvre son compte à tous, ceux qui attendaient compris |
| **D12** | 60 abonnements nouveaux par heure et par compte, demandes comprises ; ne plus suivre n'est pas compté | Le plafond qui arrête un script sans gêner personne : 64 profils en tout |
| **D13** | Seuls les abonnements acceptés comptent ; les nombres sont les mêmes pour tous | Une demande n'est pas un abonné |
| **D14** | Les nombres s'écrivent comme les visites du 8 : « 1 abonné », « 4 abonnés », « 1 234 abonnés », zéro et un au singulier, une espace insécable avant le mot ; une seule fonction pour l'app et le web, `formatFollowCount` | Ils prennent place dans la ligne des visites, qui s'écrit déjà ainsi ; le « 12 k » du 22 sert des pastilles étroites. Revu au lot 2 |
| **D15** | Supprimer son compte ou être banni efface ses abonnements et ses abonnés ; l'export les rend | La cascade de `users` ; ce sont des données de son compte |
| **D16** | Le web montre les nombres dans sa ligne de date, sans les demandes, ni liste, ni bouton ; il tient avant la migration | Le web suit le profil de l'app (21) ; on suit dans l'app |
| **D17** | Rien au back-office | Un abonnement n'a pas de texte à modérer ; bannir efface déjà tout (D15) |
| **D18** | La 1.1 et la 0.1.0 ne voient rien : une table neuve sans droit direct, une colonne et des fonctions neuves | La règle de la sortie store unique |
| **D19** | Pas de feuille « Garde ton compte » de plus au premier abonnement | Réglages et la feuille après la première publication (28) suffisent |
| **D20** | Le lecteur d'écran lit « Suivre @pseudo », « Abonné à @pseudo », « Demande envoyée à @pseudo », et la ligne de date en entier, avec son indice | Chantier 11 |
| **D21** | Le filtre « Abonnements » retire aussi les comptes bloqués sur le téléphone, comme « La table » | Un blocage d'avant le 22 n'existe que sur le téléphone |
| **D22** | `app_config.follows_enabled` coupe tout sans nouvelle version ; les abonnements restent | Comme `comments_enabled` (22) et `whys_enabled` (12) |

---

## 12. Suivis

- **Le compte privé**, aux bentos visibles des seuls abonnés (D3).
- **Les notifications** d'un nouvel abonné, d'une demande et d'un nouveau
  bento d'un compte suivi : chantier 24.
- **Les abonnés fantômes** : un compte anonyme perdu garde ses abonnements ;
  une purge des comptes inactifs les retirerait, avec leurs likes.
- **Suivre depuis le fil, la recherche ou « Mêmes goûts »**, si l'usage le
  demande.
