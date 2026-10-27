# Chantier 25 · Comptes Instagram et TikTok

> Spécification écrite le 27 octobre 2026, à partir du code de
> `feat/ux-24-zone-de-notifications` (`837f968`, la PR #103, elle-même sur la
> #102 et la #101) et de la documentation des plateformes relevée le 15
> septembre (roadmap, §25). Aucune écriture en production.
>
> **Arbitrages rendus le 27 octobre 2026 par Clément**, en QCM, D1 à D3
> (§11), chaque fois l'option recommandée ; D4 à D20 sont pris par la
> spécification. En résumé : on relie son Instagram et son TikTok en tapant
> son pseudo, sans connexion ni revue ; deux glyphes s'ajoutent à la ligne de
> date de sa page, et le web les montre sous son identité ; « Afficher mes
> réseaux », allumé par défaut, rejoint la section Confidentialité, appliqué
> par la base, et referme le chantier 26. Même sortie store unique que tous
> les chantiers.
>
> **Fait et recetté le même jour**, en cinq lots, sur
> `feat/ux-25-comptes-instagram-tiktok` : DoD 8 sur 10, les deux derniers
> attendant la fusion et la mise en service par Clément, après celle du 24,
> cf. §8.

---

## 1. Ce que les plateformes permettent

Relevé le 15 septembre 2026 (roadmap, §25), rien n'a changé depuis dans ce
que ce chantier utilise :

- **Instagram ne s'ouvre plus aux comptes personnels** depuis l'arrêt de
  l'API Basic Display, le 4 décembre 2024. La seule API restante ne sert que
  les comptes professionnels, après l'App Review de Meta et une vérification
  d'entreprise.
- **TikTok le permet, sous conditions** : Login Kit donne pseudo et photo,
  mais sa revue exige une app **déjà publiée**, et hors revue dix comptes de
  test au plus. La sortie store n'aura lieu qu'à la fin de la roadmap.
- **Apple, règle 5.1.1** : aucun jeton de réseau social conservé ; **4.8** :
  tant que ces comptes ne servent pas à se connecter, rien n'impose Sign in
  with Apple.

D'où D1 : un pseudo saisi, sans connexion, pour les deux. Rien n'est
vérifié, rien n'est importé : ni photo, ni jeton, ni appel à leurs serveurs.
Le Popy reste le visage d'un compte (D19).

**Mesuré le 27 octobre**, en lecture seule : 64 profils, 28 bentos publiés.
Aucun lien n'existe, la fonctionnalité étant neuve.

---

## 2. Ce que voit un visiteur

Sur la page d'un compte, dans l'app : deux glyphes, Instagram et TikTok, à
la fin de la ligne de date, après les abonnés du 23 (D2). 0 pt pris à la
boîte, que le 17 Pro tient à 3 pt près ; la ligne rétrécit déjà pour tenir.
Un glyphe n'apparaît que si le lien existe et que son titulaire le montre ;
sans lien, la ligne ne change pas d'un pixel (D11).

Toucher un glyphe ouvre le profil sur le réseau : l'app du réseau si elle
est installée, le site sinon (D5). Le lecteur d'écran lit « Instagram de
@lea.cine : @lea_cine », indice « Ouvre Instagram » (D12).

Sur bento-pop.com, la page d'un compte et celle d'un bento montrent les deux
liens sous l'identité, en texte : « Instagram @lea_cine · TikTok
@lea.cine » (D15).

---

## 3. Ce que fait son titulaire

- **Dans « Modifier le profil »** (21), sous le nom affiché, deux champs,
  « Instagram » et « TikTok », précédés d'un « @ » (D10). On y tape son
  pseudo, ou on y colle l'adresse de son profil, que l'app réduit au pseudo
  (D4). Vider un champ retire le lien.
- **Dans Confidentialité**, « Afficher mes réseaux », allumé par défaut (D3).
  Éteint, les liens restent enregistrés mais ne sortent plus de la base, ni
  vers l'app des autres, ni vers le web.
- **Un pseudo refusé** l'est sous son champ : « Ce n'est pas un pseudo
  Instagram. », « Ce pseudo n'est pas accepté. » quand le filtre du 22 le
  refuse (D6).

---

## 4. La base

- `account_links (user_id → users, instagram, tiktok, updated_at)`, sans
  droit client, RLS active, en cascade avec le profil (D7, D13). Les formats
  sont tenus par des contraintes (D4).
- `users.social_visible`, allumé par défaut, modifiable par son seul
  titulaire, comme `follow_approval` au 23 (D8).
- `app_config.social_links_enabled`, allumé par défaut (D9).
- `set_social_links(p_instagram, p_tiktok)` : normalise (minuscules, « @ »
  retiré), vérifie le format, passe le filtre du 22, enregistre ; deux vides
  effacent la ligne. Refuse sans session, sans profil, interrupteur éteint.
- `social_links(p_user)` : les deux liens d'un compte, s'il les montre, ou à
  son titulaire avec son réglage ; aucune ligne sinon. Ouverte à `anon`, pour
  le web.
- `my_social_export` reprend celle du 24 et ajoute les liens et le réglage.
- **La 1.1 et la 0.1.0 ne voient rien** (D14) : une table neuve sans droit,
  deux colonnes neuves, des fonctions neuves. **La migration suit celle du
  24**, dont elle redéfinit l'export.

### 4.1 Les formats (D4)

| Réseau | Longueur | Caractères | Interdit |
| --- | --- | --- | --- |
| Instagram | 1 à 30 | `a-z 0-9 . _` | un point en tête, en fin, ou deux de suite |
| TikTok | 2 à 24 | `a-z 0-9 . _` | un point en fin |

Une adresse collée, `instagram.com/lea_cine` ou `tiktok.com/@lea.cine`, se
réduit à son pseudo dans l'app, avant d'être envoyée.

---

## 5. La modération (D6)

Un pseudo saisi n'est pas vérifié : n'importe qui peut taper @darkhifus.
L'écran ne dit donc jamais « vérifié », et le lien mène au vrai compte du
réseau, qui ne dit rien de Bento Pop. Trois garde-fous :

- **le filtre du 22** avant l'enregistrement, les points et soulignés lus
  comme des espaces ;
- **le signalement d'un compte**, qui existe depuis le 22 ;
- **au back-office**, le signalement d'un compte montre ses liens, et
  « Effacer ses réseaux » les retire d'un clic.

---

## 6. Recette et contrôles

`scripts/check-social-links.mjs`, contre une pile locale à part : écrire,
normaliser, refuser un format, filtrer, effacer ; lire à la clé anonyme
seulement ce qui est montré ; le réglage éteint ; l'interrupteur ; aucune
lecture ni écriture directe ; un compte sans profil ; l'export ; supprimer
son compte ; les lectures de la 1.1 et de la 0.1.0. Puis des défauts
introduits exprès, un à un, tous attrapés. `scripts/check-social-links.sql` :
les contrôles en lecture de la mise en service.

La recette, au simulateur iPhone 17 Pro et SE, à l'émulateur Pixel 8, au
back-office et sur le web :

1. Saisir ses deux pseudos, dont une adresse collée ; un format refusé, un
   pseudo filtré, sous leur champ.
2. Sa page et celle d'un autre : les deux glyphes au bout de la ligne de
   date ; un tap ouvre le réseau ; une page sans lien identique au pixel à
   celle du 24.
3. « Afficher mes réseaux » éteint : plus rien chez les autres, ni sur le
   web.
4. Signaler un compte, voir ses liens au back-office, les effacer.
5. La plus grande taille de texte au SE, 200 % au Pixel 8.

---

## 7. Les lots

1. **La base** : la migration, ses contrôles et ses défauts, les types.
2. **Les données dans l'app** : `social-links.ts`, la saisie, les adresses,
   les messages, testés ; les appels ; l'interrupteur ; l'export.
3. **L'app** : les deux champs de « Modifier le profil », le réglage, les
   glyphes de la ligne de date.
4. **Le web et le back-office** : les liens sous l'identité, avec un repli
   avant la migration ; la politique de confidentialité ; « Effacer ses
   réseaux ».
5. **La recette et les documents**.

---

## 8. Livraison

Fait et recetté le 27 octobre 2026, en cinq lots enchaînés, sur
`feat/ux-25-comptes-instagram-tiktok`, partie de la branche de la PR #103, le
24, et ouverte en PR #104, empilée sur la #103. Rien n'est appliqué en production : la mise en service attend Clément,
après celle du 24 (§8.6).

### 8.1 Lot 1 · La base

- `20261027300000_social_links.sql` : `account_links`, `users.social_visible`,
  l'interrupteur, `normalize_social_handle`, `set_social_links`,
  `social_links` et l'export.
- `scripts/check-social-links.mjs` : 56 contrôles en douze parties, contre la
  pile `bento-pop-liens`, puis seize défauts introduits exprès, un à un, tous
  attrapés.
- `scripts/check-social-links.sql` : les contrôles en lecture de la mise en
  service.

### 8.2 Lot 2 · Les données dans l'app

- `handleFromInput`, `isValidHandle` et `socialProfileUrl` dans
  `@bento-pop/supabase-mobile/bento`, partagés avec le web ;
  `src/lib/social-links.ts` : la saisie, les messages, les libellés ; 13
  tests.
- `src/lib/social-link-actions.ts` : les trois appels ; 7 tests contre le
  bouchon PostgREST.
- L'interrupteur dans `app-config.ts`, les liens dans l'export.

### 8.3 Lot 3 · L'app

- « Tes réseaux » dans « Modifier le profil » : deux champs, un bouton, les
  refus sous leur champ.
- « Afficher mes réseaux » dans Confidentialité.
- Les deux glyphes au bout de la ligne de date de la page d'un compte, qui
  ouvrent le réseau.

### 8.4 Lot 4 · Le web et le back-office

- La landing lit les liens par `social_links`, avec les visites et les
  abonnés, et les montre sous l'identité, `nofollow` et `ugc`, avec un repli
  avant la migration ; la politique de confidentialité ; quatre tests e2e de
  plus, 61 sur 61.
- Le back-office montre les liens d'un compte signalé, et « Effacer ses
  réseaux » les retire et classe le signalement.

### 8.5 Lot 5 · La recette

Au simulateur iPhone 17 Pro et iPhone SE, à l'émulateur Pixel 8, sur la pile
`bento-pop-liens`, et au back-office local, session simulée :

- coller « @Recette_Pro » et l'adresse
  `https://www.tiktok.com/@recette.pro?lang=fr` : la base garde `recette_pro`
  et `recette.pro`, et les champs les affichent réduits ; un pseudo finissant
  par un point est refusé sous son champ ;
- sa page et celle d'un autre : les deux glyphes au bout de la ligne de date,
  lus « Instagram de @lea.cine : @lea_cine » ; le glyphe Instagram ouvre
  Safari sur instagram.com ;
- « Afficher mes réseaux » éteint : plus aucun lien chez le visiteur, au SE ;
- **une page sans lien identique au pixel** à celle du 24, le code d'avant
  prouvé chargé, 2 290 modules : 0 pixel différent sur l'écran entier ;
- la plus grande taille de texte au SE, 200 % au Pixel 8 : la ligne et ses
  glyphes tiennent ;
- au back-office : le signalement d'un compte montre ses liens ; « Effacer
  ses réseaux » les retire, et le signalement passe traité.

**Deux défauts trouvés, corrigés** :

- **les accents de `bento.ts`, écrits en séquences échappées au 23**
  (`abonn\u00e9`), remis en clair, sans toucher aux trois échappements voulus,
  ceux des espaces insécables ;
- **les tests e2e du web comptaient les liens du pied de page**, ceux de Bento
  Pop, et l'un lisait une page déjà en cache, rendue par un autre test : ils
  ne comptent plus que les liens d'un utilisateur, et le repli a sa propre
  fiche.

Non vérifiés : la voix de VoiceOver et de TalkBack, un vrai téléphone, au
chantier 29 ; l'ouverture de l'app Instagram ou TikTok elle-même, absente des
simulateurs.

### 8.6 La mise en service, par Clément

Après celle du 24, dont elle redéfinit l'export.

1. **La migration**, dans l'éditeur SQL de « My Bento Pop », puis les
   contrôles en lecture de `scripts/check-social-links.sql`.
2. **La landing**, redéployée d'elle-même à la fusion ; **le back-office**,
   redéployé sur Coolify, pour « Effacer ses réseaux ».
3. Aucune variable, aucun service : 0 €.

### 8.7 La CI, rejouée en local

Sur l'arbre de travail du 25, modifications non commitées comprises, sans
cache : install figée ; lint et typage 8 sur 8 ; tests 1 057 pour l'app, 251
pour l'admin et 202 pour la landing ; build 3 sur 3 ; e2e de la landing 61
sur 61. Aucun échec. Les 56 contrôles de la base passent sur la migration
finale.

---

## 9. Definition of Done

État au 27 octobre 2026 : 8 sur 10, les deux derniers à la fusion et à la
mise en service.

1. ✅ Relier son Instagram et son TikTok en quelques taps, pseudo ou adresse
   collée ; délier en vidant le champ : contrôles 1 et 4, recette au 17 Pro.
2. ✅ Son profil montre les deux liens, qui ouvrent le réseau ; une page sans
   lien ne change pas d'un pixel : recette aux trois appareils, A/B (§8.5).
3. ✅ Un lien masqué ne sort pas de l'API, vérifié à la clé anonyme :
   contrôles 5 et 6, recette au SE.
4. ✅ Un format faux ou un pseudo filtré est refusé sous son champ :
   contrôles 2 et 3, recette au 17 Pro.
5. ✅ Le back-office efface les liens d'un compte signalé : contrôles 12,
   recette au back-office local.
6. ✅ Le web montre les liens, et s'affiche comme avant sans la migration :
   l'e2e de la landing.
7. ✅ La 1.1 et la 0.1.0 lisent et écrivent comme avant : contrôles 9.
8. ✅ Le chantier 26 refermé : ses six réglages dans Confidentialité.
9. ⬜ La politique de confidentialité à jour, **en production** : écrite, la
   landing à redéployer après la fusion.
10. ⬜ La migration prouvée compatible, **appliquée et contrôlée** ; la CI
    rejouée en local : compatible, et la CI rejouée sans échec (§8.7) ;
    l'application attend la mise en service.

---

## 10. Décisions

| # | Décision | Pourquoi |
| --- | --- | --- |
| **D1** | Un pseudo saisi, sans connexion, pour Instagram comme pour TikTok | QCM. Instagram fermé aux comptes personnels ; la revue de TikTok attend une app publiée ; 0 € |
| **D2** | Deux glyphes à la fin de la ligne de date ; le web les montre sous l'identité | QCM. 0 pt pris à la boîte du 17 Pro |
| **D3** | « Afficher mes réseaux », allumé par défaut, dans Confidentialité, appliqué par la base | QCM. On les saisit pour être vu ; le réglage du 26 |
| **D4** | Les formats de §4.1, en minuscules ; « @ » et adresse collée acceptés à la saisie | Ceux des deux réseaux ; une adresse est ce qu'on a sous la main |
| **D5** | Les liens ouvrent `instagram.com/<pseudo>/` et `tiktok.com/@<pseudo>`, l'app du réseau si elle est là | Liens universels : aucun schéma à déclarer |
| **D6** | Jamais « vérifié » ; le filtre du 22, le signalement d'un compte, et « Effacer ses réseaux » au back-office | §5 : un pseudo saisi ne prouve rien |
| **D7** | `account_links` à part, sans droit client ; `set_social_links` écrit, `social_links` lit | Un lien masqué ne sort pas de l'API |
| **D8** | Le réglage `users.social_visible`, modifiable par son titulaire seul | Comme `follow_approval` (23) et `searchable` (20) |
| **D9** | `app_config.social_links_enabled` coupe tout sans nouvelle version | Comme `follows_enabled` (23) |
| **D10** | La saisie dans « Modifier le profil », sous le nom affiché | L'écran de l'identité, au 21 |
| **D11** | Sans lien, la ligne de date ne change pas d'un pixel | Comme les abonnés du 23 |
| **D12** | Le lecteur d'écran lit « Instagram de @pseudo : @lien », indice « Ouvre Instagram » | Chantier 11 |
| **D13** | Supprimer son compte efface ses liens ; l'export les rend, avec le réglage | La cascade de `users` |
| **D14** | La 1.1 et la 0.1.0 ne voient rien | La règle de la sortie store unique |
| **D15** | Le web montre les liens en texte, `rel="nofollow noopener noreferrer ugc"`, rien avant la migration | Le web suit le profil de l'app (21) |
| **D16** | La politique de confidentialité nomme les réseaux, leur visibilité et leur conservation | Transparence |
| **D17** | Pas de rythme d'écriture | Un compte n'écrit que sa propre ligne, filtrée à chaque fois |
| **D18** | Le chantier 26 se referme : visites, recherche, commentaires, j'aime, abonnés et réseaux, tous dans Confidentialité | La section du 20, arbitrée le 15 septembre |
| **D19** | Aucune photo importée | Instagram fermé ; TikTok après la sortie, et ses conditions (III.3.h) |
| **D20** | Des glyphes au trait, à l'encre, de la hauteur de la ligne | La ligne ne grandit pas ; pas de logo de marque en couleur |
