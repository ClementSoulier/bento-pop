/**
 * Schémas de contenu de la landing.
 *
 * Tous les modules `src/content/*.ts` retournent ces types via une fonction async.
 * Quand le backoffice arrivera, on swappera l'implémentation des fonctions vers
 * Supabase sans toucher aux composants — les types restent identiques.
 */

// ---------- Nav ----------
export type NavLink = { id: string; label: string; href: string };
export type NavCta = { label: string; href: string; iconKey: SocialIconKey | 'play' };

// ---------- Boutons / icônes partagées ----------
export type SocialIconKey = 'youtube' | 'spotify' | 'instagram' | 'tiktok' | 'x' | 'deezer' | 'apple';
export type CtaIconKey = SocialIconKey | 'play';

export type CTA = {
  label: string;
  href: string;
  variant: 'primary' | 'default';
  size?: 'md' | 'lg';
  iconKey?: CtaIconKey;
};

// ---------- Hero ----------
export type StickerLabel = {
  id: string;
  text: string;
  rotation: number;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  tone: 'red' | 'cream';
};

export type HeroBentoCell =
  | {
      kind: 'video';
      href: string;
      title: string;
      episodeLabel: string;
      live: boolean;
      /** Si présent, on rend un embed YouTube ; sinon, lien cliquable + play btn. */
      youtubeId?: string;
      gridArea: string;
    }
  | {
      kind: 'tiktok';
      videoId: string;
      postUrl: string;
      gridArea: string;
    }
  | { kind: 'popy'; mascotPath: string; gridArea: string }
  | {
      kind: 'tag';
      tone: 'jx' | 'pm' | 'dh' | 'cnv';
      title: string;
      subtitle: string;
      /** Photo plateau utilisée en background ; sinon → tint de couleur uni. */
      photoPath?: string;
      gridArea: string;
    };

export type FloatingPopyConfig = {
  id: string;
  mascotPath: string;
  size: number;
  rotation: number;
  delaySeconds: number;
  position: { top?: string; bottom?: string; left?: string; right?: string };
};

export type HeroVariant = 'A' | 'B' | 'C';

export type HeroContent = {
  variant: HeroVariant;
  eyebrow: string;
  headline: { prefix: string; accent: string; suffix: string };
  lead: { html: string };
  ctas: CTA[];
  stickers: StickerLabel[];
  bentoCells: HeroBentoCell[];
  floatingPopys: FloatingPopyConfig[];
};

// ---------- Agenda ----------
export type AgendaStatus = 'live' | 'soon' | 'done';

export type AgendaEvent = {
  id: string;
  date: string;
  title: string;
  place: string;
  stand: string;
  status: AgendaStatus;
  statusLabel: string;
  replayUrl?: string;
  order: number;
};

export type AgendaContent = {
  eyebrow: string;
  title: string;
  description: string;
  events: AgendaEvent[];
};

// ---------- Vote / Thermomètre ----------
export type VoteOption = { id: string; label: string };

export type VoteWeek = {
  id: string;
  weekTag: string;
  question: string;
  options: VoteOption[];
  closesAt: string;
};

export type VoteCounts = Record<string, number>;

export type ThermometreContent = {
  eyebrow: string;
  title: string;
  description: string;
  closingNote: string;
  fallback: VoteWeek;
  fallbackBaseCounts: VoteCounts;
};

// ---------- Univers ----------
export type UniversTone = 'cinema' | 'gaming' | 'japan' | 'societe';

export type UniversItem = {
  id: string;
  tone: UniversTone;
  /** Chemin vers la mascotte Popy affichée dans le badge de la carte. */
  mascotPath: string;
  title: string;
  description: string;
  tags: string[];
  order: number;
};

export type UniversContent = {
  eyebrow: string;
  title: string;
  description: string;
  items: UniversItem[];
};

// ---------- Debriefs / Podcast ----------
export type Platform = {
  id: string;
  label: string;
  href: string;
  iconKey: 'spotify' | 'youtube' | 'deezer' | 'apple';
};

export type DebriefsContent = {
  eyebrow: string;
  title: string;
  description: string;
  platforms: Platform[];
  spotifyShowId: string;
};

// ---------- Team ----------
export type TeamPhoto =
  | { kind: 'gradient'; from: string; to: string; initials: string }
  | { kind: 'image'; url: string; initials: string };

export type TeamMember = {
  id: string;
  name: string;
  nick: string;
  bio: string;
  photo: TeamPhoto;
  rotation: number;
  order: number;
};

export type TeamContent = {
  eyebrow: string;
  title: string;
  members: TeamMember[];
  quote: string;
};

// ---------- Footer ----------
export type SocialLink = {
  id: string;
  platform: 'youtube' | 'instagram' | 'x' | 'tiktok';
  href: string;
};

export type LegalLink = { id: string; label: string; href: string };

export type FooterContent = {
  socialsHeading: string;
  socials: SocialLink[];
  contactLine: string;
  contactEmail: string;
  legalLinks: LegalLink[];
  copyright: string;
};

// ---------- Aggregat global (optionnel) ----------
export type LandingContent = {
  nav: NavLink[];
  navCta: NavCta;
  hero: HeroContent;
  agenda: AgendaContent;
  thermometre: ThermometreContent;
  univers: UniversContent;
  debriefs: DebriefsContent;
  team: TeamContent;
  footer: FooterContent;
};
