/**
 * Les éditions hebdomadaires, côté back-office.
 *
 * Une édition est un **modèle de bento** : un titre, une adresse, une date de
 * sortie, et de deux à six cases décrites. Elle ne porte aucun item. Quand
 * quelqu'un la compose, il obtient un bento comme les autres, avec son
 * adresse publique et sa place dans le fil. Cf.
 * `docs/UX-13-BENTO-HEBDOMADAIRE.md`.
 *
 * Deux moitiés, comme `catalogue-types.ts` : les fonctions pures d'abord,
 * testées par `editions.test.ts` ; les accès à la base ensuite, qui prennent
 * leur client en paramètre pour être rejoués contre le Supabase local.
 *
 * **La règle d'intitulé n'est pas ici.** Elle vit dans
 * `@bento-pop/supabase-mobile/bento`, partagée avec l'app : deux
 * implémentations divergeraient, et l'équipe le découvrirait une fois
 * l'édition sortie, quand plus personne ne peut la corriger sans casser les
 * bentos déjà composés.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOX_LAYOUTS, boxPlacements, promptFit } from '@bento-pop/supabase-mobile/bento';
import type { Database } from '@bento-pop/supabase-mobile/types';

export type MobileClient = SupabaseClient<Database>;

export type Result<T = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; value: T } | { ok: false; error: string };

// ─── Ce qu'est une édition ─────────────────────────────────────────────

/** L'état d'une édition, déduit de sa seule date de sortie. */
export type EditionStatus = 'brouillon' | 'programmee' | 'sortie';

export const EDITION_STATUS_LABELS: Record<EditionStatus, string> = {
  brouillon: 'brouillon',
  programmee: 'programmée',
  sortie: 'sortie',
};

export type EditionCase = {
  /** Identifiant en base, absent tant que la case n'est pas enregistrée. */
  id?: number;
  /** Rang dans la boîte, de 1 à 6. */
  order: number;
  /** La question posée, ce que lit l'utilisateur sur une case vide. */
  prompt: string;
  /** Tampon court de la tuile pleine, capitales. */
  stamp: string;
  gender: 'm' | 'f';
  /** Type d'élément accepté, `item_types.id`. */
  typeId: number;
};

export type EditionRow = {
  id: number;
  slug: string;
  title: string;
  /** ISO, ou `null` pour un brouillon. */
  releasedAt: string | null;
  status: EditionStatus;
  /** Nombre de cases décrites. */
  cases: number;
  /** Nombre de personnes qui l'ont composée. */
  composed: number;
};

/**
 * L'état d'une édition ne se stocke pas, il se lit.
 *
 * `released_at` porte à la fois la date et le fait d'être sortie : une
 * colonne de statut en plus serait une seconde vérité à tenir cohérente, et
 * elle finirait par mentir.
 */
export function editionStatus(releasedAt: string | null, now: Date = new Date()): EditionStatus {
  if (!releasedAt) return 'brouillon';
  return new Date(releasedAt).getTime() <= now.getTime() ? 'sortie' : 'programmee';
}

// ─── Validation ────────────────────────────────────────────────────────

/** Même forme que `bentos_slug_format` : le slug devient celui des bentos. */
export const EDITION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
/**
 * 30 caractères au plus, la même borne qu'en base : c'est ce que le composer
 * affiche entier sur un iPhone SE. Arbitrage du 16 septembre 2026, à la place
 * de 80, qui laissait passer des titres tronqués dans l'app.
 */
export const EDITION_TITLE_MAX = 30;
export const STAMP_MAX = 8;

export type EditionInput = { title: string; slug: string; releasedAt: string | null };

/**
 * Valide le cadre d'une édition, avant d'écrire.
 *
 * Le slug est définitif dans les faits : il devient l'adresse publique du
 * bento de chaque personne qui compose l'édition, et ces adresses sont
 * partagées. On le refuse donc tôt, avec un message lisible.
 */
export function validateEdition(input: EditionInput): Result {
  const title = input.title.trim();
  if (title.length === 0) return { ok: false, error: 'Il faut un titre.' };
  if (title.length > EDITION_TITLE_MAX) {
    return { ok: false, error: `Titre trop long : ${EDITION_TITLE_MAX} caractères au plus.` };
  }

  const slug = input.slug.trim();
  if (!EDITION_SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: 'Adresse invalide : 3 à 40 caractères, minuscules, chiffres et tirets.',
    };
  }

  if (input.releasedAt !== null && Number.isNaN(new Date(input.releasedAt).getTime())) {
    return { ok: false, error: 'Date de sortie illisible.' };
  }

  return { ok: true };
}

/** Le verdict d'affichage d'une case, tel que l'écran le montre. */
export type CaseVerdict = {
  order: number;
  /**
   * L'intitulé est encore vide : rien à mesurer. L'écran affichait « coupé ·
   * 0 lignes » pour une case qu'on n'a pas encore écrite, recette du
   * 16 septembre 2026. La validation, elle, la refuse toujours.
   */
  empty: boolean;
  /** L'intitulé s'affiche entier. */
  fits: boolean;
  /** Il tient, mais risque la coupe sur un petit écran. */
  tight: boolean;
  /** Lignes nécessaires, au plus deux. */
  lines: number;
  /** Cases de sa rangée dans la disposition retenue. */
  casesInRow: number;
  /** Part de la ligne occupée, de 0 à 1 et parfois au-delà. */
  ratio: number;
  /** Le mot qui ne tiendra sur aucune ligne, s'il y en a un. */
  tooLongWord: string | null;
};

/**
 * Comment chaque case s'affichera, une fois la disposition connue.
 *
 * La disposition découle du **nombre** de cases : deux cases donnent deux
 * bandes, six donnent la boîte d'aujourd'hui. Un intitulé qui tenait à cinq
 * cases peut donc cesser de tenir à six, quand sa rangée passe de deux à
 * trois. C'est pourquoi le verdict se recalcule à chaque ajout, et pourquoi
 * l'écran le montre en direct plutôt qu'au moment d'enregistrer.
 */
export function caseVerdicts(cases: readonly EditionCase[]): CaseVerdict[] {
  const places = boxPlacements(cases.length);
  return [...cases]
    .sort((a, b) => a.order - b.order)
    .map((c, i) => {
      const place = places[i];
      const empty = c.prompt.trim().length === 0;
      if (!place) {
        return {
          order: c.order, empty, fits: false, tight: false, lines: 0,
          casesInRow: 0, ratio: 0, tooLongWord: null,
        };
      }
      const fit = promptFit(c.prompt, place.casesInRow);
      return {
        order: c.order,
        empty,
        fits: fit.fits,
        tight: fit.tight,
        lines: fit.lines,
        casesInRow: place.casesInRow,
        ratio: fit.usableWidth === 0 ? 0 : fit.widestLine / fit.usableWidth,
        tooLongWord: fit.tooLongWord,
      };
    });
}

/**
 * Valide les cases d'une édition avant d'écrire.
 *
 * Refuse ce qui ne peut pas s'afficher, mais **laisse passer ce qui est
 * seulement serré** : `tight` est un avertissement que l'écran montre, pas un
 * blocage. La règle de refus doit accepter tout ce qui existe déjà, sans quoi
 * elle est fausse, cf. §5.4 de la spec.
 */
export function validateCases(cases: readonly EditionCase[]): Result {
  const n = cases.length;
  if (!BOX_LAYOUTS[n]) {
    const dessinees = Object.keys(BOX_LAYOUTS).map(Number).sort((a, b) => a - b);
    return {
      ok: false,
      error: `Une édition compte de ${dessinees[0]} à ${dessinees[dessinees.length - 1]} cases, pas ${n}.`,
    };
  }

  const rangs = cases.map((c) => c.order).sort((a, b) => a - b);
  const attendus = Array.from({ length: n }, (_, i) => i + 1);
  if (rangs.join() !== attendus.join()) {
    return { ok: false, error: `Les rangs doivent aller de 1 à ${n}, sans trou ni doublon.` };
  }

  for (const c of cases) {
    if (c.prompt.trim().length === 0) {
      return { ok: false, error: `Case ${c.order} : il faut un intitulé.` };
    }
    const stamp = c.stamp.trim();
    if (stamp.length === 0) return { ok: false, error: `Case ${c.order} : il faut un tampon.` };
    if (stamp.length > STAMP_MAX) {
      return { ok: false, error: `Case ${c.order} : tampon trop long, ${STAMP_MAX} caractères au plus.` };
    }
    if (!Number.isInteger(c.typeId) || c.typeId <= 0) {
      return { ok: false, error: `Case ${c.order} : il faut choisir un type.` };
    }
  }

  for (const verdict of caseVerdicts(cases)) {
    if (verdict.fits) continue;
    const c = cases.find((x) => x.order === verdict.order);
    if (verdict.tooLongWord) {
      return {
        ok: false,
        error: `Case ${verdict.order} : « ${verdict.tooLongWord} » est trop long pour une case de cette disposition.`,
      };
    }
    return {
      ok: false,
      error:
        `Case ${verdict.order} : « ${c?.prompt ?? ''} » demande ${verdict.lines} lignes ` +
        `dans une rangée à ${verdict.casesInRow}, et la case n'en affiche que deux.`,
    };
  }

  return { ok: true };
}

/**
 * La clé en base d'une case d'édition.
 *
 * `bento_categories.key` est unique pour toute la table, cases du bento
 * principal comprises : elle doit donc porter l'édition. C'est aussi ce que
 * l'app passe à `search_items`, qui la résout vers son type.
 */
export function caseKey(editionId: number, order: number): string {
  return `ed${editionId}_${order}`;
}

/** Un message lisible pour une erreur Postgres, plutôt que son code. */
export function explainEditionError(message: string): string {
  if (message.includes('editions_slug_key')) return 'Cette adresse est déjà prise par une autre édition.';
  if (message.includes('bento_categories_key_key')) return 'Deux cases portent la même clé.';
  if (message.includes('bento_categories_edition_order')) return 'Deux cases portent le même rang.';
  if (message.includes('editions_slug_check')) {
    return 'Adresse invalide : 3 à 40 caractères, minuscules, chiffres et tirets.';
  }
  return message;
}

// ─── Accès à la base ───────────────────────────────────────────────────

/** Les éditions, avec leur nombre de cases et de bentos composés. */
export async function listEditions(client: MobileClient): Promise<Result<EditionRow[]>> {
  const [editions, cases, bentos] = await Promise.all([
    client.from('editions').select('id, slug, title, released_at').order('id', { ascending: false }),
    client.from('bento_categories').select('edition_id').not('edition_id', 'is', null),
    client.from('bentos').select('edition_id').not('edition_id', 'is', null),
  ]);

  if (editions.error) return { ok: false, error: editions.error.message };

  const parCases = new Map<number, number>();
  for (const row of cases.data ?? []) {
    const id = row.edition_id as number | null;
    if (id !== null) parCases.set(id, (parCases.get(id) ?? 0) + 1);
  }
  const parBentos = new Map<number, number>();
  for (const row of bentos.data ?? []) {
    const id = row.edition_id as number | null;
    if (id !== null) parBentos.set(id, (parBentos.get(id) ?? 0) + 1);
  }

  return {
    ok: true,
    value: (editions.data ?? []).map((e) => ({
      id: e.id as number,
      slug: e.slug as string,
      title: e.title as string,
      releasedAt: (e.released_at as string | null) ?? null,
      status: editionStatus((e.released_at as string | null) ?? null),
      cases: parCases.get(e.id as number) ?? 0,
      composed: parBentos.get(e.id as number) ?? 0,
    })),
  };
}

export type EditionDetail = {
  edition: Omit<EditionRow, 'cases' | 'composed'>;
  cases: EditionCase[];
};

/** Une édition et ses cases, dans l'ordre de la boîte. */
export async function loadEdition(
  client: MobileClient,
  id: number,
): Promise<Result<EditionDetail>> {
  const [edition, cases] = await Promise.all([
    client.from('editions').select('id, slug, title, released_at').eq('id', id).maybeSingle(),
    client
      .from('bento_categories')
      .select('id, prompt, stamp, gender, display_order, type_id')
      .eq('edition_id', id)
      .order('display_order'),
  ]);

  if (edition.error) return { ok: false, error: edition.error.message };
  if (!edition.data) return { ok: false, error: 'Édition introuvable.' };
  if (cases.error) return { ok: false, error: cases.error.message };

  const releasedAt = (edition.data.released_at as string | null) ?? null;
  return {
    ok: true,
    value: {
      edition: {
        id: edition.data.id as number,
        slug: edition.data.slug as string,
        title: edition.data.title as string,
        releasedAt,
        status: editionStatus(releasedAt),
      },
      cases: (cases.data ?? []).map((c) => ({
        id: c.id as number,
        order: c.display_order as number,
        prompt: c.prompt as string,
        stamp: c.stamp as string,
        gender: (c.gender as 'm' | 'f') ?? 'm',
        typeId: c.type_id as number,
      })),
    },
  };
}

export async function createEdition(
  client: MobileClient,
  input: EditionInput,
): Promise<Result<number>> {
  const check = validateEdition(input);
  if (!check.ok) return check;

  const { data, error } = await client
    .from('editions')
    .insert({ title: input.title.trim(), slug: input.slug.trim(), released_at: input.releasedAt })
    .select('id')
    .single();

  if (error) return { ok: false, error: explainEditionError(error.message) };
  return { ok: true, value: data.id as number };
}

export async function updateEdition(
  client: MobileClient,
  id: number,
  input: EditionInput,
): Promise<Result> {
  const check = validateEdition(input);
  if (!check.ok) return check;

  const { error } = await client
    .from('editions')
    .update({ title: input.title.trim(), slug: input.slug.trim(), released_at: input.releasedAt })
    .eq('id', id);

  if (error) return { ok: false, error: explainEditionError(error.message) };
  return { ok: true };
}

/**
 * Remplace les cases d'une édition.
 *
 * On supprime puis on réinsère, plutôt que de rapprocher ligne à ligne : les
 * cases n'ont pas d'identité pour l'utilisateur, seul leur rang compte, et un
 * rapprochement introduirait des états intermédiaires où deux cases
 * partageraient un rang.
 *
 * ⚠️ Une case supprimée emporte les items déjà posés dessus, par
 * `bento_items.category_id` en cascade. C'est sans danger tant que l'édition
 * n'est pas sortie, et c'est pourquoi l'appelant refuse la modification d'une
 * édition sortie.
 */
export async function saveCases(
  client: MobileClient,
  editionId: number,
  cases: readonly EditionCase[],
): Promise<Result> {
  const check = validateCases(cases);
  if (!check.ok) return check;

  const suppression = await client.from('bento_categories').delete().eq('edition_id', editionId);
  if (suppression.error) return { ok: false, error: suppression.error.message };

  const lignes = [...cases]
    .sort((a, b) => a.order - b.order)
    .map((c) => ({
      key: caseKey(editionId, c.order),
      label_fr: c.prompt.trim(),
      prompt: c.prompt.trim(),
      stamp: c.stamp.trim().toUpperCase(),
      gender: c.gender,
      display_order: c.order,
      api_source: 'admin',
      type_id: c.typeId,
      edition_id: editionId,
      is_active: true,
    }));

  const { error } = await client.from('bento_categories').insert(lignes);
  if (error) return { ok: false, error: explainEditionError(error.message) };
  return { ok: true };
}

/** Supprime une édition et ses cases. Refusée si quelqu'un l'a composée. */
export async function deleteEdition(client: MobileClient, id: number): Promise<Result> {
  const { count, error: compte } = await client
    .from('bentos')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', id);
  if (compte) return { ok: false, error: compte.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} personne(s) ont composé cette édition : elle ne peut plus être supprimée.`,
    };
  }

  const cases = await client.from('bento_categories').delete().eq('edition_id', id);
  if (cases.error) return { ok: false, error: cases.error.message };

  const { error } = await client.from('editions').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
