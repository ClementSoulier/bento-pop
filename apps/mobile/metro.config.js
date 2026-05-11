// Configuration Metro pour le monorepo pnpm.
// Metro doit savoir résoudre les modules depuis le node_modules à la racine
// (où pnpm hoist les deps partagées) en plus du node_modules local à l'app.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watcher sur toute la racine du monorepo pour détecter les changements
//    dans les packages partagés (@bento-pop/brand, etc.).
config.watchFolders = [workspaceRoot];

// 2. Résolution des deps : essaie d'abord le node_modules local, puis racine.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Désactive le hoisting "intelligent" — on veut une résolution stricte.
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, {
  input: './src/styles/global.css',
});
