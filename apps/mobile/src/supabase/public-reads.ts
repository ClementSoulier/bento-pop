import type { SupabaseClientOptions } from '@supabase/supabase-js';

/**
 * Options d'authentification du client des lectures publiques.
 *
 * Le client principal fait attendre chaque requête, même publique, la fin du
 * renouvellement de la session. Sur une authentification lente ou en panne,
 * `auth-js` réessaie ce renouvellement jusqu'à 30 s en tenant sa file
 * d'attente : la page publique affichait « Connexion perdue » alors que les
 * données répondaient. Observé sur émulateur Android le 14 septembre 2026.
 *
 * Sans session, ce client n'attend rien, et il lit ce que lit n'importe quel
 * visiteur : la RLS anonyme. C'est aussi ce que la page publique doit montrer,
 * à son propriétaire compris.
 *
 * Deux protections, redondantes à dessein : sans persistance, le stockage de
 * l'app n'est jamais lu ; persistée par erreur, la session serait rangée sous
 * une autre clé que celle du client principal. Le test d'intégration les
 * vérifie ensemble et chacune seule.
 *
 * Isolé dans un module sans `react-native` pour que ce test vérifie ces
 * options-là, et pas une copie.
 */
export const PUBLIC_READS_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  storageKey: 'bento-pop-public-reads',
} as const satisfies NonNullable<SupabaseClientOptions<'public'>['auth']>;
