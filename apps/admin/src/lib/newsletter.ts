/**
 * La liste de la newsletter au back-office (docs/NEWSLETTER.md) : provenance
 * lisible, et export CSV pour l'outil d'envoi.
 */

export type SubscriberRow = {
  id: string;
  email: string;
  source: string;
  consent_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  home: 'Accueil',
  footer: 'Pied de page',
  landing: 'Landing',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/** Une cellule CSV : entre guillemets dès qu'elle contient un séparateur. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Le CSV de la liste : l'adresse d'abord, comme l'attendent les outils
 * d'envoi (Brevo, Mailchimp…), puis la date d'inscription (ISO 8601, UTC)
 * et la provenance. Séparateur virgule, fins de ligne CRLF (RFC 4180).
 */
export function subscribersCsv(rows: readonly SubscriberRow[]): string {
  const lines = [
    'email,inscrit_le,provenance',
    ...rows.map((r) =>
      [r.email, new Date(r.consent_at).toISOString(), sourceLabel(r.source)].map(csvCell).join(','),
    ),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Filtre sur l'adresse, sans tenir compte de la casse ni des espaces autour. */
export function filterSubscribers(rows: readonly SubscriberRow[], query: string): SubscriberRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((r) => r.email.toLowerCase().includes(q));
}
