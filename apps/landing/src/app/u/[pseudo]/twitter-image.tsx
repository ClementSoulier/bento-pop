/**
 * X n'utilise pas `og:image` : il lui faut `twitter:image`. Next ne dérive
 * pas l'une de l'autre, les deux conventions de fichier sont distinctes.
 * On réexporte donc le même rendu plutôt que d'en maintenir deux.
 *
 * Le test de fumée du lot 7 vérifie que les deux balises sont bien
 * présentes dans le HTML, pour que cette hypothèse ne se démente pas en
 * silence à la prochaine version de Next.
 */
export { default, size, contentType, generateImageMetadata } from './opengraph-image';
