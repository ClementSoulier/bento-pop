# Passation de session · Bento Pop

> Écrit le 14 septembre 2026. À supprimer une fois la session reprise ailleurs.
>
> Ce fichier remplace le prompt de reprise : il porte l'état exact du dépôt,
> le chantier en cours, la façon de travailler et tout ce qu'il ne faut pas
> perdre. Rien d'autre à charger pour démarrer.

---

## 1. Où en est le dépôt

| | |
|---|---|
| Dépôt | `git@github.com:ClementSoulier/bento-pop.git` |
| Branche par défaut | `main`, à `3680f82` |
| Branche en cours | `feat-ux-07-page-bento`, à `db3da6e`, **poussée**, pas de PR ouverte |
| Arbre de travail | propre |
| Worktree local | `/Users/clementsoulier/conductor/workspaces/bento-pop/geneva` (Conductor). Le dépôt principal est à `/Users/clementsoulier/Sites/bento-pop` et occupe `main` : un `git checkout main` échouera ici, c'est normal. |

`db3da6e` ne contient que de la documentation : la spécification du chantier 7
et la mise à jour de la roadmap. **Aucun code applicatif n'a été touché.**

### Ce qui est livré

Chantiers 1 à 6 et 14 de la roadmap. Le 6, « Trouver », a été fusionné le
13 septembre (PR #58, commit `3680f82`) : recherche par item, plus aucun
résultat qui mène à « Bento introuvable », 12 critères de DoD sur 12.

**1.2.0 est livrée aux deux stores** depuis le 13 septembre, TestFlight et
canal interne. L'App Store public sert toujours **1.1**.

---

## 2. Le chantier en cours : 7, page bento publique

**Spécification écrite, mesures faites, développement pas commencé.**
`docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`, 809 lignes. La convention est
« spéc validée, puis lot par lot » : le lot 1 attend le feu vert de Clément.

### Ce que la mesure a établi, et qu'il ne faut pas redécouvrir

- **Le recouvrement des CTA n'est pas propre à l'iPhone SE.** Mesuré au point
  par arbre d'accessibilité sur trois écrans : 3 pt sur un 17 Pro, 18 sur un
  17e, **134 sur un SE**, où la boîte dépasse en plus de 35 pt sous le bord.
- **`BentoGrid` ne met à l'échelle que les hauteurs.** Sa largeur est celle du
  parent, les tuiles étant en `flex: 1`. Une échelle n'y est pas un zoom, c'est
  une compression verticale. La boîte est écrasée de 8 % sur un 17 Pro.
- **Le cas « case vide ou en modération » n'existe pas** (0 sur 27 bentos
  publiés) **et ne changerait rien** : `EmptyTile` a la hauteur de `Tile`, la
  boîte fait 512 pt quoi qu'elle contienne.
- **L'échelle dynamique du composer ne s'applique pas.** Elle calcule sur la
  seule hauteur, donne 0,68 sur un SE et reconduit l'écrasement.
- **Une panne réseau affiche « Bento introuvable ».** `findUserByPseudo` avale
  l'erreur (`pseudo.ts:53`). Sur la page d'arrivée de tous les liens partagés.
- **Deux requêtes séquentielles** : 89 ms p50 contre **46 ms** en une jointure
  externe, à charge utile égale. Et **21 % de la charge n'est jamais rendue**
  (`year`, `external_source`, `external_id`, `created_at`).
- **Jointure externe et non `!inner`** : elle distingue gratuitement « pseudo
  inconnu » de « pas de bento en ligne ». `bentos.user_id` est `unique`, donc
  PostgREST rend un objet, pas un tableau.
- **13 % des titres sont tronqués dans leur tuile**, 33 % pour la musique.
  C'est le chiffre qui a servi à trancher la question du surlignage.

### La règle du chantier

> La boîte a les mêmes proportions et la même taille que dans le fil, et rien
> ne la recouvre jamais.

`scale = min(feedScale(largeur), max(hauteurDisponible / 512, 0,86))`.
Le plancher 0,86 est ce que le fil montre déjà sur un iPhone SE, livré et
accepté au chantier 2. Résultat : boîte identique au fil sur 17 Pro et 17e,
zéro défilement ; ~90 pt de défilement sur le SE seulement.

### La question ouverte, tranchée : non

Signaler la case d'arrivée depuis la recherche : **non**. La ligne de résultat
nomme déjà la case et le titre, et après le chantier les six cases sont
visibles d'un coup. `TilePulse` existe si la recette contredit : deux lignes.

### Le plan

Quatre lots, §9 de la spéc. Lot 1 : les deux modules purs
(`src/components/bento/public-layout.ts` et `src/lib/public-bento.ts`) avec
leurs tests, aucun écran modifié. Lot 2 : l'écran. Lot 3 : ce que la police
maximale casse. Lot 4 : recette. 13 critères de DoD.

**Aucune migration SQL. Rien à appliquer côté Supabase pour ce chantier.**

### Les captures de la mesure

Elles vivaient dans `/tmp/ux07/livrees/` sur la machine d'origine et **ne
survivent pas au transfert**. Elles se refont en cinq minutes, cf. §5.

---

## 3. Comment Clément veut qu'on travaille

Ces règles ont été posées explicitement et valent pour toute la suite.

- **Jamais de tiret cadratin** dans les réponses ni dans les contenus rédigés.
- **Spécification et plan avant implémentation**, puis lot par lot avec
  validation entre chaque.
- **Rigueur intransigeante** sur les tests, la recette, la qualité du code,
  l'expérience utilisateur et les performances.
- **Mesurer avant d'affirmer.** Une propriété visuelle se mesure au pixel, et
  on lit toute la capture. Cette méthode a écarté une option architecturale au
  chantier 5, changé tout le design d'un écran au chantier 6, et élargi le
  constat du chantier 7 de « l'iPhone SE » à « tous les iPhone ».
- **Partager les captures** quand on en prend.
- Pour un texte destiné au back-office admin : **bloc de code en texte brut,
  puces `•`**.
- **Toujours préciser buildtime ou runtime** en demandant une variable
  d'environnement Coolify. Une `NEXT_PUBLIC_` posée au runtime est ignorée en
  silence.
- **Jamais de clé service-role sur la landing**, clé anonyme uniquement.
- **Ne jamais coller de clé de store dans la conversation.** Le `.p8` et le
  JSON du compte de service Google vivent sur EAS via `eas credentials`,
  jamais dans le dépôt.
- **Tout compte créé pour la recette se supprime après**, profil PUIS auth.
  Un compte anonyme récent qui porte un profil est un vrai utilisateur, pas
  une sonde : vérifier avant de supprimer.
- L'adresse `contact@keremaprod.com` sert à identifier Clément, à n'envoyer à
  aucun service tiers.

**Piège GitHub, appris à ses dépens** : empiler une PR sur une autre est à
éviter. Supprimer la branche de base au moment du merge **ferme** la PR
empilée, et une PR fermée dont la base n'existe plus ne se rouvre ni ne se
retargette. Retargeter d'abord, ou attendre.

---

## 4. La stack, en bref

Turborepo et pnpm workspaces, Node 20 via nvm
(`$HOME/.nvm/versions/node/v20.20.2/bin`), `shamefully-hoist=true`.

| App | Ce que c'est |
|---|---|
| `apps/mobile` | Expo SDK 57, RN 0.86.3, expo-router en `js-tabs`, CNG |
| `apps/landing` | Next.js, déployée sur Coolify (Dockerfile standalone, port 3200) |
| `apps/admin` | back-office Next.js, **pas encore déployé** |
| `apps/quiz-wheel` | app de plateau, sans rapport avec le mobile |

**Deux projets Supabase distincts, à ne pas confondre.**

| | URL | Clés |
|---|---|---|
| Mobile | hébergé, `ggjgktbcqumfxrixcdyx.supabase.co` | `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `apps/mobile/.env` |
| Landing et admin | auto-hébergé Coolify, `https://supabase.bento-pop.com` | `NEXT_PUBLIC_SUPABASE_*` dans `apps/admin/.env` |

L'accès **lecture production mobile** passe par `MOBILE_SUPABASE_URL` et
`MOBILE_SUPABASE_SERVICE_ROLE_KEY`, dans `apps/admin/.env`. Ces fichiers `.env`
sont ignorés par git : **ils ne suivront pas le transfert**, il faudra les
récupérer sur la machine d'origine ou dans Coolify.

### Pièges de plateforme déjà payés

- PostgREST expose les fonctions SQL en **POST uniquement**. `security invoker`
  est le défaut, donc la RLS s'applique.
- `pg_trgm similarity()` est insensible à la casse, rien dans sa signature ne
  le dit.
- Les jokers `ilike` `%` et `_` s'échappent avec `escape '\'`, et le triple
  `replace` doit traiter `\` en premier. `_` est un caractère de pseudo valide :
  `bentopop://u/buyt_k` affichait le bento de `buyt.k`.
- **Un module qui importe `react-native`, `expo-constants` ou `expo-updates`
  n'est pas chargeable sous `node:test`.** D'où le motif du client Supabase
  **injecté en premier paramètre** (`feed.ts`, `suggestions.ts`, `search.ts`).
- `apps/mobile/src/test/postgrest-stub.ts` fournit `startPostgrestStub()` et
  `STUB_CLIENT_OPTIONS` pour tester un vrai `supabase-js` contre un bouchon
  HTTP local.
- La commande de test est `tsx --test $(find src -name '*.test.ts' | sort)` :
  **un test placé hors de `src/` n'est jamais exécuté.**
- La CI (`.github/workflows/ci.yml`) tourne `lint`, `typecheck`, `test`,
  `test:e2e`. Elle ne lance **pas** `format:check`, et c'est heureux : toutes
  les spécifications existantes échouent à prettier.

---

## 5. Refaire les mesures et la recette

### Simulateurs

Le build de dev (0.2.0, pointé sur la production) est installé sur
`iPhone 17 Pro`. Il se copie sur les autres :

```bash
xcrun simctl list devices available | grep -i iphone
# le bundle installé se récupère par :
xcrun simctl listapps <udid-17-pro> | grep -A2 bentopop
cp -R <chemin>/MonBentoPop.app /tmp/
xcrun simctl boot <udid-cible> && xcrun simctl install <udid-cible> /tmp/MonBentoPop.app
```

UDID utilisés le 14 septembre :

| Appareil | Points | UDID |
|---|---|---|
| iPhone 17 Pro | 402 × 874 | `EE21A738-2F4B-414A-A752-5EAEEA46AD70` |
| iPhone 17e | 390 × 844 | `D3A5A808-BCBC-4401-BC59-0A65C11FF405` |
| iPhone SE (3e gén.) | 375 × 667 | `83A78615-AFAC-46E4-9635-B7BC2123C735` |

L'iPhone 17 de base fait 402 × 874, exactement comme le 17 Pro : inutile comme
point de mesure supplémentaire.

```bash
cd apps/mobile && export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
npx expo start                       # Metro
xcrun simctl launch <udid> com.bentopop.mobile
xcrun simctl openurl <udid> "bentopop://u/dark_hifus"
```

Sur un appareil où l'app n'était pas encore lancée, iOS demande une
confirmation « Ouvrir dans Mon Bento Pop ? » avant de suivre le lien profond.

### Outils

- `idb ui tap|text|swipe` : coordonnées en **points**, pas en pixels. Sur un
  17 Pro, 1206 × 2622 px pour 402 × 874 pt, donc diviser par 3.
- `idb ui text` tape en QWERTY sur un clavier AZERTY : **éviter a, q, z, w, m**
  dans les chaînes saisies. `idb ui key <udid> 42` vaut retour arrière.
- `idb ui describe-all <udid>` rend l'arbre d'accessibilité en JSON, avec les
  cadres. **C'est l'outil de mesure** : c'est lui qui a donné les 200 pt de
  haut de page à 0,1 pt près, et qui a révélé que les crédits photo de la
  rangée basse sont absents de l'arbre sur iPhone SE.
- `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large`
  pour la police système maximale, `large` pour revenir. **Y repasser
  systématiquement** : ce réglage a trouvé trois défauts au chantier 6 et deux
  au chantier 7.
- Pour mesurer une géométrie au pixel sur une capture, attention au **rayon de
  coin** : une colonne scannée à 2 pt du bord coupe le coin arrondi et fait
  perdre 15 pt en haut comme en bas. C'est ce qui a d'abord donné 474,6 au lieu
  de 481,9.

### Mesures production

Elles se refont avec de petits scripts Node lisant `apps/admin/.env`. Les
scripts jetables ont été supprimés ; les requêtes utiles sont toutes écrites
dans §4 de `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`.

Corpus au 14 septembre 2026 : **75 profils, 27 bentos publiés, 162 cases,
131 avec image**. Le corpus dérive : il était de 72 et 26 la veille.

---

## 6. À ne pas perdre

### Livraison et versions

- **L'App Store sert 1.1.** La 1.2.0 est sur TestFlight et attend une mise en
  revue **manuelle** dans App Store Connect.
- **`app_config` porte encore `ios_latest_version: "1.1"`,
  `android_latest_version: "0.1.0"`, `ios_min_version: "0.0.1"`,
  `android_min_version: null`, `maintenance_mode: false`.** À passer à 1.2.0
  **le jour où elle est publique, PAS AVANT** : ces valeurs pilotent l'écran
  de mise à jour obligatoire.
- **La prochaine mise à jour à distance doit viser la runtime 1.2.0.** Celle
  du 13 septembre visait 0.2.0 et est orpheline.
- **Personne n'a encore observé ce que fait l'app au lancement après une mise
  à jour à distance** : écran « Mise à jour… » puis rechargement, ou démarrage
  normal parce que la vérification a dépassé son plafond de 1500 ms.

### Recette appareil réel, qui accumule sept chantiers

Haptique (chantiers 3 et 6), VoiceOver, taille de police système, fluidité du
fil sur build de production, aperçus de partage, et les deux cas réseau du
démarrage : mode avion et réseau très lent. Le simulateur ne restitue pas
l'haptique.

### Dette produit ouverte

- **Chantier 11** doit : poser des plafonds de grossissement sur 20 usages
  d'`Extenda` et sur `TopChip` ; ajouter une liste « Comptes bloqués » au
  profil, car bloquer quelqu'un est aujourd'hui une porte à sens unique (le
  menu « Débloquer » vit sur `/u/[pseudo]`, page filtrée du fil comme de la
  recherche une fois le blocage posé).
- **Doublons du catalogue à fusionner en modération** : « arcane », « joueur du
  grenier », « lesadpanda », et les deux variantes du Seigneur des anneaux.
  `admin_merge_items` existe. Ça se voit maintenant dans la recherche.
- **15 bentos complets et non publiés**, sans bug qui l'explique, en attente
  depuis 26 jours en médiane. Chantier 8.
- **46 comptes sans bento publié.** Chantiers 8 et 9.
- **Suivis ouverts par le chantier 7** (§12 de sa spéc) : le composer a
  probablement le même écrasement que la page publique ; la page web
  `/u/[pseudo]` porte une troisième géométrie ; le bouton retour renvoie au
  composer quand il n'y a rien à dépiler ; personne ne sait d'où viennent les
  ouvertures de la page publique.

### Ménage et infrastructure

- **Migration `20260911000000_revalidate_landing_on_publish.sql` toujours pas
  appliquée**, ni ses deux secrets Vault. Sans elle, la page publique web se
  rafraîchit toutes les cinq minutes au lieu d'immédiatement.
- **Back-office et landing toujours pas déployés sur Coolify.**
- Compte d'administration de recette `recette.bo@bento-pop.com`, à retirer de
  `admin_users` et `auth.users` quand il ne servira plus.
- 36 installations sans pseudo conservées volontairement : les supprimer
  masquerait une perte d'un tiers à l'inscription, arbitrage produit à
  trancher.
- Le simulateur iPhone 17 Pro a une session `auth` périmée depuis la
  suppression du compte de recette du chantier 6 : au lancement, un bandeau
  d'erreur vide s'affiche (« Invalid Refresh Token »). Sans conséquence pour
  consulter une page publique, mais c'est ce qu'on voit au démarrage.

---

## 7. La carte des documents

| Fichier | Ce qu'il porte |
|---|---|
| `docs/MON-BENTO-POP-UX-ROADMAP.md` | les 14 chantiers, l'ordre d'attaque, les statuts. **Le point d'entrée.** |
| `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` | le chantier en cours |
| `docs/UX-06-TROUVER.md` | la recherche, livrée le 13/09 |
| `docs/UX-02-FIL-LA-TABLE.md` | §5.3 : l'échelle de la boîte se calcule sur la largeur |
| `docs/UX-01-PAGE-BENTO-PUBLIQUE.md` | la page **web**, à ne pas confondre avec le chantier 7 |
| `docs/UX-05-BROUILLON-PUBLIE.md`, `UX-03-RECHERCHE-ITEM.md`, `UX-14-BACK-OFFICE-UTILISATEURS.md` | chantiers livrés |
| `docs/RECETTE-MOBILE.md`, `DEPLOIEMENT-MOBILE.md`, `MISES-A-JOUR-APP.md`, `STORE-COMPLIANCE.md` | procédures |
| `CLAUDE.md` | consignes dépôt. **Attention, il décrit surtout `quiz-wheel` et dit « Vercel » là où la landing tourne sur Coolify.** |

---

## 8. Pour reprendre

1. Récupérer les `.env` (`apps/mobile/.env`, `apps/admin/.env`, éventuellement
   `apps/landing/.env`), qui ne sont pas dans git.
2. `nvm use && pnpm install`.
3. `git checkout feat-ux-07-page-bento`, lire
   `docs/UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md`.
4. Attendre la validation de la spéc par Clément, puis attaquer le lot 1.
5. Supprimer ce fichier.
