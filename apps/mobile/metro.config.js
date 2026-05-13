// Configuration Metro.
//
// Depuis Expo SDK 52, `getDefaultConfig` détecte automatiquement le
// monorepo pnpm et configure `watchFolders` + `nodeModulesPaths` pour
// inclure tous les workspaces. Pas besoin d'override manuel.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './src/styles/global.css',
});
