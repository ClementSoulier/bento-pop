import type { ComponentType, SVGProps } from 'react';
import { ApplePodcastsIcon } from './ApplePodcastsIcon';
import { DeezerIcon } from './DeezerIcon';
import { GlobeIcon } from './GlobeIcon';
import { InstagramIcon } from './InstagramIcon';
import { PinIcon } from './PinIcon';
import { PlayIcon } from './PlayIcon';
import { SpotifyIcon } from './SpotifyIcon';
import { TikTokIcon } from './TikTokIcon';
import { TwitchIcon } from './TwitchIcon';
import { XIcon } from './XIcon';
import { YoutubeIcon } from './YoutubeIcon';

export type IconKey =
  | 'youtube'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'twitch'
  | 'x'
  | 'deezer'
  | 'apple'
  | 'play'
  | 'pin'
  | 'globe';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const iconRegistry: Record<IconKey, IconComponent> = {
  youtube: YoutubeIcon,
  spotify: SpotifyIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  twitch: TwitchIcon,
  x: XIcon,
  deezer: DeezerIcon,
  apple: ApplePodcastsIcon,
  play: PlayIcon,
  pin: PinIcon,
  globe: GlobeIcon,
};

export {
  ApplePodcastsIcon,
  DeezerIcon,
  GlobeIcon,
  InstagramIcon,
  PinIcon,
  PlayIcon,
  SpotifyIcon,
  TikTokIcon,
  TwitchIcon,
  XIcon,
  YoutubeIcon,
};
