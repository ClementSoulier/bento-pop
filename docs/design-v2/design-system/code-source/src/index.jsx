import React from 'react';
import { ICONS } from './icons.js';
import { IMG } from './assets.js';

const h = React.createElement;
const cx = (...a) => a.filter(Boolean).join(' ');
const asArray = (v, sep = '|') => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(sep).map((s) => s.trim()) : []);
const num = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));
const bool = (v) => v === true || v === 'true' || v === '' || v === 1;

/* ------------------------------------------------------------------ */
/* Données de référence                                                */
/* ------------------------------------------------------------------ */
export const CATEGORIES = {
  film: { label: 'Film', short: 'Film', icon: 'film-slate' },
  serie: { label: 'Série', short: 'Série', icon: 'television-simple' },
  artiste: { label: 'Artiste', short: 'Artiste', icon: 'star' },
  son: { label: 'Chanson', short: 'Son', icon: 'music-notes' },
  crea: { label: 'Créateur de contenu', short: 'Créa', icon: 'monitor-play' },
  lieu: { label: 'Lieu', short: 'Lieu', icon: 'map-pin' },
};
export const SLOT_ORDER = ['film', 'serie', 'artiste', 'son', 'crea', 'lieu'];
const SLOT_SIZES = ['xl', 'l', 'l', 's', 's', 's'];

const MOOD_FILES = {
  content: 'content', bisou: 'fille', fille: 'fille', intello: 'intello', gene: 'gene', 'gêné': 'gene',
  surpris: 'nani', nani: 'nani', enerve: 'enerve', 'énervé': 'enerve', 'intello-enerve': 'intello-enerve',
  malade: 'malade', diable: 'diable',
};
export const MOODS = Object.keys(MOOD_FILES);
const popySrc = (mood) => IMG.popy[MOOD_FILES[mood] || 'content'];

const PANTRY = { yolk: 'var(--yolk-300)', ume: 'var(--ume-300)', thon: 'var(--thon-300)', sakura: 'var(--sakura-300)', shiso: 'var(--shiso-300)', ramune: 'var(--ramune-300)', wasabi: 'var(--wasabi-300)', rice: 'var(--rice-100)', white: 'var(--neutral-0)' };
export const COLORS = Object.keys(PANTRY);
const pantry = (c) => PANTRY[c] || PANTRY.yolk;

/* Visuels de démonstration (maquettes uniquement) : des aplats façon photo floue. */
const ART = {
  dusk: 'radial-gradient(60% 70% at 28% 30%, #f6b26b 0%, transparent 60%), radial-gradient(55% 60% at 78% 62%, #8e4a9e 0%, transparent 62%), linear-gradient(160deg, #3b2346, #120c18)',
  ocean: 'radial-gradient(60% 60% at 70% 25%, #a8e6f0 0%, transparent 55%), radial-gradient(70% 70% at 20% 80%, #1d5f8a 0%, transparent 65%), linear-gradient(180deg, #2a7fb0, #0b2236)',
  forest: 'radial-gradient(55% 55% at 30% 35%, #c9e08f 0%, transparent 55%), radial-gradient(70% 70% at 75% 75%, #2c5b33 0%, transparent 65%), linear-gradient(170deg, #4d7d3e, #0f2414)',
  neon: 'radial-gradient(45% 50% at 70% 30%, #ff5fa2 0%, transparent 55%), radial-gradient(55% 55% at 25% 70%, #3c7bff 0%, transparent 60%), linear-gradient(180deg, #23123f, #08050f)',
  sunset: 'radial-gradient(60% 50% at 50% 70%, #ffcf6b 0%, transparent 60%), radial-gradient(70% 60% at 20% 20%, #ff7a59 0%, transparent 60%), linear-gradient(180deg, #c2465b, #3b1626)',
  stage: 'radial-gradient(30% 70% at 50% 0%, #fff1c2 0%, transparent 65%), radial-gradient(60% 50% at 50% 100%, #b5462f 0%, transparent 70%), linear-gradient(180deg, #2b1a14, #0c0806)',
  city: 'radial-gradient(40% 40% at 75% 25%, #ffd8a8 0%, transparent 55%), linear-gradient(100deg, transparent 0 18%, rgba(0,0,0,.25) 18% 22%, transparent 22% 48%, rgba(0,0,0,.3) 48% 53%, transparent 53%), linear-gradient(180deg, #6d87a8, #1b2433)',
  studio: 'radial-gradient(50% 55% at 40% 40%, #f0c9a0 0%, transparent 60%), radial-gradient(60% 60% at 80% 80%, #3a2f5c 0%, transparent 65%), linear-gradient(170deg, #5b4a3f, #141016)',
  night: 'radial-gradient(35% 35% at 70% 30%, #e8f0ff 0%, transparent 50%), radial-gradient(70% 70% at 30% 75%, #263a7a 0%, transparent 70%), linear-gradient(180deg, #121a3a, #05070f)',
  meadow: 'radial-gradient(70% 45% at 50% 20%, #d6f0ff 0%, transparent 60%), radial-gradient(80% 50% at 50% 95%, #7fae4f 0%, transparent 70%), linear-gradient(180deg, #8cc7e8, #3e6b2a)',
};
export const ART_NAMES = Object.keys(ART);

function mediaStyle(item) {
  if (!item) return null;
  if (item.image) return { backgroundImage: `url("${item.image}")` };
  if (item.art && ART[item.art]) return { backgroundImage: ART[item.art] };
  return null;
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */
export function Icon({ name, size = 24, weight = 'bold', className, style, label }) {
  const set = ICONS[name];
  if (!set) return null;
  return h('svg', {
    className: cx('mbp-icon', className), width: num(size, 24), height: num(size, 24), viewBox: '0 0 256 256', fill: 'currentColor',
    'aria-hidden': label ? undefined : 'true', role: label ? 'img' : undefined, 'aria-label': label, style, focusable: 'false',
    dangerouslySetInnerHTML: { __html: set[weight] || set.bold },
  });
}

export function Spinner({ size = 18, label }) {
  const s = num(size, 18);
  return h('span', { className: 'mbp-spinner', style: { width: s, height: s }, role: label ? 'status' : undefined, 'aria-label': label });
}

export function Badge({ count, dot, label }) {
  if (bool(dot)) return h('span', { className: 'mbp-badge mbp-badge--dot', role: label ? 'img' : undefined, 'aria-label': label });
  const n = num(count, 0);
  return h('span', { className: 'mbp-badge', 'aria-label': label }, n > 99 ? '99+' : n);
}

export function Popy({ mood = 'content', size = 120, tilt = 0, wiggle, alt = '', className, style }) {
  const s = num(size, 120);
  return h('img', {
    className: cx('mbp-popy', bool(wiggle) && 'mbp-popy--wiggle', className), src: popySrc(mood), width: s, height: s, alt,
    draggable: false, style: { width: s, height: s, transform: num(tilt, 0) ? `rotate(${tilt}deg)` : undefined, ...style },
  });
}

export function Avatar({ mood = 'content', color = 'yolk', size = 'md', label, className, style }) {
  const px = typeof size === 'number' || /^\d+$/.test(String(size)) ? Number(size) : { xs: 24, sm: 32, md: 44, lg: 56, xl: 96 }[size] || 44;
  const full = MOOD_FILES[mood] === 'diable';
  return h('span', {
    className: cx('mbp-avatar', typeof size === 'string' && `mbp-avatar--${size}`, full && 'is-full', className),
    style: { '--avatar-size': px + 'px', '--avatar-bg': full ? 'var(--neutral-0)' : pantry(color), ...style },
    role: label ? 'img' : undefined, 'aria-label': label,
  }, h('img', { src: popySrc(mood), alt: '' }));
}

export function Logo({ height = 28, className, style }) {
  const hh = num(height, 28);
  return h('img', { className: cx('mbp-logo', className), src: IMG.logo, alt: 'Bento Pop', style: { height: hh, ...style } });
}

export function AppIcon({ size = 40 }) {
  return h('span', { className: 'mbp-appicon', style: { '--s': num(size, 40) + 'px' }, 'aria-hidden': 'true' }, h('img', { src: IMG.popy.content, alt: '' }));
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */
export function Button({ variant = 'primary', size = 'lg', icon, iconRight, block, loading, disabled, children, label, href, type = 'button', className, style, onClick }) {
  const isLoading = bool(loading);
  const isDisabled = bool(disabled);
  const iconSize = size === 'sm' ? 16 : 20;
  const content = [
    isLoading ? h(Spinner, { key: 's', size: size === 'sm' ? 14 : 18 }) : icon ? h(Icon, { key: 'i', name: icon, size: iconSize }) : null,
    (children ?? label) != null ? h('span', { key: 'l', className: 'mbp-btn__label' }, children ?? label) : null,
    iconRight && !isLoading ? h(Icon, { key: 'r', name: iconRight, size: iconSize }) : null,
  ];
  const text = typeof (children ?? label) === 'string' ? (children ?? label) : '';
  const props = {
    className: cx('mbp-btn', `mbp-btn--${variant}`, `mbp-btn--${size}`, bool(block) && 'mbp-btn--block', isLoading && 'is-loading', text.length > 34 && 'mbp-btn--wrap', className),
    'aria-disabled': isDisabled || isLoading ? 'true' : undefined, 'aria-busy': isLoading ? 'true' : undefined, style, onClick,
  };
  if (href) return h('a', { href, ...props }, content);
  return h('button', { type, disabled: isDisabled || undefined, ...props }, content);
}

export function IconButton({ icon, label, variant = 'plain', size = 'md', weight = 'bold', badge, active, className, style, onClick }) {
  const isActive = bool(active);
  return h('button', {
    type: 'button', className: cx('mbp-iconbtn', `mbp-iconbtn--${variant}`, `mbp-iconbtn--${size}`, isActive && 'is-active', className),
    'aria-label': label, 'aria-pressed': active === undefined ? undefined : String(isActive), style, onClick,
  }, h(Icon, { name: icon, size: size === 'sm' ? 20 : 24, weight: isActive ? 'fill' : weight }), badge != null && badge !== '' ? h(Badge, { count: badge }) : null);
}

/* ------------------------------------------------------------------ */
/* Structure d'écran                                                   */
/* ------------------------------------------------------------------ */
export function Screen({ theme = 'light', tone = 'app', safeTop = true, label, children, className, style }) {
  return h('div', {
    className: cx('mbp-screen', className), 'data-theme': theme, 'data-tone': tone, 'data-safe-top': String(safeTop !== false && safeTop !== 'false'),
    role: label ? 'region' : undefined, 'aria-label': label, style,
  }, children);
}

function renderAction(a, i) {
  if (!a) return null;
  if (a.kind === 'pill') return h('button', { key: i, type: 'button', className: 'mbp-topbar__pill' }, a.icon ? h(Icon, { name: a.icon, size: 16 }) : null, a.label);
  if (a.icon) return h(IconButton, { key: i, icon: a.icon, label: a.label, badge: a.badge, active: a.active });
  return h('button', { key: i, type: 'button', className: 'mbp-topbar__text-action', style: a.tone === 'danger' ? { color: 'var(--text-danger)' } : undefined }, a.label);
}

export function TopBar({ variant = 'inline', title, eyebrow, subtitle, back, backLabel = 'Retour', close, closeLabel = 'Fermer', actions, border, children, className }) {
  const acts = Array.isArray(actions) ? actions : actions ? [actions] : [];
  const lead = bool(back) ? h(IconButton, { icon: 'caret-left', label: backLabel }) : bool(close) ? h(IconButton, { icon: 'x', label: closeLabel }) : null;
  if (variant === 'large') {
    return h('header', { className: cx('mbp-topbar mbp-topbar--large', bool(border) && 'has-border', className) },
      lead ? h('div', { className: 'mbp-topbar__back' }, lead) : null,
      h('div', { className: 'mbp-topbar__main' },
        h('div', { className: 'mbp-topbar__titles' },
          eyebrow ? h('div', { className: 'mbp-topbar__eyebrow' }, eyebrow) : null,
          h('h1', { className: 'mbp-topbar__large-title' }, title),
          subtitle ? h('div', { className: 'mbp-topbar__subtitle' }, subtitle) : null),
        acts.length ? h('div', { className: 'mbp-topbar__trail' }, acts.map(renderAction)) : null),
      children);
  }
  if (variant === 'brand') {
    return h('header', { className: cx('mbp-topbar mbp-topbar--brand', bool(border) && 'has-border', className) },
      h(Logo, { height: 30 }), h('div', { className: 'mbp-topbar__spacer' }), acts.length ? h('div', { className: 'mbp-topbar__trail' }, acts.map(renderAction)) : null, children);
  }
  return h('header', { className: cx('mbp-topbar mbp-topbar--inline', bool(border) && 'has-border', className) },
    h('div', { className: 'mbp-topbar__lead' }, lead),
    h('div', { className: 'mbp-topbar__title' }, title),
    h('div', { className: 'mbp-topbar__trail' }, acts.map(renderAction)), children);
}

const TABS = [
  { key: 'table', label: 'La table', icon: 'bowl-steam' },
  { key: 'trouver', label: 'Trouver', icon: 'magnifying-glass' },
  { key: 'compose', label: 'Compose', icon: 'plus' },
  { key: 'notifs', label: 'Notifs', icon: 'bell' },
  { key: 'profil', label: 'Profil', icon: null },
];
export function TabBar({ active = 'compose', notifs, mood = 'content', color = 'yolk' }) {
  const n = num(notifs, 0);
  return h('nav', { className: 'mbp-tabbar', 'aria-label': 'Navigation principale' }, TABS.map((t) => {
    const on = t.key === active;
    let icon;
    if (t.key === 'compose') icon = h('span', { className: 'mbp-tab__compose' }, h(Icon, { name: 'plus', size: 22, weight: 'bold' }));
    else if (t.key === 'profil') icon = h(Avatar, { mood, color, size: 26, className: 'mbp-tab__me' });
    else icon = h(Icon, { name: t.icon, size: 26, weight: on ? 'fill' : 'bold' });
    return h('a', { key: t.key, href: '#' + t.key, className: cx('mbp-tab', t.key === 'compose' && 'mbp-tab--compose'), 'aria-current': on ? 'page' : undefined },
      h('span', { className: 'mbp-tab__icon' }, icon, t.key === 'notifs' && n > 0 ? h(Badge, { count: n, label: `${n} nouveautés` }) : null),
      h('span', null, t.label));
  }));
}

export function Tabs({ items, value = 0, fill, border = true, className }) {
  const list = asArray(items).map((it) => (typeof it === 'string' ? { label: it } : it));
  const v = num(value, 0);
  return h('div', { className: cx('mbp-tabs', bool(fill) && 'mbp-tabs--fill', bool(border) && 'has-border', className), role: 'tablist' }, list.map((it, i) =>
    h('button', { key: i, type: 'button', role: 'tab', className: 'mbp-tabs__item', 'aria-selected': String(i === v) },
      h('span', null, it.label), it.count != null ? h('span', { className: 'mbp-tabs__count' }, it.count) : null)));
}

export function Chip({ label, children, selected, variant = 'filter', count, icon, className }) {
  const sel = bool(selected);
  return h('button', { type: 'button', className: cx('mbp-chip', variant !== 'filter' && `mbp-chip--${variant}`, sel && 'is-selected', className), 'aria-pressed': variant === 'filter' ? String(sel) : undefined },
    variant === 'add' ? h(Icon, { name: 'plus', size: 16 }) : icon ? h(Icon, { name: icon, size: 16 }) : null,
    h('span', null, children ?? label),
    count != null ? h('span', { className: 'mbp-chip__count', 'aria-label': `${count} bentos` }, count) : null);
}

export function Steps({ count = 3, index = 0, label }) {
  const n = num(count, 3), i = num(index, 0);
  return h('div', { className: 'mbp-steps', style: { '--total': n }, role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': n, 'aria-valuenow': i + 1, 'aria-label': label || `Étape ${i + 1} sur ${n}` },
    Array.from({ length: n }, (_, k) => h('span', { key: k, className: cx('mbp-steps__seg', k <= i && 'is-on') })));
}

export function Progress({ value = 0, total = 6, label }) {
  const v = num(value, 0), t = num(total, 6);
  return h('div', { className: 'mbp-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': t, 'aria-valuenow': v, 'aria-label': `Cases remplies : ${v} sur ${t}` },
    h('div', { className: 'mbp-progress__segs', style: { '--total': t } }, Array.from({ length: t }, (_, k) => h('span', { key: k, className: cx('mbp-progress__seg', k < v && 'is-on') }))),
    h('span', { className: 'mbp-progress__label', 'aria-hidden': 'true' }, label ?? `${v} / ${t}`));
}

/* ------------------------------------------------------------------ */
/* Bento                                                               */
/* ------------------------------------------------------------------ */
export function Tag({ category = 'film', variant = 'media', label, icon }) {
  const cat = CATEGORIES[category] || CATEGORIES.film;
  return h('span', { className: cx('mbp-tag', variant !== 'media' && `mbp-tag--${variant}`), 'data-cat': category },
    variant === 'plain' ? h('i', { className: 'mbp-tag__dot', 'aria-hidden': 'true' }) : null,
    bool(icon) ? h(Icon, { name: cat.icon, size: 12 }) : null,
    label || cat.short);
}

export function BentoTile({ item, category = 'film', size = 'l', mode = 'view', prompt, next, className }) {
  const cat = CATEGORIES[category] || CATEGORIES.film;
  if (!item) {
    if (mode !== 'edit') return h('div', { className: cx('mbp-tile', `mbp-tile--${size}`, 'is-empty', className), 'data-cat': category, 'aria-label': `${cat.label} : case vide` });
    return h('button', { type: 'button', className: cx('mbp-tile', `mbp-tile--${size}`, 'is-empty', bool(next) && 'is-next', className), 'data-cat': category, 'aria-label': `Ajouter : ${prompt || cat.label}` },
      h('span', { className: 'mbp-tile__plus', 'aria-hidden': 'true' }, h(Icon, { name: 'plus', size: size === 's' ? 16 : 18 })),
      prompt ? h('span', { className: 'mbp-tile__kind', 'aria-hidden': 'true' }, h('i'), cat.short) : null,
      h('span', { className: 'mbp-tile__prompt' }, prompt || cat.label));
  }
  const media = mediaStyle(item);
  const initial = (item.initial || item.title || '?').trim().charAt(0);
  const Tagname = mode === 'edit' ? 'button' : 'div';
  return h(Tagname, {
    type: mode === 'edit' ? 'button' : undefined,
    className: cx('mbp-tile', `mbp-tile--${size}`, media && 'has-media', item.pending && 'is-pending', className), 'data-cat': category,
    'aria-label': `${cat.label} : ${item.title}${item.subtitle ? ', ' + item.subtitle : ''}${item.pending ? ', en attente de validation' : ''}`,
  },
    media ? h('span', { className: 'mbp-tile__media', style: media, 'aria-hidden': 'true' }) : h('span', { className: 'mbp-tile__initial', 'aria-hidden': 'true' }, initial),
    h('span', { className: 'mbp-tile__tag' }, h(Tag, { category })),
    item.pending ? h('span', { className: 'mbp-tile__badge', title: 'En attente de validation' }, h(Icon, { name: 'hourglass-medium', size: 15 })) : null,
    h('span', { className: 'mbp-tile__title', 'aria-hidden': 'true' }, item.title),
    item.subtitle ? h('span', { className: 'mbp-tile__sub', 'aria-hidden': 'true' }, item.subtitle) : null,
    item.credit ? h('span', { className: 'mbp-tile__credit' }, item.credit) : null);
}

function normalizeSlots(slots, items, prompts) {
  if (Array.isArray(slots) && slots.length) {
    return slots.slice(0, 6).map((s, i) => ({ category: (s && s.category) || SLOT_ORDER[i], prompt: s && s.prompt, item: s && s.item ? s.item : s && s.title ? s : null, next: s && s.next }));
  }
  const its = Array.isArray(items) ? items : [];
  const ps = asArray(prompts);
  return SLOT_ORDER.map((c, i) => ({ category: (its[i] && its[i].category) || c, prompt: ps[i], item: its[i] && its[i].title ? its[i] : null }));
}

export function Bento({ slots, items, prompts, mode = 'view', density = 'feed', label, className, style }) {
  const list = normalizeSlots(slots, items, prompts);
  const filled = list.filter((s) => s.item).length;
  return h('div', {
    className: cx('mbp-plate', `mbp-plate--${density}`, className), style, role: 'group',
    'aria-label': label || (mode === 'edit' ? `Bento en cours, ${filled} cases sur 6` : 'Bento'),
  }, list.map((s, i) => h(BentoTile, { key: i, item: s.item, category: s.category, size: SLOT_SIZES[i], mode, prompt: s.prompt, next: s.next })));
}

export function Thumb({ item, category = 'film', size = 44 }) {
  const media = mediaStyle(item);
  return h('span', { className: 'mbp-thumb', 'data-cat': category, style: { '--s': num(size, 44) + 'px' }, 'aria-hidden': 'true' },
    media ? h('span', { className: 'mbp-tile__media', style: media }) : h('span', { className: 'mbp-thumb__initial' }, ((item && (item.initial || item.title)) || '?').charAt(0)));
}

export function ItemCard({ item = {}, category = 'film' }) {
  const media = mediaStyle(item);
  return h('button', { type: 'button', className: 'mbp-item', 'aria-label': `${item.title}${item.subtitle ? ', ' + item.subtitle : ''}` },
    h('span', { className: 'mbp-item__poster', 'data-cat': category },
      media ? h('span', { className: 'mbp-tile__media', style: media }) : h('span', { className: 'mbp-tile__initial' }, (item.initial || item.title || '?').charAt(0))),
    h('span', { className: 'mbp-item__title', 'aria-hidden': 'true' }, item.title),
    item.subtitle ? h('span', { className: 'mbp-item__sub', 'aria-hidden': 'true' }, item.subtitle) : null);
}

export function ItemGrid({ items, category = 'film' }) {
  const list = Array.isArray(items) ? items : [];
  return h('div', { className: 'mbp-itemgrid' }, list.map((it, i) => h(ItemCard, { key: i, item: it, category: it.category || category })));
}

export function ProposeRow({ query, subtitle = 'Proposer au catalogue (validé par l’équipe)' }) {
  return h('button', { type: 'button', className: 'mbp-propose' },
    h('span', { className: 'mbp-propose__plus', 'aria-hidden': 'true' }, h(Icon, { name: 'plus', size: 20 })),
    h('span', { style: { display: 'flex', flexDirection: 'column', minWidth: 0 } },
      h('span', { className: 'mbp-propose__title' }, `Ajouter « ${query} »`),
      h('span', { className: 'mbp-propose__sub' }, subtitle)));
}

/* ------------------------------------------------------------------ */
/* Social                                                              */
/* ------------------------------------------------------------------ */
export function ActionBar({ likes, liked, comments, commentLabel = 'Commenter', showLikes = true, share, className }) {
  const isLiked = bool(liked);
  const showL = showLikes !== false && showLikes !== 'false';
  const nc = comments === undefined || comments === null || comments === '' ? null : num(comments, 0);
  return h('div', { className: cx('mbp-actionbar', className) },
    h('button', { type: 'button', className: cx('mbp-action', isLiked && 'is-liked'), 'aria-pressed': String(isLiked), 'aria-label': isLiked ? 'Je n’aime plus' : 'J’aime' },
      h(Icon, { name: 'heart', size: 26, weight: isLiked ? 'fill' : 'bold' }), showL && likes != null && likes !== '' ? h('span', null, likes) : null),
    h('button', { type: 'button', className: 'mbp-action', 'aria-label': nc ? `${nc} commentaires` : commentLabel },
      h(Icon, { name: 'chat-circle', size: 26 }), h('span', null, nc ? nc : commentLabel)),
    bool(share) ? h('button', { type: 'button', className: 'mbp-action', 'aria-label': 'Partager' }, h(Icon, { name: 'share-fat', size: 26 })) : null);
}

export function PostHeader({ handle, name, time, mood, color }) {
  return h('div', { className: 'mbp-post__head' },
    h(Avatar, { mood, color, size: 'md' }),
    h('div', { className: 'mbp-post__who' },
      h('span', { className: 'mbp-post__handle' }, handle),
      h('span', { className: 'mbp-post__meta' }, [name, time].filter(Boolean).join(' · '))));
}

export function Post({ handle, name, time, mood, color, slots, items, likes, liked, comments, commentLabel, showLikes, className }) {
  return h('article', { className: cx('mbp-post', className), 'aria-label': `Bento de ${handle}` },
    h(PostHeader, { handle, name, time, mood, color }),
    h(Bento, { slots, items }),
    h(ActionBar, { likes, liked, comments, commentLabel, showLikes }));
}

export function ProfileHeader({ handle, name, meta, mood = 'content', color = 'yolk', socials, stats, children }) {
  const soc = asArray(socials);
  const st = Array.isArray(stats) ? stats : [];
  return h('section', { className: 'mbp-profile', 'aria-label': `Profil de ${handle}` },
    h(Avatar, { mood, color, size: 'xl' }),
    h('h1', { className: 'mbp-profile__handle' }, handle),
    (name || meta || soc.length) ? h('div', { className: 'mbp-profile__meta' },
      h('span', null, [name, meta].filter(Boolean).join(' · ')),
      soc.length ? h('span', { className: 'mbp-profile__socials' }, soc.map((s) => h(IconButton, { key: s, icon: s === 'tiktok' ? 'tiktok-logo' : 'instagram-logo', label: s === 'tiktok' ? 'TikTok' : 'Instagram' }))) : null) : null,
    st.length ? h('div', { className: 'mbp-stats' }, st.map((s, i) => h(s.link ? 'a' : 'div', { key: i, href: s.link ? '#' : undefined, className: cx('mbp-stat', s.link && 'is-link') },
      h('span', { className: 'mbp-stat__value' }, s.value), h('span', { className: 'mbp-stat__label' }, s.label)))) : null,
    children ? h('div', { className: 'mbp-btn-row', style: { width: '100%', marginTop: 6 } }, children) : null);
}

export function SectionHeader({ title, action, actionIcon }) {
  return h('div', { className: 'mbp-section__head' },
    h('h2', { className: 'mbp-section__title' }, title),
    action ? h(Button, { variant: 'tertiary', size: 'sm', icon: actionIcon }, action) : null);
}

export function Achievement({ label, mood = 'content', color = 'yolk' }) {
  return h('div', { className: 'mbp-achievement' },
    h('span', { className: 'mbp-achievement__medal', style: { '--m-bg': pantry(color) }, 'aria-hidden': 'true' }, h('img', { src: popySrc(mood), alt: '' })),
    h('span', { className: 'mbp-achievement__label' }, label));
}

export function Achievements({ items }) {
  const list = Array.isArray(items) ? items : [];
  return h('div', { className: 'mbp-achievements', role: 'list' }, list.map((a, i) => h('div', { key: i, role: 'listitem' }, h(Achievement, a))));
}

export function WhyEntry({ category = 'film', title, quote, item, more = true }) {
  return h('div', { className: 'mbp-why' },
    h(Thumb, { item: item || { title }, category }),
    h('div', { className: 'mbp-why__body' },
      h(Tag, { category, variant: 'plain' }),
      h('span', { className: 'mbp-why__title' }, title),
      quote ? h('p', { className: 'mbp-why__quote' }, `« ${quote} »`) : null),
    bool(more) ? h(IconButton, { icon: 'dots-three', label: `Options pour le pourquoi de ${title}` }) : null);
}

export function WhyField({ category = 'film', title, item, value, placeholder = 'Pourquoi ce choix ?' }) {
  const cat = CATEGORIES[category] || CATEGORIES.film;
  return h('div', { className: 'mbp-whyfield' },
    h('div', { className: 'mbp-whyfield__head' },
      h(Thumb, { item: item || { title }, category, size: 40 }),
      h('div', { className: 'mbp-whyfield__titles' }, h(Tag, { category, variant: 'plain' }), h('span', { className: 'mbp-whyfield__title' }, title))),
    h(TextField, { placeholder, value, label: null, id: undefined }));
}

export function Comment({ handle, time, text, mood, color }) {
  return h('div', { className: 'mbp-comment' },
    h(Avatar, { mood, color, size: 36 }),
    h('div', { className: 'mbp-comment__body' },
      h('div', { className: 'mbp-comment__head' }, h('span', { className: 'mbp-comment__handle' }, handle), h('span', { className: 'mbp-comment__time' }, time)),
      h('p', { className: 'mbp-comment__text' }, text)),
    h(IconButton, { icon: 'dots-three', label: `Options pour le commentaire de ${handle}` }));
}

export function CommentComposer({ placeholder = 'Ajoute un commentaire…', value, canSend }) {
  return h('div', { className: 'mbp-composer' },
    h('div', { className: 'mbp-composer__input', role: 'textbox', 'aria-label': 'Ton commentaire' }, value || placeholder),
    h(Button, { variant: 'primary', size: 'md', disabled: !bool(canSend) }, 'Envoyer'));
}

const NOTIF_KINDS = {
  like: { icon: 'heart', bg: 'var(--ume-300)' },
  validated: { icon: 'check', bg: 'var(--wasabi-300)' },
  refused: { icon: 'x', bg: 'var(--neutral-100)' },
  edition: { icon: 'sparkle', bg: 'var(--yolk-300)' },
  achievement: { icon: 'trophy', bg: 'var(--yolk-300)' },
};
export function Medallion({ kind, mood, color, size = 44 }) {
  const k = NOTIF_KINDS[kind];
  if (kind === 'achievement') {
    return h('span', { className: 'mbp-medallion', style: { '--s': num(size, 44) + 'px', '--m-bg': pantry(color || 'yolk') } },
      h('img', { src: popySrc(mood || 'content'), alt: '', style: { width: '84%', height: '84%', objectFit: 'contain', marginTop: '8%' } }),
      h('span', { className: 'mbp-medallion__corner', style: { '--c-bg': 'var(--yolk-300)' } }, h(Icon, { name: 'trophy', size: 12, weight: 'fill' })));
  }
  if (k) return h('span', { className: 'mbp-medallion', style: { '--s': num(size, 44) + 'px', '--m-bg': k.bg, '--m-fg': 'var(--nori-900)' } }, h(Icon, { name: k.icon, size: 22, weight: kind === 'like' ? 'fill' : 'bold' }));
  return h(Avatar, { mood, color, size: num(size, 44) });
}

export function NotificationRow({ kind = 'follow', mood, color, time, children, text }) {
  return h('div', { className: 'mbp-notif' },
    h(Medallion, { kind, mood, color }),
    h('p', { className: 'mbp-notif__text', style: { margin: 0 } }, children ?? text, time ? h('span', { className: 'mbp-notif__time' }, ' · ' + time) : null));
}

export function AccountRow({ handle, name, detail, detailCategory, mood, color, trailing = 'chevron', actions }) {
  const acts = Array.isArray(actions) ? actions : actions ? [actions] : [];
  return h('div', { className: 'mbp-account' },
    h(Avatar, { mood, color, size: 48 }),
    h('div', { className: 'mbp-account__body' },
      h('span', { className: 'mbp-account__handle' }, handle),
      name ? h('span', { className: 'mbp-account__name' }, name) : null,
      detail ? h('span', { className: 'mbp-account__detail' }, detailCategory ? h(Tag, { category: detailCategory, variant: 'plain' }) : null, h('span', null, detail)) : null),
    acts.length ? h('div', { className: 'mbp-account__actions' }, acts.map((a, i) => h(Button, { key: i, size: 'sm', variant: a.variant || 'secondary', icon: a.icon }, a.label)))
      : trailing === 'chevron' ? h(Icon, { name: 'caret-right', size: 20, className: 'mbp-row__chev' }) : null);
}

/* ------------------------------------------------------------------ */
/* Listes, contrôles, champs                                           */
/* ------------------------------------------------------------------ */
export function List({ header, footer, plain, children, className }) {
  return h('section', { className: cx('mbp-list', bool(plain) && 'mbp-list--plain', className) },
    header ? h('h2', { className: 'mbp-list__header mbp-eyebrow', style: { margin: 0 } }, header) : null,
    h('div', { className: 'mbp-list__group' }, h('div', { className: 'mbp-list__rows' }, children)),
    footer ? h('p', { className: 'mbp-list__footer', style: { margin: 0 } }, footer) : null);
}

export function Switch({ checked, disabled, label }) {
  return h('button', { type: 'button', role: 'switch', className: 'mbp-switch', 'aria-checked': String(bool(checked)), 'aria-label': label, disabled: bool(disabled) || undefined },
    h('span', { className: 'mbp-switch__thumb', 'aria-hidden': 'true' }));
}

export function ListRow({ icon, title, subtitle, note, detail, trailing = 'chevron', checked, tone = 'default', strong, className }) {
  let trail = null;
  if (trailing === 'chevron') trail = h(Icon, { name: 'caret-right', size: 20, className: 'mbp-row__chev' });
  else if (trailing === 'external') trail = h(Icon, { name: 'arrow-up-right', size: 20, className: 'mbp-row__chev' });
  else if (trailing === 'switch') trail = h(Switch, { checked, label: title });
  else if (trailing === 'spinner') trail = h(Spinner, { size: 18, label: 'En cours' });
  const Tagname = trailing === 'switch' ? 'div' : 'button';
  return h(Tagname, { type: Tagname === 'button' ? 'button' : undefined, className: cx('mbp-row', icon && 'has-icon', tone !== 'default' && `mbp-row--${tone}`, className) },
    icon ? h(Icon, { name: icon, size: 24, className: 'mbp-row__icon' }) : null,
    h('span', { className: 'mbp-row__body' },
      h('span', { className: cx('mbp-row__title', bool(strong) && 'mbp-row__title--strong') }, title),
      subtitle ? h('span', { className: 'mbp-row__subtitle' }, subtitle) : null,
      note ? h('span', { className: 'mbp-row__note' }, note) : null),
    detail ? h('span', { className: 'mbp-row__detail' }, detail) : null,
    trail);
}

export function Checkbox({ checked, label, children }) {
  const on = bool(checked);
  return h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on), className: cx('mbp-check', on && 'is-on') },
    h('span', { className: 'mbp-check__box', 'aria-hidden': 'true' }, on ? h(Icon, { name: 'check', size: 16, weight: 'bold' }) : null),
    h('span', { className: 'mbp-check__label' }, children ?? label));
}

export function RadioRow({ label, checked }) {
  const on = bool(checked);
  return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), className: 'mbp-row' },
    h('span', { className: 'mbp-row__body' }, h('span', { className: 'mbp-row__title' }, label)),
    h('span', { className: cx('mbp-radio', on && 'is-on'), 'aria-hidden': 'true' }));
}

export function TextField({ label, placeholder, value, prefix, helper, helperRight, counter, error, multiline, focused, id }) {
  const has = value != null && value !== '';
  const isFocused = bool(focused);
  return h('div', { className: cx('mbp-field', isFocused && 'is-focused', error && 'is-error') },
    label ? h('label', { className: 'mbp-field__label', htmlFor: id }, label) : null,
    h('div', { className: 'mbp-field__control', style: bool(multiline) ? { alignItems: 'flex-start', minHeight: 112 } : undefined },
      prefix ? h('span', { className: 'mbp-field__prefix', 'aria-hidden': 'true' }, prefix) : null,
      h('span', { className: cx('mbp-field__value', !has && 'is-placeholder'), id, role: 'textbox', 'aria-label': label || placeholder, style: bool(multiline) ? { whiteSpace: 'normal' } : undefined },
        has ? value : isFocused ? null : placeholder, isFocused ? h('span', { className: 'mbp-field__caret', 'aria-hidden': 'true' }) : null,
        !has && isFocused && placeholder ? h('span', { style: { marginLeft: 2 } }, placeholder) : null),
      counter ? h('span', { className: 'mbp-field__counter' }, counter) : null),
    error ? h('span', { className: 'mbp-field__error', role: 'alert' }, h(Icon, { name: 'warning-circle', size: 16 }), error) : null,
    (helper || helperRight) ? h('div', { className: 'mbp-field__help' }, h('span', null, helper), helperRight ? h('span', null, helperRight) : null) : null);
}

export function SearchField({ placeholder = 'Cherche…', value, focused }) {
  const has = value != null && value !== '';
  return h('div', { className: cx('mbp-search', bool(focused) && 'is-focused'), role: 'search' },
    h(Icon, { name: 'magnifying-glass', size: 22 }),
    h('span', { className: cx('mbp-field__value', !has && 'is-placeholder'), role: 'searchbox', 'aria-label': placeholder },
      has ? value : null, bool(focused) ? h('span', { className: 'mbp-field__caret', 'aria-hidden': 'true' }) : null, has ? null : placeholder),
    has ? h(IconButton, { icon: 'x-circle', label: 'Effacer la recherche', weight: 'fill' }) : null);
}

export function CodeField({ length = 6, value = '', focused = true, label = 'Code à 6 chiffres' }) {
  const n = num(length, 6);
  const v = String(value || '');
  return h('div', { className: 'mbp-code', style: { '--len': n }, role: 'textbox', 'aria-label': label },
    Array.from({ length: n }, (_, i) => h('span', { key: i, className: cx('mbp-code__cell', i < v.length && 'is-filled', bool(focused) && i === v.length && 'is-active') },
      v[i] || (bool(focused) && i === v.length ? h('span', { className: 'mbp-field__caret' }) : ''))));
}

/* ------------------------------------------------------------------ */
/* Calques                                                             */
/* ------------------------------------------------------------------ */
export function Sheet({ title, eyebrow, eyebrowCategory, subtitle, height = 'auto', close = 'icon', closeLabel = 'Fermer', action, actionTone, grabber = true, scrim = true, children, className }) {
  return h('div', { className: 'mbp-layer' },
    scrim !== false && scrim !== 'false' ? h('div', { className: 'mbp-scrim', 'aria-hidden': 'true' }) : null,
    h('section', { className: cx('mbp-sheet', height !== 'auto' && `mbp-sheet--${height}`, className), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      grabber !== false && grabber !== 'false' ? h('div', { className: 'mbp-sheet__grabber', 'aria-hidden': 'true' }) : null,
      (title || close !== 'none' || action) ? h('div', { className: 'mbp-sheet__head' },
        h('div', { className: 'mbp-sheet__titles' },
          eyebrow ? h('div', { className: 'mbp-sheet__eyebrow' }, eyebrowCategory ? h(Tag, { category: eyebrowCategory, variant: 'surface' }) : null, h('span', null, eyebrow)) : null,
          title ? h('h2', { className: 'mbp-sheet__title' }, title) : null,
          subtitle ? h('p', { className: 'mbp-sheet__subtitle' }, subtitle) : null),
        action ? h('button', { type: 'button', className: 'mbp-topbar__text-action', style: { color: actionTone === 'danger' ? 'var(--text-danger)' : undefined } }, action) : null,
        close === 'icon' ? h(IconButton, { icon: 'x', label: closeLabel, variant: 'tonal' }) : close === 'text' ? h('button', { type: 'button', className: 'mbp-topbar__text-action' }, closeLabel) : null) : null,
      h('div', { className: 'mbp-sheet__body' }, children)));
}

export function SheetFooter({ children, flat }) {
  return h('div', { className: cx('mbp-sheet__footer', bool(flat) && 'is-flat') }, children);
}

export function AskSheet({ mood = 'content', title, message, primary, secondary, secondaryVariant = 'tertiary', confetti }) {
  return h('div', { className: 'mbp-layer' },
    h('div', { className: 'mbp-scrim', 'aria-hidden': 'true' }),
    bool(confetti) ? h(Confetti, null) : null,
    h('section', { className: 'mbp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { className: 'mbp-sheet__grabber', 'aria-hidden': 'true' }),
      h('div', { className: 'mbp-ask' },
        h(Popy, { mood, size: 112, wiggle: true }),
        h('h2', { className: 'mbp-ask__title' }, title),
        message ? h('p', { className: 'mbp-ask__text' }, message) : null,
        h('div', { className: 'mbp-btn-stack' },
          primary ? h(Button, { variant: 'primary', block: true }, primary) : null,
          secondary ? h(Button, { variant: secondaryVariant, block: secondaryVariant !== 'tertiary' }, secondary) : null))));
}

export function ActionSheet({ title, actions, cancelLabel = 'Annuler' }) {
  const acts = Array.isArray(actions) ? actions : [];
  return h('div', { className: 'mbp-layer' },
    h('div', { className: 'mbp-scrim', 'aria-hidden': 'true' }),
    h('section', { className: 'mbp-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Options' },
      h('div', { className: 'mbp-sheet__grabber', 'aria-hidden': 'true' }),
      h('div', { className: 'mbp-actions', role: 'menu' },
        title ? h('div', { className: 'mbp-actions__title' }, title) : null,
        acts.map((a, i) => h('button', { key: i, type: 'button', role: 'menuitem', className: cx('mbp-actions__item', a.tone === 'danger' && 'is-danger') }, a.icon ? h(Icon, { name: a.icon, size: 24 }) : null, a.label)),
        h('div', { className: 'mbp-actions__sep', 'aria-hidden': 'true' }),
        h('button', { type: 'button', role: 'menuitem', className: 'mbp-actions__item', style: { justifyContent: 'center', fontWeight: 600 } }, cancelLabel))));
}

export function Dialog({ title, message, mood, actions }) {
  const acts = Array.isArray(actions) ? actions : [];
  return h('div', { className: 'mbp-dialog-layer' },
    h('div', { className: 'mbp-scrim', 'aria-hidden': 'true' }),
    h('section', { className: 'mbp-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title },
      mood ? h(Popy, { mood, size: 76 }) : null,
      h('h2', { className: 'mbp-dialog__title' }, title),
      message ? h('p', { className: 'mbp-dialog__text' }, message) : null,
      h('div', { className: 'mbp-btn-stack' }, acts.map((a, i) => h(Button, { key: i, variant: a.variant || (i === acts.length - 1 ? 'secondary' : 'primary'), size: 'md', block: true }, a.label)))));
}

export function Toast({ message, action, icon, offset = 98 }) {
  return h('div', { className: 'mbp-toast', role: 'status', 'aria-live': 'polite', style: { '--toast-offset': num(offset, 98) + 'px' } },
    icon ? h(Icon, { name: icon, size: 22, className: 'mbp-toast__icon', weight: 'fill' }) : null,
    h('span', { className: 'mbp-toast__msg' }, message),
    action ? h('button', { type: 'button', className: 'mbp-toast__action' }, action) : null);
}

export function Banner({ tone = 'offline', title, message, action, closable }) {
  if (tone === 'offline') {
    return h('div', { className: 'mbp-banner mbp-banner--offline', role: 'status' }, h(Icon, { name: 'wifi-slash', size: 18 }), h('span', null, title || 'Pas de connexion'));
  }
  return h('div', { className: cx('mbp-banner', `mbp-banner--${tone}`), role: 'status' },
    tone === 'update' ? h(Popy, { mood: 'nani', size: 40 }) : null,
    h('span', { className: 'mbp-banner__text' }, h('span', { className: 'mbp-banner__title' }, title), message ? h('span', { className: 'mbp-banner__body' }, message) : null),
    action ? h(Button, { variant: 'primary', size: 'sm' }, action) : null,
    bool(closable) ? h(IconButton, { icon: 'x', label: 'Fermer', size: 'sm' }) : null);
}

export function InAppNotice({ title, message, time = 'maintenant' }) {
  return h('div', { className: 'mbp-notice', role: 'status', 'aria-live': 'polite' },
    h(AppIcon, { size: 40 }),
    h('div', { className: 'mbp-notice__body' },
      h('div', { className: 'mbp-notice__top' }, h('span', { className: 'mbp-notice__title' }, title), h('span', { className: 'mbp-notice__time' }, time)),
      h('span', { className: 'mbp-notice__text' }, message)));
}

export function EmptyState({ mood = 'content', title, message, action, actionVariant = 'primary', size = 120 }) {
  return h('div', { className: 'mbp-empty' },
    h(Popy, { mood, size, wiggle: true }),
    title ? h('h2', { className: 'mbp-empty__title' }, title) : null,
    message ? h('p', { className: 'mbp-empty__text' }, message) : null,
    action ? h(Button, { variant: actionVariant }, action) : null);
}

export function PromptCard({ mood = 'content', text, action }) {
  return h('div', { className: 'mbp-prompt' },
    h('div', { className: 'mbp-prompt__row' }, h(Popy, { mood, size: 52 }), h('p', { className: 'mbp-prompt__text', style: { margin: 0 } }, text)),
    action ? h(Button, { variant: 'primary', block: true }, action) : null);
}

export function Skeleton({ kind = 'post', rows = 3 }) {
  if (kind === 'list') {
    return h('div', { className: 'mbp-skel', 'aria-busy': 'true', 'aria-label': 'Chargement' }, Array.from({ length: num(rows, 3) }, (_, i) => h('div', { key: i, className: 'mbp-skel__row' },
      h('span', { className: 'mbp-skel__b mbp-skel__circle' }), h('span', { className: 'mbp-skel__lines' }, h('span', { className: 'mbp-skel__b', style: { width: '46%' } }), h('span', { className: 'mbp-skel__b', style: { width: '72%' } })))));
  }
  return h('div', { className: 'mbp-skel', 'aria-busy': 'true', 'aria-label': 'Chargement' },
    h('div', { className: 'mbp-skel__row' }, h('span', { className: 'mbp-skel__b mbp-skel__circle' }), h('span', { className: 'mbp-skel__lines' }, h('span', { className: 'mbp-skel__b', style: { width: '38%' } }), h('span', { className: 'mbp-skel__b', style: { width: '24%' } }))),
    h('div', { className: 'mbp-skel__plate' }, h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 6', aspectRatio: '16 / 9' } }), h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 3', aspectRatio: '6 / 5' } }), h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 3', aspectRatio: '6 / 5' } }),
      h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 2', aspectRatio: '1' } }), h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 2', aspectRatio: '1' } }), h('span', { className: 'mbp-skel__b', style: { gridColumn: 'span 2', aspectRatio: '1' } })));
}

export function Sticker({ label, children, tone = 'ink', tilt = -3 }) {
  return h('span', { className: cx('mbp-sticker', tone !== 'ink' && `mbp-sticker--${tone}`), style: { '--tilt': num(tilt, -3) + 'deg' } }, children ?? label);
}

export function Display({ size = 'xl', children, text, outline, as = 'h1', align, className }) {
  return h(as, { className: cx('mbp-display', `mbp-display--${size}`, className), style: align ? { textAlign: align } : undefined },
    children ?? text, outline ? h(React.Fragment, null, ' ', h('span', { className: 'mbp-outline' }, outline)) : null);
}

export function StatusPill({ label = 'En ligne', tone = 'live' }) {
  return h('span', { className: cx('mbp-status', tone !== 'live' && `mbp-status--${tone}`) }, h('span', { className: 'mbp-status__dot', 'aria-hidden': 'true' }), label);
}

export function Rule({ icon = 'check', tone = 'default', children, text }) {
  return h('div', { className: cx('mbp-rule', tone === 'no' && 'mbp-rule--no') },
    h('span', { className: 'mbp-rule__icon', 'aria-hidden': 'true' }, h(Icon, { name: icon, size: 18 })),
    h('p', { className: 'mbp-rule__text', style: { margin: 0 } }, children ?? text));
}

export function PopyPick({ mood = 'content', label, selected }) {
  const on = bool(selected);
  const full = MOOD_FILES[mood] === 'diable';
  return h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), className: cx('mbp-pick', on && 'is-on') },
    h('span', { className: 'mbp-pick__disc' }, h('img', { src: popySrc(mood), alt: '', className: full ? 'is-full' : undefined }), on ? h('span', { className: 'mbp-pick__check', 'aria-hidden': 'true' }, h(Icon, { name: 'check', size: 14 })) : null),
    h('span', { className: 'mbp-pick__label' }, label));
}

const CONFETTI = [
  [6, 4, 'yolk-300', 40, 260, 160, 2.2], [14, 10, 'ume-300', -30, 300, -200, 2.6], [22, 2, 'ramune-300', 20, 240, 120, 2.1], [31, 8, 'sakura-300', -10, 320, 220, 2.8],
  [40, 3, 'wasabi-300', 30, 260, -140, 2.3], [49, 12, 'shiso-300', -20, 300, 180, 2.7], [58, 5, 'yolk-300', 10, 280, -220, 2.4], [67, 9, 'thon-300', -40, 250, 200, 2.5],
  [75, 2, 'ume-300', 25, 330, -160, 2.9], [83, 7, 'ramune-300', -15, 270, 140, 2.2], [91, 4, 'sakura-300', 35, 300, -200, 2.6], [96, 11, 'yolk-300', -25, 260, 160, 2.3],
  [10, 18, 'shiso-300', 15, 220, 120, 2.0], [36, 16, 'thon-300', -35, 240, -120, 2.4], [62, 19, 'wasabi-300', 20, 230, 190, 2.1], [88, 17, 'ume-300', -10, 210, -160, 2.5],
];
export function Confetti() {
  return h('div', { className: 'mbp-confetti', 'aria-hidden': 'true' }, CONFETTI.map(([x, y, c, dx, dy, r, d], i) =>
    h('i', { key: i, style: { left: x + '%', top: y + '%', background: `var(--${c})`, '--dx': dx + 'px', '--dy': dy + 'px', '--r': r + 'deg', '--d': d + 's', transform: `rotate(${r}deg)`, borderRadius: i % 3 === 0 ? '50%' : undefined, width: i % 3 === 0 ? 12 : undefined, height: i % 3 === 0 ? 12 : undefined } })));
}

export function ShareCard({ handle, slots, items, scale = 1 }) {
  const s = num(scale, 1);
  return h('div', { style: { width: 1080 * s, height: 1920 * s, overflow: 'hidden', flex: 'none' } },
    h('div', { className: 'mbp-share', style: { transform: `scale(${s})`, transformOrigin: '0 0' }, role: 'img', 'aria-label': `Image à partager : le bento de ${handle}` },
      h('div', { className: 'mbp-share__inner' },
        h('div', { className: 'mbp-share__top' }, h(Logo, { height: 76 }), h(Popy, { mood: 'content', size: 120, tilt: 8 })),
        h('span', { className: 'mbp-share__sticker' }, 'Mon bento pop culture'),
        h('h1', { className: 'mbp-share__handle' }, handle),
        h(Bento, { slots, items, density: 'share' }),
        h('div', { className: 'mbp-share__foot' },
          h(AppIcon, { size: 104 }),
          h('div', { style: { display: 'flex', flexDirection: 'column' } },
            h('span', { className: 'mbp-share__url' }, `bento-pop.com/u/${String(handle || '').replace(/^@/, '').toLowerCase()}`),
            h('span', { className: 'mbp-share__cta' }, 'Compose le tien sur Mon Bento Pop'))))));
}
