/**
 * Convertit un nombre de secondes en mm:ss ou hh:mm:ss.
 * Renvoie '' si null/undefined.
 */
export function secondsToTimecode(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Parse une chaîne mm:ss, hh:mm:ss, m:ss ou un entier en secondes.
 * Renvoie null si parse échoue.
 */
export function timecodeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 2) {
    const [m, s] = nums;
    if (s == null || s >= 60 || m == null) return null;
    return m * 60 + s;
  }
  const [h, m, s] = nums;
  if (h == null || m == null || s == null || m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Convertit un timestamp ISO (ou null) en valeur pour input[type=datetime-local]
 * (format YYYY-MM-DDTHH:mm, sans fuseau).
 */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convertit la valeur d'un input datetime-local en ISO (ou null si vide).
 * L'input est interprété en heure locale du navigateur côté client ; côté serveur
 * on reçoit la chaîne telle quelle et on la passe à `new Date()`.
 */
export function datetimeLocalToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
