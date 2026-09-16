/**
 * X n'utilise pas `og:image` : il lui faut `twitter:image`, et les deux
 * conventions de fichier sont distinctes. Même raison qu'à l'étage du dessus.
 */
export { default, size, contentType, generateImageMetadata } from '../opengraph-image';
