# Les deux mécanismes de mise à jour

> Spécification écrite le 13 septembre 2026, avant la build 0.2.0. Elle
> couvre deux choses qui se ressemblent mais n'ont rien à voir : inviter
> quelqu'un à télécharger une nouvelle version sur le store, et appliquer
> une mise à jour à distance au lancement.
>
> Les deux doivent être dans **cette** build. Le second surtout : le livrer
> par mise à jour à distance serait circulaire.

---

## 0. Ce qui existe déjà, et le trou

| Brique | État |
|---|---|
| `app_config.ios_min_version` / `android_min_version` | lue, comparée, déclenche `ForceUpdateScreen` |
| `app_config.ios_latest_version` / `android_latest_version` | **lue, transportée, jamais utilisée** |
| `ForceUpdateScreen` | existe, bloquant, CTA vers le store |
| `openStore()` | existe dans `AppBlocker.tsx`, gère les deux plateformes |
| `expo-updates` | en dépendance, `updates.url` et `runtimeVersion` configurés |
| Appel à `Updates.*` dans le code | **aucun** |

Donc le cas dur est traité et le cas doux n'existe pas ; et les mises à jour
à distance s'appliquent au démarrage **suivant**, jamais au démarrage courant.

Les valeurs en production sont encore celles de la mise en place :
`ios_min_version` et `ios_latest_version` à `0.0.1`, les deux champs Android à
`null`. Tant qu'elles ne sont pas réglées, **rien de ce qui suit ne se
déclenche**. C'est un réglage de fin de déploiement, pas de code.

---

## 1. Lot 0 : le garde-fou du splash ne garde qu'à moitié

Bug connu, non corrigé, et c'est précisément le mode de défaillance contre
lequel tout le reste de ce document se protège.

`app/_layout.tsx` pose un `setTimeout` de 12 s qui remet `initialized` à vrai.
Mais la condition d'affichage du splash est :

```ts
if (!fontsLoaded || !initialized || appStatusLoading) return <Splash />;
```

Trois verrous, un seul garde-fou. Si `app_config` n'aboutit jamais,
`appStatusLoading` reste vrai pour toujours et l'écran jaune ne part pas.
C'est reproductible en coupant le réseau, et c'est documenté dans
[`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md).

En pratique `fetchAppConfig` a son propre timeout de 4 s, donc le cas est
théorique aujourd'hui. Il cesse de l'être dès qu'on ajoute une deuxième porte
réseau au démarrage, ce que fait le lot B.

**Correction** : le garde-fou libère tous les verrous qu'il connaît, y compris
la phase de mise à jour ajoutée par le lot B. Un seul point de sortie, pas
trois timeouts qui se coursent.

---

## 2. Lot A : « une nouvelle version est disponible »

### 2.1 Ce n'est pas un quatrième statut

Tentant d'ajouter `'update_available'` à `AppStatus`. À ne pas faire :
`AppStatus` pilote un `return` qui remplace toute l'app par un écran bloquant.
Le cas doux est l'exact contraire, il coexiste avec l'app.

C'est donc un **drapeau orthogonal** : `updateAvailable`, dérivé à côté du
statut, exposé par le même store, sans toucher à l'enum.

### 2.2 La logique, et où elle vit

Aujourd'hui `compareVersions` habite `app-config.ts`, qui importe
`react-native` et `expo-constants`. Conséquence directe et vérifiée trois fois
sur ce dépôt : **un module qui importe `react-native` ne se charge pas sous
`node:test`**. La comparaison de versions, le cœur logique des deux
mécanismes, n'a donc aucun test.

On extrait `src/lib/version.ts`, sans le moindre import :

```ts
compareVersions(a, b): -1 | 0 | 1
isUpdateAvailable(current, latest | null): boolean
shouldOfferUpdate(current, latest | null, dismissed: string | null): boolean
```

`app-config.ts` réexporte `compareVersions` pour ne rien casser. Le fichier
devient testable, et c'est le seul endroit où il y a une vraie décision.

Règles :

- `latest` absent ou vide, on n'offre rien. Le champ Android est `null` en
  production, il ne doit pas produire de faux positif ;
- `latest <= current`, on n'offre rien. Y compris **strictement supérieur** :
  quelqu'un sur une build interne plus récente que le store ne doit pas être
  invité à « revenir en arrière » ;
- `latest == dismissed`, on n'offre rien. Refuser une version donnée vaut pour
  cette version, pas pour les suivantes.

### 2.3 La mémoire du refus

`AsyncStorage`, clé `bp_update_dismissed`, valeur : la chaîne de version
refusée. Pas un booléen, pas une date. Une nouvelle `latest_version` invalide
mécaniquement le refus précédent, sans code d'expiration.

Même forme que `bp_blocked_pseudos` dans `state/blocked.ts` : hydratation au
boot, `try/catch` silencieux, un storage indisponible dégrade vers « pas de
refus mémorisé » et non vers un plantage.

### 2.4 La forme visible

**Tranché : le bandeau discret**, ignorable indéfiniment.Raison : `min_version` existe déjà pour les
cas où l'on veut vraiment forcer, et il est bloquant. Entre les deux, une
feuille modale qui s'impose au lancement pour une mise à jour facultative
dépense du capital d'attention pour un gain que le blocage dur couvre déjà
mieux.

Dans les deux cas :

- CTA **« Mettre à jour »** vers `openStore()`, extrait de `AppBlocker.tsx`
  pour que les deux mécanismes n'aient pas deux façons d'ouvrir le store ;
- une sortie explicite, la croix, qui écrit le refus ;
- rien à l'image quand `latest <= current`, c'est-à-dire chez presque tout le
  monde presque tout le temps.

Trois corrections venues de la recette, aucune prévue par cette spéc :

1. posé à `top: 0` avec un `paddingTop` égal à l'inset, le bandeau peignait
   son encre **derrière la barre d'état** et l'heure devenait noire sur noir.
   Il est désormais posé à `top: insets.top`, sous la barre d'état, qui garde
   son fond jaune ;
2. il s'affichait **pendant l'onboarding**. Envoyer sur le store quelqu'un qui
   vient d'installer l'app est absurde, et c'est l'endroit du tunnel où l'on
   perd déjà le plus de monde. Le bandeau est restreint aux onglets, ce qui
   écarte au passage la modale de recherche ;
3. il recouvre le logo Bento Pop en haut du fil. Assumé : il est temporaire et
   se ferme d'un geste, et décaler le contenu obligerait chaque écran à
   connaître le bandeau.

### 2.5 Le conflit de place avec le bandeau hors-ligne


`OfflineBanner` est en `position: absolute`, `top: 0`, `zIndex: 1000`, par
dessus la safe area. Un second bandeau au même endroit se ferait recouvrir.

Résolution : le bandeau de mise à jour **ne s'affiche pas hors ligne**.
Proposer d'aller sur le store sans connexion ne mène nulle part, donc la règle
n'est pas un contournement, c'est la bonne règle. On extrait un
`useIsOffline()` que les deux composants partagent, plutôt que de les coupler.

---

## 3. Lot B : appliquer la mise à jour au lancement

### 3.1 Le compromis, chiffré

Le comportement actuel ne coûte rien au démarrage et fait payer un décalage :
la correction arrive à la **deuxième** ouverture. Bloquer le démarrage sur le
réseau ferait payer une lenteur permanente à tout le monde pour un gain
occasionnel. Aucun des deux n'est bon.

La sortie tient en une phrase : **la vérification se cache derrière le boot
existant, et l'échec retombe exactement sur le comportement actuel.**

Le boot dure déjà 500 ms à 2 s (polices, session anonyme, `app_config`). On
plafonne la vérification à **1500 ms**. Dans la grande majorité des cas elle
finit à l'intérieur de ce temps déjà payé et ne coûte rien. Quand elle
dépasse, on arrête de l'attendre et l'app démarre ; la vraie promesse continue
en arrière-plan, `expo-updates` téléchargera et appliquera au prochain
démarrage à froid. Autrement dit **le chemin d'échec est le comportement
d'aujourd'hui**, pas une régression.

C'est aussi la raison de ne pas passer par `fallbackToCacheTimeout` dans
`app.json` : ce réglage impose l'attente à tous les démarrages sans distinguer
« je vérifie » de « je télécharge ».

### 3.2 La séquence

| Étape | Plafond | Échec, timeout ou refus |
|---|---|---|
| garde `__DEV__` et `Updates.isEnabled` | aucun | on ne fait rien |
| `checkForUpdateAsync()` | 1500 ms | on laisse démarrer |
| `isAvailable === false` | aucun | on laisse démarrer, **rien à l'écran** |
| `fetchUpdateAsync()` | 8000 ms | on laisse démarrer |
| `isNew === false` | aucun | on laisse démarrer |
| `reloadAsync()` | aucun | on laisse démarrer |

Total borné à 9,5 s dans le pire cas, et ce pire cas suppose qu'une mise à
jour existe vraiment. Sans mise à jour, le plafond est 1500 ms, très
majoritairement absorbé par le boot.

Deux points qui se ratent facilement :

- **l'écran de mise à jour n'apparaît qu'à l'étape de téléchargement**, jamais
  pendant la vérification. Sinon chaque lancement montrerait un état
  « mise à jour » qui n'aboutit à rien neuf fois sur dix ;
- **un `fetchUpdateAsync` qui dépasse son délai ne doit surtout pas mener à
  `reloadAsync`.** Recharger sur un téléchargement partiel, c'est le seul
  chemin de ce document qui produit une app cassée sans recours.

### 3.3 Rendre la séquence testable

`expo-updates` est un module natif, intestable sous `node:test` pour la même
raison que `react-native`. On écrit donc `src/lib/ota.ts` **sans aucun
import**, avec les trois fonctions injectées :

```ts
type OtaDeps = {
  enabled: boolean;
  check: () => Promise<{ isAvailable: boolean }>;
  fetch: () => Promise<{ isNew: boolean }>;
  reload: () => Promise<void>;
  onPhase: (p: 'checking' | 'downloading') => void;
};

runStartupUpdate(deps, timeouts): Promise<'skipped' | 'none' | 'timeout' | 'failed' | 'reloading'>
```

Le câblage réel (`import * as Updates from 'expo-updates'`) tient en dix
lignes dans `src/lib/ota-runtime.ts`, la seule partie non couverte, et elle ne
contient aucune décision.

Cas à couvrir, tous des tests unitaires :

1. désactivé, on sort sans appeler quoi que ce soit ;
2. pas de mise à jour, `onPhase('downloading')` **jamais appelé** ;
3. vérification qui dépasse le délai, `fetch` jamais appelé ;
4. vérification qui rejette, même chose ;
5. téléchargement qui dépasse le délai, **`reload` jamais appelé** ;
6. téléchargement qui rejette, `reload` jamais appelé ;
7. `isNew === false`, `reload` jamais appelé ;
8. chemin nominal, `reload` appelé une fois ;
9. `reload` qui rejette, la fonction rend la main sans lever.

Les cas 5 et 6 sont ceux qui comptent. Les autres protègent contre la
lenteur, ceux-là contre une app cassée.

### 3.4 L'écran

`Splash` prend une légende optionnelle. Même logo, même Popy qui flotte, une
ligne de texte en dessous. Zéro nouvel écran à dessiner, zéro incohérence
possible avec le splash natif qui le précède, et la continuité visuelle est
justement ce qu'on veut pendant un rechargement.

Pas de barre de progression : `fetchUpdateAsync` ne rapporte pas d'avancement.
Une fausse barre serait un mensonge.

---

## 4. Recette

### 4.1 Faite au simulateur, le 13 septembre 2026

iPhone 17 Pro, build de développement en 0.2.0 pointant sur le Supabase de
production, en bougeant `ios_latest_version` puis en restaurant.

| Cas | Attendu | Résultat |
|---|---|---|
| `latest` 0.0.1 ≤ 0.2.0 | rien | rien |
| `latest` 0.3.0 | bandeau | bandeau |
| pendant l'onboarding | rien | rien, après correction |
| croix, puis relancement | rien, refus mémorisé | rien, `dismissed = 0.3.0` |
| `latest` 0.4.0 après refus de 0.3.0 | bandeau | bandeau |
| hors ligne, mise à jour dispo | bandeau hors-ligne seul | bandeau hors-ligne seul |
| `min_version` 0.9.0 | écran bloquant | écran bloquant, pas de régression |
| lot B en développement | `skipped`, démarrage normal | `skipped` |

Le dernier point ferme la garde `__DEV__` / `isEnabled` : elle sort avant le
moindre appel réseau, donc aucun écran de mise à jour ne peut apparaître en
développement.

L'état de production a été rendu tel quel : `ios_min_version` et
`ios_latest_version` à `0.0.1`, les champs Android à `null`, 69 profils,
55 bentos, 276 items, 4 entrées au registre de suppression. Le compte de
recette a été supprimé côté profil **puis** côté auth, dans cet ordre.

### 4.2 Reste à faire, sur build de production

Le lot B **ne se recette pas au simulateur** : `Updates.isEnabled` est faux en
développement, ce qui vient d'être vérifié. Il se recette sur la build de
production, en publiant une mise à jour à distance sur la branche
`production` après installation.

Les deux cas réseau à ne pas sauter, parce que c'est là que l'app peut rester
bloquée :

- **avion** : l'app doit démarrer normalement, aucune légende de mise à jour ;
- **réseau très lent** : l'app doit démarrer au bout des 1500 ms, sans
  attendre.

Le proxy `readonly-proxy.mjs` et son mode `FAIL=` couvrent le premier ; le
second demande le conditionneur réseau du simulateur, ou un vrai mauvais
réseau.

---

## 5. Définition de terminé

- [x] `version.ts` sans import, 9 tests unitaires
- [x] `ota.ts` sans import, 11 tests, les deux cas de téléchargement raté en tête
- [x] le garde-fou du root layout libère les trois verrous
- [x] aucune légende de mise à jour quand il n'y a pas de mise à jour
- [x] aucun `reloadAsync` sur un téléchargement incomplet
- [x] le refus est mémorisé par version, une version plus récente le rejoue
- [x] rien ne s'affiche hors ligne
- [x] pas de régression sur le blocage dur `min_version`
- [x] `pnpm test` (166), `pnpm lint`, `pnpm typecheck` verts
- [ ] **recette avion et recette réseau lent, sur build de production**
- [ ] **`app_config` réglé après déploiement**, sans quoi tout ceci dort
