import { createHmac } from 'node:crypto';

/**
 * Lien d'aperçu d'un article non publié (docs/BLOG.md D12).
 *
 * La landing ne voit pas les brouillons en anonyme. Le BO lui envoie donc un lien
 * signé : `/blog/apercu/<id>?exp=<secondes>&sig=<hmac>`. La landing recalcule la
 * signature avec le même secret, vérifie l'échéance, puis lit l'article par sa clé
 * de service.
 *
 * Le secret est `REVALIDATE_TOKEN`, déjà partagé par les deux apps. Le préfixe
 * `blog-preview:` sépare cet usage de la purge du cache : une signature d'aperçu ne
 * peut servir à rien d'autre. Même calcul dans `apps/landing/src/lib/blog/preview.ts`.
 */

export const PREVIEW_TTL_SECONDS = 24 * 60 * 60;

export function signPreview(postId: string, exp: number, secret: string): string {
  return createHmac('sha256', secret).update(`blog-preview:${postId}:${exp}`).digest('base64url');
}

export function buildPreviewUrl(
  landingUrl: string,
  postId: string,
  secret: string,
  nowMs: number = Date.now(),
): string {
  const exp = Math.floor(nowMs / 1000) + PREVIEW_TTL_SECONDS;
  const sig = signPreview(postId, exp, secret);
  const base = landingUrl.replace(/\/$/, '');
  return `${base}/blog/apercu/${postId}?exp=${exp}&sig=${sig}`;
}
