// Déclarations de modules pour les assets statiques importés via `require` /
// `import ... from '*.png'`. Metro résout ces requires nativement ; ces
// déclarations existent uniquement pour TypeScript.
//
// On les met ici (pas dans `expo-env.d.ts`) car ce dernier est régénéré
// par Expo à chaque commande et ignore nos additions.

declare module '*.png' {
  const value: number;
  export default value;
}
declare module '*.jpg' {
  const value: number;
  export default value;
}
declare module '*.jpeg' {
  const value: number;
  export default value;
}
declare module '*.otf' {
  const value: number;
  export default value;
}
declare module '*.ttf' {
  const value: number;
  export default value;
}
