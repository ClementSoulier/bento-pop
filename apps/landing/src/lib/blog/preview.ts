import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Vérifie un lien d'aperçu signé par le BO (docs/BLOG.md D12) : même calcul que
 * `apps/admin/src/lib/blog/preview.ts`, sur `REVALIDATE_TOKEN`.
 *
 * Refuse sans secret configuré, après l'échéance, ou au-delà de 25 h dans le futur
 * (le BO signe pour 24 h : une échéance plus lointaine ne vient pas de lui).
 */
const MAX_AHEAD_SECONDS = 25 * 60 * 60;

export function verifyPreview(
  postId: string,
  exp: string | undefined,
  sig: string | undefined,
  secret: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!secret || !exp || !sig || !/^\d{1,12}$/.test(exp)) return false;
  const expSeconds = Number(exp);
  const now = Math.floor(nowMs / 1000);
  if (expSeconds < now || expSeconds > now + MAX_AHEAD_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`blog-preview:${postId}:${expSeconds}`)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'base64url');
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
