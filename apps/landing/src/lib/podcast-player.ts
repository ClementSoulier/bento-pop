/**
 * La logique du lecteur des pages podcasts, sans React.
 *
 * À part du composant pour être testable par le lanceur du dépôt, qui ne sait pas résoudre
 * les alias `@/` : ce module n'importe rien.
 */

export type PlayerChapter = { label: string; start_seconds: number };

/** Le chapitre en cours à l'instant `t` (en secondes), ou null avant le premier. */
export function chapterAt(chapters: PlayerChapter[], t: number): PlayerChapter | null {
  let enCours: PlayerChapter | null = null;
  for (const c of [...chapters].sort((a, b) => a.start_seconds - b.start_seconds)) {
    if (c.start_seconds > t) break;
    enCours = c;
  }
  return enCours;
}

/**
 * Lit un lien vers un instant de l'épisode : « #t=754 », « #t=12:34 » ou « #t=1:02:03 ».
 * C'est la syntaxe des fragments de média, celle que comprennent déjà les navigateurs.
 */
export function parseTimeFragment(hash: string): number | null {
  const m = /^#?t=(\d+(?::\d{1,2}){0,2})$/.exec(hash.trim());
  if (!m?.[1]) return null;
  return m[1].split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

/** Les vitesses proposées, dans l'ordre où le bouton les fait défiler. */
export const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2, 0.75] as const;

export function nextSpeed(current: number): number {
  const i = PLAYBACK_SPEEDS.findIndex((v) => v === current);
  return PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length] ?? 1;
}

/** « 1,25× » : la virgule française, et pas de « ,00 » inutile. */
export function formatSpeed(speed: number): string {
  return `${String(speed).replace('.', ',')}×`;
}

/** L'instant en toutes lettres, pour les lecteurs d'écran : « 12 minutes 34 secondes ». */
export function formatSpokenTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const parties: string[] = [];
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) parties.push(`${h} heure${h > 1 ? 's' : ''}`);
  if (m) parties.push(`${m} minute${m > 1 ? 's' : ''}`);
  if (s % 60 || !parties.length) parties.push(`${s % 60} seconde${s % 60 > 1 ? 's' : ''}`);
  return parties.join(' ');
}

/**
 * Vrai si l'identifiant d'épisode d'une plateforme en est un vrai. Les fiches portent
 * « A_REMPLACER » ou « TODO_… » tant qu'on ne le connaît pas, c'est-à-dire tant que la
 * plateforme n'a pas repris l'épisode : un lecteur ou un lien construit dessus serait cassé.
 */
export function isRealEpisodeId(platform: string, id: string): boolean {
  switch (platform) {
    case 'spotify':
      return /^[0-9A-Za-z]{22}$/.test(id);
    case 'deezer':
    case 'apple':
      return /^\d+$/.test(id);
    default:
      return false;
  }
}
