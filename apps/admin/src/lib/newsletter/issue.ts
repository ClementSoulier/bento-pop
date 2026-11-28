/**
 * Un numéro de la newsletter (docs/NEWSLETTER-ENVOI.md, D3 et D10) : son rendu
 * avant envoi et ses contrôles. Fonctions pures, sans réseau.
 *
 * Le HTML déposé part tel quel. Deux retouches seulement : le repère
 * `{{desinscription}}` remplacé par le lien de désinscription, et le texte
 * d'aperçu glissé, invisible, en tête du `<body>`.
 */

export const NEWSLETTER_FROM = 'Bento Pop <newsletter@news.bento-pop.com>';
export const NEWSLETTER_REPLY_TO = 'contact@bento-pop.com';

/** Le repère que Florian place dans son HTML. Espaces tolérés : `{{ desinscription }}`. */
export const UNSUBSCRIBE_MARKER = '{{desinscription}}';
const MARKER_RE = /\{\{\s*desinscription\s*\}\}/g;

/** Le lien personnel que Resend met à la place, pour chaque destinataire d'un Broadcast. */
export const RESEND_UNSUBSCRIBE_URL = '{{{RESEND_UNSUBSCRIBE_URL}}}';

/** Gmail coupe un message au-delà de 102 Ko et masque la suite, lien de désinscription compris. */
export const GMAIL_CLIP_BYTES = 100_000;

export const SUBJECT_MAX = 150;
export const PREHEADER_MAX = 200;
export const HTML_MAX_BYTES = 512_000;
export const TEXT_MAX_BYTES = 200_000;

export type IssueStatus = 'draft' | 'sending' | 'scheduled' | 'sent';

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  draft: 'Brouillon',
  sending: 'Envoi en cours',
  scheduled: 'Programmé',
  sent: 'Envoyé',
};

export type IssueContent = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function hasUnsubscribeMarker(value: string): boolean {
  MARKER_RE.lastIndex = 0;
  return MARKER_RE.test(value);
}

export function fillUnsubscribe(value: string, url: string): string {
  return value.replace(MARKER_RE, () => url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Le bloc d'aperçu : invisible dans le mail, lu par la boîte de réception
 * après l'objet. Les espaces insécables qui suivent empêchent la boîte d'aller
 * chercher la suite dans le corps du mail.
 */
export function preheaderBlock(preheader: string): string {
  const filler = '&#847;&zwnj;&nbsp;'.repeat(60);
  return (
    '<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;' +
    'font-size:1px;line-height:1px;opacity:0;">' +
    `${escapeHtml(preheader.trim())}${filler}</div>`
  );
}

export function injectPreheader(html: string, preheader: string): string {
  if (!preheader.trim()) return html;
  const block = preheaderBlock(preheader);
  const body = /<body\b[^>]*>/i.exec(html);
  if (!body) return block + html;
  const at = body.index + body[0].length;
  return html.slice(0, at) + block + html.slice(at);
}

/** Le HTML et le texte tels qu'ils partent, le lien de désinscription donné. */
export function renderIssue(
  content: Pick<IssueContent, 'preheader' | 'html' | 'text'>,
  unsubscribeUrl: string,
): { html: string; text: string } {
  return {
    html: fillUnsubscribe(injectPreheader(content.html, content.preheader), unsubscribeUrl),
    text: fillUnsubscribe(content.text, unsubscribeUrl),
  };
}

export type IssueCheck = { level: 'error' | 'warning'; message: string };

/** Un lien de Resend fait une centaine de caractères : de quoi peser le mail au plus juste. */
const SAMPLE_UNSUBSCRIBE_URL = `https://unsubscribe.resend.com/${'x'.repeat(96)}`;

/**
 * Les contrôles d'avant envoi. Une erreur bloque l'envoi aux inscrits ; un
 * avertissement se lit et se décide (D10).
 */
export function checkIssue(content: IssueContent): IssueCheck[] {
  const checks: IssueCheck[] = [];
  const error = (message: string) => checks.push({ level: 'error', message });
  const warn = (message: string) => checks.push({ level: 'warning', message });

  if (!content.subject.trim()) error('L’objet est vide.');
  if (!content.html.trim()) {
    error('Le contenu HTML est vide.');
    return checks;
  }
  if (!hasUnsubscribeMarker(content.html)) {
    error(
      `Le HTML ne contient pas ${UNSUBSCRIBE_MARKER} : chaque numéro doit offrir son lien de désinscription.`,
    );
  }

  const unstable = [...content.html.matchAll(/\bsrc\s*=\s*["'][^"']*\/_next\//gi)].length;
  if (unstable > 0) {
    warn(
      `${unstable} image${unstable > 1 ? 's' : ''} chargée${unstable > 1 ? 's' : ''} depuis /_next/ : ` +
        'leur adresse change à chaque mise en ligne du site. Utiliser https://bento-pop.com/newsletter/….',
    );
  }

  const bytes = byteLength(renderIssue(content, SAMPLE_UNSUBSCRIBE_URL).html);
  if (bytes > GMAIL_CLIP_BYTES) {
    warn(
      `Le mail pèse ${Math.round(bytes / 1000)} Ko : Gmail le coupe au-delà de 102 Ko et masque la fin, ` +
        'lien de désinscription compris.',
    );
  }

  if (!content.text.trim()) {
    warn('La version texte est vide : certaines messageries n’affichent qu’elle.');
  } else if (!hasUnsubscribeMarker(content.text)) {
    warn(`La version texte ne contient pas ${UNSUBSCRIBE_MARKER}.`);
  }

  const all = `${content.subject}${content.preheader}${content.html}${content.text}`;
  if (all.includes('�')) {
    warn(
      'Des caractères sont illisibles (�) : le fichier n’était sans doute pas enregistré en UTF-8. ' +
        'Le réexporter en UTF-8 avant de le coller.',
    );
  }

  if (content.preheader.trim() && /<body\b[^>]*>\s*<(div|span)\b[^>]*display\s*:\s*none/i.test(content.html)) {
    warn(
      'Le HTML a déjà un bloc d’aperçu invisible en tête : le texte d’aperçu s’y ajoutera. ' +
        'Garder l’un ou l’autre.',
    );
  }

  return checks;
}

export function hasBlockingError(checks: readonly IssueCheck[]): boolean {
  return checks.some((c) => c.level === 'error');
}

export const SCHEDULE_MIN_MS = 10 * 60 * 1000;
export const SCHEDULE_MAX_MS = 30 * 24 * 60 * 60 * 1000;

/** Une programmation tient entre 10 minutes et 30 jours plus tard (D7). */
export function checkSchedule(iso: string, now = Date.now()): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'Date de programmation invalide.';
  if (at < now + SCHEDULE_MIN_MS) return 'La programmation doit tomber au moins 10 minutes plus tard.';
  if (at > now + SCHEDULE_MAX_MS) return 'La programmation ne peut pas dépasser 30 jours.';
  return null;
}

const PARIS_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

/** « samedi 6 décembre 2026 à 09:00 », à l'heure de Paris. */
export function formatParisDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : PARIS_DATE.format(date);
}
