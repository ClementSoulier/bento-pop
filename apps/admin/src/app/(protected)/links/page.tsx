import { PageShell } from '@/components/AppShell/PageShell';
import { createServerClient } from '@/lib/supabase/server';
import {
  LinksClient,
  type CtaRow,
  type HeroTiktokRow,
  type HeroVideoRow,
  type LinkRow,
} from './LinksClient';

export const dynamic = 'force-dynamic';

const HERO_VIDEO_FALLBACK: HeroVideoRow = {
  youtubeId: '8JVSPC2ozOw',
  title: 'Replay · Dernier épisode',
  episodeLabel: 'EP. 24 · 1h12',
  live: false,
};

const HERO_TIKTOK_FALLBACK: HeroTiktokRow = {
  tiktokUrl: '',
  enabled: false,
};

export default async function LinksPage() {
  const supabase = await createServerClient();
  const [linksRes, ctasRes, heroVideoRes, heroTiktokRes] = await Promise.all([
    supabase
      .from('landing_links')
      .select('id, kind, name, url, enabled, surfaces, display_order')
      .order('display_order', { ascending: true }),
    supabase.from('landing_ctas').select('slot, label, url'),
    supabase
      .from('landing_hero_video')
      .select('youtube_id, title, episode_label, live')
      .eq('id', 'singleton')
      .maybeSingle(),
    supabase
      .from('landing_hero_tiktok')
      .select('tiktok_url, enabled')
      .eq('id', 'singleton')
      .maybeSingle(),
  ]);

  const links = (linksRes.data ?? []) as unknown as LinkRow[];
  const ctas = (ctasRes.data ?? []) as unknown as CtaRow[];
  ctas.sort((a) => (a.slot === 'primary' ? -1 : 1));

  const hv = heroVideoRes.data as unknown as
    | { youtube_id: string; title: string; episode_label: string; live: boolean }
    | null;
  const heroVideo: HeroVideoRow = hv
    ? {
        youtubeId: hv.youtube_id,
        title: hv.title,
        episodeLabel: hv.episode_label,
        live: hv.live,
      }
    : HERO_VIDEO_FALLBACK;

  const ht = heroTiktokRes.data as unknown as
    | { tiktok_url: string | null; enabled: boolean }
    | null;
  const heroTiktok: HeroTiktokRow = ht
    ? { tiktokUrl: ht.tiktok_url ?? '', enabled: ht.enabled }
    : HERO_TIKTOK_FALLBACK;

  return (
    <PageShell crumbs="Vidéo · TikTok · réseaux · contact · boutons" title="Liens & CTAs">
      <LinksClient
        links={links}
        ctas={ctas}
        heroVideo={heroVideo}
        heroTiktok={heroTiktok}
      />
    </PageShell>
  );
}
