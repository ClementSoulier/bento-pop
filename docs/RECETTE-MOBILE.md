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
   orphelin : profil **puis** authentification. Au tableau de bord Supabase,
   ou par l'API d'administration avec `MOBILE_SUPABASE_SERVICE_ROLE_KEY` de
   `apps/admin/.env`, jamais affichée : relire d'abord le compte
   (`GET /auth/v1/admin/users/<id>`, anonyme, créé à l'heure du journal du
   proxy, sans profil), le supprimer (`DELETE` sur la même adresse), puis
   vérifier le 404.

### Éprouver des droits d'écriture : le Supabase local, jamais la production

Une policy ou un privilège se prouve en tentant l'écriture interdite, ce qui
ne se fait pas en production. Le Supabase local, construit depuis les
migrations du dépôt, sert à ça : Docker Desktop lancé, puis

```bash
cd apps/mobile
supabase start -x studio,logflare,vector,imgproxy,edge-runtime,realtime,mailpit,supavisor
supabase db reset --local
npx tsx scripts/check-privileges.ts
npx tsx scripts/check-types.ts
docker exec -i supabase_db_bento-pop-mobile psql -U postgres -d postgres -q < scripts/check-editions.sql
docker exec -i supabase_db_bento-pop-mobile psql -U postgres -d postgres -q < scripts/check-push.sql
cd ../admin && npx tsx scripts/check-catalogue-types.ts
```

Les trois scripts refusent toute cible qui n'est pas `127.0.0.1`.
`check-catalogue-types.ts` rejoue la couche de données du catalogue par type
du back-office et l'import des listes de départ (25 contrôles). L'interface, elle, passe par l'authentification
de production : elle ne se clique en local que sur accord explicite de
Clément, dans une copie jetable (worktree détaché, jamais commitée) où la
session admin est simulée, toute cible Supabase non locale refusée et le
serveur ouvert sur `127.0.0.1` seulement. Aucun compte n'est créé pour ça.
`check-privileges.ts` rejoue les attaques connues et tout le parcours
d'écriture de l'app, avec les fonctions de l'app quand elles prennent leur
client en paramètre : au 15 septembre 2026, 42 contrôles, dont 11 en échec
sans `20260915000000_close_privilege_gaps.sql`. C'est aussi la preuve qu'une
migration ne casse pas les versions publiées. `check-types.ts` vérifie le
modèle type et case du chantier 15 : 18 contrôles. Toute migration qui touche
aux droits ou au catalogue doit les laisser verts, et ajouter ses propres
contrôles.

Deux précautions. Toujours passer par `db reset` avant de mesurer : c'est ce
qui garantit une base qui reflète exactement les migrations du dépôt, sans
reste d'une session précédente. Et pour comparer avant et après une
migration, `supabase db reset --local --version <horodatage d'avant>`, puis
`supabase migration up --local` : la migration s'applique sur les mêmes
lignes, sans sortir de fichier du dossier.

### Prouver au pixel qu'une migration ne change pas l'écran : l'A/B local

Une fois la migration en production, aucune capture d'avant n'existe plus. Le
chantier 15, lot 3, a comparé l'avant et l'après sur le Supabase local, avec
**une seule compilation par plateforme**, pointée sur le proxy de lecture, et
le proxy tourné vers la base locale (`TARGET` et `KEY` tirés de
`supabase status -o env`, `FAKE_AUTH=1` pour le composer « 0 / 6 ») :

1. base remise juste avant la migration, jeu de données fixe inséré en SQL
   (profils `editorial`, horodatages et identifiants fixes pour des tris
   identiques) ;
2. barre d'état figée, app réinstallée à neuf, série de captures A ;
3. `migration up`, app réinstallée à neuf, **même série**, captures B ;
4. comparaison pixel à pixel de chaque paire, avec l'image des pixels changés.

Le bruit rencontré, à reconnaître avant de conclure : le curseur d'un champ
capturé à deux instants de son clignotement, le clavier Android, une icône de
la barre d'état Android malgré le mode démo, et des pixels à un écart de 1
sur 255. Tout le reste est un vrai changement.

```bash
# barre d'état figée, puis rendue
xcrun simctl status_bar <UDID> override --time 9:41 --batteryState charged --batteryLevel 100 \
  --wifiBars 3 --cellularBars 4
xcrun simctl status_bar <UDID> clear
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command exit
```

Les dates relatives du fil (« il y a 12 h ») changent à l'heure pile : prendre
A et B dans la même heure.

**L'image de partage se récupère sans l'envoyer nulle part.** Toucher
« Partager » l'écrit avant d'ouvrir la feuille de partage : sur iOS dans
`tmp/ReactNative/*.jpg` du conteneur de données de l'app
(`xcrun simctl get_app_container <UDID> com.bentopop.mobile data`), sur Android
dans `cache/ReactNative-snapshot-image*.jpg`, par
`adb exec-out run-as com.bentopop.mobile cat <chemin>`.

### Recetter à côté d'une autre session : ne rien partager

Le 17 septembre 2026, une session recettait le chantier 17 sur le simulateur,
l'émulateur, Metro 8081 et le Supabase local, pendant qu'une seconde
reproduisait un défaut d'affichage. Tout ce que touche une recette se double,
sans rien arrêter chez l'autre.

**Le Supabase local.** Celui du projet mobile écoute sur **54331** (API) et
**54332** (base), et non 54321 : le 54321 de la machine appartient à un autre
projet, « lokkal ». Une seconde pile se monte depuis une copie du dossier
`supabase`, sous un autre `project_id` et d'autres ports. Sans
`.temp/postgres-version`, la CLI y prend une image Postgres qui plante sur tout
appel d'une fonction sans droit :

```bash
W=<dossier de travail>
cp -R apps/mobile/supabase "$W/supabase" && rm -rf "$W/supabase/.temp" && mkdir "$W/supabase/.temp"
printf '17.6.1.167' > "$W/supabase/.temp/postgres-version"
sed -i '' -e 's/^project_id = .*/project_id = "bento-pop-recette2"/' \
  -e 's/^port = 54331/port = 54341/' -e 's/^port = 54332/port = 54342/' \
  -e 's/^shadow_port = 54330/shadow_port = 54340/' -e 's/^port = 54333/port = 54343/' \
  "$W/supabase/config.toml"
supabase start --workdir "$W" -x studio,logflare,vector,imgproxy,edge-runtime,realtime,mailpit,supavisor
docker exec -i supabase_db_bento-pop-recette2 psql -U postgres -c 'create schema recette_marker'
```

Le conteneur de l'autre session, `supabase_db_bento-pop-mobile`, répond aux
mêmes commandes : tout script de données refuse une base qui ne porte pas le
schéma marqueur, et ce refus s'éprouve une fois, dans une transaction qui retire
le marqueur puis s'annule.

**Les builds**, pointées sur `http://127.0.0.1:54341` et contrôlées comme plus
bas, compilent dans leur propre `-derivedDataPath` : le
`find … DerivedData/MonBentoPop-* | head -1` de l'autre session installerait
sinon la leur.

**Les simulateurs iOS, dans un jeu d'appareils à part.** Créés et démarrés par
`xcrun simctl --set <dossier>`, ils n'apparaissent ni dans `simctl list`, ni
dans Simulator.app, ni derrière un `booted` de l'autre session. `idb` s'y branche
par un compagnon dédié :

```bash
xcrun simctl --set <dossier> create "Recette 17 Pro" com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro <runtime>
idb_companion --udid <UDID> --device-set-path <dossier> --grpc-port 10882 &
idb connect localhost 10882
```

**Metro sur un autre port.** L'app de développement iOS charge
`localhost:8081` : React Native est précompilé, `RCT_METRO_PORT` ne se change
pas à la compilation. Sans rien de plus, elle exécute le code servi par le Metro
de l'autre session. Le port se passe au lancement, et s'écrit aussi dans les
préférences de l'app, pour un lancement sans argument :

```bash
xcrun simctl --set <dossier> launch <UDID> com.bentopop.mobile -RCT_jsLocation 127.0.0.1:8082
D=$(xcrun simctl --set <dossier> get_app_container <UDID> com.bentopop.mobile data)
/usr/libexec/PlistBuddy -c "Add :RCT_jsLocation string 127.0.0.1:8082" "$D/Library/Preferences/com.bentopop.mobile.plist"
```

Le journal de Metro doit afficher « iOS Bundled » au lancement : c'est la preuve
que l'app lit le bon.

**Android : un AVD dédié, et jamais deux émulateurs à la fois.** `adb shell`
sans numéro de série échoue dès que deux appareils sont branchés : démarrer un
second émulateur casse les commandes de l'autre session. Attendre que le sien
soit arrêté, lancer l'AVD dédié sur un port à part, puis toujours
`adb -s emulator-5580`. Un AVD se crée sans `avdmanager`, en recopiant le
`config.ini` d'un AVD existant sous un autre `AvdId`.

```bash
emulator -avd Recette_Pixel_8 -no-window -no-snapshot -port 5580 &
adb -s emulator-5580 reverse tcp:8082 tcp:8082
adb -s emulator-5580 reverse tcp:54341 tcp:54341
```

**L'app Android d'un émulateur vise l'hôte en `10.0.2.2:8081`**, sans passer
par `adb reverse` : « Unable to load script » si ce Metro n'existe pas, le code
de l'autre session s'il existe. L'adresse du bundler s'écrit dans les
préférences de l'app, app arrêtée :

```bash
printf '%s' "<?xml version='1.0' encoding='utf-8' standalone='yes' ?><map><string name=\"debug_http_host\">localhost:8082</string></map>" > /tmp/rn.xml
adb -s emulator-5580 push /tmp/rn.xml /data/local/tmp/rn.xml
adb -s emulator-5580 shell "run-as com.bentopop.mobile mkdir -p shared_prefs && run-as com.bentopop.mobile cp /data/local/tmp/rn.xml shared_prefs/com.bentopop.mobile_preferences.xml"
```

Enfin, un réglage posé juste avant `adb emu kill` peut ne pas survivre : la
taille de police était restée à 2,0 au démarrage suivant. Relire le réglage
après chaque démarrage.

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

### Ne jamais réinstaller un `.app` traînant dans le dépôt

Variante du piège précédent, et elle contourne même le contrôle de
`EXConstants.bundle/app.config`.

Le 16 septembre 2026, `apps/mobile/MonBentoPop.app` a été réinstallé sur le
simulateur pour repartir d'un état propre. Ce fichier n'était pas un dev
client : une build EAS de canal `preview`, version 0.0.1, datée du 12 mai 2026.
Son `Expo.plist` porte `EXUpdatesEnabled = true` et
`EXUpdatesCheckOnLaunch = ALWAYS`, donc **elle charge une mise à jour OTA et
ignore Metro en silence**. Aucun message, aucun bandeau : l'app démarre, elle
est simplement branchée sur la production.

Coût : trois `signInAnonymously` sur le projet de production, donc jusqu'à trois
lignes `auth.users` à nettoyer, et une mesure d'onboarding faite sur une build
de mai prise pour le code courant.

Les trois contrôles, dans cet ordre :

```bash
# 1. Ce .app est-il un dev client, ou une build à canal de mise à jour ?
plutil -p <chemin>.app/Expo.plist 2>/dev/null
#    EXUpdatesEnabled = true  →  elle ignorera Metro. Ne pas l'installer.

# 2. Après lancement, sur quoi l'app est-elle réellement branchée ?
D=$(xcrun simctl get_app_container <UDID> com.bentopop.mobile data)
python3 -c "import json;print(list(json.load(open('$D/Library/Application Support/com.bentopop.mobile/RCTAsyncLocalStorage_V1/manifest.json')).keys()))"
#    ['sb-127-auth-token']            → le proxy, tout va bien
#    ['sb-ggjgktbcqumfxrixcdyx-...']  → LA PRODUCTION, arrêter l'app

# 3. Une mise à jour OTA a-t-elle été téléchargée ?
ls "$D/Library/Application Support/.expo-internal" | head
```

La bonne façon de repartir d'un état propre : **reconstruire**, avec
`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:8098 npx expo run:ios`, qui installe
un dev client et l'ouvre avec l'URL `expo-development-client/?url=…`. Les `.app`
du dépôt ne sont pas des outils de recette.

### `idb ui tap` prend deux arguments, pas une chaîne

Coûteux parce qu'invisible. Une cible calculée puis passée telle quelle :

```bash
F=$(… python3 …)        # "74 287"
idb ui tap --udid "$SIM" $F 2>/dev/null
```

échoue avec `argument x: invalid int value: '74 287'`, et le `2>/dev/null`
avale le message. À l'écran, rien ne bouge : on croit que l'app ignore le tap,
on cherche un défaut dans le code, on relance, on rebâtit. Vécu le 16 septembre
2026, cinq cycles perdus sur la recette du chantier 9.

```bash
read -r X Y <<< "$(… python3 … print(int(cx), int(cy)) …)"
idb ui tap --udid "$SIM" "$X" "$Y"      # et SANS 2>/dev/null
```

**Règle : jamais de `2>/dev/null` sur `idb`.** Ses erreurs d'usage sont le seul
signal qu'un tap n'est pas parti.

### Un bandeau LogBox couvre le bas de l'écran, boutons compris

Déjà noté pour la barre d'onglets ; il vaut pour **tout** ce qui touche le bas.
Sur iPhone 17 Pro, le bandeau occupe `y=800..822` en points, soit la moitié
basse d'un `StampButton` posé à `y=770`. Les taps y atterrissent et la page ne
réagit pas.

```bash
idb ui describe-all --udid "$SIM" | grep -i "Open debugger"
#   !, Open debugger to view warnings.   y=800
idb ui tap --udid "$SIM" 388 811        # la croix, pour le fermer
```

Le fermer avant toute série de taps, ou viser la moitié **haute** du bouton.

### Le proxy de recette n'autorise qu'une inscription

`recette-write-proxy.mjs` refuse la deuxième par construction, et c'est voulu.
Mais après une désinstallation de l'app, le lancement suivant redemande une
inscription : le proxy répond `503 inscription déjà faite, refusée`, l'app
démarre sans session, et **tout ce qui exige `userId` retourne en silence**.
Symptôme : des taps sans effet, aucune erreur.

```bash
grep -i "inscription" "$SC/wproxy.log" | tail -2
```

Le relancer remet son compteur à zéro. Lui rappeler l'existence du coupe-circuit
`READONLY_FLAG`, obligatoire au démarrage avec `TARGET`, `KEY` et `DELAY_FILE`.

### Une colonne `not null` sans défaut, contre les droits de colonne

Piège de schéma, pas d'écran, et le plus cher du chantier 16.

Le client n'a le droit d'écrire qu'une colonne de `bentos` :
`grant insert (user_id) to authenticated`. Ajouter une colonne `not null`
**sans valeur par défaut** rend donc toute insertion client impossible :

```
ERROR: null value in column "slug" violates not-null constraint
```

Aucun test applicatif ne peut le voir : ils bouchonnent PostgREST, donc aucune
contrainte de base ne s'y exerce. Le seul contrôle qui l'attrape rejoue
l'insertion réelle avec une session simulée, cf. `scripts/check-bentos-multi.sql`
cas 6a :

```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','<uuid d''un users sans bento>','role','authenticated')::text, true);
set local role authenticated;
insert into public.bentos (user_id) values ('<le même uuid>');
rollback;
```

**Règle : toute migration qui ajoute une colonne `not null` à une table écrite
par le client se teste avec cette insertion-là**, avant d'être appliquée.

### Metro dit les cycles d'imports, et personne ne lit Metro

```
WARN  Require cycle: src/state/draft-mirror.ts -> src/state/session.ts -> src/state/draft-mirror.ts
Require cycles are allowed, but can result in uninitialized values.
```

Ni le typecheck ni les tests ne le voient : le cycle se résout à l'exécution,
et il ne casse que selon l'ordre d'évaluation des modules. Trouvé le 16
septembre en cherchant autre chose dans le journal.

```bash
grep -iE "require cycle|error" "$SC/metro.log" | tail
```

À passer après chaque lot qui déplace des modules d'état.

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

Pour n'importe quel texte, « Squeezie » compris : le poser dans le
presse-papiers du simulateur, puis coller par l'interface. Un appui long sur
le champ fait paraître « Paste », qu'on touche. Sur Android,
`adb shell input text` tape juste, lettres comprises.

```bash
printf "Squeezie" | xcrun simctl pbcopy <UDID>
idb ui tap --udid <UDID> --duration 1.2 <x du champ> <y du champ>
# puis toucher « Paste », trouvé par idb ui describe-all
```

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

### Le style d'un `Pressable` en fonction de `pressed` n'est pas appliqué

Sous le runtime JSX de NativeWind, `style={({ pressed }) => …}` sur un
`Pressable` **ne donne rien du tout**, silencieusement. Au chantier 11, le
`StampButton` de l'app avait ainsi perdu son ombre stamp, son enfoncement à
l'appui et le grisé de son état désactivé : un bouton inerte se présentait comme
actif. Le style en tableau, lui, s'applique ; l'appui se suit alors à la main par
`onPressIn` / `onPressOut`.

Pour trancher entre « la propriété n'a pas d'effet » et « le style n'arrive
pas », poser une sonde impossible à manquer, ici une bordure bleue de 6 pt, et
mesurer la capture : en forme fonction, bordure noire pleine et fond inchangé ;
en forme tableau, bordure bleue à 50 % et fond composité. `FeedPost` avait relevé
le même symptôme sur ses marges sans en tirer la règle.

### Un `ScrollView` qui ne défile pas et rogne quand même sa fin

`contentContainerStyle={{ flexGrow: 1 }}` avec un enfant en `flex: 1` et une
`minHeight` : quand le contenu grossit, l'enfant ne peut plus se réduire sous sa
hauteur minimale, la boîte de contenu reste à la hauteur de l'écran, et ce qui
dépasse est **rogné sans que rien ne défile**. Mesuré au chantier 11 sur l'écran
splash d'un iPhone SE à la troisième taille d'accessibilité : la fin de la phrase
d'accroche disparaissait sous le bouton, et deux balayages n'y changeaient rien.
Le ressort d'un décor ne porte donc pas de `minHeight` ; le décor s'efface quand
la place manque, sa place étant mesurée par `onLayout`.

Le symptôme se reconnaît à ceci qu'un balayage ne bouge rien : capturer, balayer,
recapturer, faire la différence. Identique, le contenu ne défile pas.

### `adjustsFontSizeToFit` avec une hauteur de ligne posée

Sur iOS, un texte qui porte à la fois `adjustsFontSizeToFit` et un `lineHeight`
explicite rétrécit jusqu'à la trace : le moteur fait tenir la police dans la
hauteur de ligne, et non l'inverse. Vu au chantier 11 sur le pseudo du composer,
réduit à quelques pixels. Ne le poser que là où le texte peut vraiment déborder,
jamais avec une hauteur de ligne posée.

### La barre d'onglets en navigation à trois boutons

Sa hauteur se calcule sur la marge basse du système, 34 pt en gestes sur iOS,
24 dp en trois boutons sur Android. Prendre la valeur d'iOS des deux côtés
coupait les libellés en deux sur l'émulateur en trois boutons. Une base par
plateforme, cf. `tab-bar.ts`, et 108 dp en trois boutons.

### `simctl io screenshot` échoue en silence sur un chemin relatif

Aucune erreur, aucun fichier : toute une série de captures peut se perdre. Passer
un chemin absolu, et vérifier que le fichier existe avant d'enchaîner. La
sous-commande de taille de police, elle, s'écrit `content_size` avec un
souligné, quand la plupart des autres prennent un tiret.

### LogBox masque la barre d'onglets, et les taps par libellé échouent

Le bandeau de développement couvre le bas de l'écran : un script qui tape sur
« La table » tape dans le bandeau et reste sur l'écran précédent, sans erreur. Le
chercher dans l'arbre avant chaque série, le fermer par « Dismiss », et
recommencer la série. Au chantier 11, trois écrans d'une série avaient ainsi été
capturés deux fois le même. Son texte se lit en le dépliant : un avertissement
d'expo-router pendant la navigation vient de la bibliothèque, sa pile de
composants ne citant que `ContextNavigator` et `ExpoRoot`.

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

### Un garde-fou qui lit la mauvaise variable ne garde rien

Le 16 septembre 2026, la recette du back-office a été montée avec deux
bouchons portant chacun un contrôle de cible : refuser toute base qui ne soit
pas `127.0.0.1`. Ils lisaient `NEXT_PUBLIC_MOBILE_SUPABASE_URL`.

Le client réel, lui, lit `MOBILE_SUPABASE_URL` (`lib/supabase/mobile.ts:28`).
Les deux variables n'ont pas à porter la même valeur, et ce jour-là la seconde
n'était pas définie du tout : le contrôle voyait une chaîne vide, la jugeait
non conforme ou conforme selon l'écriture, et **n'avait aucun rapport avec la
base réellement interrogée**. Il aurait laissé passer la production.

> **Un contrôle de cible lit exactement la variable que le code contrôlé
> utilise.** Pas une qui lui ressemble, pas une qui la préfixe. Et on l'éprouve
> en lui présentant une cible interdite, une fois, avant de s'en servir.

Même règle pour les scripts SQL de données de recette :
`seed-editions-local.sql` refuse une base qui porte un pseudo de l'équipe, et
ce refus a été vérifié en faisant passer la base locale pour la production.

### Une règle d'affichage qui refuse ce qui existe déjà est fausse

En écrivant la règle qui dit si un intitulé de case tient à l'écran, une marge
de 7 % a paru prudente : elle couvrait le fil sur iPhone SE, mesuré 6 % plus
serré que l'échelle de référence.

Elle refusait « Créateur de contenu », affiché dans la rangée à trois du bento
principal **depuis le premier jour**.

> **Avant d'écrire une règle de validation, la passer sur les données qui
> existent.** Si elle en refuse une seule, c'est la règle qui est fausse, pas
> la donnée. Une règle prudente qui interdit le présent n'est pas prudente,
> elle est inapplicable, et elle finira contournée.

La règle rend donc deux verdicts : `fits`, qui bloque, et `tight`, qui
avertit. L'avertissement a servi tout de suite : « CRÉATEUR DE CONTENU »
occupe 96 % de sa ligne, et **au calcul il déborde dans le fil sur iPhone
SE**. À confirmer sur appareil, chantier 29.

### Mesurer du texte sans canevas, et le prouver deux fois

Un back-office en Node n'a pas de canevas, et l'app ne peut pas mesurer avant
de dessiner. Les largeurs de Bungee sont donc extraites du vrai fichier de
police, `Bungee_400Regular.ttf` de `@expo-google-fonts` : tables `head`,
`hhea`, `hmtx` et `cmap` format 4, une centaine de lignes, aucune dépendance.

Deux précautions rendent la table fiable :

- `bungee-metrics.test.ts` **la redérive du fichier** à chaque exécution, donc
  elle ne peut pas dormir périmée après une montée de version ;
- elle a été recoupée avec une mesure au canevas dans un vrai navigateur,
  police réellement chargée : 199,8 contre 199,3 pour « LE FILM QUI T'A FAIT
  PLEURER », soit 0,3 % d'écart.

> Deux méthodes indépendantes qui tombent d'accord valent mieux qu'une méthode
> sûre d'elle.

### Un module « pur » cesse de l'être au premier import distrait

`bento-actions-pure.ts` existe pour une raison écrite dans son en-tête : rester
chargeable sous `node:test`, sans monter React Native. Le 17 septembre, un
nouveau module de domaine a importé le client Supabase pour y ajouter deux
lectures, et `bento-actions-pure.ts` a cessé de se tester, avec une erreur
d'esbuild sur `react-native/index.js` qui ne nomme aucun des deux fichiers.

> **Quand un module porte « ne rien importer de lourd » dans son en-tête,
> c'est une contrainte, pas une préférence.** Les lectures en base vont dans un
> module voisin, et le module pur porte l'avertissement en tête.

### Une jointure qui manque ne casse pas, elle efface

Depuis le chantier 13, une case peut appartenir à une édition, et sa clé n'est
plus forcément l'une des six. Le code qui traduisait `category_id` vers une
clé passait par une table compilée dans l'app : pour une case d'édition, elle
rend `undefined`, et la boucle **saute la case en silence**.

Le résultat n'est pas une erreur, c'est une boîte qui se dessine avec des
cases vides. Les requêtes publiques joignent donc la case pour obtenir sa clé,
avec l'ancienne table en repli :

```ts
const cat = link.bento_categories?.key ?? CATEGORY_BY_ID[link.category_id];
```

> Chercher les endroits où une donnée inconnue est **sautée** plutôt que
> signalée : ce sont ceux qui mentiront le plus longtemps.

### Les cases vides n'ont pas de ligne, et c'est la disposition qui en dépend

Une case qu'on n'a pas remplie n'existe pas dans `bento_items`. Déduire la
liste des cases des lignes présentes marche tant que les bentos sont complets,
et casse dès qu'ils ne le sont pas : la boîte **rétrécit** au lieu de montrer
des emplacements vides, parce que c'est le nombre de cases qui décide de la
disposition.

La liste complète vient donc de l'édition, imbriquée dans la même requête :

```
editions ( slug, title, bento_categories ( key, prompt, … ) )
```

> Quand une liste décide d'une mise en page, la lire à sa source, pas la
> déduire de ce qui la remplit.

### Un défaut qui ne se montre qu'à froid

Le piège « `adjustsFontSizeToFit` avec une hauteur de ligne posée » décrit plus
haut ne se déclenche pas à chaque rendu. Le 16 septembre 2026, « TITANIC »
s'écrivait en 5 pt dans la grande case d'une édition, **à la première ouverture
de la page publique**, et à sa taille normale dès la seconde, page en cache.
Une recette qui revient sur la page pour « vérifier » voit un écran juste.

Le reproduire, c'est tuer l'app et rouvrir la page à froid, trois fois, en
mesurant la capture : la hauteur du plus grand bloc de pixels blancs du titre
passait de 51 px à 8 px, trois fois sur trois. Après correction, 51 px trois
fois sur trois.

> **Un défaut intermittent se reproduit dans l'état où il est apparu**, ici
> une page sans cache, avant d'être déclaré corrigé ou imaginaire.

La correction n'a pas été de retirer la hauteur de ligne, que le budget vertical
compte, mais de ne plus déléguer la taille à la plateforme : un titre d'un mot
se mesure désormais comme les autres, `lineFitScale`.

### Deux lectures de la même chose finissent par diverger

Le composer se remplit par deux lectures : celle du démarrage, et celle du
changement de bento. Chacune écrivait sa liste de colonnes. La seconde avait
perdu `image_credit` et `status` : revenir à son bento principal par le
sélecteur **effaçait les crédits d'image**, qu'une photo sous licence CC BY
exige, et **l'état « en attente »**, qui bloque la publication d'une case non
modérée. Rien ne cassait, les cases s'affichaient, un peu moins complètes.

Vu en comparant deux captures du même bento à une heure d'écart, pas en
regardant l'écran.

> **Une liste de colonnes lue par une même fonction de mapping s'écrit une
> fois**, `REMOTE_SLOT_COLUMNS`, et un test vérifie que les deux lectures s'en
> servent.

### Revenir au premier plan n'est pas revenir sur l'onglet

`useFocusEffect` se déclenche quand l'onglet reprend le focus de navigation,
pas quand l'app revient de l'arrière-plan. Une édition programmée qui sortait
pendant que l'app dormait n'apparaissait qu'après un changement d'onglet :
contrôle D de la recette du chantier 13, même processus avant et après,
vérifié par son pid.

> Ce qui doit se relire « au retour » se branche sur les deux :
> `useFocusEffect` **et** `AppState` à `active`, abonnement retiré quand
> l'onglet perd le focus.

### Un tap hors de l'écran tombe sur le voisin

`idb ui tap` à une abscisse au-delà de la largeur de l'écran ne refuse rien :
le tap est ramené au bord, et touche l'élément qui s'y trouve. Le 16 septembre,
viser une pastille défilée hors champ a sélectionné sa voisine, et l'écran
suivant montrait un autre bento que celui demandé.

> **Taper au centre de la partie visible**, et refuser un élément dont il reste
> moins de 8 points à l'écran : faire défiler d'abord.

### Un test ajusté à une régression la protège

« Commence par ton film » était devenu « Commence par film » pendant la
généralisation du bouton aux éditions, et le test avait été modifié pour
accepter la nouvelle chaîne. La recette l'a vu, pas la suite de tests, qui
passait.

> Quand un refactor oblige à changer l'assertion d'un test existant, **l'ancienne
> assertion est la spécification** jusqu'à preuve du contraire. Changer le test
> demande une raison écrite, pas un rendu différent.

### `find … | head -1` installe n'importe quelle build

Pour installer « la » build du simulateur, `find DerivedData -name "*.app" |
head -1` a pris une build Release d'une session précédente, pointée sur un
proxy local. Aucun compte n'a été créé, mais la cible n'était plus celle
vérifiée.

> Installer par le **chemin exact** de la build qu'on vient de produire, puis
> contrôler son `app.config` et la clé de session, comme en §2, avant de lancer.

### Un rechargement complet peut rouvrir une modale comme écran racine

Après certaines modifications à chaud, Metro recharge tout le bundle, et
l'app peut revenir sur la modale de recherche **sans écran derrière** :
« Fermer » ne fait rien, et LogBox affiche `The action 'GO_BACK' was not
handled`. Ce n'est pas un défaut de l'app, mais une recette qui continue dans
cet état capture des écrans faux.

> Au premier `GO_BACK was not handled`, relancer l'app avant la suite.

### Reposer un état identique ne doit rien effacer

Le composer relit le bento courant à chaque retour sur l'onglet, et la
relecture reposait son jeu de cases. Poser un jeu de cases vidait les cases
remplies, ce qui est juste quand on change de bento et faux quand on repose le
même. Pendant qu'une écriture était en vol, `hydrate` ignorait ensuite l'état
distant, comme il le doit : **une case choisie à l'instant restait vide à
l'écran alors qu'elle était enregistrée en base**. Vu à la recette de la
proposition A, sur une case d'édition, en tapant vite.

Le défaut dépend du rythme : à la première recette, les écritures finissaient
avant la relecture, et rien ne se voyait. Reproduit ensuite dans un test du
store, en rejouant l'ordre des événements, avant d'être corrigé.

> **Une action qui efface ce qu'elle remplace compare d'abord.** Reposer la
> même valeur ne touche à rien ; l'effacement voulu, au changement de bento,
> devient une action explicite, `clearSlots`.

### Un fond sous un texte qui passe à la ligne prend toute la largeur

Sur React Native comme en CSS, une boîte ajustée à son texte prend **toute la
largeur permise dès que le texte passe à la ligne**, et non celle de sa plus
longue ligne. « TON VOYAGE / RÊVÉ » posait ainsi un pavé noir sur toute la
largeur de la case, deux tiers de vide à droite de « RÊVÉ ».

Aucune propriété ne rétrécit la boîte après la coupure. La coupe se calcule
donc avant de dessiner, avec les largeurs de la police, et la boîte reçoit la
largeur de la plus longue ligne, plus 2 % et un point de marge pour les écarts
de rendu. Une seule implémentation pour l'app, la page web et l'aperçu de lien :
`fitLabel`, dans le package partagé.

### Prouver qu'un rendu web n'a pas bougé

Pour montrer qu'un changement laisse le bento principal intact sur la page
web : extraire la liste des cases du HTML servi, remettre les fichiers
modifiés dans leur version du dernier commit, laisser le serveur de
développement recompiler, extraire de nouveau, remettre les fichiers, et
comparer à l'octet.

**Une comparaison identique ne prouve rien si l'ancienne version n'a pas été
servie**, par exemple si la recompilation n'a pas eu le temps de se faire.
Extraire donc dans le même geste une page **témoin**, qui elle doit différer :
la page d'une édition. Au chantier 13, la boîte du bento principal sortait
identique, 12 398 octets, pendant que celle de l'édition passait de 12 230 à
13 740 octets. Même méthode pour l'aperçu de lien, comparé au pixel : 0 pixel
différent pour le bento principal, et des différences limitées aux étiquettes
pour l'édition.

### Un fichier `.env` de la landing pointe sur la production

`apps/landing/.env` porte les adresses et une clé service-role de la
production. Des variables passées au shell l'emportent sur lui, mais seulement
pour celles qu'on pense à passer. Pour une recette locale, le mettre hors
service, `mv .env .env.recette-hors-service`, lancer avec les seules variables
locales, et le remettre en place à la fin, comme celui de l'app.

### La base locale plante sur une fonction sans droit : l'image Postgres

Rencontré le 17 septembre 2026, au lot 1 du chantier 17. Après un
`supabase db reset --local` lancé depuis un worktree neuf, **tout appel d'une
fonction sans droit d'exécution fait planter Postgres** au lieu de répondre
`permission denied for function` :

```
server closed the connection unexpectedly
LOG:  server process (PID 317) was terminated by signal 11: Segmentation fault
```

Le processus serveur tombe, et Postgres redémarre toutes les connexions.

**La cause est l'image, pas la migration.** Mesuré sur des conteneurs vierges,
avec une fonction neuve et le rôle `anon` : les images `17.6.1.105`, `106` et
`111` plantent, la `17.6.1.167` répond normalement. Le coupable est
`supautils` 3.2.0, qui ajoute un conseil (« Grant the required privileges… »)
aux erreurs de droits et supposait l'objet refusé toujours une table. Corrigé
dans `supautils` 3.2.2 ([PR 190](https://github.com/supabase/supautils/pull/190),
dont le test rejoue exactement ce cas).

**La production n'est pas concernée** : elle tourne en `17.6.1.121`, qui
embarque `supautils` 3.2.2 d'après `nix/ext/supautils.nix` du dépôt
`supabase/postgres` à cette étiquette. Ne jamais le vérifier en production :
le test lui-même la ferait tomber si c'était faux.

**Pourquoi un worktree neuf.** La CLI choisit l'image d'après
`apps/mobile/supabase/.temp/postgres-version`, ignoré par git, donc absent
d'un worktree neuf : elle prend alors son image par défaut, `17.6.1.106` pour
la CLI 2.98.2. La parade, sans rien télécharger quand l'image est déjà là :

```bash
cd apps/mobile
docker images | grep supabase/postgres     # images disponibles
printf '17.6.1.167' > supabase/.temp/postgres-version
supabase stop
supabase start -x studio,logflare,vector,imgproxy,edge-runtime,realtime,mailpit,supavisor
supabase db reset --local
```

**Règle : avant de conclure qu'une migration plante la base, rejouer le cas sur
un conteneur vierge de la même image.** Si le conteneur vierge plante aussi,
c'est l'image.

### `pod install` échoue sur l'encodage, hors d'un terminal interactif

Rencontré le 17 septembre 2026, au lot 2 du chantier 17, en régénérant le projet
iOS par `npx expo prebuild --platform ios --clean` depuis un script :

```
Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)
```

CocoaPods lit le chemin du projet sans langue UTF-8 quand le shell n'en déclare
aucune, ce qui arrive dans un script ou un terminal non interactif. `prebuild`
laisse alors un dossier `ios` sans `MonBentoPop.xcworkspace`, et `xcodebuild`
échoue ensuite sur un workspace introuvable, loin de la vraie cause.

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd apps/mobile/ios && pod install
```

### `pg_net` abandonne à 3 secondes, et une route lente perd son travail

Rencontré le 23 septembre 2026, au lot 3 du chantier 17, en recettant le
battement de `pg_cron` contre un back-office en mode développement. La route
venait d'être recompilée, elle a mis 3 secondes à répondre, et `pg_net` l'a
abandonnée :

```sql
select status_code, timed_out, error_msg from net._http_response order by created desc limit 1;
-- sans statut · true · Timeout of 3000 ms reached
```

Le battement avait été noté, mais le travail prévu après la réponse, par
`after()`, n'a jamais tourné. Deux conséquences :

- **une route appelée par `pg_net` répond sans rien attendre**, et fait tout
  après la réponse, battement compris ;
- **en développement, préchauffer la route avant le passage de `pg_cron`**,
  par un appel au faux jeton qui la compile sans rien faire :

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3101/api/push/tick \
  -H 'Authorization: Bearer faux' -H 'Content-Type: application/json' -d '{"type":"tick"}'
```

`pg_net` atteint le back-office local par `http://host.docker.internal:<port>`,
même quand `next dev` n'écoute que sur `127.0.0.1`. Ces secrets de coffre ne se
posent que dans la base **locale**, et `supabase db reset --local` les efface :
`check-push.sql` refuse de tourner tant qu'ils existent.

### Le back-office de recette dans une copie : lier `node_modules` et `packages`

La copie de `apps/admin` qui sert à la recette (sans `.env` de production, avec
une session simulée) doit lier `node_modules` **et** `packages` depuis le
worktree : la mise en page racine charge sa police par un chemin relatif,
`../../../../packages/brand/assets/fonts/`, et sans lui toutes les routes
répondent 500, API comprises.

### Une image Docker se teste en la lançant, pas seulement en la construisant

Le 23 septembre 2026, l'image du back-office se construisait sans erreur, et
**chaque envoi de notification y aurait échoué** : le SDK d'Expo 6.1.0 relit son
`package.json` à chaque requête par un `createRequire` que webpack ne suit pas,
et la sortie autonome de Next ne l'embarquait pas. En développement, tout
marchait. Seul l'appel réel, dans le conteneur lancé contre la base locale, l'a
montré :

```
RequestFailed : Cannot find module '../package.json'
```

Corrigé par `serverExternalPackages: ['expo-server-sdk']` dans
`apps/admin/next.config.ts`. Pour construire et lancer l'image comme Coolify :

```bash
docker build -f apps/admin/Dockerfile -t bento-admin:recette \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://localhost:54331 \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=cle-factice \
  --build-arg NEXT_PUBLIC_ADMIN_URL=http://localhost:3300 .
docker run -d --name bento-admin-recette -p 127.0.0.1:3300:3300 \
  -e MOBILE_SUPABASE_URL=http://host.docker.internal:54331 \
  -e MOBILE_SUPABASE_SERVICE_ROLE_KEY=<clé de service LOCALE> \
  -e PUSH_WEBHOOK_TOKEN=<jeton local> bento-admin:recette
```

Depuis le même jour, `.dockerignore` écarte `apps/mobile/ios` et
`apps/mobile/android` : 8 Go ignorés par git mais envoyés à Docker depuis un
worktree, qui rendaient la construction locale impossible. Coolify part d'un
clone et ne les a jamais vus.

### `postgres` n'écrit pas dans l'historique de `pg_cron` sans numéro de passage

Pour éprouver une purge de `cron.job_run_details` dans un contrôle,
`insert … values (…)` échoue sur `permission denied for sequence runid_seq` :
seul le travailleur de `pg_cron` avance cette séquence. Donner un `runid`
explicite, négatif pour ne jamais croiser un vrai passage. La purge elle-même
ne fait qu'effacer, et n'en a pas besoin.

### Simuler une notification distante au simulateur iOS, sans clé APNs

`xcrun simctl push` livre au simulateur une notification distante, que
l'app reçoit comme d'Expo. Rencontré le 23 septembre 2026 au lot 4 du chantier
17 : les données doivent être sous la clé `body`, où `expo-notifications` les
lit pour une notification distante (`NotificationRecords.swift`).

```bash
cat > notif.json <<'JSON'
{
  "aps": { "alert": { "title": "Proposition validée", "body": "« Titre » est au catalogue : ta case est en ligne." }, "sound": "default" },
  "body": { "type": "item_moderated", "status": "validated", "itemId": "<uuid>" }
}
JSON
xcrun simctl push <UDID> com.bentopop.mobile notif.json
```

Trois pièges :

- **la bannière disparaît en quelques secondes** : la toucher aussitôt, sans
  capture entre l'envoi et le tap. Sinon le tap tombe sur ce qui est dessous,
  une icône de l'écran d'accueil par exemple ;
- **toucher la notification sur l'écran verrouillé n'ouvre pas l'app** dans le
  simulateur : repasser par l'écran d'accueil et la bannière ;
- sur Android, sans compte de service FCM, aucune notification distante ne se
  simule : le tap s'y recette avec le lot 0.

### L'émulateur Android reprend son instantané, app comprise

`emulator -avd Pixel_8` recharge l'instantané `default_boot`, et avec lui le
processus de l'app tel qu'il était ce jour-là : son ancien JavaScript, déjà
chargé, sans rien demander à Metro. Rencontré le 23 septembre 2026 : l'app
affichait l'état du 17 septembre, et aucune ligne « Android Bundled » n'était
apparue dans Metro. Avant toute recette :

```bash
adb shell am force-stop com.bentopop.mobile
adb shell am start -n com.bentopop.mobile/.MainActivity
# puis vérifier « Android Bundled » dans le journal de Metro
```

Même vigilance que pour la cible : un compte créé à ce moment-là doit
apparaître dans la base locale, et jamais en production.

### L'onglet que le panneau navigateur ouvre sur Metro est l'app, en version web

Lancer Metro par `preview_start` ouvre un onglet sur `localhost:8081`, qui
charge la **version web** de l'app. Elle s'ouvre, se connecte en anonyme et
crée un compte dans la base visée par Metro. Le 23 septembre 2026, c'était la
base locale : un compte de trop, et une énigme de plus. Fermer l'onglet aussitôt.

### Remettre une autorisation Android à « jamais demandée »

Android ne dit pas si une autorisation n'a jamais été demandée ou si elle a été
refusée pour de bon : `expo-notifications` le déduit, en partie d'un repère
qu'il garde dans les données de l'app. `pm revoke` suivi de
`pm clear-permission-flags … user-set user-fixed` ne suffit donc pas : l'app
continue de répondre « refusée ». Seul un effacement des données de l'app
rend l'état neuf, session et brouillon compris :

```bash
adb shell pm clear com.bentopop.mobile
```

### Mesurer une animation de moins d'une demi-seconde

Une capture fixe ne prouve pas un pouls de 230 ms. Filmer le simulateur, puis
mesurer l'élément image par image, avec un témoin voisin qui ne doit pas
bouger :

```bash
xcrun simctl io <UDID> recordVideo --codec=h264 --force tap.mov &   # arrêter par SIGINT
ffmpeg -ss 3.3 -t 1.6 -i tap.mov -vf "fps=60,crop=700:170:380:505" p%03d.png
```

puis compter les pixels sombres de chaque image (Python et Pillow). Le 23
septembre 2026 : la pastille de l'édition passait de 616 à 640 px et revenait,
quand la pastille voisine restait à 340 px sur les 77 images.
