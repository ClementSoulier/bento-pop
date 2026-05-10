// Types générés à terme par `supabase gen types typescript --linked`.
// V1 — typés à la main pour les tables landing + BO en attendant la
// liaison du projet Supabase distant.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type VoteOptionRow = { id: string; label: string };

type LandingVoteWeekFields = {
  id: string;
  week_tag: string;
  question: string;
  options: VoteOptionRow[];
  starts_at: string;
  ends_at: string;
  is_current: boolean;
  created_at: string;
};

type LandingVoteResponseFields = {
  id: string;
  week_id: string;
  option_id: string;
  anon_id: string;
  voted_at: string;
};

type LandingNewsletterSubscriberFields = {
  id: string;
  email: string;
  source: string;
  consent_at: string;
};

type AdminUserFields = {
  user_id: string;
  role: 'admin' | 'editor';
  created_at: string;
};

type LandingEventFields = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  place: string;
  stand: string;
  status: 'live' | 'soon' | 'done';
  status_label: string;
  replay_url: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type LandingTeamFields = {
  id: string;
  name: string;
  nick: string;
  bio: string;
  popy_path: string | null;
  photo_kind: 'gradient' | 'image';
  photo_from: string | null;
  photo_to: string | null;
  photo_url: string | null;
  initials: string;
  rotation: number;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type LinkKind =
  | 'youtube'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'discord'
  | 'mail'
  | 'deezer'
  | 'apple';

export type LinkSurface = 'social' | 'podcast' | 'contact';

type LandingLinkFields = {
  id: string;
  kind: LinkKind;
  name: string;
  url: string;
  enabled: boolean;
  surfaces: LinkSurface[];
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type CtaSlot = 'primary' | 'secondary';

type LandingCtaFields = {
  slot: CtaSlot;
  label: string;
  url: string;
  icon_key: string | null;
  updated_at: string;
};

type LandingHeroVideoFields = {
  id: 'singleton';
  youtube_id: string;
  title: string;
  episode_label: string;
  live: boolean;
  updated_at: string;
};

type LandingSettingsFields = {
  id: 'singleton';
  season_number: number;
  updated_at: string;
};

type LandingHeroTiktokFields = {
  id: 'singleton';
  tiktok_url: string | null;
  enabled: boolean;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: AdminUserFields;
        Insert: Omit<AdminUserFields, 'created_at' | 'role'> &
          Partial<Pick<AdminUserFields, 'created_at' | 'role'>>;
        Update: Partial<AdminUserFields>;
        Relationships: [];
      };
      landing_vote_weeks: {
        Row: LandingVoteWeekFields;
        Insert: Omit<LandingVoteWeekFields, 'id' | 'starts_at' | 'is_current' | 'created_at'> &
          Partial<Pick<LandingVoteWeekFields, 'id' | 'starts_at' | 'is_current' | 'created_at'>>;
        Update: Partial<LandingVoteWeekFields>;
        Relationships: [];
      };
      landing_vote_responses: {
        Row: LandingVoteResponseFields;
        Insert: Omit<LandingVoteResponseFields, 'id' | 'voted_at'> &
          Partial<Pick<LandingVoteResponseFields, 'id' | 'voted_at'>>;
        Update: Partial<LandingVoteResponseFields>;
        Relationships: [];
      };
      landing_newsletter_subscribers: {
        Row: LandingNewsletterSubscriberFields;
        Insert: Omit<LandingNewsletterSubscriberFields, 'id' | 'source' | 'consent_at'> &
          Partial<Pick<LandingNewsletterSubscriberFields, 'id' | 'source' | 'consent_at'>>;
        Update: Partial<LandingNewsletterSubscriberFields>;
        Relationships: [];
      };
      landing_events: {
        Row: LandingEventFields;
        Insert: Omit<LandingEventFields, 'id' | 'created_at' | 'updated_at' | 'stand' | 'status' | 'status_label' | 'display_order' | 'replay_url'> &
          Partial<Pick<LandingEventFields, 'id' | 'created_at' | 'updated_at' | 'stand' | 'status' | 'status_label' | 'display_order' | 'replay_url'>>;
        Update: Partial<LandingEventFields>;
        Relationships: [];
      };
      landing_team: {
        Row: LandingTeamFields;
        Insert: Omit<LandingTeamFields, 'id' | 'created_at' | 'updated_at' | 'bio' | 'popy_path' | 'photo_kind' | 'photo_from' | 'photo_to' | 'photo_url' | 'rotation' | 'display_order'> &
          Partial<Pick<LandingTeamFields, 'id' | 'created_at' | 'updated_at' | 'bio' | 'popy_path' | 'photo_kind' | 'photo_from' | 'photo_to' | 'photo_url' | 'rotation' | 'display_order'>>;
        Update: Partial<LandingTeamFields>;
        Relationships: [];
      };
      landing_links: {
        Row: LandingLinkFields;
        Insert: Omit<LandingLinkFields, 'id' | 'created_at' | 'updated_at' | 'url' | 'enabled' | 'surfaces' | 'display_order'> &
          Partial<Pick<LandingLinkFields, 'id' | 'created_at' | 'updated_at' | 'url' | 'enabled' | 'surfaces' | 'display_order'>>;
        Update: Partial<LandingLinkFields>;
        Relationships: [];
      };
      landing_ctas: {
        Row: LandingCtaFields;
        Insert: Omit<LandingCtaFields, 'updated_at' | 'icon_key'> &
          Partial<Pick<LandingCtaFields, 'updated_at' | 'icon_key'>>;
        Update: Partial<LandingCtaFields>;
        Relationships: [];
      };
      landing_hero_video: {
        Row: LandingHeroVideoFields;
        Insert: Omit<LandingHeroVideoFields, 'id' | 'updated_at' | 'live'> &
          Partial<Pick<LandingHeroVideoFields, 'id' | 'updated_at' | 'live'>>;
        Update: Partial<LandingHeroVideoFields>;
        Relationships: [];
      };
      landing_settings: {
        Row: LandingSettingsFields;
        Insert: Omit<LandingSettingsFields, 'id' | 'updated_at' | 'season_number'> &
          Partial<Pick<LandingSettingsFields, 'id' | 'updated_at' | 'season_number'>>;
        Update: Partial<LandingSettingsFields>;
        Relationships: [];
      };
      landing_hero_tiktok: {
        Row: LandingHeroTiktokFields;
        Insert: Omit<LandingHeroTiktokFields, 'id' | 'updated_at' | 'enabled' | 'tiktok_url'> &
          Partial<Pick<LandingHeroTiktokFields, 'id' | 'updated_at' | 'enabled' | 'tiktok_url'>>;
        Update: Partial<LandingHeroTiktokFields>;
        Relationships: [];
      };
    };
    Views: {
      landing_vote_results: {
        Row: { week_id: string; option_id: string; votes: number };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
