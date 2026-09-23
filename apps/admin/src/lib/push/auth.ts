import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Le jeton porteur des routes d'envoi, que le coffre du projet mobile
 * présente (`push_webhook_token`) et que Coolify fournit au back-office
 * (`PUSH_WEBHOOK_TOKEN`, runtime). Chantier 17, §6.3 et §6.5.
 *
 * Comparé en temps constant, comme `/api/revalidate` de la landing, mais sur
 * les empreintes : elles ont toujours la même longueur, donc la durée de la
 * comparaison ne dit rien non plus de la longueur du jeton attendu.
 */
export function isAuthorizedPushCall(
  authorization: string | null,
  expected: string | undefined,
): boolean {
  if (!expected) return false;
  if (!authorization?.startsWith('Bearer ')) return false;
  const provided = authorization.slice('Bearer '.length);
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
