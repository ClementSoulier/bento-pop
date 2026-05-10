import type { ComponentType, SVGProps } from 'react';
import { ApplePodcastsIcon } from './ApplePodcastsIcon';
import { DeezerIcon } from './DeezerIcon';
import { InstagramIcon } from './InstagramIcon';
import { PinIcon } from './PinIcon';
import { PlayIcon } from './PlayIcon';
import { SpotifyIcon } from './SpotifyIcon';
import { TikTokIcon } from './TikTokIcon';
import { XIcon } from './XIcon';
import { YoutubeIcon } from './YoutubeIcon';

export type IconKey =
  | 'youtube'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'deezer'
  | 'apple'
  | 'play'
  | 'pin';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const iconRegistry: Record<IconKey, IconComponent> = {
  youtube: YoutubeIcon,
  spotify: SpotifyIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  deezer: DeezerIcon,
  apple: ApplePodcastsIcon,
  play: PlayIcon,
  pin: PinIcon,
};

export {
  ApplePodcastsIcon,
  DeezerIcon,
  InstagramIcon,
  PinIcon,
  PlayIcon,
  SpotifyIcon,
  TikTokIcon,
  XIcon,
  YoutubeIcon,
};
