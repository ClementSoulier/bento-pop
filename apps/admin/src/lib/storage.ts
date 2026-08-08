/**
 * Constantes partagées pour les uploads Supabase Storage.
 */

/**
 * `cacheControl` (en secondes) posé sur tout objet uploadé dans un bucket
 * public : 1 an.
 *
 * Pourquoi c'est sûr malgré la durée, sur les deux conventions de nommage
 * utilisées dans le BO :
 *
 * 1. Chemin en UUID (`PhotoUploader` : `${pathPrefix}${randomUUID()}.ext`) :
 *    un chemin donné n'est jamais réécrit, remplacer une photo génère un
 *    nouveau nom de fichier donc une nouvelle URL.
 * 2. Chemin stable + URL versionnée (`item-images` : `${itemId}/main.ext` en
 *    `upsert`) : l'objet est écrasé, mais l'URL stockée en base porte un
 *    `?v={timestamp}` régénéré à chaque upload, ce qui invalide le cache
 *    navigateur, CDN et React Native.
 *
 * Dans les deux cas le couple (URL, contenu) est immuable : rien à purger.
 *
 * ⚠️ Mesuré le 8 août 2026 sur le projet mobile : Supabase enregistre bien
 * cette valeur dans les metadata, mais son CDN sert `cache-control: no-cache`
 * quoi qu'on envoie (testé avec 3600, 31536000 et une valeur `immutable`).
 * Les objets restent revalidables par ETag, donc une revisite coûte un 304 à
 * 0 octet, mais on ne gagne pas le cache navigateur ferme espéré.
 *
 * On garde quand même la valeur correcte : elle est juste sur le fond, elle
 * prendra effet derrière un CDN maîtrisé (Cloudflare) ou sur une instance
 * Supabase auto-hébergée, et elle ne coûte rien.
 *
 * Ce qui règle réellement l'egress côté landing, c'est `next/image` : le
 * serveur Next récupère l'original une fois et sert ensuite tous les
 * visiteurs depuis son propre cache disque, avec un vrai `max-age` d'un an.
 */
export const STORAGE_CACHE_CONTROL = '31536000';
