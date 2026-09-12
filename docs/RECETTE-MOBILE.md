# Recette de l'app mobile sur simulateur

> Mode d'emploi pour faire tourner `apps/mobile` sur simulateur iOS et
> émulateur Android, avec de vraies données de production et sans rien y
> écrire. Écrit après la recette du chantier 2, où la moitié du temps est
> partie dans les pièges listés en §4 plutôt que dans la recette elle-même.

---

## 1. Le principe

L'app pointe sur un proxy local qui relaie les lectures vers Supabase et
bloque tout le reste. On obtient les vraies données, le vrai rendu, les vraies
images, sans compte anonyme créé ni écriture possible.

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

### Couper tout le réseau bloque l'app sur le splash

Le garde-fou de 12 s du root layout ne remet que `initialized`, pas
`appStatusLoading` : si `app_config` n'aboutit jamais, l'écran jaune ne part
pas. Pour atteindre l'état d'erreur d'un écran, faire échouer **une seule**
route :

```bash
FAIL=/rest/v1/bentos TARGET=... KEY=... node apps/mobile/scripts/readonly-proxy.mjs
```

Compter environ trois secondes de squelette avant l'erreur : React Query
retente deux fois.

### `INSTALL_FAILED_VERSION_DOWNGRADE` sur Android

Une build plus récente occupe déjà l'émulateur. `adb uninstall
com.bentopop.mobile` avant d'installer, en sachant que les données locales de
cette build partent avec.

### Un module natif impose un rebuild

`expo-image`, `expo-haptics` et consorts ne se chargent pas par rechargement à
chaud. Le projet est en génération native continue : ni `ios/` ni `android/`
n'est versionné, `expo run:*` les régénère. Penser à les supprimer après la
recette pour ne pas les commiter par accident.

---

## 5. Après la recette

```bash
pkill -f readonly-proxy; pkill -f "expo start"
xcrun simctl shutdown all
adb emu kill
rm -rf apps/mobile/ios apps/mobile/android
```
