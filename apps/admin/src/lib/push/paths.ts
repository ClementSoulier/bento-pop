/**
 * Les routes que `pg_net` appelle, sans session : le middleware les laisse
 * passer, et chacune vérifie elle-même son jeton porteur (`auth.ts`).
 *
 * À part d'`auth.ts`, qui importe `node:crypto` : le middleware tourne sur
 * le runtime Edge, qui ne l'a pas.
 */
export function isPushWebhookPath(pathname: string): boolean {
  return pathname === '/api/push' || pathname.startsWith('/api/push/');
}
