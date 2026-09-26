# Chantier 18 · Publication automatique à la validation

> Spécification écrite le 26 septembre 2026, à partir du code de `main`
> (`c2167e3`) et de lectures sur la production, en lecture seule. Aucune
> écriture en production.
>
> **Arbitrages rendus le 26 septembre 2026**, les cinq de §11. En résumé :
> tout bento complet sort à la validation de son dernier item en attente,
> sans geste de son auteur, dans la nouvelle app seulement ; elle le dit
> avant, sous la boîte, et le notifie après, « Bento publié ». L'automatisme
> tient tant qu'un item attend. Un compte sans profil y arrive par le pseudo
> et les CGU.
>
> Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantier 18, [le chantier
> 5](./UX-05-BROUILLON-PUBLIE.md), dont il doit tenir la promesse, et [le
> chantier 17](./UX-17-NOTIFICATIONS-PUSH.md), dont il reprend la chaîne
> d'envoi. Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 La dernière marche, mesurée

Relevé le 26 septembre 2026 sur la production, en lecture seule. **24 bentos
portent une proposition de leur propre auteur** :

| | |
| --- | --- |
| Jamais publiés | **15**, dont **12 complets** |
| Publiés après la validation | 8, **5 jours après** en médiane (de 2 heures à 17 jours) |
| Publiés avant la validation | 1 |

Les 12 complets ne sont bloqués par rien : onze ont vu leur proposition
validée le 25 août, en un seul lot, le douzième le 18 juillet, et personne
n'est revenu publier. Des 3 partiels, l'un porte un item refusé, le cas que
le chantier 17 a corrigé (D28). La modération tombe chaque semaine : **6,9 jours** en
médiane entre la proposition et la validation, sur 139 validations, et 90 %
en moins de 7,2 jours. Quelqu'un qui propose un item attend donc une semaine
avant de pouvoir publier, sans que rien ne le prévienne dans les versions
publiées, et deux fois sur trois il ne revient pas.

Le chantier 17 le prévient désormais, « Proposition validée ». Il reste à
rouvrir l'app et à publier : c'est cette marche que le chantier retire.

### 1.2 La promesse du chantier 5

Le chantier 5 a pris l'option A : une modification d'un bento publié est en
ligne tout de suite, et l'app dit toujours si le bento est public. Publier à
la place de quelqu'un doit la tenir. **Elle tient ici par l'information, pas
par le geste** (D1) : avant, l'app dit sous la boîte que le bento sortira à
la validation ; après, la notification dit qu'il est sorti ; et la
dépublication du chantier 5 reste à un tap, depuis le profil.

---

## 2. Objectif et critères de succès

Un bento complet dont un item attend sort à la validation de cet item, sans
que son auteur rouvre l'app, et il le sait.

- Les bentos publiés à la validation se comptent : `auto_published_at`
  (§6.1).
- Aucun bento ne sort incomplet, avec un item en attente ou refusé.
- Les versions publiées ne voient rien changer (D5).

---

## 3. Périmètre

**Dans le chantier :**

- la base : la marque « publié dès la validation », la publication à la
  validation ou à la fusion, la marque qui tombe, la notification qui le dit ;
- le back-office : le texte « Bento publié » et le tap vers la page publique ;
- l'app : la marque posée, l'état dit sous la boîte, le compte sans profil,
  le tap ;
- les éditions, sur leurs propres cases.

**Hors du chantier :**

- **les 12 bentos complets jamais publiés** : ils n'ont rien qui attende, et
  la validation ne les concerne plus. C'est la relance du chantier 8 ;
- **un garde-fou en base contre la publication d'un item en attente**
  (`can_publish_bento`, annoncé depuis le 28 mai) : la 0.1.0 ne connaît pas
  l'attente et publierait en erreur. Le composer l'empêche déjà, et la
  publication automatique vérifie tout elle-même ;
- **refuser d'avance la publication automatique** : D1 l'écarte ;
  dépublier après, depuis le profil, suffit.

---

## 4. Ce que disent le code et la base

- **Le blocage n'existe que dans l'app.** `compose-cta.ts:123` rend « En
  attente de validation », désactivé, dès qu'une case porte un item en
  attente (`compose.tsx:96`). Aucune règle en base.
- **Le client n'écrit que `published_at`** sur `bentos`
  (`20260913200000_bentos_column_privileges.sql:39`), et n'insère que
  `user_id`. `publishBento` (`bento-actions.ts:111`) ne republie pas un bento
  déjà en ligne.
- **Un compte sans profil ne peut pas être publié à sa place.** Depuis le
  chantier 9, son brouillon vit sur le téléphone, et la base n'en sait rien.
  `publish_first_bento` crée profil, bento, cases et publication en une
  transaction (`20260917100000_editions.sql`, qui l'a corrigée), après le
  pseudo et les CGU, et refuse un bento incomplet.
- **La complétude** : le bento principal compte les cases actives sans
  édition, six ; une édition, les siennes.
- **La fusion réécrit les cases avant de changer le statut**
  (`admin_merge_items`) : quand le perdant passe `merged`, les bentos portent
  déjà l'item conservé.
- **La notification de modération du chantier 17** part d'un déclencheur
  `after update of status` sur `items`, `items_notify_moderation`, qui poste
  l'item et son statut au back-office. Les déclencheurs d'une même table
  partent dans l'ordre alphabétique : un déclencheur de publication nommé
  avant lui publie dans la même transaction, et la notification peut le dire.
- **Publier en base prévient déjà la landing** : `bentos_revalidate_landing`
  part sur tout changement de `bentos`.
- **Les versions publiées lisent `bentos` par des listes de colonnes**, jamais
  `select('*')` (la 1.1, commit `6426779`) : une colonne de plus leur reste
  invisible.
- **Depuis le chantier 17 (D28)**, le composer vide la case d'un item refusé ;
  en base, la case garde l'item refusé.

---

## 5. Design

### 5.1 Ce que voit l'auteur

| Situation | Bouton | Sous la boîte |
| --- | --- | --- |
| Complet, un item attend, avec profil | « Publication à la validation », désactivé | « Ton bento sortira dès que « Titre » sera validé. » |
| Complet, un item attend, sans profil | « Publier dès la validation », actif : l'écran du pseudo | rien de plus |
| Complet, plus rien n'attend | « Publier mon bento » | inchangé |
| Publié à la validation | « Voir mon bento public » | la mention du chantier 5, les modifications sont en ligne |

Plusieurs items en attente : la phrase nomme le premier, puis « et 1 autre ».
Les libellés exacts se mesurent sur l'écran le plus étroit, comme ceux du
chantier 13.

### 5.2 Ce qui fait tomber l'automatisme (D2)

La marque tient tant que le bento est complet et qu'un item attend. Elle
tombe :

- quand plus rien n'attend sans que la base ait publié : l'auteur a remplacé
  l'item en attente, le bouton redevient « Publier mon bento » ;
- quand une case se vide : « Compléter » ;
- au refus d'un de ses items : la case se vide dans l'app (D28 du 17), et la
  notification de refus donne la raison.

Une nouvelle proposition dans un bento complet repose la marque.

### 5.3 La notification (D4)

Quand la validation ou la fusion publie le bento, la notification de
validation du 17 change de titre : **« Bento publié »**, l'item nommé
dessous. Son tap ouvre la page publique du bento. Sans publication, rien ne
change : « Proposition validée », le tap vers le composer (D22 du 17).

### 5.4 Le compte sans profil (D3)

« Publier dès la validation » mène à l'écran du pseudo, le même que
« Publier ». `publish_first_bento` crée alors profil, bento et cases, et
publie si tout est validé, ou marque le bento si un item attend. Le pseudo
n'est réservé que par une demande de publication, ce que le chantier 9
admet.

---

## 6. Contrat technique

### 6.1 La base

Une migration, développée et prouvée sur Supabase local :

- **`bentos.publish_on_validation_at`**, `timestamptz`, nul par défaut : la
  marque, posée par la nouvelle app, levée par la base.
- **`bentos.auto_published_at`**, `timestamptz` : posée par la base quand
  elle publie, et gardée. C'est la trace qui compte les publications à la
  validation, et le signal de la notification.
- **`mark_publish_on_validation(p_bento uuid)`**, `security definer` : pose la
  marque si le bento est à l'appelant, non publié, complet, qu'un item y
  attend et qu'aucun n'est refusé ; sinon ne fait rien. Idempotente.
- **`bento_is_complete(p_bento uuid)`** : les cases du bento contre celles
  de son jeu, principal ou édition.
- **Un déclencheur `after update of status` sur `items`**, nommé pour passer
  avant `items_notify_moderation` : à une validation ou une fusion, chaque
  bento marqué qui porte l'item, ou l'item conservé, sort s'il est complet et
  que plus rien n'y attend ni n'y est refusé : `published_at` et
  `auto_published_at` à `now()`, marque levée. À un refus, la marque des
  bentos qui portent l'item tombe.
- **Un déclencheur sur `bento_items`** : la marque tombe quand le bento
  n'est plus complet, ou que plus rien n'y attend.
- **`publish_first_bento`** garde sa signature ; quand un item attend, le
  bento naît non publié et marqué.
- **`notify_item_moderation`** ajoute à l'événement le bento que la
  transaction vient de publier (`auto_published_at = now()`), s'il y en a un.
- **`check-publication.sql`**, sur le modèle de `check-push.sql` : transaction
  annulée, contrôles numérotés, défauts introduits exprès.

**Compatibilité avec la 1.1 et la 0.1.0**, à prouver avant d'appliquer :
elles ne marquent jamais rien, donc aucun déclencheur n'agit sur leurs
bentos ; elles ne lisent pas les deux colonnes ; `publish_first_bento` n'est
appelée par aucune. Appliquée en production à la validation du lot, sur feu
vert.

### 6.2 Le back-office

`/api/push` lit le bento publié dans l'événement : titre « Bento publié »,
données du tap vers la page publique (pseudo et `slug`). Tests sur le modèle
de `content.test.ts` et `pipeline.test.ts`, dont la ligne de titre de 28
caractères.

### 6.3 L'app

- `compose-cta.ts` : les états de §5.1, testés comme les autres.
- La marque posée par `mark_publish_on_validation` quand le composer montre
  un bento complet, non publié, avec un item en attente et sans marque : à
  l'hydratation et après chaque case posée. Le store garde
  `publishOnValidationAt`.
- La phrase sous la boîte, et le compte sans profil par l'écran du pseudo.
- `pushTargetFromData` accepte la cible « page publique » ; un bento publié
  entre-temps se relit à l'ouverture, `published_at` faisant le reste
  (chantier 5).

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **Base**, `check-publication.sql` : la marque ne se pose que sur un bento
  complet, non publié, à l'appelant, avec un item en attente ; valider le
  dernier item publie, et pas l'avant-dernier ; la fusion publie ; le refus
  lève la marque ; remplacer l'item ou vider une case la lève ; un bento non
  marqué ne sort jamais, ce qui tient la compatibilité (D5) ; une édition
  compte ses propres cases ; l'événement porte le bento publié ;
  `publish_first_bento` marque quand un item attend ; aucun client n'écrit
  les deux colonnes.
- **Back-office** : le texte et les données du tap, avec et sans publication.
- **App** : les états du bouton, la phrase, la cible du tap.

### 7.2 Recette

Au simulateur iOS et à l'émulateur Android, sur la base locale et un
back-office de recette, sans aucun `.env` de production :

- un compte avec profil complète son bento avec une proposition : la phrase
  s'affiche, le bouton dit « Publication à la validation » ;
- la validation au back-office publie le bento, qui entre en tête du fil ;
  l'app, rouverte, dit « Voir mon bento public » ;
- la fusion publie de même ; le refus lève la marque ;
- remplacer l'item en attente rend « Publier mon bento » ;
- un compte sans profil passe par le pseudo, puis sort à la validation ;
- le tap de « Bento publié » ouvre la page publique, par `xcrun simctl push`
  au simulateur. La vraie réception attend le lot 0 du chantier 17.

---

## 8. Plan de développement

### Lot 1 · La base

La migration de §6.1 et `check-publication.sql`, en local. La compatibilité
avec la 1.1 et la 0.1.0 prouvée, puis la migration appliquée en production
sur feu vert, vérifiée en lecture seule.

### Lot 2 · Le back-office

« Bento publié » et le tap vers la page publique, testés.

### Lot 3 · L'app

La marque, le bouton, la phrase, le compte sans profil, le tap. Tests, puis
recette de §7.2.

### Lot 4 · Recette et documents

La DoD point par point, la roadmap, le catalogue (§4.4, ce que voit
l'utilisateur à la validation), la PR unique du chantier, sur accord.

---

## 9. Livraison

- Une branche, une PR, fusionnée après CI verte, sur accord.
- La migration s'applique en production à la validation du lot 1, compatible
  avec la 1.1 et la 0.1.0 et prouvée avant.
- Le back-office se redéploie à la main après la fusion.
- L'app attend la sortie store unique.

---

## 10. Definition of Done

1. Un bento complet dont un item attend sort à la validation de cet item,
   sans que l'auteur rouvre l'app, à la date de la validation.
2. Avant, l'app dit sous la boîte qu'il sortira à la validation.
3. Après, la notification dit « Bento publié », et son tap ouvre la page
   publique.
4. La fusion vaut validation.
5. L'automatisme tombe quand plus rien n'attend, quand une case se vide, et
   au refus.
6. Un compte sans profil y arrive par le pseudo et les CGU.
7. Une édition suit la même règle, sur ses propres cases.
8. Aucun bento ne sort incomplet, avec un item en attente ou refusé.
9. Les versions publiées ne voient rien changer : compatibilité prouvée avant
   la migration.
10. `check-publication.sql` passe sur Supabase local.
11. La migration est appliquée en production.

---

## 11. Décisions

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | Tout bento complet sort à la validation de son dernier item en attente, sans geste de son auteur ; l'app le dit avant et le notifie après | Choisi le 26 septembre 2026, de préférence à une demande explicite, que je recommandais pour tenir la promesse du chantier 5 par le geste. Mesuré : 15 des 24 bentos portant une proposition de leur auteur ne sont jamais sortis. La promesse tient par l'information, et la dépublication reste à un tap |
| **D2** | L'automatisme tient tant qu'un item attend : il tombe quand plus rien n'attend, quand une case se vide, et au refus | Choisi le 26 septembre 2026. Un auteur qui remplace lui-même l'item en attente est dans l'app : il publie d'un tap, et rien ne sort pendant qu'il édite |
| **D3** | Un compte sans profil y arrive par le pseudo et les CGU : `publish_first_bento` publie, ou marque le bento quand un item attend | Choisi le 26 septembre 2026. Son brouillon n'existe que sur le téléphone, rien ne peut le publier sans profil ; le pseudo n'est réservé que par une demande de publication |
| **D4** | Quand une validation publie le bento, sa notification dit « Bento publié », l'item nommé dessous, et son tap ouvre la page publique | Choisi le 26 septembre 2026. Une seule alerte pour un seul événement, toujours deux types de notification (D4 du 17) ; 12 caractères sur les 28 d'une ligne de titre |
| **D5** | Nouvelle app seulement : elle marque le bento ; la 1.1 et la 0.1.0 ne marquent rien, et leurs bentos gardent le comportement d'aujourd'hui | Choisi le 26 septembre 2026. Elles ne sauraient ni dire l'état public ni prévenir : un bento publié à leur insu contredirait le chantier 5. 9 propositions en septembre, dont 3 dans un bento |

---

## 12. Suivis

- **Les 12 bentos complets jamais publiés** : relance du chantier 8, qui
  passera par les notifications du 17.
- **`can_publish_bento`**, le garde-fou en base : à reconsidérer une fois la
  0.1.0 sortie des téléphones, ce que la télémétrie ne sait pas mesurer
  (chantier 17, §12).
