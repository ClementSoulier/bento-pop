# Chantier 21 · Profil : tous les bentos d'un compte

> Spécification écrite le 24 octobre 2026, à partir du code de la branche du
> chantier 20 (`3d2f3f9`) et de lectures sur la production, en lecture seule :
> la base mobile, projet « My Bento Pop ». Aucune écriture en production.
>
> **Arbitrages rendus le 24 octobre 2026 par Clément**, en QCM, D1 à D10
> (§11), chacun sur l'option recommandée ; D11 à D16 sont pris par la
> spécification. En résumé : `/u/<pseudo>` devient le profil, sans rien
> changer à son premier écran, les autres bentos du compte venant dessous, en
> entier, comme dans « La table » ; l'onglet Profil devient sa propre page,
> les réglages passant dans un écran à part ; chacun modifie son nom, son
> pseudo et son Popy ; un changement de pseudo redirige pour toujours les
> anciens liens, et le blocage suit le compte plutôt que le pseudo.
>
> Absorbe le chantier 10, profil éditable, fondu dans celui-ci le
> 15 septembre. Cf. [la roadmap](./MON-BENTO-POP-UX-ROADMAP.md) chantiers 21
> et 10, [le chantier 7](./UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md) pour
> l'échelle de la page, [le chantier 16](./UX-16-PLUSIEURS-BENTOS.md) pour les
> bentos d'un compte et [le chantier 20](./UX-20-MATCH-PAR-BENTO.md) pour les
> réglages. Même sortie store unique que tous les chantiers.

---

## 1. Intention

### 1.1 Ce que la roadmap demande

« Une nouvelle vue profil, avec les différents bentos de l'utilisateur. »
Proposition : `/u/<pseudo>` devient le profil, l'identité, le bento principal
en tête, les éditions ensuite ; même adresse, donc les liens partagés et
leurs aperçus restent valables ; son propre profil est la même vue, avec les
réglages ; la page web suit. Le chantier 10 y apporte ses trois formulaires :
le nom, le pseudo, le Popy.

Fait quand : depuis n'importe quel pseudo, on voit tous les bentos publiés de
la personne, un lien partagé il y a trois mois montre toujours son bento
principal, et chacun peut modifier son nom, son pseudo et son Popy sans
recréer son compte.

### 1.2 Mesuré le 24 octobre 2026, en production

- **64 comptes**, tous de type `member` : aucun profil éditorial.
- **28 bentos publiés**, de 28 comptes ; 53 bentos en tout, brouillons
  compris. **Aucun compte n'a plus d'un bento** : aucun secondaire, aucune
  édition. La liste des autres bentos ne montrera donc rien à personne avant
  la sortie store, qui ouvre les éditions.
- **Aucun nom affiché** : `display_name` est vide pour les 64 comptes, faute
  d'écran pour le saisir.
- **Les pseudos** font de 4 à 17 caractères, 8,6 en moyenne ; 2 portent des
  majuscules.
- **41 motifs interdits** actifs dans `blocked_pseudo_patterns`, vérifiés par
  le déclencheur `users_pseudo_block_check`, avant toute insertion et toute
  mise à jour du pseudo.
- **Les droits** : un compte connecté ne peut écrire ni son pseudo ni son nom,
  les droits d'écriture de `users` étant donnés colonne par colonne
  (`show_visits`, `searchable`) ; le pseudo est lu par tous, clé anonyme
  comprise.
- **3 signalements** en tout.

---

## 2. Objectif et critères de succès

- Depuis n'importe quel pseudo, dans l'app comme sur le web, on voit tous les
  bentos publiés de la personne, le principal d'abord.
- La page d'un compte qui n'a qu'un bento ne change pas d'un point : c'est le
  cas de tous les comptes aujourd'hui.
- Chacun modifie son nom, son pseudo et son Popy depuis son profil, sans
  recréer son compte.
- Un lien partagé avant un changement de pseudo mène toujours au bon profil,
  et personne d'autre ne peut récupérer l'ancien pseudo.
- Le Popy choisi s'affiche partout où le compte apparaît.
- Un compte bloqué le reste quand il change de pseudo.

---

## 3. Périmètre

**Dans le chantier** :

- la page d'un compte, `/u/<pseudo>`, qui s'allonge des autres bentos ;
- l'onglet Profil qui devient sa propre page, et l'écran « Réglages » ;
- l'écran « Modifier le profil » : le nom, le pseudo, le Popy ;
- les anciens liens redirigés, dans l'app et sur le web ;
- le blocage rattaché au compte ;
- la page web de la landing, qui suit l'app.

**Hors du chantier** :

- les abonnés et abonnements (23), les liens Instagram et TikTok (25), les
  succès (27) : la page leur gardera leur place, sans rien en montrer ;
- une photo à la place du Popy (25) ;
- le compte privé (chantier 20, D8) ;
- l'édition des profils éditoriaux depuis le back-office (D10) : les
  fonctions de la base l'accepteront, sans formulaire.

---

## 4. Ce que disent le code et la base

### 4.1 La page d'un compte dans l'app

- **`app/u/[pseudo].tsx`** rend `/u/<pseudo>` et `/u/<pseudo>/<slug>`. Sans
  slug, le bento principal du compte ; avec, celui que l'adresse nomme
  (chantier 16, D5).
- **Le premier écran tient sans défiler** : `publicBentoScale`
  (`src/lib/public-layout.ts`) calcule l'échelle de la boîte pour que
  l'en-tête, la bande des autres bentos, la boîte et la barre de boutons
  tiennent ensemble (chantier 7). Un `ScrollView` les porte, « un filet, pas
  un mode de lecture », la barre de boutons restant hors de lui, en bas.
- **Les autres bentos du compte** sont une bande de pastilles au-dessus de la
  boîte, qui mènent chacune à `/u/<pseudo>/<slug>` (`OtherBentos`). La
  requête de la page n'en lit que les références, sans leurs cases
  (`PublicBentoRef`).
- **Dans la barre du haut** : « Mêmes goûts » (chantier 20) et « Options »,
  signaler ou bloquer.

### 4.2 L'onglet Profil

`app/(tabs)/profile.tsx` est le tableau de bord de son compte, et rien n'y est
public : le Popy, le pseudo, le nom s'il existait, l'état de publication et
ses visites, « Voir mon bento public » et « Éditer mon bento », puis les
sections À propos, Notifications, Confidentialité, Comptes bloqués et
Compte, où l'on retire son bento du fil ou supprime son compte.

### 4.3 La page web

`apps/landing/src/app/u/[pseudo]/page.tsx` et `[slug]/page.tsx` rendent le
bento par `BentoPublicView`, l'identité par `BentoIdentity`, et les autres
bentos en liens sous l'identité. Rendu d'avance pour les bentos mis en
avant, à la demande sinon, gardé 5 minutes, rafraîchi par
`POST /api/revalidate` ; l'aperçu partagé est `opengraph-image.tsx`.

### 4.4 Ce qui dépend du pseudo

- **Le Popy** est tiré du pseudo : `popyKeyForPseudo`, un hachage du pseudo en
  minuscules parmi six Popys, partagé par l'app et la landing
  (`packages/supabase-mobile/src/bento.ts`). Changer de pseudo changerait de
  Popy. Le commentaire de `src/lib/popy-avatar.ts` attendait une colonne
  `users.avatar`.
- **Les adresses** : `/u/<pseudo>` et `/u/<pseudo>/<slug>`, dans les
  partages, les liens universels (`/u/*`), le sitemap et le déclencheur qui
  rafraîchit la landing, qui nomme les pages par `lower(pseudo)`.
- **Le blocage** est une liste de pseudos en minuscules, sur le téléphone
  (`src/state/blocked.ts`, clé `bp_blocked_pseudos`). Changer de pseudo suffit
  à en sortir, ce que la roadmap avait relevé (fondation 2).
- **Les signalements** recopient le pseudo signalé, `target_pseudo`, pour la
  trace, et nomment le bento par son identifiant.
- **Le fil, la recherche et les matchs** affichent le pseudo et le Popy :
  `users:user_id ( pseudo, display_name, kind )` pour le fil, `search_bentos`
  et `bento_matches`, qui rendent le pseudo mais ni l'identifiant du compte
  ni de quoi choisir le Popy.

### 4.5 La base

- **`users`** : `id`, `pseudo`, `display_name`, `kind`, `show_visits`,
  `searchable` et ses dates. Le pseudo est unique sans tenir compte de la
  casse (`users_pseudo_lower_idx`), au format `^[A-Za-z0-9_.]{3,20}$`, écrit à
  la première publication par `publish_first_bento` (chantier 9) : avant, le
  compte n'a pas de ligne dans `users`.
- **Les motifs interdits**, `blocked_pseudo_patterns`, sans accès client,
  lus par `check_pseudo_blocked()`. L'app y ajoute deux motifs réservés,
  `bento pop` et `bento pop team` (`src/lib/pseudo-match.ts`).
- **Le déclencheur `revalidate_landing_visits`** rafraîchit les pages web d'un
  compte quand `show_visits` ou `searchable` changent (chantiers 8 et 20).

---

## 5. Design

### 5.1 La page d'un compte (D1, D2)

**Le premier écran ne change pas** : l'identité, la bande des autres bentos,
le bento principal tenu à l'écran, la barre de boutons. **En faisant
défiler, les autres bentos du compte**, en entier, à la largeur de la boîte,
comme dans « La table » : chacun sous une étiquette qui dit le titre de
l'édition, ou l'adresse d'un bento libre, et sa date, les plus récents
d'abord. Un tap sur un bento ouvre sa page, `/u/<pseudo>/<slug>`, comme une
pastille de la bande.

Aucune carte à dessiner : la boîte est celle du fil, et un bento s'y lit
comme sur sa page. La bande de pastilles reste le sommaire du premier écran :
elle dit qu'il y a autre chose plus bas.

Sur `/u/<pseudo>/<slug>`, la liste montre les autres bentos du compte, le
principal compris, en tête.

Un compte qui n'a qu'un bento n'a ni bande ni liste : sa page ne bouge pas
d'un point, et c'est le cas de tous les comptes au 24 octobre.

### 5.2 Son propre profil (D3)

**L'onglet Profil montre sa page**, telle que les autres la voient, avec
deux boutons en tête : « Modifier le profil » et « Réglages ». Ses actions de
propriétaire restent les siennes : « Éditer mon bento », partager, et l'état
de publication avec ses visites sous le pseudo.

**L'écran « Réglages »** reprend tel quel ce que l'onglet porte aujourd'hui
sous l'identité : À propos, Notifications, Confidentialité, Comptes bloqués,
Compte. C'est l'écran à part que D9 du chantier 20 attendait.

**Avant sa première publication**, le compte n'a pas encore de pseudo
(chantier 9) : l'onglet garde l'état d'aujourd'hui, « Pas encore publié » et
« Reprendre mon bento », avec « Réglages ».

### 5.3 Modifier son profil (D4, D5, D7)

Un écran, trois champs, chacun enregistré à part :

- **le nom affiché** (D4) : facultatif, une ligne, 30 caractères au plus,
  passé aux mêmes motifs interdits que les pseudos ; vide, il disparaît ;
- **le pseudo** (D5) : au plus une fois tous les 30 jours, aux règles de la
  création, la disponibilité vérifiée pendant la saisie, comme à la
  publication ; l'écran dit la date du prochain changement possible, et
  prévient que les anciens liens mèneront au nouveau pseudo ;
- **le Popy** (D7) : les six, au choix, le sien sélectionné ; sans choix,
  celui d'aujourd'hui, tiré du pseudo.

Un changement de pseudo ne change pas de Popy : s'il n'a jamais été choisi,
celui du pseudo d'avant est figé au changement.

### 5.4 Les anciens liens (D6)

Après un changement de pseudo, `/u/<ancien>` et `/u/<ancien>/<slug>` mènent
au profil sous le nouveau pseudo, **pour toujours** : dans l'app, la page
remplace l'adresse ; sur le web, une redirection permanente (308). L'ancien
pseudo reste réservé à son titulaire, qui peut le reprendre ; personne
d'autre ne peut le prendre, donc personne ne récupère les liens déjà
partagés.

Supprimer son compte libère ses pseudos, anciens compris, comme aujourd'hui
le sien : leurs liens mènent alors à « introuvable ».

### 5.5 Le blocage (D8)

Le téléphone retient l'identifiant du compte bloqué, en plus de son pseudo :
changer de pseudo ne lève plus le blocage. Au premier lancement de la
nouvelle version, chaque pseudo bloqué est rattaché à son compte, anciens
pseudos compris ; un pseudo qui ne mène plus à personne reste dans la liste,
tel quel. La liste des comptes bloqués montre le pseudo actuel.

### 5.6 La page web (D9)

Elle suit l'app : l'identité, le bento principal, puis les autres bentos en
entier, la redirection 308 des anciens pseudos, le Popy choisi sur la page
et dans l'aperçu partagé. Le nom affiché apparaît sous le pseudo.

---

## 6. Contrat technique

### 6.1 La base

Une migration :

- **`users.avatar`** : une des six clés de Popy, ou `null` pour celui du
  pseudo ; écrit par son propriétaire, par `update_profile`.
- **`pseudo_history`** : `pseudo`, `user_id`, `changed_at`, unique sur
  `lower(pseudo)`, supprimé avec le compte. Aucun accès client direct.
- **`update_profile(p_display_name, p_avatar)`**, `security definer`, pour
  son propre compte : le nom nettoyé de ses blancs, 30 caractères au plus,
  passé aux motifs interdits ; la clé de Popy parmi les six, ou `null`.
- **`change_pseudo(p_pseudo, p_keep_avatar)`**, `security definer`, pour son
  propre compte : le format, la casse ignorée, ni un pseudo actuel ni un
  ancien d'un autre compte, les motifs interdits par le déclencheur
  existant ; au plus une fois tous les 30 jours ; l'ancien pseudo versé à
  `pseudo_history`, le pseudo repris retiré de celle-ci ; `p_keep_avatar`, le
  Popy affiché par l'app, figé dans `avatar` s'il est encore vide.
- **`resolve_pseudo(p_pseudo)`**, lisible à la clé anonyme : le pseudo actuel
  du compte qui a porté celui-ci, ou rien. Une réponse à la fois : on ne
  liste pas l'historique.
- **`search_bentos` et `bento_matches`** rendent en plus `user_id` et
  `avatar`, à arguments inchangés (D14).
- **Le déclencheur des pages web** suit aussi `pseudo`, `display_name` et
  `avatar` ; à un changement de pseudo, il rafraîchit l'ancienne adresse, la
  nouvelle et le sitemap (D15).
- **Contrôles** : `scripts/check-profile.sql`, en transaction annulée, comme
  `check-matches.sql`.

### 6.2 L'app

- **`src/lib/popy-avatar.ts`** : `popyFor(pseudo, avatar)`, l'avatar choisi
  d'abord, celui du pseudo sinon ; tous les appels de `popyForPseudo`
  passent par lui, le fil, la recherche, les matchs, la page, le profil et
  l'image de partage.
- **`src/lib/profile-edit.ts`**, pur : la validation des trois champs, les
  messages, la date du prochain changement de pseudo, et les écritures par
  les fonctions de la base.
- **`src/lib/account-bentos.ts`** : les autres bentos publiés d'un compte,
  par pages de huit, comme le fil, les plus récents d'abord (D11).
- **`src/state/blocked.ts`** : des entrées `{ userId, pseudo }`, filtrées par
  identifiant ; la reprise des pseudos d'aujourd'hui au premier lancement.
- **`app/u/[pseudo].tsx`** : la liste sous la boîte ; un pseudo introuvable
  passé à `resolve_pseudo`, puis l'adresse remplacée.
- **`app/(tabs)/profile.tsx`**, **`app/settings.tsx`** et
  **`app/profile/edit.tsx`** : l'onglet, les réglages, la modification.

### 6.3 La landing

- `lookupPublicBento` lit `avatar` et les autres bentos en entier ; un
  pseudo introuvable passe à `resolve_pseudo`, puis `permanentRedirect`.
- `BentoIdentity` et l'aperçu prennent le Popy choisi ; `BentoPublicView`
  rend les autres bentos sous le principal.
- Un repli, comme au chantier 20, si la landing part avant la migration.

### 6.4 Compatibilité avec les versions publiées

La 1.1 et la 0.1.0 lisent `users` en `select('*')` et ignorent `avatar` ;
`search_bentos` et `bento_matches` gardent leurs arguments, leurs nouvelles
colonnes étant ignorées. Personne ne peut changer de pseudo ni de Popy avant
la sortie store : la nouvelle app seule le permet. Après, sur une version
ancienne restée installée, un Popy choisi s'affiche comme le Popy du pseudo,
et un lien vers un ancien pseudo dit « introuvable ».

---

## 7. Stratégie de test et de recette

### 7.1 Tests

- **`check-profile.sql`**, sur le Supabase local, en transaction annulée :
  les règles du nom et du pseudo, les 30 jours, la réserve des anciens
  pseudos et leur reprise, la redirection, le Popy figé, les droits par
  compte et sous la clé anonyme, le rafraîchissement des pages web.
- **`check-privileges.ts`** : la section du chantier 21, par les fonctions
  de l'app contre l'API locale.
- **L'app** : `profile-edit.test.ts`, `account-bentos.test.ts`, le blocage et
  sa reprise, `popyFor` ; les tests qui lisent le code pour les nouveaux
  écrans.
- **La landing** : la redirection, le Popy et la liste, en e2e.

### 7.2 Recette

Au simulateur iPhone 17 Pro et SE et à l'émulateur Pixel 8, sur le Supabase
local, avec un compte garni d'un principal et de trois autres bentos :

1. La page d'un compte qui n'a qu'un bento, mesurée au point près avant et
   après le chantier.
2. La liste : l'ordre, les étiquettes, le tap, le défilement jusqu'au bout.
3. L'onglet Profil et l'écran Réglages.
4. Modifier le nom, le pseudo et le Popy ; les refus, les 30 jours.
5. Un ancien lien, dans l'app et sur la landing de ce worktree.
6. Le Popy partout : fil, recherche, matchs, page, partage.
7. Un compte bloqué qui change de pseudo, et la reprise des blocages.
8. VoiceOver et TalkBack, lus dans les arbres ; les grandes tailles de
   police.

---

## 8. Plan de développement

Effort **L**, comme à la roadmap.

### Lot 1 · La base

`users.avatar`, `pseudo_history`, `update_profile`, `change_pseudo`,
`resolve_pseudo`, `search_bentos` et `bento_matches` élargies, le
déclencheur, `check-profile.sql`.

> **Fait le 24 octobre 2026**, sur la branche `feat/ux-21-profil`, partie de
> celle du chantier 20.
>
> - **`supabase/migrations/20261024100000_profile.sql`** : `users.avatar` et
>   `users.pseudo_changed_at` ; `pseudo_history`, sans accès client, et sa
>   réserve ; les écritures `set_display_name`, `set_avatar` et
>   `change_pseudo`, et leurs pendants `apply_*` pour le rôle de service
>   (D10) ; les lectures `pseudo_status`, `resolve_pseudo`,
>   `resolve_accounts` et `my_pseudo_history` ; `search_bentos` et
>   `bento_matches` recréées avec `user_id` et `avatar` ; le déclencheur des
>   pages web, qui suit aussi le pseudo, le nom et le Popy. Appliquée au
>   Supabase local seulement.
> - **`scripts/check-profile.sql`** : 39 contrôles en transaction annulée,
>   sur quatre comptes construits pour l'occasion.
>
> **Quatre choix que la spécification laissait ouverts** :
>
> 1. **Une écriture par champ**, `set_display_name` et `set_avatar`, plutôt
>    que `update_profile(nom, Popy)` : l'écran enregistre chaque champ à part,
>    et un nom vide ne se confond plus avec « ne pas toucher au nom ».
> 2. **La réserve tenue par un déclencheur**, et pas seulement dans
>    `change_pseudo` : un compte neuf ne prend pas non plus l'ancien pseudo
>    d'un autre à sa première publication.
> 3. **`pseudo_status`**, ce que l'écran peut dire d'un pseudo pendant la
>    saisie : libre, pris, réservé, non autorisé, invalide ou le sien. L'app
>    d'aujourd'hui ne lit que les pseudos actuels : elle annoncerait libre un
>    ancien pseudo réservé, que la base refuserait ensuite.
> 4. **`users.pseudo_changed_at`**, la date du dernier changement, qui tient
>    les 30 jours. Changer seulement la casse compte comme un changement, sans
>    rien verser à l'historique : les adresses, en minuscules, ne changent
>    pas.
>
> **La marque, couverte deux fois** : le contrôle que `change_pseudo` en
> faisait doublait deux des 41 motifs interdits, en local comme en
> production. Retiré, les motifs refusant ces pseudos comme à la première
> publication ; `pseudo_status` garde la réponse « réservé », plus juste
> pour l'écran que « non autorisé ».
>
> **Défauts introduits exprès** : vingt-deux, tous attrapés, après une
> correction de chaque côté : un défaut mal écrit, le Popy jamais figé, et un
> contrôle ajouté, un pseudo écrit directement sans toucher au Popy, que
> `change_pseudo` masquait en écrivant toujours cette colonne. Le nom à 40
> caractères, sans les motifs ou sur deux lignes ; un Popy inconnu ; aucun
> délai ; aucune réserve, ou une réserve sensible à la casse ; l'historique
> jamais écrit, gardé à la reprise ou survivant au compte ; le Popy jamais
> figé, ou écrasé ; la redirection fermée aux visiteurs ; l'historique
> lisible par tous ; le statut aveugle aux anciens pseudos ou à la marque ;
> la recherche sans le Popy, les matchs sans le compte ; les pages sourdes au
> pseudo, oubliant l'ancienne adresse ou le sitemap ; son pseudo actuel
> compté comme un changement.
>
> **Non-régression** : `check-matches.sql`, 17 sur 17, sur `bento_matches`
> recréée ; `check-visits.sql`, 43 sur 43, le déclencheur partagé compris.
>
> **Pour le lot 2** : `check-privileges.ts` gagnera la section du chantier,
> par les fonctions de l'app. La CI ne lit pas le SQL : elle sera rejouée au
> lot 2.

### Lot 2 · L'app : les données

`popyFor` partout, `profile-edit.ts`, `account-bentos.ts`, le blocage par
compte et sa reprise, le type `Database`, `check-privileges.ts`.

> **Fait le 24 octobre 2026**, sur la même branche. Rien de neuf à l'écran :
> le Popy choisi s'affiche partout où un compte apparaît, mais personne ne
> peut encore en choisir.
>
> - **`popyKeyFor`**, dans `@bento-pop/supabase-mobile/bento`, partagé avec la
>   landing, et **`popyFor`** dans l'app : le Popy choisi, ou celui du pseudo ;
>   une clé inconnue se lit comme pas de choix. Le fil, la recherche, les
>   matchs, la page publique et l'onglet Profil y passent tous. Chacun des six
>   a un nom, pour le choix et pour VoiceOver, d'après son dessin : content,
>   intello, bisou, gêné, surpris, diable.
> - **Le compte et son Popy** dans chaque post du fil, chaque résultat de la
>   recherche, chaque match et sur la page publique.
> - **`blocked-accounts.ts`**, pur, et **`src/state/blocked.ts`** : le blocage
>   par compte (D8). La liste d'avant, des pseudos, est reprise au premier
>   lancement, chaque pseudo rattaché à son compte par `resolve_accounts` ;
>   une entrée sans compte réessaie à chaque lancement, et les pseudos
>   affichés suivent ceux des comptes. Rien de tout cela ne retarde
>   l'hydratation : la liste lue sert tout de suite.
> - **`profile-edit.ts`** : la validation du nom, compté en caractères comme
>   la base, la date du prochain changement de pseudo, les trois écritures et
>   la lecture de leurs refus, en phrases.
> - **`account-bentos.ts`** : les autres bentos d'un compte, par la requête du
>   fil, limitée au compte et sans le bento de la page.
> - **`pseudo_status` à la publication aussi** : l'écran du pseudo annonce
>   « Pris » un ancien pseudo réservé, et « Non autorisé » un pseudo interdit,
>   au lieu de les découvrir à l'envoi.
> - **L'export de ses données** inclut ses anciens pseudos (D16).
> - **`check-privileges.ts`** gagne la section du chantier, treize contrôles
>   par les fonctions de l'app contre l'API locale : le nom et le Popy écrits
>   par leurs fonctions et jamais par la colonne, le pseudo changé et sa page
>   qui suit, la redirection sans session, la réserve, les 30 jours,
>   l'historique fermé, la recherche qui rend le compte et son Popy, le rôle
>   de service par la même fonction (D10). Conforme.
>
> **Deux choix** :
>
> 1. **Huit bentos par page, comme le fil**, et non dix : la même requête, au
>    poids mesuré au chantier 2. D11 est corrigée en ce sens.
> 2. **Le parcours des versions publiées garde son contrôle** :
>    `check-privileges.ts` rejoue toujours leur test de disponibilité, sur
>    `users`, quand la nouvelle app passe par `pseudo_status`.
>
> **Tests** : 37 de plus, 816 pour l'app : le blocage par compte et sa
> reprise, la modification du profil et ses refus contre le bouchon
> PostgREST, `pseudo_status`, le fil d'un compte, le compte et le Popy dans
> chaque mise en forme. Quinze défauts introduits exprès, tous attrapés : le
> blocage aveugle au compte ; la reprise sous l'ancien pseudo ; un compte
> bloqué deux fois ; le déblocage par le seul pseudo ; le nom compté en
> unités UTF-16 ; 29 jours entre deux pseudos ; un pseudo interdit lu comme
> pris ; le Popy affiché jamais transmis ; une réponse inconnue lue comme
> libre ; le fil d'un compte qui montre aussi le bento de la page ; le fil
> sans le Popy, la recherche sans le compte, les matchs sans le Popy, la page
> sans le compte ; le Popy choisi ignoré.
>
> **La CI, rejouée en local, en deux temps** : lint et typage 8 sur 8 ;
> tests 226, 193 et 816 ; build 3 sur 3. L'e2e de la landing, que ce lot ne
> touche pas, passe au lot 5 : le port 4599 de son bouchon est tenu par une
> autre session.

### Lot 3 · L'app : la page d'un compte et son profil

La liste sous la boîte, l'ancien pseudo résolu, l'onglet Profil, l'écran
Réglages.

> **Fait le 24 octobre 2026**, sur la même branche.
>
> - **La liste sous la boîte**, `AccountBentoList` : les autres bentos du
>   compte, chacun en entier, comme dans « La table », sous une étiquette qui
>   dit son titre, celui de l'édition, « Bento principal » ou l'adresse d'un
>   bento libre, et sa date ; un tap ouvre sa page. Chargée à part de la page,
>   par pages de huit, la suivante à 600 points du bas. Sous un bento nommé, le
>   principal passe en tête (§5.1), demandé à part en même temps que la
>   première page des autres (`loadAccountBentosPage`).
> - **L'ancien pseudo résolu** : un pseudo introuvable passe à
>   `resolve_pseudo`, la page restant en chargement le temps de la réponse,
>   puis l'adresse est remplacée, le bento nommé compris. Un pseudo que
>   personne n'a porté dit toujours « Bento introuvable ».
> - **L'onglet Profil** rend la page de son compte, `AccountScreen`, tenue
>   au-dessus de la barre d'onglets, « Réglages » à la place de « Retour ».
>   Avant la première publication, « Pas encore publié » et « Reprendre mon
>   bento », sous le Popy content plutôt que le diable que tirait un pseudo
>   vide.
> - **L'écran Réglages**, `app/settings.tsx` : À propos, Notifications,
>   Confidentialité, Comptes bloqués et Compte, repris de l'onglet, dans le
>   même ordre. Les phrases qui renvoyaient au profil pour débloquer un compte
>   renvoient aux réglages.
>
> **Trois choix** :
>
> 1. **La bande des pastilles suit la liste** : même ordre, le principal
>    d'abord, puis du plus récent au plus ancien, et mêmes titres, « Bento
>    principal » compris, qui mène à l'adresse du compte. Elle allait du plus
>    ancien au plus récent, l'ordre du choix du bento au chantier 16, et se
>    lisait à rebours de la liste qu'elle résume. Aucun compte n'en montre en
>    production ; la landing suivra au lot 5.
> 2. **Dans la liste, l'édition n'est dite qu'une fois** : son titre est déjà
>    celui de l'étiquette, la boîte n'en porte plus le ruban. « Invité » et
>    « Coup de cœur » restent.
> 3. **Tous les textes de la page, des réglages et de l'onglet appliquent
>    eux-mêmes la taille système**, plafonnée, comme l'écran des mêmes goûts
>    au chantier 20 : c'est la correction des défauts 3 et 4 ci-dessous.
>
> **Recette** au simulateur iPhone 17 Pro, à part de celui des autres
> sessions, sur le Supabase local : un compte garni d'un principal et de onze
> autres bentos, la liste et ses deux pages jusqu'au bout, les étiquettes, la
> bande, le tap ; l'onglet Profil et les Réglages ; un compte bloqué depuis
> sa page, retrouvé dans les Réglages et débloqué ; un compte qui change de
> pseudo, ses anciens liens `/u/<ancien>` et `/u/<ancien>/<slug>`, son Popy
> figé au changement, et un pseudo que personne n'a porté ; la plus grande
> taille de texte, au lancement et changée écran ouvert.
>
> **Quatre défauts relevés, corrigés** :
>
> 1. VoiceOver annonçait un bento de la liste « Bento de @recette_profil »,
>    sous une étiquette « TROISIEME » : son libellé commence maintenant par ce
>    qu'on lit, son titre puis sa date.
> 2. Notifications et Confidentialité ne s'annonçaient pas comme des titres,
>    à la différence des trois autres sections des réglages.
> 3. Une taille réduite écran ouvert laissait les lignes des réglages à leur
>    ancienne hauteur, et le sous-titre d'un interrupteur rogné, sur iOS.
> 4. Une taille agrandie écran ouvert coupait « Réglages », « Options » et
>    « Mêmes goûts » en « RÉGLA… », « OPTI… » et « MÊMES GOÛ… », sur iOS. Les
>    deux derniers dataient des chantiers 7 et 20.
>
> **Relevé, hors du lot** : dans les Réglages, après quelques allers-retours,
> VoiceOver lit des rôles mélangés, « Conditions d'utilisation » en case à
> cocher. C'est le recyclage des vues de Fabric, que la session sur les rôles
> de VoiceOver traite à part.
>
> **Tests** : 22 de plus, 838 pour l'app : la liste d'un compte et son
> principal en tête contre le bouchon PostgREST, qui sait désormais viser une
> requête parmi plusieurs parties ensemble ; l'ordre, le rang et les titres de
> la bande ; le libellé lu d'un bento de la liste, le ruban tu ; l'ancien
> pseudo ; la liste rafraîchie après une publication ; les textes de la page,
> des réglages et de l'onglet, et les titres des réglages, lus dans le code.
> La lecture des styles remonte désormais toutes les fonctions englobantes :
> un texte rendu dans un `.map()` y trouve les constantes du composant.
>
> **Défauts introduits exprès** : vingt-quatre, tous attrapés. La liste
> annoncée par l'auteur ; l'édition redite ; le principal nommé par son
> adresse ; le filtre du principal perdu ; le ruban d'édition sur la boîte de
> la liste ; la bande à rebours, le principal à sa date, sa pastille sans son
> rang ; le principal absent de la liste d'un bento nommé, redemandé à chaque
> page, ou listé deux fois ; la liste qui montre le bento de la page ;
> l'ancien pseudo cherché avec ses blancs, la redirection qui oublie le bento
> nommé, une panne lue comme « introuvable » ; la liste jamais rafraîchie ;
> un titre des réglages, « Réglages », « Options », la description d'un
> interrupteur et « Pas encore publié » rendus à la plateforme ou figés ;
> trois sections des réglages annoncées comme du texte. Restent vérifiés à la
> seule recette, faute de test d'écran : le titre et l'adresse d'une pastille,
> et la redirection réservée à la route.
>
> **La CI, rejouée en local** : lint et typage 8 sur 8 ; tests 226, 193 et
> 838 ; build 3 sur 3. L'e2e de la landing, que ce lot ne touche pas, passe
> au lot 5 : le port 4599 de son bouchon est toujours tenu par une autre
> session.

### Lot 4 · L'app : modifier son profil

L'écran « Modifier le profil » : le nom, le pseudo, le Popy.

### Lot 5 · La landing

La redirection, le Popy choisi, la liste, le repli, l'e2e.

### Lot 6 · Recette et documents

La recette de §7.2, la DoD point par point, la roadmap, la liste du
chantier 29.

---

## 9. Livraison

- **Une PR** pour les six lots, empilée sur celle du chantier 20, la #94.
- **La migration**, par Clément, dans l'éditeur SQL du projet Supabase
  « My Bento Pop », ref `ggjgktbcqumfxrixcdyx`,
  `https://supabase.com/dashboard/project/ggjgktbcqumfxrixcdyx/sql/new`, avant
  la fusion ; le SQL lui sera envoyé en bloc et en fichier, avec ses
  contrôles. Compatible avec la 1.1 et la 0.1.0 (§6.4).
- **Deux sessions en cours touchent des fichiers voisins**, les textes
  d'Android (le fil, la recherche, le composer, `FeedLabel`) et les rôles de
  VoiceOver : la première fusionnée, l'autre se met à jour sur elle.
- **À la sortie store** : la page d'un compte, le profil, sa modification.

---

## 10. Definition of Done

- [ ] Depuis n'importe quel pseudo, dans l'app et sur le web, on voit tous
      les bentos publiés de la personne, le principal d'abord
- [ ] La page d'un compte qui n'a qu'un bento ne change pas d'un point
- [ ] Un lien vers un ancien pseudo, `/u/<ancien>` comme
      `/u/<ancien>/<slug>`, mène au profil sous le nouveau, dans l'app et
      sur le web
- [ ] Personne d'autre ne peut prendre un ancien pseudo ; son titulaire peut
      le reprendre
- [ ] Chacun modifie son nom, son pseudo et son Popy depuis son profil ; le
      pseudo au plus une fois tous les 30 jours, aux règles de la création ;
      refusé à un autre compte et à la clé anonyme
- [ ] Le nom affiché fait 30 caractères au plus et passe aux motifs
      interdits
- [ ] Le Popy choisi s'affiche partout ; changer de pseudo ne change pas de
      Popy
- [ ] Un compte bloqué qui change de pseudo reste bloqué ; les blocages
      d'avant survivent à la mise à jour
- [ ] Les versions publiées ne cassent pas
- [ ] VoiceOver et TalkBack lisent un bento de la liste en un seul élément ;
      les grandes tailles de police tiennent
- [ ] Tests, typage, lint et build verts, CI rejouée en local

---

## 11. Décisions

D1 à D10 rendues par Clément le 24 octobre 2026, en QCM, chacune sur l'option
recommandée ; D11 à D16 prises par la spécification.

| # | Décision | Raison |
| --- | --- | --- |
| **D1** | `/u/<pseudo>` devient le profil : son premier écran ne change pas, les autres bentos du compte viennent dessous | Les liens partagés et leurs aperçus restent valables ; aucun compte n'a plus d'un bento aujourd'hui, la page ne change pour personne avant les éditions |
| **D2** | Un bento de la liste s'affiche en entier, à la largeur du fil, sous son étiquette, les plus récents d'abord | Aucune carte nouvelle à dessiner ; `MiniBentoCard` avait été retirée au chantier 2, ses titres de cases étant illisibles à cette taille |
| **D3** | L'onglet Profil devient sa propre page, avec « Modifier le profil » et « Réglages » ; les réglages passent dans un écran à part | La « même vue » de la roadmap, et l'écran que D9 du chantier 20 attendait |
| **D4** | Le nom affiché : facultatif, une ligne, 30 caractères au plus, passé aux motifs interdits | Du texte d'utilisateur, à filtrer avant publication (règle 1.2 d'Apple) ; aucun compte n'en a aujourd'hui |
| **D5** | Le pseudo, au plus une fois tous les 30 jours, aux règles de la création | Corriger un choix fait à la publication, sans tourner chaque semaine de nom en nom |
| **D6** | Les anciens liens redirigés pour toujours ; l'ancien pseudo réservé à son titulaire, qui peut le reprendre | Personne ne récupère les liens déjà partagés d'un autre |
| **D7** | Le Popy au choix parmi les six, `users.avatar` ; celui du pseudo par défaut, figé au changement de pseudo | Changer de pseudo ne change pas de visage |
| **D8** | Le blocage suit le compte : l'identifiant en plus du pseudo, les blocages d'avant rattachés à leur compte | Changer de pseudo ne suffit plus à se débloquer |
| **D9** | La page web suit l'app : la liste, la redirection 308, le Popy choisi | Les liens partagés mènent d'abord au web |
| **D10** | Les profils éditoriaux hors du chantier ; les fonctions acceptent l'appel du back-office | Aucun en production aujourd'hui |
| **D11** | Les autres bentos chargés à part, après le bento de la page, par la requête du fil : pages de huit, mêmes ordre et curseur | Le premier écran n'attend jamais la liste, et une liste longue d'éditions ne pèse que ce qu'on en voit ; huit et non dix, corrigé au lot 2, pour garder la requête du fil telle quelle |
| **D12** | Les anciens pseudos dans `pseudo_history`, uniques sans tenir compte de la casse, supprimés avec le compte | La réserve et la redirection lisent la même table ; supprimer son compte libère ses pseudos, comme aujourd'hui |
| **D13** | Le pseudo et le nom écrits par `change_pseudo` et `update_profile`, jamais par un droit sur la colonne | Les règles vivent en base, et la clé anonyme ne peut rien |
| **D14** | `search_bentos` et `bento_matches` rendent aussi `user_id` et `avatar` | Le Popy choisi et le blocage par compte, en un aller-retour ; les versions publiées ignorent les colonnes en plus |
| **D15** | Le déclencheur des pages web suit le pseudo, le nom et le Popy ; à un changement de pseudo, l'ancienne adresse, la nouvelle et le sitemap | La page et l'aperçu suivent en quelques secondes plutôt qu'en cinq minutes |
| **D16** | L'export de ses données inclut ses anciens pseudos | Ce sont des données de son compte |

---

## 12. Suivis

- **Les abonnés, les liens sociaux et les succès** trouveront leur place dans
  l'identité, avec les chantiers 23, 25 et 27.
- **L'édition des profils éditoriaux** depuis le back-office, le jour où il y
  en aura.
- **Le pseudo actuel dans le back-office**, à côté du pseudo signalé, si un
  signalement vise un compte qui a changé de nom depuis.
