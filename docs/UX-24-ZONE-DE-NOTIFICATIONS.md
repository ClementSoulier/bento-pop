# Chantier 24 · Zone de notifications dans l'app

> Spécification écrite le 27 octobre 2026, à partir du code de
> `feat/ux-23-suivre-un-compte` (`68dca53`, la PR #102, elle-même sur la
> #101) et de lectures sur la production, en lecture seule : la base mobile,
> projet « My Bento Pop ». Aucune écriture en production.
>
> **Arbitrages rendus le 27 octobre 2026 par Clément**, en QCM, D1 à D3
> (§11) : un cinquième onglet plutôt que la cloche recommandée ; les
> décisions de l'équipe en plus de ce que la demande nomme ; 90 jours. D4 à
> D25 sont pris par la spécification. En résumé : un onglet « Notifs », entre
> « Trouver » et « Profil », dont l'icône porte le nombre de nouveautés ; une
> ligne par sujet, « 3 personnes ont aimé ton bento », « @lea.cine et 2
> autres te suivent » ; rien n'est recopié, la zone se calcule à la lecture
> à partir des likes, des commentaires, des abonnements et des décisions de
> l'équipe, donc elle est exacte par construction et n'a rien à purger.
> Même sortie store unique que tous les chantiers.
>
> **Fait et recetté le même jour**, en cinq lots, sur
> `feat/ux-24-zone-de-notifications` : DoD 11 sur 13, les deux derniers
> attendant la fusion et la mise en service par Clément, après celles du 22,
> du 12 et du 23, cf. §9.

---

## 1. Ce que la production dit

Mesuré le 27 octobre 2026, en lecture seule.

- **113 comptes, 64 profils, 28 bentos publiés** : 4 dans les 30 derniers
  jours, 17 dans les 90. Par mois : 7 en mai, 1 en juin, 3 en juillet, 10 en
  août, 3 en septembre, 4 en octobre.
- **141 items proposés en 90 jours, par 26 comptes** : 107 validés, 20
  fusionnés dans un item existant, 4 refusés, 10 en attente. Le 17 a mesuré
  6,9 jours de validation en médiane, **sans que personne soit prévenu** : son
  push attend la clé APNs et le compte FCM.
- **Aucun like, commentaire ni abonnement** : les migrations du 22 et du 23
  attendent leur mise en service. Aucune édition sortie, aucun appareil
  enregistré pour le push.

À ce rythme, la zone d'un compte tient en une page sur 90 jours. Le chantier
se dessine pour l'exactitude, pas pour le volume.

### 1.1 La barre d'onglets

Quatre onglets aujourd'hui, en Bungee 9, espacement 1, la taille figée et
plafonnée au chantier 11 (`(tabs)/_layout.tsx`). Largeurs mesurées par la
table de Bungee (`bungeeTextWidth`), redérivée du fichier de la police :

| Libellé | Largeur |
| --- | --- |
| « La table » | 54,0 pt |
| « Trouver » | 52,1 pt |
| « Compose » | 51,4 pt |
| « Profil » | 42,7 pt |
| « Notifs » | 42,2 pt |
| « Activité » | 55,4 pt |
| « Notifications » | 91,6 pt |

| Fenêtre | 4 onglets | 5 onglets |
| --- | --- | --- |
| 360 dp, petit Android | 90 | 72 |
| iPhone SE, 375 pt | 93,8 | 75 |
| iPhone 17 Pro, 402 pt | 100,5 | 80,4 |
| Pixel 8, 411 dp | 102,8 | 82,2 |

Cinq onglets tiennent à la taille par défaut. Au plafond des contrôles,
×1,2, « La table » passe vers 64 pt, sous les 72 d'un petit Android. Le
libellé rétrécit déjà plutôt que de se tronquer, mais par
`adjustsFontSizeToFit` avec une hauteur de ligne posée : la combinaison qui
a fait tomber deux textes à la trace sur iOS à la recette du 23. Le libellé
prendra donc la taille que l'écran mesure, `lineFitScale`, comme l'étiquette
du fil.

---

## 2. Ce que la zone annonce

Pour un compte qui a un profil, sur 90 jours (D3) :

| Sorte | Quand | Ligne |
| --- | --- | --- |
| `like` | quelqu'un aime un de ses bentos publiés | « 3 personnes ont aimé ton bento » |
| `comment` | quelqu'un commente un de ses bentos | « @lea.cine et 2 autres ont commenté ton bento : « Trop bien » » |
| `follow` | quelqu'un le suit, ou sa demande est acceptée | « @lea.cine et 3 autres te suivent » |
| `follow_request` | quelqu'un demande à le suivre | « @lea.cine demande à te suivre » |
| `followed_bento` | un compte qu'il suit publie un bento | « @lea.cine a publié son bento » |
| `item_validated` | un item qu'il a proposé est validé, ou fusionné | « Tes items « Dune » et « Akira » sont validés » |
| `item_rejected` | un item qu'il a proposé est refusé | « Ton item « X » est refusé : motif » |
| `bento_published` | la validation de ses items publie son bento (18) | « Ton bento est publié : tous ses items sont validés » |
| `comment_hidden` | l'équipe masque un de ses commentaires (22) | « L'équipe a masqué ton commentaire : motif » |
| `why_hidden` | l'équipe masque un de ses pourquoi (12) | « L'équipe a masqué ton pourquoi sur « Dune » : motif » |

Les quatre premières sont la demande, les abonnés y compris : le 23 les a
renvoyées ici (D9 du 23). Les quatre dernières sont « les décisions de
l'équipe », choisies au QCM (D2) ; le pourquoi masqué s'y range avec le
commentaire masqué, même geste de l'équipe sur un contenu de la personne. Les
éditions n'y entrent pas.

- **Un like reste anonyme** : un nombre, jamais un pseudo. Le 22 l'a décidé,
  « le nombre est public, la liste non », et un compte anonyme aime sans
  pseudo (D5 du 22).
- **Un bento d'édition se nomme par son titre** : « ton bento « Le film de
  ta vie » », « @lea.cine a publié son bento « Le film de ta vie » ».
- **On ne se notifie jamais soi-même** : son propre commentaire sur son
  bento, par exemple.

---

## 3. Où elle vit

**Un cinquième onglet, « Notifs », entre « Trouver » et « Profil »** (D1,
D5). L'icône est une cloche, du même trait que les autres, remplie quand
l'onglet est actif. Une pastille rouge, `--bento-red`, cerclée d'encre, porte
le nombre de nouveautés, « 9+ » au-delà de 9 ; rien quand il n'y en a pas.
Le lecteur d'écran lit « Notifications, 3 nouvelles, onglet 4 sur 5 ».

L'onglet est là pour tous quand l'interrupteur est allumé (D12). Sans profil,
rien ne peut arriver : l'écran le dit, et propose de composer. Interrupteur
éteint, la barre revient à quatre onglets, au pixel près celle d'avant (D13).

L'écran : le titre « Notifs » en Extenda, puis une liste. En tête, les
lignes nouvelles, sur fond `--bento-tint-lit`, chacune marquée d'un point ;
puis « Plus tôt ». Chaque ligne : l'avatar (le Popy de l'auteur, un cœur pour
les likes, le Popy de Bento Pop pour l'équipe), la phrase, l'heure relative.

---

## 4. Nouveau, lu, et le nombre

- **Une date par compte, `notification_reads.seen_at`**, posée quand l'écran
  s'affiche : la date de la ligne la plus récente qu'il montre, jamais plus
  tard que maintenant (D8). Ce qui arrive ensuite reste nouveau.
- **Une ligne est nouvelle** quand l'un de ses évènements est postérieur à
  cette date. Un sujet qui a du neuf et de l'ancien donne deux lignes : « 2
  personnes ont aimé ton bento » en tête, « 12 personnes » plus bas (D6). À
  la lecture suivante, elles n'en font plus qu'une.
- **Le nombre de la pastille est le nombre de lignes nouvelles**, calculé par
  la même fonction que la liste : il ne peut pas la contredire (D8).
- **Lu au retour, pas en temps réel** (D9) : le nombre se relit à l'ouverture
  de l'app, à son retour au premier plan et à chaque changement d'onglet ;
  la liste, à chaque arrivée sur l'onglet et en tirant vers le bas. Realtime
  n'est pas ouvert sur le projet, et son plan gratuit plafonne à 200
  connexions.

---

## 5. Les taps

| Ligne | Ouvre |
| --- | --- |
| like | la page du bento |
| commentaire, commentaire masqué | ses commentaires, où le motif d'un masquage est lu (22) |
| abonné, demande | ses abonnés, les demandes en tête (23) |
| bento d'un compte suivi | la page de ce bento |
| item validé, refusé, bento publié | le même chemin que le tap du push du 17 : le composer, la case qui pulse, la recherche de la case après un refus, la page publique après une publication (D10) |
| pourquoi masqué | « Tes pourquoi » de ce bento (12) |

---

## 6. La base

### 6.1 Rien n'est recopié

**La zone se calcule à la lecture** (D4). Une fonction lit, pour le compte
qui appelle, les likes de ses bentos, les commentaires, les abonnements, les
bentos de ceux qu'il suit, ses items et ses contenus masqués, sur 90 jours,
et les regroupe. Aucune table de notifications, aucun déclencheur sur un
chemin d'écriture, aucune purge :

- **exacte par construction** : retirer son like, supprimer ou masquer un
  commentaire, ne plus suivre, bloquer, supprimer son compte, tout disparaît
  de la zone sans une ligne de code de plus ;
- **sans risque pour la 1.1 et la 0.1.0** : aucune de leurs écritures ne
  déclenche rien de neuf ;
- **sans ordonnanceur** : la fenêtre de 90 jours est un filtre, pas une
  tâche ;
- **au prix d'une lecture plus lourde**, que les volumes de §1 rendent
  négligeable, et que les index existants servent : `bento_likes` par bento,
  `bento_comments_bento`, `account_follows (followed_id, status)`.

Le push du 17 pourra relire la même fonction pour envoyer un résumé, le jour
où sa clé arrive (D19).

### 6.2 Les objets

- `notification_reads (user_id → users, seen_at)`, sans droit direct, RLS
  active, en cascade avec le profil.
- `items.merged_at`, posée par `items_touch_lifecycle_on_update` à la
  fusion, comme `validated_at` et `rejected_at` le sont déjà. Les fusions
  passées n'ont pas de date et restent hors de la zone (D15).
- `app_config.notifications_enabled`, allumé par défaut (D13).
- `notification_events(p_viewer)`, interne, sans droit pour personne : les
  évènements, chacun avec sa sorte, sa clé de regroupement, sa date, son
  auteur et sa cible.
- `notification_badge()` : le nombre de lignes nouvelles ; 0 sans session,
  sans profil ou interrupteur éteint.
- `list_notifications(p_before, p_before_key, p_limit)` : les lignes,
  regroupées, les plus récentes d'abord, 30 par page, au curseur
  `(latest_at, group_key)` ; nouvelles d'abord par construction, puisque
  leur date dépasse `seen_at` et que celle des autres ne la dépasse pas.
- `mark_notifications_seen(p_until)` : pose `seen_at` au plus grand de
  l'ancien et de `least(p_until, now())`, rend la date posée.
- `my_social_export` reprend celle du 23 et ajoute `notifications.seen_at`
  (D17).

### 6.3 Les règles de chaque sorte

- **like** : un bento publié du compte, un autre compte que lui.
- **comment** : visible, d'un autre auteur, sur un bento publié du compte.
- **follow** : accepté ; sa date est celle de l'acceptation, ou de
  l'abonnement d'un compte ouvert. **follow_request** : en attente.
- **followed_bento** : publié par un compte suivi et accepté, après le
  début de l'abonnement, profils éditoriaux compris (D6 du 23).
- **item_validated** : validé ou fusionné, proposé par le compte ; une seule
  ligne pour tous, les deux titres les plus récents et le nombre ; un item
  fusionné sous le titre de l'item gardé (D25).
  **item_rejected** : une ligne par item, avec son motif.
- **bento_published** : `auto_published_at`, posée par le 18.
- **comment_hidden**, **why_hidden** : masqués par l'équipe, avec leur
  motif.
- **Les comptes bloqués**, dans un sens ou dans l'autre (`account_blocks`),
  n'apparaissent jamais (D11).

### 6.4 Compatibilité

La 1.1 et la 0.1.0 ne voient rien (D16) : une table neuve sans droit, deux
colonnes neuves, des fonctions neuves ; le déclencheur des items gagne une
branche, que seul le back-office atteint. **La migration suit celle du 23**,
dont elle lit les abonnements et redéfinit l'export.

---

## 7. Recette et contrôles

### 7.1 Les contrôles de la base

`scripts/check-notifications.mjs`, contre une pile locale à part, à la clé
anonyme et avec de vrais comptes : chaque sorte apparaît, se regroupe et se
sépare en nouveau et plus tôt ; le nombre égale les lignes nouvelles ; la
fenêtre de 90 jours ; les blocages dans les deux sens ; un commentaire
masqué sort des commentaires et entre chez son auteur ; un bento dépublié
sort ; retirer son like, ne plus suivre, supprimer un compte ; personne ne
lit la zone d'un autre ; l'interrupteur ; `seen_at` ne recule pas et ne
dépasse pas maintenant ; la fusion pose `merged_at` ; le curseur ; l'export ;
les lectures de la 1.1 et de la 0.1.0. Puis des défauts introduits exprès,
un à un, qui doivent tous être attrapés.

`scripts/check-notifications.sql` : les contrôles en lecture de la mise en
service.

### 7.2 La recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8 :

1. Un compte reçoit un like, deux commentaires, un abonné, une demande, le
   bento d'un compte suivi, un item validé, un refusé, un commentaire
   masqué : la pastille dit le bon nombre, la liste les bonnes lignes.
2. Ouvrir l'onglet : les lignes nouvelles en tête ; revenir : plus rien de
   nouveau, la pastille disparaît ; un nouveau like refait une ligne en tête.
3. Chaque tap mène où dit §5.
4. Bloquer l'auteur d'un commentaire : sa ligne disparaît.
5. Sans profil : l'écran vide et son bouton.
6. Interrupteur éteint : quatre onglets, au pixel près ceux d'avant.
7. Les cinq libellés entiers au SE et au Pixel 8, à la plus grande taille de
   texte et à 200 %.

---

## 8. Les lots

1. **La base** : la migration, `check-notifications.mjs` et ses défauts,
   `check-notifications.sql`, les types.
2. **Les données dans l'app** : `notifications.ts`, les phrases et le
   regroupement côté écran, testés ; `notification-actions.ts` et ses tests
   d'intégration ; l'interrupteur ; l'export.
3. **L'onglet et l'écran** : la cloche et sa pastille, le libellé mesuré,
   l'écran, les taps, la date de lecture, la relecture au retour.
4. **La landing** : la politique de confidentialité (D18).
5. **La recette et les documents**.

---

## 9. Livraison

Fait et recetté le 27 octobre 2026, en cinq lots enchaînés, sur
`feat/ux-24-zone-de-notifications`, partie de la branche de la PR #102, le
23, elle-même sur la #101. Rien n'est appliqué en production : la mise en
service attend Clément, après celles du 22, du 12 et du 23 (§9.6).

### 9.1 Lot 1 · La base

- `20261027200000_notifications.sql` : `notification_reads`, `items.merged_at`
  et sa branche du déclencheur des items, l'index des propositions,
  l'interrupteur, `notification_events`, `notification_badge`,
  `list_notifications`, `mark_notifications_seen` et l'export.
- `scripts/check-notifications.mjs` : 79 contrôles en quatorze parties, contre
  la pile `bento-pop-notifs`, puis vingt-six défauts introduits exprès, un à
  un, tous attrapés.
- `scripts/check-notifications.sql` : les contrôles en lecture de la mise en
  service.

### 9.2 Lot 2 · Les données dans l'app

- `src/lib/notifications.ts` : les phrases, les avatars, les destinations, les
  sections, le curseur, la pastille et le libellé de l'onglet ; 26 tests.
- `src/lib/notification-actions.ts` : les trois appels ; 9 tests contre le
  bouchon PostgREST.
- L'interrupteur dans `app-config.ts`, la date de lecture dans l'export.

### 9.3 Lot 3 · L'onglet et l'écran

- `(tabs)/_layout.tsx` : le cinquième onglet, la cloche et sa pastille, les
  libellés d'accessibilité à cinq ou à quatre onglets, et le libellé mesuré,
  `tabLabelScale`, 4 tests ; interrupteur éteint, l'onglet sort de la barre.
- `(tabs)/notifications.tsx` : la zone, « Nouveau » et « Plus tôt », les taps,
  la date de lecture, la relecture à chaque arrivée, l'écran sans profil.
- `use-notifications.ts` : le nombre, relu au premier plan et à chaque
  changement d'onglet.

### 9.4 Lot 4 · La landing

- La politique de confidentialité : l'onglet « Notifs », ce qu'il lit, la date
  gardée, sa finalité et sa conservation.

### 9.5 Lot 5 · La recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur la pile
`bento-pop-notifs`, la build de développement du 12 rebranchée sans
recompiler :

- une ligne de chaque sorte, dix en tout ; la pastille « 9+ », et le lecteur
  d'écran « Notifications, 10 nouvelles, onglet 4 sur 5 » ;
- ouvrir l'onglet lit tout, la pastille s'éteint ; un like de plus, et au
  changement d'onglet suivant « 1 nouvelle » : sa ligne seule sous « Nouveau »,
  les dix autres sous « Plus tôt », puis « 4 personnes » à la lecture
  d'après ;
- les neuf destinations : la page du bento, ses commentaires, ses abonnés
  avec la demande en tête, la page du bento suivi, le composer, la recherche
  de la case après un refus, « Tes pourquoi » ;
- bloquer un compte retire ses likes, ses commentaires et son abonnement ;
- sans profil, l'écran l'explique et propose de composer ;
- **interrupteur éteint, la barre identique au pixel** à celle du 23, le code
  d'avant prouvé chargé, 2 286 modules : 0 pixel différent sur 305 118 ;
- la plus grande taille de texte au SE, 200 % au Pixel 8 : les cinq libellés
  entiers, les lignes repliées sans rien tronquer.

**Deux défauts trouvés, corrigés, puis revérifiés** :

- **la pastille rognait son « + »** : en position absolue dans l'icône de
  22 pt, elle n'avait que 10 pt pour grandir. Elle prend la largeur mesurée de
  son texte ; « 9+ » entier au 17 Pro et au Pixel 8 ;
- **un item fusionné s'annonçait sous sa faute de frappe**, « Inseption »,
  que sa case ne montre plus : il s'annonce sous le titre de l'item gardé,
  « Inception » (D25), et un contrôle de plus le garde.

Non vérifiés : la voix de VoiceOver et de TalkBack, un vrai téléphone, au
chantier 29.

### 9.6 La mise en service, par Clément

Après celles du 22, du 12 et du 23, dont les migrations doivent précéder
celle-ci : elle lit les abonnements du 23 et redéfinit son export.

1. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-notifications.sql`.
2. **La landing**, redéployée d'elle-même à la fusion ; le back-office n'a
   rien de neuf.
3. Aucune variable, aucun service : 0 €.

### 9.7 La CI, rejouée en local

Sur l'arbre de travail du 24, modifications non commitées comprises, sans
cache : install figée ; lint et typage 8 sur 8 ; tests 1 037 pour l'app, 251
pour l'admin et 202 pour la landing ; build 3 sur 3 ; e2e de la landing 57
sur 57. Aucun échec. Les 79 contrôles de la base repassés après la dernière
correction, celle du titre d'un item fusionné, sans échec.

---

## 10. Definition of Done

État au 27 octobre 2026 : 11 sur 13, les deux derniers à la fusion et à la
mise en service.

1. ✅ Chaque like, commentaire, abonné, demande et nouveau bento d'un compte
   suivi apparaît dans la zone, regroupé : contrôles 2 à 5, recette aux trois
   appareils.
2. ✅ Les décisions de l'équipe aussi : item validé, fusionné, refusé, bento
   publié, commentaire et pourquoi masqués : contrôles 6, recette aux trois
   appareils.
3. ✅ Le nombre de la pastille égale toujours les lignes nouvelles :
   contrôles 7 et 9, recette au 17 Pro.
4. ✅ Ouvrir l'onglet lit tout ; ce qui arrive ensuite est nouveau :
   contrôles 7, recette au 17 Pro.
5. ✅ Rien d'un compte bloqué, dans un sens ou dans l'autre ; un like ne dit
   jamais qui : contrôles 2 et 9, recette au 17 Pro.
6. ✅ 90 jours, et rien à purger : contrôles 8.
7. ✅ Chaque tap mène à son sujet : les neuf destinations, au 17 Pro.
8. ✅ Personne ne lit la zone d'un autre, vérifié à la clé anonyme :
   contrôles 1.
9. ✅ L'interrupteur rend la barre d'avant, sans nouvelle version :
   contrôles 11, et la barre identique au pixel à celle du 23 (§9.5).
10. ✅ La 1.1 et la 0.1.0 lisent et écrivent comme avant : contrôles 12.
11. ✅ Les cinq libellés entiers à toutes les tailles, sur les trois
    appareils : la plus grande au SE, 200 % au Pixel 8, et `tabLabelScale`.
12. ⬜ La politique de confidentialité à jour, **en production** : écrite, la
    landing à redéployer après la fusion.
13. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : compatible, et la CI rejouée sans échec (§9.7) ;
    l'application attend la mise en service.

---

## 11. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Un cinquième onglet | QCM, contre la cloche recommandée : toujours à portée. Les libellés tiennent, §1.1 |
| **D2** | En plus de la demande : les décisions de l'équipe, item validé, fusionné ou refusé, bento publié à la validation, commentaire et pourquoi masqués ; pas les éditions | QCM. 141 items proposés en 90 jours, 6,9 jours d'attente sans nouvelle ; le pourquoi masqué est le même geste que le commentaire masqué |
| **D3** | 90 jours | QCM. Une page par compte au rythme de §1 |
| **D4** | Rien n'est recopié : la zone se calcule à la lecture | §6.1 : exacte par construction, rien sur les chemins de la 1.1 et de la 0.1.0, rien à purger |
| **D5** | « Notifs », entre « Trouver » et « Profil » ; une cloche | « Notifications » fait 91,6 pt pour 72 à 82 par onglet ; « Notifs » 42,2, le plus court des cinq |
| **D6** | Une ligne par sujet, séparée en nouveau et plus tôt ; likes et commentaires par bento, abonnés en une ligne, demandes en une ligne, items validés en une ligne ; une ligne par bento suivi, par refus, par masquage | Le regroupement que demande la roadmap, « 12 personnes ont aimé ton bento » |
| **D7** | Un like ne nomme personne | D5 du 22 : la liste n'est pas publique |
| **D8** | Une date de lecture par compte, posée à l'affichage, au plus récent montré ; la pastille compte les lignes nouvelles, par la même fonction que la liste | Le compteur exact de la roadmap ; deux téléphones d'un même compte gardé (28) voient la même chose |
| **D9** | Relu à l'ouverture, au premier plan, à chaque changement d'onglet ; pas de Realtime | Realtime fermé, 200 connexions au plan gratuit ; volumes de §1 |
| **D10** | Les décisions de l'équipe suivent le chemin du tap du push du 17 | Un même sujet, une même destination ; `followPushTarget` est testé |
| **D11** | Aucun compte bloqué, dans un sens ou dans l'autre | Le blocage du 22 |
| **D12** | L'onglet pour tous, interrupteur allumé ; sans profil, un écran qui invite à composer | Une barre qui ne change pas de forme à la première publication |
| **D13** | `app_config.notifications_enabled` coupe tout sans nouvelle version ; éteint, quatre onglets | Comme `follows_enabled` (23) |
| **D14** | Un bento suivi compte s'il est publié après le début de l'abonnement | Suivre n'annonce pas ce qui existait déjà, que « Abonnements » montre |
| **D15** | `items.merged_at` neuve ; les fusions passées restent hors de la zone | Aucune date ne les situe ; 20 en 90 jours |
| **D16** | La 1.1 et la 0.1.0 ne voient rien | La règle de la sortie store unique |
| **D17** | L'export rend la date de lecture ; supprimer son compte l'efface | Une donnée de son compte |
| **D18** | La politique de confidentialité dit ce que lit la zone et la date gardée | Transparence ; rien d'autre n'est gardé |
| **D19** | Aucun push neuf | Le lot 5b du 17 attend APNs et FCM ; la même fonction le servira |
| **D20** | Le lecteur d'écran lit chaque ligne en phrase, « nouveau » compris, et l'onglet avec son nombre | Chantier 11 |
| **D21** | Le libellé des onglets prend la taille que l'écran mesure | La recette du 23 : `adjustsFontSizeToFit` avec une hauteur de ligne posée tombe à la trace sur iOS |
| **D22** | 30 lignes par page, au curseur `(latest_at, group_key)` | Une page suffit au rythme de §1 ; le curseur tient au-delà |
| **D23** | Rien au back-office ni sur le web, hors la politique | La zone est dans l'app |
| **D24** | Le bento d'édition se nomme par son titre | Un compte peut en avoir plusieurs (16) |
| **D25** | Un item fusionné s'annonce sous le titre de l'item gardé | Sa case montre désormais celui-là ; « Inseption » pour « Inception », relevé à la recette |

---

## 12. Hors chantier

- Le push des likes, commentaires et abonnés : au 17, à l'arrivée de la clé
  APNs et du compte FCM.
- Les éditions dans la zone : écartées au QCM.
- Les réglages par sorte : aucun n'est demandé, et le 26 n'en prévoit pas.
