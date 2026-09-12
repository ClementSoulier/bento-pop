/**
 * Adaptation des URL d'image du catalogue à la taille réellement affichée.
 *
 * Mesuré le 12 septembre 2026 sur les 205 items illustrés de la base :
 * 82 images viennent de TMDb en `w500`, 117 du stockage Supabase, 6
 * d'ailleurs.
 *
 * Pour les 117 images Supabase, il n'y a **rien à faire côté client** : la
 * transformation d'image de Supabase répond `403 FeatureNotEnabled` sur le
 * plan gratuit, et elles sont donc servies telles quelles, jusqu'à 960 × 1441
 * px pour une tuile qui en affiche 348. Le seul levier est la recompression à
 * l'upload dans le BO.
 *
 * Pour les 82 images TMDb en revanche, la taille est dans l'URL et il suffit
 * de la demander plus petite. C'est gratuit, immédiat, et sans effet de bord :
 * TMDb sert toutes ces largeurs depuis le même CDN.
 */

/**
 * Largeurs de poster publiées par TMDb. Toute autre valeur renvoie une 404 :
 * on ne peut pas se contenter d'écrire la largeur voulue dans l'URL, il faut
 * choisir dans cette liste.
 */
const TMDB_POSTER_WIDTHS = [92, 154, 185, 342, 500, 780] as const;

/**
 * `https://image.tmdb.org/t/p/w500/abc.jpg` → capture la largeur et le reste.
 * Ancré sur l'hôte : une URL d'un autre domaine qui contiendrait `/t/p/w500/`
 * ne doit pas être réécrite.
 */
const TMDB_POSTER = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w(\d+)(\/.+)$/;

/**
 * Marge acceptée sous la largeur strictement nécessaire.
 *
 * Sans elle, une tuile de 116 pt sur un écran ×3 réclame 348 px et rate
 * `w342` de six pixels, ce qui la ferait retomber sur `w500` : le cas de
 * l'iPhone 17, donc l'appareil le plus courant, et la mesure perdrait tout
 * son intérêt.
 *
 * Le compromis chiffré, sur trois affiches réellement téléchargées :
 * `w500` pèse 104 Ko en moyenne, `w342` en pèse 52. On divise le poids par
 * deux contre un agrandissement de 1,7 %, invisible sur une tuile de la
 * taille d'une vignette.
 *
 * 10 % est la borne au-delà de laquelle l'agrandissement commencerait à se
 * voir sur les aplats et les titres incrustés dans les affiches.
 */
const UNDERSHOOT = 0.9;

/**
 * Renvoie l'URL de l'image à la plus petite taille TMDb qui couvre encore
 * `displayWidth` points sur un écran `pixelRatio`.
 *
 * Les URL non TMDb, et les URL TMDb déjà plus petites que nécessaire, sont
 * renvoyées inchangées : cette fonction ne doit jamais dégrader une image ni
 * inventer une variante qui n'existe pas.
 */
export function itemImageUrl(
  url: string,
  displayWidth: number,
  pixelRatio = 3,
): string {
  const match = TMDB_POSTER.exec(url);
  if (!match) return url;

  const [, prefix, currentRaw, path] = match;
  const current = Number(currentRaw);
  if (!Number.isFinite(current)) return url;

  const needed = Math.ceil(displayWidth * pixelRatio * UNDERSHOOT);
  const target = TMDB_POSTER_WIDTHS.find((w) => w >= needed);

  // Rien d'assez grand dans la liste, ou l'URL demande déjà moins que ce
  // qu'il faut : on ne touche à rien plutôt que d'agrandir.
  if (!target || target >= current) return url;

  return `${prefix}w${target}${path}`;
}
