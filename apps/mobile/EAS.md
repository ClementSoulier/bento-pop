# EAS Build · Mon Bento Pop

Guide rapide pour produire les premiers binaires iOS / Android via EAS.

## Pré-requis (une fois)

1. Compte Expo : `eas login` (gratuit tant qu'on reste sous le free tier de builds)
2. **Compte Apple Developer** ($99/an) — OK ✓
3. **Compte Google Play Developer** ($25 one-time) — pour plus tard
4. CLI : `pnpm dlx eas-cli` (ou `npm i -g eas-cli`)

## Configuration des secrets EAS (une fois)

Plutôt que de mettre les credentials Supabase/TMDb en clair dans `eas.json`, on les stocke dans EAS Secrets (chiffrés côté Expo, jamais commités). Depuis `apps/mobile/` :

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>"
eas secret:create --scope project --name EXPO_PUBLIC_TMDB_TOKEN --value "<jwt>"
```

Vérifier : `eas secret:list`.

## Lancer le 1er build (preview, iOS simulator)

```bash
cd apps/mobile
eas build:configure   # 1ère fois seulement — connecte le projet à EAS
eas build --profile preview --platform ios --simulator
```

Le `--simulator` produit un `.app` directement lançable dans le simulateur Xcode, sans avoir à enregistrer un device dans le Developer Portal. **Recommandé pour la 1ère vérif**.

Quand le build termine (~10-15 min), `eas` affiche un lien :
- Télécharge le `.app`
- Glisse-dépose dans le simulateur iOS lancé (`open -a Simulator`)
- L'app installée se lance comme depuis l'App Store

## Build TestFlight (device réel iOS)

Pour distribuer aux beta-testeurs via TestFlight :

```bash
eas build --profile preview --platform ios
# Pas de --simulator → produit un .ipa signé
```

EAS provisionnera automatiquement :
- Certificat de distribution
- Profile de provisionnement
- Bundle ID enregistré dans App Store Connect

À la fin :

```bash
eas submit --profile preview --platform ios --latest
# Upload le dernier build vers TestFlight
```

Le build apparaît dans **App Store Connect → TestFlight → Builds** sous 30 min. Ajoute des testeurs internes (jusqu'à 100 emails Apple ID) sans review Apple. Pour des testeurs externes (250 max) : review légère sous 24h.

## Build de production

```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios --latest
# Soumet pour review App Store (sous 24-72h en général)
```

Avant ça, finir les actions manuelles **store-side** :
- App Store Connect → app record (icon haute qualité, description FR, screenshots 6.5" + 6.7", URL privacy + support, age rating)
- App Privacy → labels nutritionnels (cf. `STORE-COMPLIANCE.md` section 6)
- Tester sur device réel via TestFlight d'abord

## En cas d'incident

- **Build qui ne démarre pas** : check `eas.json` syntaxe + `eas build:configure` réinitialise
- **Secrets pas pris en compte** : `eas secret:list` puis `eas secret:delete` + recreate
- **Bundle JS plante au cold start** : revenir au commit précédent + `eas build --clear-cache --profile preview`
- **Version / build number conflict** : `autoIncrement: true` dans `eas.json:build.production` gère, mais en cas de souci `eas build --auto-submit` clean

## Logs / monitoring après publication

EAS Build et Apple TestFlight ne fournissent pas de remote logging. Pour avoir des crash reports :
- Sentry (~free tier généreux) → installation 30 min
- Expo Application Services Insights (en beta, gratuit)

À traiter après le 1er TestFlight quand on a besoin de visibilité.
