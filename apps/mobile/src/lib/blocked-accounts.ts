/**
 * Les comptes bloqués sur le téléphone, rangés par compte et non plus par
 * pseudo : changer de pseudo ne lève plus un blocage (chantier 21, D8).
 *
 * Pur, sans stockage ni client : `src/state/blocked.ts` persiste les entrées,
 * et l'appelant fournit la réponse de `resolve_accounts` pour la reprise. Les
 * filtres du fil, de la recherche, des matchs et de la page publique passent
 * tous par `isBlockedAccount`.
 */

/**
 * Un compte bloqué. `userId` vaut `null` quand le pseudo bloqué ne mène plus
 * à personne, à la reprise : l'entrée garde alors son seul pseudo, qui suffit
 * si un compte le reprend un jour.
 */
export type BlockedEntry = { userId: string | null; pseudo: string };

/** L'index des filtres : les comptes par identifiant, les pseudos en minuscules. */
export type BlockedAccounts = {
  ids: ReadonlySet<string>;
  pseudos: ReadonlySet<string>;
};

export const NO_BLOCKED_ACCOUNTS: BlockedAccounts = { ids: new Set(), pseudos: new Set() };

export function blockedIndex(entries: readonly BlockedEntry[]): BlockedAccounts {
  const ids = new Set<string>();
  const pseudos = new Set<string>();
  for (const entry of entries) {
    if (entry.userId) ids.add(entry.userId);
    pseudos.add(entry.pseudo.toLowerCase());
  }
  return { ids, pseudos };
}

/**
 * Vrai si ce compte est bloqué : par son identifiant quand on le connaît, et
 * par son pseudo dans tous les cas, pour les entrées qui n'ont plus de
 * compte et pour les écrans qui n'ont pas l'identifiant sous la main.
 */
export function isBlockedAccount(
  blocked: BlockedAccounts,
  who: { userId?: string | null; pseudo: string },
): boolean {
  if (who.userId && blocked.ids.has(who.userId)) return true;
  return blocked.pseudos.has(who.pseudo.toLowerCase());
}

/** Un bloqué de plus, ou le même mis à jour, sans doublon. */
export function withBlocked(entries: readonly BlockedEntry[], entry: BlockedEntry): BlockedEntry[] {
  return [...withoutBlockedEntry(entries, entry), { userId: entry.userId, pseudo: entry.pseudo.toLowerCase() }];
}

/** Débloquer : par le compte, et par le pseudo pour une entrée sans compte. */
export function withoutBlockedEntry(
  entries: readonly BlockedEntry[],
  entry: { userId?: string | null; pseudo: string },
): BlockedEntry[] {
  const pseudo = entry.pseudo.toLowerCase();
  return entries.filter((e) =>
    entry.userId && e.userId ? e.userId !== entry.userId : e.pseudo.toLowerCase() !== pseudo,
  );
}

/**
 * La reprise des blocages d'avant le chantier 21, une liste de pseudos en
 * minuscules : chacun rattaché au compte que `resolve_accounts` lui trouve,
 * actuel ou ancien, sous son pseudo actuel. Un pseudo qui ne mène plus à
 * personne reste dans la liste, tel quel. Deux pseudos du même compte n'en
 * font qu'un.
 */
export function migrateBlockedPseudos(
  pseudos: readonly string[],
  resolved: readonly { pseudo: string; user_id: string; current_pseudo: string }[],
): BlockedEntry[] {
  const byPseudo = new Map(resolved.map((r) => [r.pseudo.toLowerCase(), r]));
  let entries: BlockedEntry[] = [];
  for (const raw of pseudos) {
    const pseudo = raw.trim().toLowerCase();
    if (!pseudo) continue;
    const found = byPseudo.get(pseudo);
    entries = withBlocked(
      entries,
      found ? { userId: found.user_id, pseudo: found.current_pseudo } : { userId: null, pseudo },
    );
  }
  return entries;
}

/**
 * Les pseudos actuels des comptes bloqués, pour la liste des réglages : un
 * compte qui a changé de pseudo s'y lit sous le nouveau.
 */
export function withCurrentPseudos(
  entries: readonly BlockedEntry[],
  current: ReadonlyMap<string, string>,
): BlockedEntry[] {
  return entries.map((e) => {
    const pseudo = e.userId ? current.get(e.userId) : undefined;
    return pseudo ? { userId: e.userId, pseudo: pseudo.toLowerCase() } : e;
  });
}

/**
 * Lit ce que le stockage garde, en tolérant tout : une valeur illisible se lit
 * comme une liste vide, jamais comme une erreur qui empêcherait l'app de
 * démarrer.
 */
export function parseBlockedEntries(raw: string | null): BlockedEntry[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((v) => {
      if (!v || typeof v !== 'object') return [];
      const r = v as Record<string, unknown>;
      if (typeof r.pseudo !== 'string' || !r.pseudo.trim()) return [];
      return [{ userId: typeof r.userId === 'string' ? r.userId : null, pseudo: r.pseudo.toLowerCase() }];
    });
  } catch {
    return [];
  }
}
