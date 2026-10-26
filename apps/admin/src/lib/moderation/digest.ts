/**
 * Le mail à l'équipe et le motif d'un bannissement, chantier 22 (§5.8, D11,
 * D13). Pur, testé sous `node:test` : ce qui part, et quand.
 *
 * Un mail au premier signalement en attente, puis au plus un par heure tant
 * qu'il en arrive, chacun groupant tous ceux que l'équipe n'a pas encore
 * reçus : 24 par jour au pire, sous les 100 du plan gratuit de Resend,
 * partagés avec les codes du chantier 28.
 */

/** Entre deux mails à l'équipe, au moins une heure (D11). */
export const ALERT_INTERVAL_MS = 60 * 60 * 1000;

/** Ce qu'un mail cite d'un commentaire signalé. */
export const EXCERPT_LENGTH = 80;

/**
 * Les six motifs, tels que l'app les montre (`apps/mobile/src/lib/social.ts`,
 * `REPORT_REASONS`). Recopiés : le back-office ne lit pas le code de l'app.
 */
export const REASON_LABELS: Record<string, string> = {
  hate: 'Haine ou discrimination',
  harassment: 'Harcèlement ou insultes',
  sexual: 'Contenu sexuel',
  violence: 'Violence ou menaces',
  spam: 'Spam ou arnaque',
  other: 'Autre',
};

export function reasonLabel(code: string | null | undefined): string {
  return (code && REASON_LABELS[code]) ?? 'Sans motif';
}

export type AlertableReport = {
  id: string;
  target_kind: string;
  target_pseudo: string;
  reason_code: string | null;
  target_text: string | null;
  created_at: string;
};

/** Vrai quand un mail doit partir maintenant. */
export function shouldSendDigest({
  unalerted,
  lastAlertAt,
  now,
}: {
  unalerted: readonly AlertableReport[];
  lastAlertAt: Date | null;
  now: Date;
}): boolean {
  if (unalerted.length === 0) return false;
  if (!lastAlertAt) return true;
  return now.getTime() - lastAlertAt.getTime() >= ALERT_INTERVAL_MS;
}

const TARGETS: Record<string, string> = {
  comment: 'Commentaire de',
  account: 'Compte',
  bento: 'Bento de',
  pseudo: 'Pseudo',
};

/** Un extrait sur une ligne, coupé au mot, avec « … » s'il est coupé. */
export function excerpt(text: string, max = EXCERPT_LENGTH): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if ([...flat].length <= max) return flat;
  const cut = [...flat].slice(0, max).join('');
  const atWord = cut.replace(/\s+\S*$/, '');
  return `${atWord.length > max / 2 ? atWord : cut}…`;
}

function line(r: AlertableReport): string {
  const who = `${TARGETS[r.target_kind] ?? 'Cible'} @${r.target_pseudo}`;
  const text = r.target_text ? ` · « ${excerpt(r.target_text)} »` : '';
  return `${who} · ${reasonLabel(r.reason_code)}${text}`;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Mail = { subject: string; text: string; html: string };

/** Le mail à l'équipe (§5.8) : chaque signalement, puis le lien. */
export function composeDigest(
  reports: readonly AlertableReport[],
  { adminUrl }: { adminUrl: string },
): Mail {
  const n = reports.length;
  const subject = `Bento Pop · ${n} signalement${n > 1 ? 's' : ''} à modérer`;
  const link = `${adminUrl.replace(/\/+$/, '')}/reports`;
  const lines = reports.map(line);
  const text = [
    n > 1 ? `${n} signalements attendent l'équipe :` : "Un signalement attend l'équipe :",
    '',
    ...lines.map((l) => `• ${l}`),
    '',
    `Ouvrir la modération : ${link}`,
    '',
    "L'app promet une réponse sous 24 h.",
  ].join('\n');
  const html = [
    `<p>${n > 1 ? `${n} signalements attendent l'équipe :` : "Un signalement attend l'équipe :"}</p>`,
    `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`,
    `<p><a href="${escapeHtml(link)}">Ouvrir la modération</a></p>`,
    "<p>L'app promet une réponse sous 24 h.</p>",
  ].join('');
  return { subject, text, html };
}

/**
 * Le motif d'un bannissement, envoyé avant la suppression à l'adresse d'un
 * compte gardé (D13, article 17 du DSA) : ce qui est fait, pourquoi, sur
 * quelle base, et comment le contester.
 */
export function composeBanNotice({ pseudo, reason }: { pseudo: string; reason: string }): Mail {
  const subject = 'Ton compte Mon Bento Pop a été supprimé';
  const paragraphs = [
    `Bonjour @${pseudo},`,
    "L'équipe Bento Pop a supprimé ton compte, avec tes bentos et tes commentaires.",
    `Motif : ${reason}.`,
    "Cette décision applique les règles du jeu acceptées avant ta première publication, et les conditions d'utilisation (bento-pop.com/mentions-legales).",
    "Pour la contester, écris à contact@bento-pop.com en expliquant pourquoi. Une personne de l'équipe te répondra.",
  ];
  return {
    subject,
    text: paragraphs.join('\n\n'),
    html: paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''),
  };
}

/** Les adresses de l'équipe, d'une variable « a@x.fr, b@y.fr ». */
export function parseRecipients(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}
