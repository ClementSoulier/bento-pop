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
  | 'manual'
  | 'user'    // soumis par un utilisateur via le nouveau flow (1.1.0+)
  | 'admin';  // créé directement par l'équipe via le BO

export type ItemStatus =
  | 'draft'
  | 'pending'
  | 'validated'
  | 'rejected'
  | 'merged';

export type ImageSuggestionStatus = 'pending' | 'accepted' | 'dismissed';

/** Nature d'un profil, cf. la migration `20260913000000_admin_users.sql`. */
export type UserKind = 'member' | 'editorial';

export type Database = {
  public: {
    Tables: {
      /**
       * Les cases. Celles du bento principal ont `edition_id` nul ; les
       * autres décrivent une édition hebdomadaire. Le nom est historique :
       * depuis `20260915100000_item_types_and_cases.sql`, ce qu'est un item
       * vit dans `item_types`, et chaque case porte un type.
       *
       * ⚠️ `key` n'est plus une `CategoryKey` depuis le chantier 13 : les six
       * cases du bento principal en portent une, les cases d'édition portent
       * une clé construite, `ed<édition>_<rang>`. Le type s'élargit donc à
       * `string`, et les clients qui n'attendent que les six la retraduisent
       * par `CATEGORY_BY_ID`, qui saute déjà ce qu'il ne connaît pas.
       */
      bento_categories: {
        Row: {
          id: number;
          key: CategoryKey | (string & {});
          label_fr: string;
          display_order: number;
          api_source: ExternalSource | (string & {});
          is_active: boolean;
          created_at: string;
          /** Type des items qu'accepte la case. Artiste et Créateur : Personne. */
          type_id: number;
          /** L'édition décrite, ou nul pour une case du bento principal. */
          edition_id: number | null;
          /** Ce que lit l'utilisateur. Pour une édition, la question. */
          prompt: string;
          /** Tampon court de la tuile pleine, capitales. */
          stamp: string;
          /** Genre grammatical de `prompt`, pour accorder les phrases. */
          gender: 'm' | 'f';
        };
        Insert: {
          key: string;
          label_fr: string;
          display_order?: number;
          api_source: ExternalSource | (string & {});
          is_active?: boolean;
          type_id: number;
          edition_id?: number | null;
          prompt: string;
          stamp: string;
          gender: 'm' | 'f';
        };
        Update: Partial<Database['public']['Tables']['bento_categories']['Insert']>;
        Relationships: [];
      };
      /**
       * Les éditions hebdomadaires, modèles de bento.
       *
       * `released_at` porte à la fois la date de sortie et le fait d'être
       * sortie : nul, l'édition est un brouillon que personne ne voit. La
       * lecture publique filtre `released_at <= now()`, donc la visibilité se
       * lit et ne se déclenche pas.
       */
      editions: {
        Row: {
          id: number;
          slug: string;
          title: string;
          released_at: string | null;
          /** Réservé au chantier 19, aucun client ne le lit. */
          show_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          title: string;
          released_at?: string | null;
          show_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['editions']['Insert']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          pseudo: string;
          display_name: string | null;
          terms_accepted_at: string | null;
          created_at: string;
          updated_at: string;
          /**
           * `member` : compte réel, `id` vaut son `auth.uid()`.
           * `editorial` : profil créé par l'équipe pour un créateur invité,
           * sans compte d'authentification. Ne compte pas comme utilisateur.
           */
          kind: UserKind;
          /**
           * Dernier démarrage de l'app, écrit par le client.
           *
           * **Toujours `null` à la lecture** depuis la migration
           * `20260915000000_close_privilege_gaps.sql` : un trigger détourne
           * les trois colonnes de télémétrie vers `user_telemetry`, que les
           * clients ne lisent pas. Elles restent écrivables parce que la 1.2.0
           * les écrit. Ne pas confondre avec `auth.users.last_sign_in_at`,
           * qui vaut la date de création : la session anonyme persiste.
           */
          last_seen_at: string | null;
          platform: 'ios' | 'android' | null;
          app_version: string | null;
        };
        Insert: {
          /** Pour un membre, doit valoir `auth.uid()`. Généré pour un éditorial. */
          id?: string;
          pseudo: string;
          display_name?: string | null;
          terms_accepted_at?: string | null;
          kind?: UserKind;
          last_seen_at?: string | null;
          platform?: 'ios' | 'android' | null;
          app_version?: string | null;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          /** Case d'origine, facultative : un livre n'a pas de case dans le bento principal. */
          category_id: number | null;
          /** Ce qu'est l'item, déduit de sa case quand il en a une. */
          type_id: number;
          external_source: ExternalSource;
          external_id: string | null;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          status: ItemStatus;
          submitted_by: string | null;
          submitted_at: string | null;
          validated_by: string | null;
          validated_at: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          rejected_reason: string | null;
          merged_into_id: string | null;
          image_credit: string | null;
        };
        Insert: {
          /** Posée, elle impose le type. Sinon, `type_id` est requis. */
          category_id?: number | null;
          type_id?: number;
          external_source: ExternalSource;
          external_id?: string | null;
          title: string;
          subtitle?: string | null;
          year?: number | null;
          image_url?: string | null;
          metadata?: Record<string, unknown>;
          // Tous les champs lifecycle sont remplis par triggers, mais on
          // les expose en Insert pour permettre à l'admin (service-role)
          // de bypasser quand il crée un draft ou valide à la main.
          status?: ItemStatus;
          submitted_by?: string | null;
          submitted_at?: string | null;
          validated_by?: string | null;
          validated_at?: string | null;
          rejected_by?: string | null;
          rejected_at?: string | null;
          rejected_reason?: string | null;
          merged_into_id?: string | null;
          image_credit?: string | null;
        };
        Update: Partial<Database['public']['Tables']['items']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'items_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'bento_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_submitted_by_fkey';
            columns: ['submitted_by'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_merged_into_id_fkey';
            columns: ['merged_into_id'];
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      item_aliases: {
        Row: {
          id: string;
          item_id: string;
          alias: string;
          created_at: string;
        };
        Insert: {
          item_id: string;
          alias: string;
        };
        Update: Partial<Database['public']['Tables']['item_aliases']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'item_aliases_item_id_fkey';
            columns: ['item_id'];
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      item_image_suggestions: {
        Row: {
          id: string;
          item_id: string;
          source_url: string;
          thumbnail_url: string | null;
          attribution: string | null;
          license_code: string | null;
          wikipedia_page_url: string | null;
          fetched_at: string;
          status: ImageSuggestionStatus;
        };
        Insert: {
          item_id: string;
          source_url: string;
          thumbnail_url?: string | null;
          attribution?: string | null;
          license_code?: string | null;
          wikipedia_page_url?: string | null;
          status?: ImageSuggestionStatus;
        };
        Update: Partial<Database['public']['Tables']['item_image_suggestions']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'item_image_suggestions_item_id_fkey';
            columns: ['item_id'];
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
        ];
      };
      bentos: {
        Row: {
          id: string;
          user_id: string;
          /**
           * Adresse publique du bento : `/u/<pseudo>/<slug>`. Chantier 16.
           *
           * Absente d'`Insert` et d'`Update` **volontairement** : les droits
           * colonne n'accordent au client que `insert (user_id)` et
           * `update (published_at)`. Un secondaire se crée par
           * `create_bento()`, et le compilateur le rappelle ici plutôt que
           * de laisser découvrir un 403 à l'exécution.
           *
           * Le back-office, lui, écrit avec la clé service-role, qui n'est
           * pas soumise à ces grants : il assume la conversion à un seul
           * endroit, `apps/admin/src/app/(protected)/bentos/actions.ts`.
           */
          slug: string;
          /** Le bento que `/u/<pseudo>` met en avant. Un seul par compte. */
          is_primary: boolean;
          /**
           * L'édition que ce bento compose, ou nul pour un bento libre.
           *
           * Absente d'`Insert` pour la même raison que `slug` : seule
           * `create_edition_bento()` l'écrit côté client. Chantier 13.
           */
          edition_id: number | null;
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
      app_config: {
        Row: {
          id: number;
          maintenance_mode: boolean;
          maintenance_title: string;
          maintenance_message: string;
          ios_min_version: string;
          ios_latest_version: string;
          android_min_version: string | null;
          android_latest_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          maintenance_mode?: boolean;
          maintenance_title?: string;
          maintenance_message?: string;
          ios_min_version?: string;
          ios_latest_version?: string;
          android_min_version?: string | null;
          android_latest_version?: string | null;
        };
        Update: Partial<Database['public']['Tables']['app_config']['Insert']>;
        Relationships: [];
      };
      user_deletions: {
        Row: {
          id: string;
          /**
           * Profil supprimé. Sans clé étrangère, et sans pouvoir en avoir :
           * la ligne qu'il désigne n'existe plus au moment de l'insertion.
           */
          deleted_user_id: string;
          kind: UserKind;
          reason: string;
          /** Email de l'administrateur. */
          deleted_by: string;
          deleted_at: string;
        };
        Insert: {
          deleted_user_id: string;
          kind: UserKind;
          reason: string;
          deleted_by: string;
        };
        Update: Partial<Database['public']['Tables']['user_deletions']['Insert']>;
        Relationships: [];
      };
      /**
       * Télémétrie des membres, lue en service-role uniquement : RLS active,
       * aucune policy, aucun privilège client. Remplie par le trigger
       * `users_divert_telemetry` à chaque écriture de télémétrie sur `users`.
       */
      user_telemetry: {
        Row: {
          user_id: string;
          last_seen_at: string | null;
          platform: 'ios' | 'android' | null;
          app_version: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          last_seen_at?: string | null;
          platform?: 'ios' | 'android' | null;
          app_version?: string | null;
        };
        Update: Partial<Database['public']['Tables']['user_telemetry']['Insert']>;
        Relationships: [];
      };
      /**
       * Ce qu'est un élément du catalogue, qui décide où l'on cherche.
       * Distinct de la case qui l'accueille : Artiste et Créateur de contenu
       * sont deux cases de type Personne. Lisible quand il est actif, écrit
       * par le seul back-office. Cf. `docs/UX-15-NOUVELLES-CATEGORIES.md`.
       */
      item_types: {
        Row: {
          id: number;
          /** Définitive : `film`, `person`, `video_game`… */
          key: string;
          label_fr: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          key: string;
          label_fr: string;
          display_order?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<Database['public']['Tables']['item_types']['Insert'], 'key'>>;
        Relationships: [];
      };
    };
    Views: { [_: string]: never };
    Functions: {
      search_items: {
        Args: { q: string; category_key: CategoryKey; lim?: number };
        Returns: Array<{
          id: string;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          image_credit: string | null;
          score: number;
        }>;
      };
      find_similar_items: {
        Args: {
          q: string;
          category_key: CategoryKey;
          threshold?: number;
          lim?: number;
        };
        Returns: Array<{
          id: string;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          score: number;
        }>;
      };
      popular_items: {
        Args: {
          category_key: CategoryKey;
          lim?: number;
          /**
           * Retire un item du résultat. Sert à ne pas reproposer celui qui
           * occupe déjà la case ouverte.
           */
          exclude_item?: string | null;
        };
        Returns: Array<{
          id: string;
          title: string;
          subtitle: string | null;
          year: number | null;
          image_url: string | null;
          image_credit: string | null;
          /** Nombre de bentos **publiés** qui contiennent cet item. */
          picks: number;
        }>;
      };
      /**
       * Recherche de l'onglet « Trouver » : pseudos et items, en un appel.
       *
       * Ne renvoie **que** des bentos publiés, ce qui est le coeur du
       * chantier 6 : au 13 septembre 2026, 46 des 72 comptes n'en avaient
       * aucun et menaient tous à « Bento introuvable ».
       */
      /**
       * Crée un bento secondaire pour `auth.uid()`, toujours non principal.
       *
       * Seule voie d'écriture du `slug` côté client : les droits colonne ne
       * l'accordent pas. Lève sur un slug mal formé, réservé, déjà pris, ou
       * au-delà du plafond par compte. Cf. chantier 16.
       */
      create_bento: {
        Args: { p_slug: string };
        Returns: string;
      };
      /**
       * Premier bento d'un compte : profil, bento, cases et publication en
       * **une transaction**. Chantier 9.
       *
       * Une suite d'appels PostgREST laisserait un profil orphelin si les
       * cases échouent, ou des cases orphelines si la publication échoue.
       * Refuse un compte qui a déjà un profil, un bento incomplet, un pseudo
       * pris ou mal formé, et l'absence d'acceptation des règles.
       */
      publish_first_bento: {
        Args: {
          p_pseudo: string;
          p_terms_accepted_at: string | null;
          /** `[{ category_id, item_id }, …]`, les six cases du brouillon. */
          p_items: { category_id: number; item_id: string }[];
        };
        Returns: string;
      };
      search_bentos: {
        Args: { q: string; lim?: number };
        Returns: Array<{
          bento_id: string;
          /** Adresse du bento trouvé, chantier 16 : `/u/<pseudo>/<slug>`. */
          slug: string;
          /** Vrai pour le bento que `/u/<pseudo>` met en avant. */
          is_primary: boolean;
          pseudo: string;
          display_name: string | null;
          is_featured: boolean;
          /** `'pseudo'` ou `'item'`. Typé `string` : le SQL ne contraint pas. */
          match_kind: string;
          /** Renseignés uniquement quand `match_kind` vaut `'item'`. */
          item_id: string | null;
          item_title: string | null;
          category_id: number | null;
          score: number;
        }>;
      };
      /**
       * Items présents dans **au moins deux** bentos publiés. Sert de bloc
       * de suggestions avant la frappe : ce sont exactement les recherches
       * qui ramènent plus d'une personne.
       *
       * Pas d'`image_url` dans la signature : le bloc n'affiche pas
       * d'images, et l'exposer inviterait à en afficher sans repasser par
       * la décision (cf. `docs/UX-06-TROUVER.md` §6.2).
       */
      shared_items: {
        Args: { lim?: number };
        Returns: Array<{
          id: string;
          title: string;
          category_id: number;
          /** Nombre de bentos publiés contenant cet item. Toujours >= 2. */
          picks: number;
        }>;
      };
      admin_delete_user: {
        Args: { target_id: string; reason: string; admin_email: string };
        /** Type du profil supprimé, pour savoir s'il faut aussi purger `auth`. */
        Returns: UserKind;
      };
      purge_user_deletions: {
        Args: Record<string, never>;
        /** Nombre de lignes retirées du registre. */
        Returns: number;
      };
      admin_merge_items: {
        Args: {
          canonical_id: string;
          loser_ids: string[];
        };
        Returns: void;
      };
    };
    Enums: { [_: string]: never };
    CompositeTypes: { [_: string]: never };
  };
};
