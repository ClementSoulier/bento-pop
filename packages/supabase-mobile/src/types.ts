/**
 * Types Supabase générés manuellement pour le MVP.
 *
 * À régénérer automatiquement plus tard avec :
 *   supabase gen types typescript --linked > apps/mobile/src/supabase/types.ts
 *
 * (depuis `/supabase-mobile/` une fois le projet linké)
 */

export type CategoryKey =
  | 'film'
  | 'series'
  | 'artist'
  | 'track'
  | 'creator'
  | 'place';

export type ExternalSource =
  | 'tmdb'
  | 'musicbrainz'
  | 'wikidata'
  | 'osm'
  | 'igdb'
  | 'manual';

export type Database = {
  public: {
    Tables: {
      bento_categories: {
        Row: {
          id: number;
          key: CategoryKey;
          label_fr: string;
          display_order: number;
          api_source: ExternalSource;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          key: CategoryKey;
          label_fr: string;
          display_order?: number;
          api_source: ExternalSource;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['bento_categories']['Insert']>;
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
        Insert: {
          id: string;
          pseudo: string;
          display_name?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          category_id: number;
          external_source: ExternalSource;
          external_id: string | null;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          category_id: number;
          external_source: ExternalSource;
          external_id?: string | null;
          title: string;
          subtitle?: string | null;
          year?: number | null;
          image_url?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database['public']['Tables']['items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'items_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'bento_categories';
            referencedColumns: ['id'];
          },
        ];
      };
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
        Insert: {
          user_id: string;
          is_featured?: boolean;
          featured_order?: number | null;
          published_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bentos']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bentos_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      bento_items: {
        Row: {
          bento_id: string;
          category_id: number;
          item_id: string;
          added_at: string;
        };
        Insert: {
          bento_id: string;
          category_id: number;
          item_id: string;
        };
        Update: Partial<Database['public']['Tables']['bento_items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'bento_items_bento_id_fkey';
            columns: ['bento_id'];
            referencedRelation: 'bentos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bento_items_item_id_fkey';
            columns: ['item_id'];
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_kind: 'bento' | 'pseudo';
          target_pseudo: string;
          target_bento_id: string | null;
          reason: string | null;
          status: 'pending' | 'reviewed' | 'dismissed';
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          reporter_id?: string | null;
          target_kind: 'bento' | 'pseudo';
          target_pseudo: string;
          target_bento_id?: string | null;
          reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reports']['Row']>;
        Relationships: [];
      };
      blocked_pseudo_patterns: {
        Row: {
          id: number;
          pattern: string;
          label: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          pattern: string;
          label: string;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['blocked_pseudo_patterns']['Insert']>;
        Relationships: [];
      };
    };
    Views: { [_: string]: never };
    Functions: { [_: string]: never };
    Enums: { [_: string]: never };
    CompositeTypes: { [_: string]: never };
  };
};
