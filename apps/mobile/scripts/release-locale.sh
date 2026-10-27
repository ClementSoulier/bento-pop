#!/bin/bash
# Répétition de la build de sortie (chantier 29, §8 de docs/UX-29-RECETTE-DE-SORTIE.md) :
# la configuration Release d'iOS ou la variante release d'Android, comme EAS,
# mais construite sur ce Mac et branchée sur une pile Supabase LOCALE, jamais
# sur la production. macOS seulement.
#
#   scripts/release-locale.sh ios|android [dossier de la pile]
#
# Le dossier de la pile est celui que `supabase status --workdir` attend ;
# par défaut `apps/mobile`, dont la pile écoute sur 54331.
#
# iOS : une .app Release pour le simulateur, à installer avec
#   xcrun simctl install <appareil> <chemin affiché à la fin>
# Android : un APK release signé de la clé de débogage du gabarit, à installer
#   avec `adb install -r`, la pile atteinte par `adb reverse tcp:<port> tcp:<port>`.
#   Le trafic HTTP en clair y est autorisé, la pile locale n'ayant pas de TLS :
#   ce réglage ne touche que le dossier android/ généré, ignoré par git, donc
#   absent de ce qu'EAS construit.
set -euo pipefail
PLATFORM=${1:?usage : release-locale.sh ios|android [dossier de la pile]}
cd "$(dirname "$0")/.."
STACK=${2:-.}

ENV=$(supabase status --workdir "$STACK" -o env 2>/dev/null) \
  || { echo "Aucune pile Supabase démarrée dans « $STACK »." >&2; exit 1; }
API_URL=$(printf '%s\n' "$ENV" | sed -n 's/^API_URL="\(.*\)"$/\1/p')
ANON_KEY=$(printf '%s\n' "$ENV" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')
case "$API_URL" in
  http://127.0.0.1:*) ;;
  *) echo "Cible refusée : « $API_URL ». Seule une pile locale est admise." >&2; exit 1 ;;
esac
[ -n "$ANON_KEY" ] || { echo "Clé anonyme de la pile introuvable." >&2; exit 1; }
[ ! -e .env ] || { echo "Un .env traîne dans apps/mobile : refus, il pourrait viser la production." >&2; exit 1; }
export EXPO_PUBLIC_SUPABASE_URL="$API_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
# La landing par défaut, bento-pop.com, comme dans la vraie build.
unset EXPO_PUBLIC_LANDING_URL
# CocoaPods exige une locale UTF-8, qu'un shell non interactif n'a pas.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

case "$PLATFORM" in
  ios)
    CI=1 npx expo prebuild --platform ios --no-install
    (cd ios && pod install)
    xcodebuild -workspace ios/MonBentoPop.xcworkspace -scheme MonBentoPop -configuration Release \
      -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
      -derivedDataPath ios/build build
    APP=ios/build/Build/Products/Release-iphonesimulator/MonBentoPop.app
    echo "Cible compilée :"
    strings "$APP/EXConstants.bundle/app.config" | grep -oE "127\.0\.0\.1:[0-9]+|[a-z]+\.supabase\.co" | sort -u
    echo "Version : $(plutil -extract CFBundleShortVersionString raw "$APP/Info.plist")"
    echo "$PWD/$APP"
    ;;
  android)
    CI=1 npx expo prebuild --platform android --no-install
    MANIFEST=android/app/src/main/AndroidManifest.xml
    grep -q 'usesCleartextTraffic="true"' "$MANIFEST" \
      || sed -i '' 's/<application /<application android:usesCleartextTraffic="true" /' "$MANIFEST"
    (cd android && ./gradlew :app:assembleRelease --console=plain)
    APK=android/app/build/outputs/apk/release/app-release.apk
    echo "Cible compilée :"
    unzip -p "$APK" assets/app.config | grep -oE "127\.0\.0\.1:[0-9]+|[a-z]+\.supabase\.co" | sort -u
    echo "$PWD/$APK"
    ;;
  *)
    echo "Plateforme inconnue : « $PLATFORM ». ios ou android." >&2
    exit 1
    ;;
esac
