import { cache } from 'react';
import type { CTA, CtaIconKey, HeroBentoCell, HeroContent } from '@/lib/content/schemas';
import { loadCtas } from '@/lib/content/ctas';
import { loadHeroVideo } from '@/lib/content/hero-video';
import { loadHeroTiktok } from '@/lib/content/hero-tiktok';
import { loadSettings } from '@/lib/content/settings';
import popyContent from '@bento-pop/brand/assets/mascot/popy-content.png';
import popyNani from '@bento-pop/brand/assets/mascot/popy-nani.png';
import popyFille from '@bento-pop/brand/assets/mascot/popy-fille.png';
import plateau01 from '@bento-pop/brand/assets/plateau/plateau-01.jpg';
import plateau02 from '@bento-pop/brand/assets/plateau/plateau-02.jpg';
import plateau03 from '@bento-pop/brand/assets/plateau/plateau-03.jpg';
import plateau04 from '@bento-pop/brand/assets/plateau/plateau-04.jpg';

const ICON_KEYS: ReadonlySet<CtaIconKey> = new Set([
  'youtube',
  'spotify',
  'instagram',
  'tiktok',
  'x',
  'deezer',
  'apple',
  'play',
]);

function toCta(
  record: { label: string; url: string; iconKey: string | null } | undefined,
  variant: 'primary' | 'default',
  fallback: CTA,
): CTA {
  if (!record) return fallback;
  const iconKey = record.iconKey && ICON_KEYS.has(record.iconKey as CtaIconKey)
    ? (record.iconKey as CtaIconKey)
    : fallback.iconKey;
  return {
    label: record.label,
    href: record.url,
    variant,
    size: 'lg',
    iconKey,
  };
}

const STATIC_CTAS: { primary: CTA; secondary: CTA } = {
  primary: {
    label: 'Regarder le dernier épisode',
    href: 'https://www.youtube.com/@BentoPop.Officiel',
    variant: 'primary',
    size: 'lg',
    iconKey: 'play',
  },
  secondary: {
    label: 'Écouter le Podcast',
    href: 'https://open.spotify.com/show/0HmT9Na37Ujd3pvTl4to89',
    variant: 'default',
    size: 'lg',
    iconKey: 'spotify',
  },
};

/**
 * Construit la liste des cellules du bento.
 *
 * Layout TikTok activé : la cellule TikTok prend toute la col 1 sur les
 * lignes 2-3 (vertical, naturel pour un short). Popy + Paris Manga
 * disparaissent — seuls JX/DH/PM/CNV remplissent les cols 2-3.
 *
 * Layout legacy (TikTok désactivé) : disposition d'origine avec la mascotte
 * Popy en col 1 ligne 2 et Paris Manga en col 1 ligne 3.
 */
function buildBentoCells(args: {
  heroVideo: { youtubeId: string; title: string; episodeLabel: string; live: boolean };
  tiktok: { enabled: boolean; videoId: string | null; postUrl: string | null };
}): HeroBentoCell[] {
  const { heroVideo, tiktok } = args;

  const videoCell: HeroBentoCell = {
    kind: 'video',
    href: `https://www.youtube.com/watch?v=${heroVideo.youtubeId}`,
    title: heroVideo.title,
    episodeLabel: heroVideo.episodeLabel,
    live: heroVideo.live,
    youtubeId: heroVideo.youtubeId,
    gridArea: '1 / 1 / 2 / 4',
  };

  if (tiktok.enabled && tiktok.videoId) {
    return [
      videoCell,
      {
        kind: 'tiktok',
        videoId: tiktok.videoId,
        postUrl: tiktok.postUrl ?? '',
        gridArea: '2 / 1 / 4 / 2',
      },
      { kind: 'tag', tone: 'jx', title: 'Japan Expo',  subtitle: 'Paris · juillet', photoPath: plateau01.src, gridArea: '2 / 2 / 3 / 3' },
      { kind: 'tag', tone: 'dh', title: 'Dark Hifus',  subtitle: 'en plateau',      photoPath: plateau02.src, gridArea: '2 / 3 / 3 / 4' },
      { kind: 'tag', tone: 'pm', title: 'Paris Manga', subtitle: 'octobre',         photoPath: plateau03.src, gridArea: '3 / 2 / 4 / 3' },
      { kind: 'tag', tone: 'cnv',title: '+12 étapes',  subtitle: 'en France',       photoPath: plateau04.src, gridArea: '3 / 3 / 4 / 4' },
    ];
  }

  return [
    videoCell,
    { kind: 'popy', mascotPath: popyFille.src,                                      gridArea: '2 / 1 / 3 / 2' },
    { kind: 'tag', tone: 'jx', title: 'Japan Expo',  subtitle: 'Paris · juillet', photoPath: plateau01.src, gridArea: '2 / 2 / 3 / 3' },
    { kind: 'tag', tone: 'dh', title: 'Dark Hifus',  subtitle: 'en plateau',      photoPath: plateau02.src, gridArea: '2 / 3 / 3 / 4' },
    { kind: 'tag', tone: 'pm', title: 'Paris Manga', subtitle: 'octobre',         photoPath: plateau03.src, gridArea: '3 / 1 / 4 / 2' },
    { kind: 'tag', tone: 'cnv',title: '+12 étapes',  subtitle: 'en France',       photoPath: plateau04.src, gridArea: '3 / 2 / 4 / 4' },
  ];
}

export const getHero = cache(async (): Promise<HeroContent> => {
  const [ctasMap, heroVideo, heroTiktok, settings] = await Promise.all([
    loadCtas(),
    loadHeroVideo(),
    loadHeroTiktok(),
    loadSettings(),
  ]);
  const ctas: CTA[] = [
    toCta(ctasMap?.primary, 'primary', STATIC_CTAS.primary),
    toCta(ctasMap?.secondary, 'default', STATIC_CTAS.secondary),
  ];

  return {
    variant: 'A',
    eyebrow: `Bento Pop · ${settings.seasonLabel}`,
    headline: {
      prefix: 'Le Talk-Show ',
      accent: 'Pop Culture',
      suffix: ' qui parcourt la France.',
    },
    lead: {
      html: 'Cinéma, Gaming, Mangas et Débats de société. Retrouvez <strong>Dark Hifus</strong> et sa bande en live depuis les plus grandes conventions, et tous les jeudi à <strong>18h</strong> sur YouTube.',
    },
    ctas,
    stickers: [
      {
        id: 'season',
        text: settings.seasonLabel,
        rotation: 8,
        position: { top: '-18px', right: '30px' },
        tone: 'red',
      },
      {
        id: 'schedule',
        text: 'Jeudi 18h',
        rotation: -6,
        position: { bottom: '-22px', left: '14%' },
        tone: 'cream',
      },
    ],
    bentoCells: buildBentoCells({ heroVideo, tiktok: heroTiktok }),
    floatingPopys: [
      {
        id: 'top-right',
        mascotPath: popyContent.src,
        size: 90,
        rotation: 8,
        delaySeconds: -0.5,
        position: { top: '12%', right: '4%' },
      },
      {
        id: 'bottom-left',
        mascotPath: popyNani.src,
        size: 75,
        rotation: -12,
        delaySeconds: -2,
        position: { bottom: '8%', left: '3%' },
      },
    ],
  };
});
