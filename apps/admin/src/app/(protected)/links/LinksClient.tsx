'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { LinkKind, LinkSurface, CtaSlot } from '@bento-pop/supabase/types';
import { clsx } from '@/lib/clsx';
import { updateCta, updateHeroTiktok, updateHeroVideo, updateLink } from './actions';

export type LinkRow = {
  id: string;
  kind: LinkKind;
  name: string;
  url: string;
  enabled: boolean;
  surfaces: LinkSurface[];
};

export type CtaRow = {
  slot: CtaSlot;
  label: string;
  url: string;
};

export type HeroVideoRow = {
  youtubeId: string;
  title: string;
  episodeLabel: string;
  live: boolean;
};

export type HeroTiktokRow = {
  tiktokUrl: string;
  enabled: boolean;
};

type Props = {
  links: LinkRow[];
  ctas: CtaRow[];
  heroVideo: HeroVideoRow;
  heroTiktok: HeroTiktokRow;
};

const SURFACE_LABEL: Record<LinkSurface, string> = {
  social: 'Réseau',
  podcast: 'Podcast',
  contact: 'Contact',
};

const KIND_TINT: Record<LinkKind, string> = {
  youtube: '#FF0000',
  spotify: '#1DB954',
  instagram: '#E1306C',
  tiktok: '#000000',
  x: '#000000',
  discord: '#5865F2',
  mail: '#7a766c',
  deezer: '#9933CC',
  apple: '#9933FF',
};

export function LinksClient({ links, ctas, heroVideo, heroTiktok }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          Vidéo embarquée (Hero)
        </h2>
        <div className="admin-card overflow-hidden">
          <HeroVideoEditor heroVideo={heroVideo} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          TikTok dans le bento (Hero)
        </h2>
        <div className="admin-card overflow-hidden">
          <HeroTiktokEditor heroTiktok={heroTiktok} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          Réseaux & contact
        </h2>
        <div className="admin-card overflow-hidden">
          {links.map((l) => (
            <LinkRowEditor key={l.id} link={l} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
          CTAs principaux (Hero)
        </h2>
        <div className="admin-card overflow-hidden">
          {ctas.map((c) => (
            <CtaRowEditor key={c.slot} cta={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function LinkRowEditor({ link }: { link: LinkRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(link.url);
  const [enabled, setEnabled] = useState(link.enabled);
  const [error, setError] = useState<string | null>(null);
  const dirty = url !== link.url || enabled !== link.enabled;

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateLink({ id: link.id, url, enabled });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[180px_1fr_auto] items-center gap-4 border-b border-admin-border px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-7 w-7 place-items-center rounded-md text-[12px] font-bold uppercase text-white"
          style={{ background: KIND_TINT[link.kind] }}
        >
          {link.kind[0]?.toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{link.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
            {link.surfaces.map((s) => SURFACE_LABEL[s]).join(' · ') || '—'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          className="admin-input"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-admin-ink"
          />
          Actif
        </label>
      </div>
      <button
        type="button"
        className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
        disabled={!dirty || pending}
        onClick={onSave}
      >
        {pending ? '…' : dirty ? 'Enregistrer' : 'OK'}
      </button>
      {error ? <div className="col-span-3 text-[11px] text-bento-red">{error}</div> : null}
    </div>
  );
}

function CtaRowEditor({ cta }: { cta: CtaRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(cta.label);
  const [url, setUrl] = useState(cta.url);
  const [error, setError] = useState<string | null>(null);
  const dirty = label !== cta.label || url !== cta.url;

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCta({ slot: cta.slot, label, url });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[120px_1fr_2fr_auto] items-center gap-4 border-b border-admin-border px-4 py-3 last:border-b-0">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-admin-muted">
        {cta.slot === 'primary' ? 'Primary' : 'Secondary'}
      </div>
      <input
        className="admin-input"
        placeholder="Libellé"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        className="admin-input"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="button"
        className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
        disabled={!dirty || pending}
        onClick={onSave}
      >
        {pending ? '…' : dirty ? 'Enregistrer' : 'OK'}
      </button>
      {error ? <div className="col-span-4 text-[11px] text-bento-red">{error}</div> : null}
    </div>
  );
}

function HeroVideoEditor({ heroVideo }: { heroVideo: HeroVideoRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [youtubeId, setYoutubeId] = useState(heroVideo.youtubeId);
  const [title, setTitle] = useState(heroVideo.title);
  const [episodeLabel, setEpisodeLabel] = useState(heroVideo.episodeLabel);
  const [live, setLive] = useState(heroVideo.live);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    youtubeId !== heroVideo.youtubeId ||
    title !== heroVideo.title ||
    episodeLabel !== heroVideo.episodeLabel ||
    live !== heroVideo.live;

  // Aperçu : si l'ID est valide, on parse aussi les URLs collées par l'utilisateur.
  const previewId = (() => {
    const v = youtubeId.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    const m = v.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/,
    );
    return m?.[1] ?? null;
  })();

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateHeroVideo({ youtubeId, title, episodeLabel, live });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Le serveur a normalisé l'ID, on resynchronise depuis l'aperçu.
      if (previewId) setYoutubeId(previewId);
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-6 px-4 py-4">
      {/* Thumbnail YouTube live */}
      <div className="overflow-hidden rounded-admin-input border border-admin-border bg-admin-bg">
        {previewId ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`https://i.ytimg.com/vi/${previewId}/hqdefault.jpg`}
            alt="Aperçu vidéo"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center text-[11px] uppercase tracking-[0.15em] text-admin-muted">
            ID invalide
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            ID ou URL YouTube
          </span>
          <input
            className="admin-input font-mono"
            value={youtubeId}
            onChange={(e) => setYoutubeId(e.target.value)}
            placeholder="8JVSPC2ozOw  ou  https://youtu.be/8JVSPC2ozOw"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Titre overlay
          </span>
          <input
            className="admin-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Replay · Dernier épisode"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            Label épisode
          </span>
          <input
            className="admin-input"
            value={episodeLabel}
            onChange={(e) => setEpisodeLabel(e.target.value)}
            placeholder="EP. 24 · 1h12"
          />
        </label>
        <div className="col-span-2 flex items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input
              type="checkbox"
              checked={live}
              onChange={(e) => setLive(e.target.checked)}
              className="h-4 w-4 accent-admin-ink"
            />
            Afficher le badge « LIVE »
          </label>
          <div className="flex items-center gap-3">
            {error ? <span className="text-[11px] text-bento-red">{error}</span> : null}
            <button
              type="button"
              className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
              disabled={!dirty || pending}
              onClick={onSave}
            >
              {pending ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractTiktokId(input: string): string | null {
  const m = input.match(/\/(?:video|v)\/(\d{10,})/);
  return m?.[1] ?? null;
}

function HeroTiktokEditor({ heroTiktok }: { heroTiktok: HeroTiktokRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tiktokUrl, setTiktokUrl] = useState(heroTiktok.tiktokUrl);
  const [enabled, setEnabled] = useState(heroTiktok.enabled);
  const [error, setError] = useState<string | null>(null);

  const dirty = tiktokUrl !== heroTiktok.tiktokUrl || enabled !== heroTiktok.enabled;
  const previewId = extractTiktokId(tiktokUrl);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateHeroTiktok({ tiktokUrl, enabled });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-6 px-4 py-4">
      {/* Aperçu iframe — même player que la landing (v1, video-only). */}
      <div className="overflow-hidden rounded-admin-input border border-admin-border bg-admin-ink">
        {previewId ? (
          <iframe
            src={`https://www.tiktok.com/player/v1/${previewId}?music_info=0&description=0&rel=0&loop=1&controls=1`}
            title="Aperçu TikTok"
            className="block aspect-[9/16] w-full border-0"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          />
        ) : (
          <div className="grid aspect-[9/16] w-full place-items-center text-center text-[11px] uppercase tracking-[0.15em] text-admin-muted">
            URL invalide
            <br />
            ou vide
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
            URL TikTok
          </span>
          <input
            className="admin-input font-mono text-[12px]"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@bentopopofficiel/video/7630384366006373654"
          />
          <span className="mt-1.5 block font-mono text-[11px] text-admin-muted">
            {previewId
              ? `ID détecté · ${previewId}`
              : 'Colle l\'URL complète d\'un post TikTok (pas un lien court vm.tiktok.com).'}
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-[12px] font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-admin-ink"
            />
            Afficher dans le bento du hero
          </label>
          <div className="flex items-center gap-3">
            {error ? <span className="text-[11px] text-bento-red">{error}</span> : null}
            <button
              type="button"
              className={clsx('admin-btn admin-btn-primary', !dirty && 'admin-btn-ghost')}
              disabled={!dirty || pending}
              onClick={onSave}
            >
              {pending ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'OK'}
            </button>
          </div>
        </div>

        <p className="mt-1 rounded-admin-input border border-admin-border bg-admin-surface-2 px-3 py-2 font-mono text-[11px] text-admin-muted">
          Quand activé, la cellule verticale en col&nbsp;1 (lignes&nbsp;2-3) du bento
          embarque ce TikTok. Sinon, le hero affiche le layout par défaut
          (Popy + Paris Manga à gauche).
        </p>
      </div>
    </div>
  );
}
