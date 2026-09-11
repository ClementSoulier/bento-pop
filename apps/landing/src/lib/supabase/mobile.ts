import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@bento-pop/supabase-mobile/types';

/**
 * Client Supabase du projet MOBILE (« Mon Bento Pop »), en clé **anon**.
 *
 * Bento Pop a deux projets Supabase distincts :
 *   - landing + admin : tables `landing_*`, épisodes, votes, newsletter.
 *     C'est ce que servent `supabase/server.ts` et `supabase/admin.ts`.
 *   - mobile : `users`, `bentos`, `bento_items`, `items`. C'est là que
 *     vivent les bentos affichés par la page publique `/u/[pseudo]`.
 *
 * ⚠️ **Jamais la service-role ici.** Le BO admin (`apps/admin`) utilise la
 * service-role du projet mobile pour ses écritures (toggle `is_featured`),
 * mais la landing est un site public : une clé qui bypasse la RLS n'a rien
 * à y faire. La clé anon suffit, parce que la RLS du projet mobile autorise
 * déjà exactement la lecture dont on a besoin, et rien de plus :
 *
 *   users        `users_read_all`                       → lecture publique
 *   bentos       `bentos_read_published`                → publiés seulement
 *   bento_items  `bento_items_read_published`           → si bento publié
 *   items        `items_read_validated_or_own_pending`  → `validated` seulement
 *
 * Un bento non publié, ou un item en attente de modération, est donc
 * invisible depuis ce client **par construction**, pas par un filtre
 * applicatif qu'on pourrait oublier.
 *
 * Pas de cookies, pas de session : le client doit rester utilisable depuis
 * `generateStaticParams`, le sitemap et les pages ISR, au même titre que
 * `createAnonServerClient()` côté projet landing.
 *
 * Renvoie `null` si les variables d'env manquent. L'appelant traite ce cas
 * comme « bento introuvable » : une landing déployée sans les variables
 * mobiles doit continuer à servir tout le reste du site.
 */
export type MobileClient = SupabaseClient<Database>;

export function createMobileAnonClient(): MobileClient | null {
  const url = process.env.NEXT_PUBLIC_MOBILE_SUPABASE_URL;
  const anonKey = process.env.MOBILE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
