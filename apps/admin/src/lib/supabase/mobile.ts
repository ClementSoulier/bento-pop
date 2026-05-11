import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase pour le projet MOBILE (« Mon Bento Pop »).
 *
 * Le BO admin gère deux projets Supabase distincts :
 *   - landing (config.toml dans `/supabase/`) : event/poll/team/links — auth admin
 *   - mobile  (config.toml dans `/apps/mobile/supabase/`) : users, bentos,
 *     items — pas d'auth admin, les utilisateurs s'auth anonymously
 *
 * Pour les opérations admin (toggle is_featured d'un bento), on utilise la
 * service-role key du projet mobile : bypass RLS, accès écriture complet.
 * Cette key ne quitte JAMAIS le serveur (`'server-only'` import).
 *
 * Types : on n'importe pas tout le schema mobile ici — au lieu de ça on
 * type localement les seules tables qu'on manipule (bentos, users), ce qui
 * évite la dépendance circulaire avec @bento-pop/mobile. Une refacto en
 * package partagé `@bento-pop/supabase-mobile` viendra quand le BO mobile
 * grossit.
 */

// Types minimaux des tables Supabase mobile qu'on manipule depuis l'admin.
export type MobileDatabase = {
  public: {
    Tables: {
      bentos: {
        Row: {
          id: string;
          user_id: string;
          is_featured: boolean;
          featured_order: number | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<MobileDatabase['public']['Tables']['bentos']['Row']>;
        Update: Partial<MobileDatabase['public']['Tables']['bentos']['Row']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          pseudo: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<MobileDatabase['public']['Tables']['users']['Row']>;
        Update: Partial<MobileDatabase['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      bento_items: {
        Row: {
          bento_id: string;
          category_id: number;
          item_id: string;
          added_at: string;
        };
        Insert: Partial<MobileDatabase['public']['Tables']['bento_items']['Row']>;
        Update: Partial<MobileDatabase['public']['Tables']['bento_items']['Row']>;
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          category_id: number;
          external_source: string;
          external_id: string | null;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<MobileDatabase['public']['Tables']['items']['Row']>;
        Update: Partial<MobileDatabase['public']['Tables']['items']['Row']>;
        Relationships: [];
      };
    };
    Views: { [_: string]: never };
    Functions: { [_: string]: never };
    Enums: { [_: string]: never };
    CompositeTypes: { [_: string]: never };
  };
};

/**
 * Crée le client mobile en service-role. Retourne `null` si les env vars
 * ne sont pas configurées (cas dev sans BO mobile activé).
 */
export function createMobileClient() {
  const url = process.env.MOBILE_SUPABASE_URL;
  const serviceKey = process.env.MOBILE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient<MobileDatabase>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
