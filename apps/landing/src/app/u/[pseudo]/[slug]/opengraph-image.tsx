/**
 * L'aperçu d'un bento nommé.
 *
 * Même rendu que celui du compte, qui lit son `slug` dans les paramètres de
 * route : chaque bento a donc sa propre image, et le HTML d'une page ne peut
 * plus montrer un bento différent de son aperçu.
 */
export { default, size, contentType, generateImageMetadata } from '../opengraph-image';
