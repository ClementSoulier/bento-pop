# Chantier 27 · Succès

> Spécification écrite le 27 octobre 2026, à partir du code de
> `feat/ux-25-comptes-instagram-tiktok` (`94581d6`, la PR #104, elle-même sur
> la #103, la #102 et la #101) et de lectures sur la production, en lecture
> seule : la base mobile, projet « My Bento Pop ». Aucune écriture en
> production.
>
> **Arbitrages rendus le 27 octobre 2026 par Clément**, en QCM, D1 à D3
> (§9), chaque fois l'option recommandée ; D4 à D23 sont pris par la
> spécification. En résumé : huit succès au lancement, sur les bentos, les
> items proposés et les abonnés ; publics, en médailles sous la boîte de sa
> page, dans l'app et sur le web, et annoncés dans « Notifs » ; acquis pour
> toujours, posés par la base au geste qui les mérite, et rattrapés à la
> migration pour les comptes existants. Même sortie store unique que tous les
> chantiers.
>
> **Fait et recetté le même jour**, en cinq lots, sur `feat/ux-27-succes` :
> DoD 7 sur 9, les deux derniers attendant la fusion et la mise en service par
> Clément, après celle du 25, cf. §7.

---

## 1. Ce que la production dit

Mesuré le 27 octobre 2026, en lecture seule.

- **28 comptes ont un bento publié**, un chacun ; **aucun n'en a trois** : les
  éditions du 13 n'ont pas encore commencé en production.
- **25 proposants ont au moins un item validé** par l'équipe, fusions
  comprises ; **18 en ont cinq, 2 en ont dix**, le plus actif 14.
- **Aucun abonné** : la migration du 23 attend sa mise en service.

Au lancement, le rattrapage donnerait donc 28 « Premier bento », 25
« Défricheur », 18 « Éclaireur » et 2 « Pionnier ».

---

## 2. Les succès du lancement (D1, D4)

| Clé | Médaille | Ce qu'elle dit | Gagnée quand | Popy |
| --- | --- | --- | --- | --- |
| `first_bento` | Premier bento | Un bento publié | son premier bento est publié | content |
| `three_bentos` | Trois bentos | Trois bentos publiés | son troisième bento est publié, le principal et deux éditions | bisou |
| `same_item_ten` | Inconditionnel | Le même item dans dix bentos | un même item entre dans son dixième bento publié | gêné |
| `first_item` | Défricheur | Un item validé par l'équipe | un premier item proposé est validé, ou fusionné | intello |
| `five_items` | Éclaireur | Cinq items validés | le cinquième | surpris |
| `ten_items` | Pionnier | Dix items validés | le dixième | diable |
| `first_follower` | Premier abonné | Un premier abonné | un premier abonnement est accepté | bisou |
| `ten_followers` | Dix abonnés | Dix abonnés | le dixième | content |

- **Les j'aime n'entrent pas** (D1) : un compte anonyme aime sans pseudo (D5
  du 22), un succès s'y gagnerait en créant des comptes.
- **Les règles sont dans le code**, en SQL, et leurs textes dans l'app et le
  web (D5) : un moteur de règles paramétrable au back-office serait un
  chantier à lui seul ; rien n'empêche d'en ajouter une par migration.
- **Les visuels sont les six Popys** (D6), en attendant ceux de la direction
  artistique : une clé par médaille, que Rob pourra habiller sans toucher aux
  règles.
- **Ce qu'on laisse tricher** (D7) : rien qui ne coûte déjà un vrai geste.
  Un bento compte une fois publié, une édition ne s'ouvre qu'au rythme de
  l'équipe (13), un item ne compte que validé par elle, un abonné que
  d'un compte qui a un pseudo (D4 du 23).

---

## 3. Où on les voit (D2)

- **Sur la page d'un compte, dans l'app** : une section « Succès » sous la
  boîte, après les pourquoi (12) : une médaille par succès, son Popy dans un
  cercle à sa couleur, son nom dessous, dans l'ordre du catalogue (D22). Sans
  succès, rien : la page ne change pas d'un pixel (D11). Le lecteur d'écran
  lit chaque médaille, « Premier bento : un bento publié » (D12).
- **Sur bento-pop.com**, la même section sous la boîte de la page d'un compte
  et de celle d'un bento (D13), après les crédits de la boîte (D23).
- **Dans « Notifs »** (24) : « Succès débloqué : Premier bento », une ligne
  par succès, qui ouvre sa page (D14).

---

## 4. Acquis pour toujours (D3)

- **`account_achievements (user_id, key, unlocked_at)`**, une ligne par
  succès gagné, en cascade avec le profil, sans droit client (D8).
- **`achievement_candidates(p_user)`**, interne : les succès que ses données
  méritent, chacun daté de l'évènement qui l'a fait gagner, la publication
  du premier bento par exemple (D9).
- **`award_achievements(p_user)`**, interne : pose ceux qui manquent, sans
  jamais en retirer. Appelée par des déclencheurs au geste : la publication
  d'un bento, une case remplie, un item validé ou fusionné, un abonnement
  accepté (D10). **Elle ne bloque jamais le geste** : une erreur s'y
  consigne et la publication passe, pour la 1.1 et la 0.1.0 comme pour la
  nouvelle app (D15).
- **Le rattrapage** : la migration la joue pour chaque profil, aux dates de
  leurs données (D16).
- **Dépublier, retirer un item, perdre un abonné ne retire rien** : c'est la
  réponse du QCM.
- `account_achievements_of(p_user)` : les succès d'un compte, ouverte à
  `anon` pour le web ; rien quand l'interrupteur est éteint.
- `notification_events` reprend celle du 24 et ajoute ses succès ; l'export
  reprend celui du 25 et les ajoute (D17).
- `app_config.achievements_enabled`, allumé par défaut, cache tout sans
  nouvelle version ; les succès continuent de se poser (D18).

---

## 5. Recette et contrôles

`scripts/check-achievements.mjs`, contre une pile locale à part : chaque
succès se gagne à son geste, daté de lui ; rien avant ; acquis après
dépublication ; personne ne pose ni ne lit la table ; la lecture publique ;
l'interrupteur ; « Notifs » ; l'export ; supprimer son compte ; la
publication des versions publiées passe et pose le succès. Puis des défauts
introduits exprès. `scripts/check-achievements.sql` : les contrôles en
lecture de la mise en service, dont **le rattrapage égal à ce que les données
méritent**.

La recette, au simulateur iPhone 17 Pro et SE, à l'émulateur Pixel 8 et sur
le web : un compte gagne « Premier bento » en publiant, le voit sur sa page
et dans « Notifs » ; un autre le voit ; une page sans succès identique au
pixel à celle du 25 ; la plus grande taille de texte, 200 %.

---

## 6. Les lots

1. **La base** : la migration, ses contrôles et ses défauts, les types.
2. **Les données dans l'app** : `achievements.ts`, le catalogue et ses
   textes, testés ; l'appel ; « Notifs » ; l'interrupteur ; l'export.
3. **L'app** : la section « Succès ».
4. **Le web** : la section, avec un repli avant la migration ; la politique de
   confidentialité.
5. **La recette et les documents**.

---

## 7. Livraison

Fait et recetté le 27 octobre 2026, en cinq lots enchaînés, sur
`feat/ux-27-succes`, partie de la branche de la PR #104, le 25. Rien n'est
appliqué en production : la mise en service attend Clément, après celle du 25
(§7.6).

### 7.1 Lot 1 · La base

- `20261027400000_achievements.sql` : `account_achievements`, l'interrupteur,
  `achievement_candidates`, `award_achievements`, les quatre déclencheurs,
  `account_achievements_of`, la zone du 24 et l'export du 25, une part de plus
  chacun, puis le rattrapage.
- `scripts/check-achievements.mjs` : 42 contrôles en douze parties, contre la
  pile `bento-pop-succes`, puis dix-huit défauts introduits exprès, un à un.
  Seize attrapés au premier passage ; les deux autres, un brouillon compté
  comme bento et une demande comptée comme abonné, passaient faute d'un
  contrôle qui les vise : deux contrôles durcis, et les deux attrapés.
- **Une pose en panne ne bloque pas la publication** (D15) : la pose
  remplacée exprès par une fonction qui lève une erreur, un bento publié
  passe, sans succès, l'erreur consignée en avertissement.
- **Le rattrapage répété sur des données posées avant la migration**, comme
  en production : six comptes, dont un éditorial, des bentos publiés et un
  brouillon, des items validés, fusionnés avant le 24, refusés et en attente,
  dix abonnés et une demande. Dix succès posés, chacun à la date attendue,
  aucun de trop, rien pour le profil éditorial.
- `scripts/check-achievements.sql` : les contrôles en lecture de la mise en
  service, dont, succès par succès, autant de lignes posées que de comptes qui
  le méritent. Mesuré en production le 27, en lecture seule, avec les mêmes
  règles : 28 « Premier bento », 25 « Défricheur », 18 « Éclaireur » et 2
  « Pionnier » à poser.
- Les types.

### 7.2 Lot 2 · Les données dans l'app

- Le catalogue dans `@bento-pop/supabase-mobile/bento`, partagé avec le web :
  les huit clés, leurs noms, ce qu'elles disent et leur Popy,
  `shownAchievements` et `achievementLabel` ; la couleur de chaque Popy l'y
  rejoint, la même dans l'app et sur le web.
- `src/lib/achievements.ts` : la grille des médailles ;
  `src/lib/achievement-actions.ts` : la lecture ; 13 tests, dont le catalogue
  comparé à la liste des clés de la migration.
- « Notifs » : « Succès débloqué : Éclaireur », le Popy de la médaille, et sa
  page au tap ; l'interrupteur dans `app-config.ts` ; les succès dans
  l'export ; publier et suivre relisent les succès.

### 7.3 Lot 3 · L'app

- La section « Succès » de la page d'un compte, après les pourquoi : trois
  colonnes au 17 Pro, deux au SE et quand le texte grandit.

### 7.4 Lot 4 · Le web

- La landing lit les succès par `account_achievements_of`, avec les visites,
  les abonnés et les réseaux, et les montre après les crédits de la boîte,
  avec un repli avant la migration ; la politique de confidentialité ; quatre
  tests e2e de plus, 65 sur 65.

### 7.5 Lot 5 · La recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8 et dans le
Safari du SE sur la landing locale, sur la pile `bento-pop-succes` :

- **publier un bento plein depuis l'app** : « Premier bento » posé, daté de
  la publication à la milliseconde ; la section apparaît aussitôt sur sa
  page, lue « Premier bento : un bento publié » ; « Notifs » l'annonce,
  « Succès débloqué : Premier bento », l'onglet lu « 1 nouvelle », et la ligne
  ouvre sa page ;
- la page d'un autre compte, aux huit médailles : trois colonnes au 17 Pro,
  deux au SE ; à la plus grande taille de texte, changée écran ouvert, dans
  les deux sens, et à 200 % au Pixel 8, où TalkBack lit chaque médaille d'un
  bloc ;
- **une page sans succès identique au pixel** à celle du 25, le code d'avant
  prouvé chargé, 2 293 modules contre 2 297 : 0 pixel différent sur l'écran
  entier, la page tenant sans défiler ;
- sur le web : la section au SE et au bureau, quatre colonnes, chaque nom sur
  une ligne ;
- les déclencheurs ont posé « Premier bento » et « Premier abonné » aux
  voisins de la recette dès leur création, comme ils le feront pour la 1.1 et
  la 0.1.0.

**Un défaut trouvé, corrigé** : **« Inconditionnel » coupé au milieu du mot
au SE**, « Inconditionn » puis « el ». Sa médaille y faisait 84 pt ; le mot en
mesure 88, relevé au pixel au 17 Pro, quand la grille partait d'une
estimation de 81. La largeur minimale d'une médaille vient désormais de la
mesure, plus 4 pt, et un test parcourt toutes les largeurs du SE au plus
large, texte agrandi compris.

Non vérifiés : la voix de VoiceOver et de TalkBack, un vrai téléphone, au
chantier 29 ; le rattrapage sur les données de production, à la mise en
service, par `check-achievements.sql`.

### 7.6 La mise en service, par Clément

Après celle du 25, dont elle redéfinit l'export, elle-même après celle du 24,
dont elle redéfinit la zone.

1. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-achievements.sql` : le rattrapage
   égal à ce que les données méritent, autour de 28, 25, 18 et 2 au 27
   octobre.
2. **La landing**, redéployée d'elle-même à la fusion. Rien au back-office
   (D20).
3. Aucune variable, aucun service : 0 €.

### 7.7 La CI, rejouée en local

Sur l'arbre de travail du 27, modifications non commitées comprises, sans
cache : install figée ; lint et typage 8 sur 8 ; tests 1 070 pour l'app, 251
pour l'admin et 202 pour la landing ; build 3 sur 3 ; e2e de la landing 65
sur 65. Aucun échec. Un premier passage avait vu le build de l'admin tomber
dans `next/font`, au téléchargement des polices Google, que le 27 ne touche
pas : passager, il est passé seul, puis toute la CI d'un seul tenant. Les 42
contrôles de la base passent sur la migration finale.

---

## 8. Definition of Done

État au 27 octobre 2026 : 7 sur 9, les deux derniers à la fusion et à la
mise en service.

1. ✅ Un succès se débloque au geste qui le mérite, daté de lui : contrôles 2
   à 4, recette au 17 Pro, publié depuis l'app.
2. ✅ Il s'affiche sur la page de son compte, dans l'app et sur le web, et
   s'annonce dans « Notifs » : recette aux trois appareils et sur le web, e2e
   de la landing.
3. ✅ Les comptes existants reçoivent ceux qu'ils méritaient déjà : contrôles
   6 et le rattrapage répété (§7.1) ; en production, à la mise en service.
4. ✅ Un succès gagné reste acquis : contrôles 5.
5. ✅ Personne ne pose un succès par l'API ; aucun geste n'échoue à cause
   d'un succès : contrôles 1 et la pose en panne (§7.1).
6. ✅ Une page sans succès ne change pas d'un pixel : l'A/B (§7.5).
7. ✅ La 1.1 et la 0.1.0 lisent et publient comme avant : contrôles 12, et
   leurs publications passent par les mêmes déclencheurs.
8. ⬜ La politique de confidentialité à jour, **en production** : écrite, la
   landing à redéployer après la fusion.
9. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
   rejouée en local sans échec : compatible, et la CI rejouée sans échec
   (§7.7) ; l'application attend la mise en service.

---

## 9. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Huit succès : bentos, items proposés, abonnés ; pas les j'aime | QCM. Les j'aime se gagneraient en créant des comptes anonymes |
| **D2** | Publics : une section sous la boîte, dans l'app et sur le web, et « Notifs » | QCM. Le profil du 21 les attendait |
| **D3** | Acquis pour toujours, posés au geste, rattrapés à la migration | QCM. Ce que la roadmap proposait |
| **D4** | Le catalogue de §2, ses clés, ses noms et ses conditions | Les deux exemples de la demande, et ce que la production peut déjà gagner |
| **D5** | Les règles en SQL, les textes dans l'app et le web | Un moteur de règles serait un chantier à lui seul |
| **D6** | Les six Popys pour visuels, une clé par médaille | En attendant la direction artistique |
| **D7** | Rien qui ne coûte un vrai geste | §2 |
| **D8** | `account_achievements` sans droit client | Personne ne se pose un succès |
| **D9** | Chaque succès daté de l'évènement qui l'a fait gagner | Le rattrapage dit vrai |
| **D10** | Des déclencheurs au geste : bento publié, case remplie, item validé ou fusionné, abonnement accepté | « au moment du geste », roadmap |
| **D11** | Sans succès, la page ne change pas d'un pixel | Comme les pourquoi du 12 |
| **D12** | Le lecteur d'écran lit le nom et ce que dit la médaille | Chantier 11 |
| **D13** | Le web montre la même section, rien avant la migration | Le web suit le profil de l'app (21) |
| **D14** | « Notifs » annonce chaque succès, qui ouvre sa page | Le 24 l'attendait |
| **D15** | Un succès ne bloque jamais le geste | La publication passe avant tout |
| **D16** | Le rattrapage aux dates des données | Un succès d'août n'est pas une nouveauté d'octobre |
| **D17** | L'export les rend ; supprimer son compte les efface | La cascade de `users` |
| **D18** | `app_config.achievements_enabled` cache tout ; les succès se posent toujours | Rallumé, rien ne manque |
| **D19** | La 1.1 et la 0.1.0 ne voient rien ; leur publication pose le succès | Le déclencheur porte sur la table |
| **D20** | Rien au back-office | Les règles sont dans le code |
| **D21** | Un profil éditorial ne gagne pas de succès | Composé par l'équipe pour un invité (14), il ne fait pas les gestes qu'un succès salue |
| **D22** | Les médailles dans l'ordre du catalogue, pas dans celui des dates | Une famille se lit d'un trait, et une médaille neuve ne bouscule pas les autres |
| **D23** | Sur le web, la section après les crédits de la boîte | Les crédits restent près de leurs images ; les succès disent le compte, comme la liste de ses autres bentos qui les suit |
