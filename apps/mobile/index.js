// Entry point local pour Metro / EAS Build.
//
// Pourquoi un `index.js` plutôt que `main: "expo-router/entry"` direct dans
// package.json : en monorepo pnpm, certains scripts EAS (notamment
// `react-native-xcode.sh` qui packe le JS bundle pour la build iOS release)
// traitent `main` comme un chemin fichier, pas un module specifier. Quand ils
// ne trouvent pas `expo-router/entry.js` comme fichier local, ils fallback
// sur `expo/AppEntry.js` (legacy) qui essaie d'importer `../../App` — chemin
// qui n'existe pas dans une install pnpm hoistée et qui plante le bundling.
//
// En pointant `main: "./index.js"`, le fichier existe localement et fait
// l'indirection vers expo-router au runtime via un import classique.
import 'expo-router/entry';
