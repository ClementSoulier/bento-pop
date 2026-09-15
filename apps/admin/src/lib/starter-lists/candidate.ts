/**
 * Un candidat d'une liste de départ : un titre, et un sous-titre seulement
 * quand il est sûr (l'auteur d'un livre, le studio de développement d'un jeu).
 * Pas d'année : une année douteuse est pire qu'une année absente.
 *
 * Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`, §5.7 et lot 2.
 */
export type StarterCandidate = { title: string; subtitle?: string };
