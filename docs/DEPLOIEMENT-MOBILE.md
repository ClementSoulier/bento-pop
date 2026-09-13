# Déploiement de l'app mobile

> Comment envoyer une version aux stores sans repasser par App Store Connect
> ni le Play Console à la main. Écrit le 13 septembre 2026, alors que les
> envois se faisaient encore entièrement à la main.

---

## 1. Où en est l'automatisation

| Étape | Avant | Maintenant |
|---|---|---|
| Construire l'app | EAS Build | inchangé |
| Numéroter la build | EAS, automatique | inchangé |
| Envoyer au store | **à la main, deux consoles** | `eas submit` |
| Déclencher l'envoi | à la main | à la main, une commande |
| Modification purement JS | build + revue | **rien encore**, cf. §6 |

La numérotation était déjà bien réglée avant ce document, et c'est ce que les
gens ratent le plus souvent : `appVersionSource: remote` avec
`autoIncrement`. EAS tient le compteur de builds côté serveur, personne ne
touche jamais à `buildNumber` ni à `versionCode`, et deux machines
différentes ne peuvent pas produire le même numéro.

---

## 2. Ce qu'il faut avoir déposé une fois

Ces deux clés ne vivent **pas dans le dépôt**. Elles sont déposées chez EAS,
qui les utilise pour toi. `.gitignore` bloque les extensions correspondantes,
mais c'est un filet, pas le plan.

### 2.1 Clé d'API App Store Connect

Bien meilleure qu'un identifiant Apple avec mot de passe d'application : pas
de double authentification à retaper, et elle fonctionne depuis une machine
de CI.

1. App Store Connect → **Utilisateurs et accès** → **Intégrations** → **Clés**
2. Créer une clé avec le rôle **App Manager**
3. Télécharger le `.p8`. **Il n'est téléchargeable qu'une fois.**
4. Noter le *Key ID* et l'*Issuer ID* affichés à côté

Puis la déposer chez EAS :

```bash
cd apps/mobile
npx eas-cli credentials --platform ios
```

Le menu propose quatre entrées ; celle qui nous intéresse est
**« App Store Connect: Manage your API Key »**, et non « Build Credentials »,
qui concerne la signature de la build et non l'envoi. Puis choisir d'ajouter
une clé et coller le *Key ID*, l'*Issuer ID* et le chemin du `.p8`.

### 2.2 Compte de service Google

1. Play Console → **Configuration** → **Accès à l'API** → lier un projet Google
   Cloud, puis créer un compte de service
2. Dans Google Cloud, créer une **clé JSON** pour ce compte
3. Revenir au Play Console → **Utilisateurs et autorisations**, inviter le
   compte de service et lui donner **Release manager** sur l'application

```bash
cd apps/mobile
npx eas-cli credentials --platform android
```

Choisir **« Google Service Account »**, puis la gestion de la clé utilisée
pour l'envoi (« used for Play Store submissions »), et donner le chemin du
JSON téléchargé.

**Le rôle compte.** « Release manager » suffit et ne donne pas accès aux
finances ni aux données utilisateurs. Ne pas prendre « Admin » par facilité.

---

## 3. Livrer une version

```bash
cd apps/mobile
pnpm release          # construit les deux plateformes ET envoie
```

C'est tout. La commande enchaîne `eas build --platform all --profile
production --auto-submit`.

Pour découpler, quand on veut regarder la build avant de l'envoyer :

```bash
pnpm build:prod       # construit seulement
pnpm submit:prod      # envoie la dernière build terminée
```

### Où atterrit la version

**iOS** : dans TestFlight. Le passage en revue pour l'App Store reste un
geste manuel dans App Store Connect, et c'est voulu : c'est le dernier point
où l'on relit la fiche avant publication.

**Android** : sur le canal **interne**, immédiatement, sans revue. On y teste,
puis on promeut vers la production depuis le Play Console.

Pour viser directement la production Android, il existe un second profil qui
dépose en **brouillon**, donc sans publier :

```bash
npx eas-cli submit --platform android --profile store --latest
```

Le brouillon est délibéré : on ne veut pas qu'une commande mal tapée mette
quelque chose en ligne.

---

## 4. Ce qu'il faut savoir avant d'appuyer

**Un module natif impose une build.** Ajouter une dépendance qui contient du
code natif, `expo-haptics` par exemple, rend toute mise à jour à distance
inopérante : il faut passer par les stores et leur revue.

**La version de l'app se change à la main** dans `app.json`, champ `version`.
Seul le numéro de build est automatique. Et comme `runtimeVersion` suit la
politique `appVersion`, changer la version **coupe** les mises à jour à
distance destinées à l'ancienne : c'est le comportement voulu, mais il faut
le savoir avant de bump.

**Vérifier ce qui va partir** :

```bash
pnpm store:versions   # numéros de build courants, iOS et Android
```

---

## 5. La recette avant envoi

Une build de production ne se comporte pas comme un `expo run`. Ce qui change,
et qui s'est déjà vu :

- LogBox n'existe pas : un `console.error` ne se voit plus à l'écran ;
- les performances diffèrent, la mesure de fluidité du chantier 2 n'a de sens
  que sur une build de production ;
- l'haptique ne se restitue ni sur simulateur ni sur émulateur.

Le mode d'emploi de la recette et ses pièges sont dans
[`RECETTE-MOBILE.md`](./RECETTE-MOBILE.md).

---

## 6. Les mises à jour à distance

Tout est en place et vérifié sur la configuration résolue : `expo-updates` en
dépendance, `updates.url` renseignée, canal `production` mappé sur la branche
`production`, et `runtimeVersion` en politique `appVersion`. **Aucune mise à
jour n'a encore été publiée.**

```bash
npx eas-cli update --branch production --message "…"
```

### 6.1 Ce que ça permet, et ce que ça ne permet pas

| Type de changement | Mise à jour à distance |
|---|---|
| Libellé, couleur, mise en page, logique JavaScript | **oui**, en minutes |
| Requête, règle d'affichage, correctif de bug JS | **oui** |
| Nouvelle dépendance native (`expo-haptics`…) | **non**, build obligatoire |
| Icône, écran de démarrage, permissions, plugins | **non**, ce sont des réglages natifs |
| Changement de `version` | **non**, cela crée une nouvelle `runtimeVersion` |

### 6.2 Le délai réel : la mise à jour s'applique au lancement **suivant**

L'app n'appelle `expo-updates` nulle part dans son code : on est donc sur le
comportement par défaut, avec `fallbackToCacheTimeout` à 0. Concrètement :

1. l'app démarre **immédiatement** avec le bundle qu'elle a déjà, sans
   attendre le réseau ;
2. elle vérifie en arrière-plan s'il existe une mise à jour, et la télécharge ;
3. la mise à jour s'applique au **prochain démarrage à froid**.

Donc quelqu'un qui a l'app ouverte voit le correctif à sa deuxième ouverture
après publication, pas à la première. C'est le compromis par défaut, et c'est
le bon : bloquer le démarrage sur un appel réseau ferait payer à tout le monde
une lenteur permanente pour un gain occasionnel.

Si un jour on veut l'appliquer tout de suite, il faudra du code, un
`Updates.checkForUpdateAsync` suivi d'un `reloadAsync`, avec le rechargement
visible que ça implique. À ne faire que si le besoin se présente vraiment.

### 6.3 La discipline à tenir, et le piège

**Bump `version` dans `app.json` dès que le natif change.** C'est la seule
règle à ne jamais oublier, et elle n'est protégée par rien.

`runtimeVersion` suit la version. Si on ajoute une dépendance native sans
changer la version, une mise à jour à distance partirait vers des binaires
qui ne contiennent pas ce module natif : l'app plante à l'ouverture, chez tout
le monde, sans possibilité de correctif par le même canal. Avec le bump, les
anciens binaires ne voient simplement pas la mise à jour, ce qui est le
comportement voulu.

Deux réserves de fond :

- **Apple tolère** les mises à jour à distance pour des correctifs et du
  contenu, pas pour changer la nature de l'app. La règle est floue mais
  réelle ;
- une mise à jour à distance **ne passe par aucune revue, ni par la nôtre**.
  Il faut une discipline au moins égale à celle d'une livraison de store,
  sans quoi c'est le meilleur moyen de casser la production un vendredi soir.

---

## 7. Suite prévue

**Déclencher depuis un tag.** `git tag v0.2.0 && git push --tags` lance la
build et l'envoi. Demande un `EXPO_TOKEN` en secret GitHub, à créer depuis
expo.dev → Account settings → Access tokens. Non fait à ce jour.

**Fiche de store versionnée** (`eas metadata`). Descriptions, mots-clés et
captures décrits dans un fichier plutôt que saisis dans deux consoles.
Intéressant le jour où la fiche bougera souvent ; inutile avant.
