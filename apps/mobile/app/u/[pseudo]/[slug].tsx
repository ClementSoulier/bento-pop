/**
 * `/u/<pseudo>/<slug>` : un bento nommé d'un compte.
 *
 * Même écran que `/u/<pseudo>`, qui lit son `slug` dans les paramètres de
 * route : sans lui, il rend le bento principal du compte et liste les autres ;
 * avec lui, il rend celui que l'adresse nomme. Le filtre part sur la ressource
 * imbriquée, donc un slug inconnu dit « Bento introuvable » au lieu de
 * retomber sur le principal (cf. `src/lib/public-bento.ts`).
 *
 * Le chemin est déjà revendiqué par les liens universels des deux plateformes,
 * `paths: ['/u/*']` côté iOS et `pathPrefix: "/u/"` côté Android : rien à
 * redéployer côté fichiers de liaison. Cf. `docs/UX-16-PLUSIEURS-BENTOS.md`
 * §5.3.
 */
export { default } from '../[pseudo]';
