# Recette de l'app mobile sur simulateur

> Mode d'emploi pour faire tourner `apps/mobile` sur simulateur iOS et
> émulateur Android, avec de vraies données de production et sans rien y
> écrire, sauf l'exception arbitrée d'un compte de recette (§1). Écrit après
> la recette du chantier 2, où la moitié du temps est partie dans les pièges
> listés en §4 plutôt que dans la recette elle-même.

---

## 1. Le principe

L'app pointe sur un proxy local qui relaie les lectures vers Supabase et
bloque tout le reste. On obtient les vraies données, le vrai rendu, les vraies
images, sans compte anonyme créé ni écriture possible.

**Jamais une build pointée sur la production.** Sans session, l'app appelle
`signInAnonymously` dès son lancement : une build pointée sur la production y
crée un compte anonyme avant qu'on ait pu vérifier sa cible. D'où l'ordre :
compiler sans lancer, vérifier la cible compilée (§4, « L'URL Supabase est
compilée dans l'app »), fermer l'app partout, puis lancer Metro, installer et
lancer. `expo run:ios` et `expo run:android` lancent l'app sitôt compilée : ils
ne conviennent que si les variables visent le proxy sans doute possible.

```bash
# iOS, depuis apps/mobile/ios
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 EXPO_PUBLIC_SUPABASE_ANON_KEY=recette \
  xcodebuild -workspace MonBentoPop.xcworkspace -scheme MonBentoPop \
  -configuration Debug -sdk iphonesimulator -destination 'id=<UDID>' build

# Android, depuis apps/mobile
export EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 EXPO_PUBLIC_SUPABASE_ANON_KEY=recette
CI=1 npx expo prebuild --platform android --no-install
(cd android && ./gradlew :app:assembleDebug --console=plain)

# Metro, avec les mêmes variables
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 EXPO_PUBLIC_SUPABASE_ANON_KEY=recette \
  npx expo start --dev-client --port 8081
```

Sont relayés : tous les `GET`, et les `POST` vers les fonctions RPC de la liste
blanche (`search_items`, `find_similar_items`, `popular_items`, et depuis le
chantier 7 `search_bentos` et `shared_items`, celles de « Trouver »), qui sont
`stable` en SQL donc en lecture. Tout le reste répond 405, et chaque refus
s'écrit au journal du proxy. Pour une recette qui a besoin d'une autre
fonction :

```bash
RPC_ALLOW=search_items,ma_fonction TARGET=… KEY=… node …/readonly-proxy.mjs
```

### Recetter un écran qui écrit, sans écrire

Sans session, `useSession().user` reste nul et **tous les gestionnaires
d'écriture sortent immédiatement** : le tap ne fait rien, et on ne voit ni
l'écriture optimiste, ni son retour arrière, ni le toast d'erreur.

`FAKE_AUTH=1` fait répondre à `/auth/*` une session synthétique au lieu d'un
503. L'app se croit connectée, et la première écriture se heurte au 405 du
proxy :

```bash
FAKE_AUTH=1 TARGET=… KEY=… node apps/mobile/scripts/readonly-proxy.mjs
```

On exerce ainsi tout le chemin d'écriture **sauf le succès**, sans créer le
moindre compte anonyme en production. Le chemin nominal, lui, demande une
vraie session : c'est la seule partie qui reste à recetter à la main.

```bash
# 1. le proxy, dans un terminal à part
set -a && . apps/landing/.env && set +a
TARGET="$NEXT_PUBLIC_MOBILE_SUPABASE_URL" KEY="$MOBILE_SUPABASE_ANON_KEY" \
  node apps/mobile/scripts/readonly-proxy.mjs

# 2. l'app
cd apps/mobile
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=recette \
  npx expo run:ios --device "iPhone 17"
```

Les identifiants viennent de `apps/landing/.env`, qui porte déjà la clé
anonyme du projet mobile pour la page publique.

### Recetter un parcours qui publie : l'exception, arbitrée à chaque fois

Publier son bento et arriver sur sa page, ou ouvrir sa propre page sans bento,
ne se recette qu'avec un vrai compte qui écrit. Au chantier 7, lot 4, c'est
fait **en production**, sur arbitrage explicite, par
`apps/mobile/scripts/recette-write-proxy.mjs`, qui prend la place du proxy de
lecture sur le port 8098 : les apps compilées gardent leur cible.

Ses garde-fous, éprouvés au `curl` avant tout lancement, sans rien créer : une
seule inscription, et 503 aux suivantes ; les écritures du seul compte de
recette, reconnu au jeton, et 405 à toute autre ; quatre routes
d'authentification ; un fichier coupe-circuit qui gèle tout ; un journal où
chaque écriture est marquée. Il retarde aussi à la demande la lecture de la
page, pour le réseau ralenti.

```bash
cd apps/mobile && set -a && . ./.env && set +a
TARGET="$EXPO_PUBLIC_SUPABASE_URL" KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
READONLY_FLAG=/tmp/recette-coupe-circuit DELAY_FILE=/tmp/recette-retard \
  node scripts/recette-write-proxy.mjs
```

L'ordre, qui compte :

1. arrêter l'app sur **tous** les appareils, et ne garder qu'un appareil
   allumé avec elle : n'importe quelle app qui démarre sans session s'inscrit,
   et prendrait la place du compte de recette ;
2. retirer de cet appareil la session `sb-127-auth-token` d'une recette
   `FAKE_AUTH` (§4) ;
3. choisir un pseudo sans `a q z w m` si on le tape par `idb` (§4), et vérifier
   par une lecture qu'il est libre et hors des motifs bloqués ;
4. remplir les cases **par les suggestions** du catalogue, jamais par
   « Proposer », qui créerait un item ;
5. garder le bento publié le moins longtemps possible : il apparaît en tête du
   fil de tout le monde. 2 min 21 s au chantier 7 ;
6. supprimer le compte dans l'app, « Supprimer mon compte », poser le
   coupe-circuit, arrêter le proxy, puis relire avec la clé anonyme que profil,
   bento et cases ont disparu ;
7. supprimer enfin le compte d'authentification anonyme, que l'app laisse
   orphelin, au tableau de bord Supabase : profil **puis** authentification.

---

## 2. iOS

```bash
xcrun simctl list devices available | grep iPhone     # choisir un appareil
npx expo run:ios --device "iPhone 17"
xcrun simctl io <UDID> screenshot --type=png /tmp/s.png
```

`idb` est installé et permet les gestes, ce que `simctl` ne fait pas :

```bash
idb ui tap   --udid <UDID> <x> <y>                    # en points, pas en pixels
idb ui swipe --udid <UDID> --duration 0.25 200 700 200 180
```

**Liens profonds.** Le groupe de routes n'apparaît pas dans l'URL :
`bentopop:///table`, pas `bentopop:///(tabs)/table`. iOS ouvre une boîte de
confirmation « Ouvrir dans Mon Bento Pop ? » qu'il faut taper une fois. Sur un
iPhone 17, le bouton est autour de (274, 474).

---

## 3. Android

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

$ANDROID_HOME/emulator/emulator -list-avds
$ANDROID_HOME/emulator/emulator -avd Pixel_8 -no-snapshot-load &
adb wait-for-device
adb reverse tcp:8098 tcp:8098      # sans ça l'émulateur ne voit pas le proxy
npx expo run:android --device Pixel_8
```

`--device` attend le **nom de l'AVD**, pas le numéro de série adb :
`Pixel_8` et non `emulator-5554`.

Gestes et captures :

```bash
adb shell input swipe 540 1900 540 400 150            # en pixels
adb shell input tap <x> <y>
adb shell screencap -p /sdcard/s.png && adb pull /sdcard/s.png /tmp/s.png
adb shell "am start -a android.intent.action.VIEW -d 'bentopop:///table' com.bentopop.mobile"
```

**Mesurer la fluidité**, ce que le simulateur iOS ne permet pas :

```bash
adb shell dumpsys gfxinfo com.bentopop.mobile reset
# ... défiler ...
adb shell dumpsys gfxinfo com.bentopop.mobile | grep -A 8 "Total frames"
```

Toujours prendre un témoin sur le même appareil, par exemple l'application
Réglages, sinon le chiffre ne veut rien dire : un émulateur saccade de base.

---

## 4. Les pièges, tous rencontrés pour de vrai

### Metro sert un bundle périmé, et `watchman` n'est pas installé

Le rechargement à chaud rate des fichiers. On peut passer une heure à
« corriger » du code qui n'a jamais tourné.

**Toujours vérifier ce que Metro sert réellement** avant de conclure quoi que
ce soit sur un rendu :

```bash
curl -s "http://localhost:8081/apps/mobile/index.bundle?platform=ios&dev=true" -o /tmp/b.js
node -e "const b=require('fs').readFileSync('/tmp/b.js','utf8');
         console.log(b.match(/H_PADDING\s*=\s*(\d+)/)?.[1]);"
```

Et en cas de doute, `npx expo start --clear`, ou un build `--configuration
Release` (iOS) qui embarque le bundle et ne dépend plus de Metro.

### Mesurer les captures, ne pas les regarder

Une marge, un écart, une largeur : ça se mesure au pixel, ça ne s'estime pas à
l'œil sur une image réduite. Le profil d'une ligne horizontale suffit :

```js
const nom = ([r,g,b]) =>
  (r>215 && g>150 && g<215 && b<90) ? 'FOND'
  : (r>240 && g>230 && b>200)       ? 'creme'
  : (r<40 && g<40 && b<40)          ? 'ink' : 'autre';
```

Corollaire : **regarder aussi le reste de l'image**. Un bandeau d'erreur en bas
d'une capture passe inaperçu quand on ne cherche qu'une marge à gauche.

### Le bandeau blanc à pastille rouge en bas d'écran

C'est LogBox, l'overlay d'erreur du mode développement. `AppContainer.js`
choisit entre `AppContainer-dev` et `AppContainer-prod` selon `__DEV__` : il
n'existe pas en production. Pour lire le message, taper dessus. Pour vérifier
qu'il s'agit bien de lui, poser un `console.error` volontaire et comparer.

### Couper tout le réseau bloquait l'app sur le splash

**Corrigé le 13 septembre 2026.** Le garde-fou de 12 s du root layout ne
remettait que `initialized`, pas `appStatusLoading` : si `app_config`
n'aboutissait jamais, l'écran jaune ne partait pas. Il libère désormais les
trois verrous, y compris la phase de mise à jour à distance ajoutée en même
temps. La note reste ici parce que le mode de défaillance, lui, reste le bon
premier soupçon devant un splash qui ne part pas.

Pour atteindre l'état d'erreur d'un écran, faire échouer **une seule** route :

```bash
FAIL=/rest/v1/bentos TARGET=... KEY=... node apps/mobile/scripts/readonly-proxy.mjs
# ou, pour un écran qui tape une RPC :
FAIL=/rest/v1/rpc/popular_items TARGET=... KEY=... node apps/mobile/scripts/readonly-proxy.mjs
```

Avec `FAIL`, qui répond 500, compter environ trois secondes de squelette avant
l'erreur : React Query retente deux fois, et `postgrest-js` ne réessaie pas un
500. **Ce chiffre ne vaut que pour `FAIL`.** Une vraie panne réseau, un 503 ou
un 520 déclenchent en plus, sous chaque tentative, trois réessais cachés de
`postgrest-js` après 1, 2 puis 4 s : environ 24 s calculées avant l'erreur d'un
écran resté à la politique globale, et 10 à 12 s mesurées sur la page bento
publique, qui les coupe (chantier 7).

### « Search failed: undefined », ou une RPC qui ne répond pas en recette

PostgREST expose les fonctions SQL en `POST`, pas en `GET`. Une fonction absente
de `RPC_ALLOW` répond donc 405 et l'écran affiche une erreur réseau, alors que
la base va très bien. Le journal du proxy le dit : chaque ligne porte désormais
la méthode et le poids de la réponse, et chaque refus sa propre ligne.

```
200 POST /rest/v1/rpc/search_items 245o
405 POST /rest/v1/rpc/ma_fonction refusé
```

Jusqu'au chantier 7, les refus ne s'écrivaient pas : la recherche de
« Trouver », par `search_bentos`, restait vide en recette sans aucune trace au
journal. Ses deux fonctions sont désormais dans la liste par défaut.

C'est aussi le moyen de **mesurer l'egress d'un parcours** : additionner la
colonne de droite sur la durée de la recette.

### Un bandeau LogBox après un échec d'écriture, c'est voulu

`search-modal.tsx` journalise les échecs d'écriture avec `console.warn`, ce
qui déclenche l'encadré jaune de LogBox en développement. C'est le bon signal
pour un développeur, mais il ressemble au bandeau blanc à pastille décrit plus
bas : avant de partir en chasse, vérifier si une écriture vient d'échouer,
notamment derrière le proxy où elles échouent toutes.

### L'URL Supabase est **compilée dans l'app**, pas servie par Metro

C'est le piège le plus coûteux rencontré jusqu'ici, et il ne se voit nulle
part dans le code de l'écran.

`app.config.ts` recopie `process.env.EXPO_PUBLIC_SUPABASE_URL` dans
`extra.SUPABASE_URL`, et `src/supabase/client.ts` lit
`Constants.expoConfig?.extra?.[key]` **avant** `process.env[key]`. Or
`app.config.ts` est évalué par `expo run:ios` au moment de la **compilation**,
et son résultat est figé dans `MonBentoPop.app/EXConstants.bundle/app.config`.

Conséquences, toutes vérifiées :

- relancer Metro avec d'autres variables ne change **rien** à la cible de
  l'app ;
- le bundle servi par Metro contient bien la nouvelle URL, mais seulement
  dans le shim `process.env`, qui n'est jamais atteint puisque `extra` gagne.
  **Vérifier le bundle ne prouve donc rien** ;
- changer de cible impose une **reconstruction**.

Le seul contrôle qui fait foi :

```bash
APP=$(find ~/Library/Developer/Xcode/DerivedData/MonBentoPop-* -name "*.app" -type d | grep simulator | head -1)
strings "$APP/EXConstants.bundle/app.config" | grep -o "127.0.0.1:8098\|ggjgktbcqumfxrixcdyx"
```

Le même contrôle sur l'app **installée**, qui peut venir d'une autre
compilation, et sur Android, où la configuration est dans l'APK :

```bash
D=$(xcrun simctl get_app_container <UDID> com.bentopop.mobile app)
strings "$D/EXConstants.bundle/app.config" | grep -o "127.0.0.1:8098\|ggjgktbcqumfxrixcdyx"

unzip -p apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk assets/app.config \
  | grep -o "127.0.0.1:8098\|ggjgktbcqumfxrixcdyx"
adb pull "$(adb shell pm path com.bentopop.mobile | head -1 | tr -d '\r' | sed 's/^package://')" /tmp/installe.apk
unzip -p /tmp/installe.apk assets/app.config | grep -o "127.0.0.1:8098\|ggjgktbcqumfxrixcdyx"
```

Second contrôle, côté données cette fois : la clé de session dans
AsyncStorage porte la référence du projet.

```bash
D=$(xcrun simctl get_app_container <UDID> com.bentopop.mobile data)
cat "$D/Library/Application Support/com.bentopop.mobile/RCTAsyncLocalStorage_V1/manifest.json"
# sb-<ref>-auth-token  → la référence dit sur quel projet l'app est branchée
```

Vécu : une session de recette entière passée à croire que l'app tapait le
proxy alors qu'elle écrivait en production, en s'appuyant sur le contrôle du
bundle, qui est insuffisant.

### `expo run:ios` ne relance pas Metro

`pkill -f "expo start"` ne suffit pas, le processus s'appelle
`expo/bin/cli run:ios` et garde le port 8081. Une nouvelle `expo run:ios`
affiche alors « Skipping dev server » et se raccroche à l'instance existante.

```bash
lsof -ti :8081 | xargs -I{} ps -o command= -p {}
pkill -f "expo/bin/cli"
```

### `idb ui text` tape sur le clavier matériel, avec la mauvaise disposition

Les lettres passent, mais les chiffres et la ponctuation sortent faux :
`recette_ux03` est devenu `recette)uxà »`. Et les caractères parasites se
retrouvent **après** le curseur, donc les retours arrière ne les effacent pas.

Pour saisir un texte fiable : n'utiliser que des lettres hors `a q z w m`, ou
passer par l'interface (les puces de suggestion du champ pseudo remplissent le
champ sans clavier). Et dans tous les cas, **relire la capture** avant de
valider : l'écran affichait bien « Invalide ».

### `idb ui text` fait disparaître le clavier logiciel

`idb ui text` tape via le **clavier matériel**, ce qui le « connecte » pour le
reste de la session de démarrage du simulateur : le clavier logiciel ne
remonte plus, même sur un écran qui a bien un `autoFocus`. On croit alors à une
régression de l'app.

Symptôme : le curseur clignote dans le champ mais aucun clavier n'est affiché.
Remède : `xcrun simctl shutdown <UDID>` puis `boot`, et prendre la capture du
clavier **avant** toute frappe via `idb`. Pour saisir du texte sans perdre le
clavier logiciel, taper les touches une par une avec `idb ui tap` sur les
coordonnées du clavier.

### Installer une build déjà compilée sur un second simulateur

Inutile de recompiler pour comparer deux tailles d'écran. Le `.app` vit dans
DerivedData :

```bash
APP=$(find ~/Library/Developer/Xcode/DerivedData/MonBentoPop-* -name "*.app" -type d | grep simulator | head -1)
xcrun simctl boot "iPhone SE (3rd generation)"
xcrun simctl install <UDID> "$APP" && xcrun simctl launch <UDID> com.bentopop.mobile
```

Vérifier ensuite dans le journal du proxy que le second appareil passe bien par
lui, et pas directement en production.

### `INSTALL_FAILED_VERSION_DOWNGRADE` sur Android

Une build plus récente occupe déjà l'émulateur. `adb uninstall
com.bentopop.mobile` avant d'installer, en sachant que les données locales de
cette build partent avec.

### Un module natif impose un rebuild

`expo-image`, `expo-haptics` et consorts ne se chargent pas par rechargement à
chaud. Le projet est en génération native continue : ni `ios/` ni `android/`
n'est versionné, `expo run:*` les régénère. Les deux dossiers sont ignorés par
git (`apps/mobile/.gitignore`) : les garder d'une recette à l'autre évite une
compilation native, les supprimer force une génération propre.

### Une session périmée et `/auth` en 503 figent tout le client principal

Rencontré au chantier 7, puis mesuré. Une recette avec `FAKE_AUTH=1` laisse
dans l'app une session factice d'une heure. Relancée plus tard sans
`FAKE_AUTH`, l'app trouve cette session périmée et veut la renouveler ; le
proxy répond 503, `auth-js` réessaie en tenant sa file d'attente, et **toutes
les requêtes du client principal attendent**, lectures comprises.

Mesuré sur l'émulateur : des boucles de 8 tentatives sur 25,5 s, enchaînées
sans pause. Au lancement, la lecture de session attend le délai de 8 s de
`session.init`, l'inscription anonyme qui suit est refusée, et l'app s'ouvre
sans session sur l'accueil. Chaque lecture du client principal attend ensuite
la boucle en cours, alors que le proxy relaie normalement ce qu'il reçoit.
LogBox affiche une « Console Error » sans message, levée par
`_recoverAndRefresh` dans `GoTrueClient.js`.

La page bento publique n'y est plus sensible, elle lit par un client sans
session (`UX-07-PAGE-BENTO-PUBLIQUE-MOBILE.md` §6.4). Pour le reste, relancer
le proxy avec `FAKE_AUTH=1`, qui répond au renouvellement, ou retirer la
session factice, app arrêtée. Vérifier d'abord que la clé porte le compte
factice `00000000-0000-4000-8000-0000000000fa` : une clé `sb-<ref>-auth-token`
d'un autre projet est une vraie session.

```bash
# iOS : la clé sb-127-auth-token du manifest.json d'AsyncStorage
xcrun simctl terminate <UDID> com.bentopop.mobile
D=$(xcrun simctl get_app_container <UDID> com.bentopop.mobile data)
M="$D/Library/Application Support/com.bentopop.mobile/RCTAsyncLocalStorage_V1/manifest.json"
python3 -c "import json; print(json.load(open('$M')).get('sb-127-auth-token'))"
python3 -c "import json; m = json.load(open('$M')); m.pop('sb-127-auth-token'); json.dump(m, open('$M', 'w'))"

# Android : la ligne du même nom dans la base RKStorage
adb shell am force-stop com.bentopop.mobile
adb exec-out run-as com.bentopop.mobile cat databases/RKStorage > /tmp/RKStorage
sqlite3 /tmp/RKStorage "select value from catalystLocalStorage where key = 'sb-127-auth-token'"
sqlite3 /tmp/RKStorage "delete from catalystLocalStorage where key = 'sb-127-auth-token'"
adb push /tmp/RKStorage /data/local/tmp/RKStorage.bentopop
adb shell chmod 644 /data/local/tmp/RKStorage.bentopop
adb shell run-as com.bentopop.mobile cp /data/local/tmp/RKStorage.bentopop databases/RKStorage
adb shell rm /data/local/tmp/RKStorage.bentopop
```

Pour reproduire la panne exprès, le chantier 7 a servi une session factice de
30 s, déjà périmée pour `auth-js` qui renouvelle 90 s avant l'expiration, et un
503 sur `grant_type=refresh_token`, dans une copie du proxy.

### Une app restée ouverte se raccroche au nouveau Metro

Un dev client resté ouvert sur un simulateur ou un émulateur se reconnecte
seul au Metro qu'on démarre, et exécute aussitôt le bundle avec la cible pour
laquelle il a été compilé. Fermer l'app sur tous les appareils allumés **avant** de lancer Metro :

```bash
xcrun simctl terminate <UDID> com.bentopop.mobile
adb shell am force-stop com.bentopop.mobile
```

### Suspendre le proxy : viser le processus qui écoute

Pour simuler un réseau qui accepte les connexions sans jamais répondre, on
suspend le proxy. `pgrep -f readonly-proxy.mjs | head -1` désigne souvent le
shell parent, dont la ligne de commande contient aussi le nom du script : le
proxy continue alors de répondre. Viser le processus qui écoute le port, et
vérifier son état :

```bash
P=$(lsof -nP -iTCP:8098 -sTCP:LISTEN -t)
kill -STOP $P && ps -o stat= -p $P    # T : suspendu
kill -CONT $P
```

### `adb reverse` passe outre le mode hors ligne de l'émulateur

`adb shell svc wifi disable` et `svc data disable` coupent le réseau de
l'émulateur : NetInfo dit hors ligne, et l'app montre ses états hors ligne.
Mais les connexions redirigées par `adb reverse` passent toujours, et le proxy
continue de répondre. Pour un réseau qui ne répond pas, suspendre le proxy.

**Pour l'état hors ligne aussi.** Au chantier 7, lot 4, la page publique
ouverte réseau coupé s'est remplie : sa requête est passée par `adb reverse`
avant que NetInfo ne signale la coupure, et une réponse arrivée l'emporte sur
l'état hors ligne. L'essai n'éprouvait rien. Couper le réseau, suspendre le
proxy, attendre le bandeau « Pas de connexion », puis seulement ouvrir la page.

### `adb reverse` saute quand on change la navigation système

Après `cmd overlay enable …navbar.threebutton`, l'app relancée affichait
« Unable to load script » : `adb reverse --list` montrait toujours les
redirections, mais plus rien ne passait. Les recréer suffit :

```bash
adb reverse --remove-all && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8098 tcp:8098
```

### Une tablette en paysage ouvre l'app en boîte aux lettres

L'app est verrouillée en portrait. Sur l'AVD `Pixel_Tablet`, en paysage, elle
tourne dans une fenêtre de 600 × 800 dp au milieu de l'écran, et une bulle
d'aide du système, « See and do more », la recouvre au premier lancement :
toucher « Got it », qui n'est pas dans l'arbre de `uiautomator`, au centre
bas de la bulle. Les coordonnées de balayage doivent tomber dans la fenêtre,
et les captures se recadrent sur elle. Pour la voir en plein écran portrait :

```bash
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1      # 0 et accelerometer_rotation 1 pour revenir
```

### Voir ce qui s'affiche entre deux captures : enregistrer l'écran

Un squelette de 50 ms, ou un ancien item le temps d'un rendu, passent entre
deux captures. L'enregistrement du simulateur n'écrit une image que quand
l'écran change, donc toutes les étapes y sont, et `ffmpeg` les sort une à une :

```bash
xcrun simctl io <UDID> recordVideo --codec h264 --force /tmp/v.mp4 &   # puis kill -INT
ffmpeg -i /tmp/v.mp4 -vsync vfr -vf scale=402:874 /tmp/images/%04d.png
```

Une planche de ces images suffit à lire la séquence. Les horodatages de
`showinfo` n'y sont pas fiables : la durée d'un état se lit au journal du
proxy.

### Le type d'un élément dans `idb` dit ce qu'entend VoiceOver

`idb ui describe-all` rend un `role` par élément : `AXButton` pour un bouton
annoncé comme tel, `AXGenericElement` pour un élément sans rôle. Au
chantier 7, les boutons des états sans bento de la page publique sortaient en
`AXGenericElement` alors qu'ils déclarent `accessibilityRole="button"`, comme
« Retour », qui sort en `AXButton`. Relever le `role`, pas seulement le
libellé.

### Android ignore `color: 'transparent'` sur un `Text`

Un texte de gabarit rendu transparent pour donner sa hauteur à un os de
squelette reste invisible sur iOS, et s'affiche en clair sur Android. Rendre
l'os par un fond, et le texte par `opacity: 0`. Vu au chantier 7 sur la date du
squelette de la page publique.

### `uiautomator dump` compte en pixels

Les `bounds` sont en pixels physiques, pas en dp : diviser par 2,625 à 420 dpi
(411 dp de large, le réglage du Pixel 8), par 3 à 480 dpi (360 dp). Les marges
système se lisent dans `adb shell dumpsys window`, aux lignes `InsetsSource`.
Un relevé prend une à deux secondes, ce qui borne la précision d'un
chronométrage fait par l'arbre.

### Un seul `uiautomator dump` à la fois

Deux relevés simultanés échouent, « UiAutomation already registered » dans
`adb logcat`, et rendent un arbre vide. Juste après une modification du code,
le premier lancement de l'app peut aussi rester noir plus de 12 s, le temps du
bundle : attendre un libellé de l'écran plutôt qu'un délai fixe.

### Un lien envoyé pendant le démarrage de l'app se perd

Relancer l'app par `am start -n …/.MainActivity`, attendre 12 s, puis envoyer
`am start -d bentopop://u/<pseudo>` : l'app restait sur le composer, quatre
fois sur quatre, cause non établie. Un démarrage à froid par le lien lui-même
ouvre bien la page, en 20 s sur le dev client. Dans
un script de recette, attendre un libellé du premier écran avant d'envoyer un
lien, ou ouvrir d'abord une page témoin.

### `adb shell` vide une boucle `while read`

Il lit l'entrée standard : dans `while read P; do adb …; done < liste`, le
premier appel avale le reste de la liste, et la boucle s'arrête après une
itération sans erreur. Lire la liste d'avance dans un tableau, ou passer
`</dev/null` à chaque commande `adb`.

### Changer la taille de police système

```bash
xcrun simctl ui <UDID> content_size accessibility-extra-extra-extra-large   # 3,571 ; extra-extra-large : 1,235
adb shell settings put system font_scale 2.0
```

Puis **relancer l'app** : un changement à chaud laisse des mises en page
périmées, l'image de partage la première. Remettre `large`, `1.0` et
`adb shell wm density reset` en fin de recette.

### Sur iPhone SE, la rangée basse de la page publique est sous les boutons

Au repos, les boutons collants la recouvrent : c'est le recouvrement accepté
du chantier 7. Pour lire les cases du bas, où les titres sont les plus
serrés, capturer après deux balayages vers le haut.

### Sur Android, `maxFontSizeMultiplier` ne plafonne pas la hauteur de ligne

React Native 0.86 plafonne la police, `toPixelFromSP(fontSize,
maxFontSizeMultiplier)`, mais convertit `lineHeight` sans plafond
(`TextAttributeProps.kt`), et selon la courbe non linéaire d'Android 14 : à
la taille 2,0, 24 devient 36 et 16 devient 28. Un texte à hauteur de ligne
posée grossit donc plus que son plafond ne le laisse croire ; l'en-tête de la
page publique dépassait son modèle de 8,6 dp. Remède du chantier 7 :
`allowFontScaling={false}` et un facteur appliqué par l'écran, `fontScaleFor`.

### Android arrondit la taille de police au pixel supérieur

`TextAttributeProps.setFontSize` fait `ceil(toPixelFromDIP(fontSize))` : un
titre de 11,57 dp passe à 31 px sur un écran à 2,625 px par dp, soit 2 % de
plus que demandé. Tout calcul de largeur de texte doit prendre la taille
arrondie, cf. `tileTitleScale`.

### `minimumFontScale` n'a aucun effet

Le rendu Fabric de React Native 0.86 le lit sans l'appliquer :
`adjustsFontSizeToFit` rétrécit jusqu'à `minimumFontSize`, 4 pt par défaut.
Sur Android, il ne rétrécit en outre que si le texte dépasse son nombre de
lignes ou sa hauteur : un mot coupé en pleine lettre, qui tient dans ses
lignes, ne déclenche rien.

### Comparer les captures au pixel, avant et après

Pour montrer qu'un changement ne touche que ce qu'il doit, recadrer les mêmes
captures avant et après et en faire la différence, avec `PIL` :
`ImageChops.difference`, seuil 40, puis `getbbox()`. La zone qui change se lit
en coordonnées. Au chantier 7, sur 27 bentos et trois appareils, seules les
cases de titre prévues par le calcul ont bougé.

### Un test qui échoue une fois sur dix

Le reproduire sous charge plutôt que de relancer jusqu'au vert :

```bash
for c in $(seq 1 $(( $(sysctl -n hw.ncpu) * 2 ))); do (yes > /dev/null &); done
npm test > suite.log 2>&1; pkill -x yes
```

Au chantier 7, trois échecs sur neuf passages ont désigné le test, et un
message d'échec enrichi de ses compteurs en a donné la cause.

---

## 5. Après la recette

```bash
pkill -f readonly-proxy; pkill -f "expo start"
xcrun simctl shutdown all
adb reverse --remove-all; adb emu kill
# facultatif : repartir d'une génération native propre à la prochaine recette
rm -rf apps/mobile/ios apps/mobile/android
```

Après une recette en `FAKE_AUTH=1`, retirer la session factice des appareils
(§4) : sinon la recette suivante, sans `FAKE_AUTH`, tombe sur une session
périmée et un client principal figé.

Remettre aussi ce que la recette a changé sur les émulateurs : police,
densité, taille, navigation par gestes, réseau, rotation. Désinstaller l'app
d'un AVD où elle n'était pas. Et après un compte de recette en production
(§1), vérifier que profil et compte d'authentification sont supprimés.
