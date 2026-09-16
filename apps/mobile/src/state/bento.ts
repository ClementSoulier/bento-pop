import { create } from 'zustand';
import type { OwnBento } from '@/lib/own-bento';
import type { TileData } from '@/components/bento/Tile';
import { MAIN_CASE_SET, type CaseSet } from '@/lib/case-set';

/**
 * État local du bento en cours de composition / édition.
 *
 * Le store fait autorité pour l'affichage. La base fait autorité pour la
 * vérité, et `hydrate` sert à réaligner l'un sur l'autre au démarrage et à
 * chaque retour sur le composer.
 *
 * ─── Le compteur d'écritures en vol ──────────────────────────────────
 *
 * Depuis que remplir une case ferme la modale **avant** que l'écriture ne
 * soit confirmée, les deux sources se marchent dessus :
 *
 *   1. tap sur une tuile : `setSlot` optimiste, la modale se ferme ;
 *   2. le composer reprend le focus et lance `refreshProfile`, qui relit le
 *      bento en base et appelle `hydrate` ;
 *   3. l'écriture n'est pas encore arrivée, donc la base ne connaît pas
 *      encore la nouvelle case ;
 *   4. `hydrate` remplace tout le store et la case disparaît de l'écran,
 *      alors même que l'écriture va aboutir.
 *
 * `hydrate` ignore donc les données distantes tant qu'une écriture locale
 * n'est pas confirmée. La règle vit ici et pas chez l'appelant : il y a un
 * seul `hydrate` à protéger, et n'importe quel appelant futur en hérite.
 *
 * Le compteur est incrémenté / décrémenté par paires, `endWrite` dans un
 * `finally`, pour qu'une écriture qui échoue ne bloque pas la
 * resynchronisation pour le reste de la session.
 */

/** Les cases remplies, indexées par clé de case. Cf. `bento-slots.ts`. */
type BentoSlots = Partial<Record<string, TileData & { itemId?: string }>>;

/**
 * Dernière case posée par une action de l'utilisateur.
 *
 * Sert à ne faire pulser *que* la tuile concernée sur le composer. Le
 * déclencheur vit ici et non dans l'écran parce que seul le store sait
 * distinguer un choix d'une resynchronisation : au démarrage à froid,
 * `hydrate` remplit les six cases d'un coup, et un écran qui comparerait
 * l'ancien et le nouvel état ferait pulser les six tuiles à l'ouverture.
 *
 * `seq` s'incrémente à chaque pose, y compris sur la même catégorie : sans
 * lui, remplacer deux fois de suite l'item d'une même case ne rejouerait
 * pas l'animation.
 */
/** La dernière case remplie, pour la faire pulser. Sa clé, pas sa catégorie :
 *  une édition n'a pas de catégories. */
type LastFilled = { caseKey: string; seq: number };

type BentoState = {
  /**
   * Le bento en cours d'édition, et tous ceux du compte.
   *
   * Chantier 16. Le store ne portait aucun identifiant : « le » bento se
   * redemandait à chaque écriture, ce qui n'a de sens que tant qu'un compte
   * n'en a qu'un. `current` est nul tant que la première lecture n'a pas
   * répondu, et `own` est vide dans le même intervalle.
   */
  current: OwnBento | null;
  own: OwnBento[];
  /**
   * Les cases du bento édité, dans l'ordre de la boîte.
   *
   * Chantier 13. Six pour le bento principal, de deux à six pour une
   * édition : leur nombre décide de la disposition, et leurs clés indexent
   * `slots`. Le jeu du bento principal est compilé dans l'app, celui d'une
   * édition vient de la base, cf. `case-set.ts`.
   */
  cases: readonly CaseSet[];
  slots: BentoSlots;
  lastFilled: LastFilled | null;
  /**
   * Date de publication du bento, ou `null` s'il n'est pas en ligne.
   *
   * L'app l'ignorait complètement : `loadOwnBento` la lisait et personne ne
   * la gardait. Résultat, le composer proposait « Publier mon bento » pour
   * l'éternité, y compris des mois après la publication, et `publishBento` a
   * dû être rendue idempotente pour survivre à ces taps répétés. La donnée
   * remonte maintenant jusqu'ici, et tout ce qui dépend de « est-ce public »
   * en découle.
   */
  publishedAt: string | null;
  /** Écritures parties et non encore confirmées, succès ou échec. */
  pendingWrites: number;
  /**
   * La première lecture du bento en base a-t-elle répondu ?
   *
   * Sans elle, le composer affiche « 0 / 6 » et « Commence par ton film » en
   * attendant, c'est-à-dire un bento vide à quelqu'un qui en a un. Mesuré au
   * chantier 11, relais retardé de 10 s par requête : huit secondes de bento
   * vide après le garde-fou de démarrage.
   */
  hydrated: boolean;
  setSlot: (caseKey: string, data: TileData & { itemId?: string }) => void;
  clearSlot: (caseKey: string) => void;
  reset: () => void;
  /**
   * Remplace l'intégralité des cases par l'état distant. Sans effet tant
   * qu'une écriture locale est en vol, cf. le bloc ci-dessus.
   */
  hydrate: (slots: BentoSlots) => void;
  /**
   * La lecture a répondu, mais il n'y avait rien à lire, ou elle a échoué.
   *
   * Sans elle, le composer restait sur son squelette et son bouton
   * « Chargement… » **pour toujours** : un compte sans bento, une ligne sans
   * cases, une panne réseau au démarrage. Relevé au chantier 11 sur l'émulateur
   * Pixel 8, dont le compte n'avait pas encore de bento. Elle ne touche pas aux
   * cases : une lecture qui échoue n'est pas une raison d'effacer ce que
   * l'appareil a déjà.
   */
  markHydrated: () => void;
  /**
   * Pose la liste des bentos du compte et celui qu'on édite.
   *
   * `currentId` absent : on garde le bento courant s'il est toujours dans la
   * liste, sinon on retombe sur le principal. C'est ce qui évite qu'un
   * rafraîchissement ramène l'utilisateur sur son principal alors qu'il
   * éditait autre chose.
   */
  setOwn: (own: OwnBento[], currentId?: string | null) => void;
  /**
   * Pose l'état de publication. Volontairement séparé d'`hydrate` : une
   * écriture de case en vol ne dit rien de l'état de publication, donc le
   * verrou `pendingWrites` n'a pas à s'y appliquer.
   */
  setPublishedAt: (publishedAt: string | null) => void;
  /**
   * Pose le jeu de cases, et **vide les cases remplies**.
   *
   * Les deux vont ensemble : `slots` est indexé par clé de case, donc garder
   * les anciennes en changeant de jeu laisserait des cases orphelines que la
   * grille n'afficherait pas et que la publication enverrait quand même.
   */
  setCases: (cases: readonly CaseSet[]) => void;
  /** À encadrer d'un `try` / `finally` autour de toute écriture optimiste. */
  beginWrite: () => void;
  endWrite: () => void;
  filledCount: () => number;
};

export const useBento = create<BentoState>((set, get) => ({
  current: null,
  own: [],
  cases: MAIN_CASE_SET,
  slots: {},
  lastFilled: null,
  publishedAt: null,
  pendingWrites: 0,
  hydrated: false,
  setSlot: (cat, data) =>
    set((s) => ({
      slots: { ...s.slots, [cat]: data },
      lastFilled: { caseKey: cat, seq: (s.lastFilled?.seq ?? 0) + 1 },
    })),
  clearSlot: (cat) =>
    set((s) => {
      const next = { ...s.slots };
      delete next[cat];
      return { slots: next };
    }),
  reset: () =>
    set({
      current: null,
      own: [],
      cases: MAIN_CASE_SET,
      slots: {},
      lastFilled: null,
      publishedAt: null,
      pendingWrites: 0,
      hydrated: false,
    }),
  hydrate: (slots) => {
    // `hydrated` est posé même quand l'écriture en vol fait ignorer les cases
    // distantes : la lecture a répondu, c'est tout ce que le composer demande.
    if (get().pendingWrites > 0) {
      set({ hydrated: true });
      return;
    }
    set({ slots, hydrated: true });
  },
  markHydrated: () => set({ hydrated: true }),
  setCases: (cases) => set({ cases, slots: {}, lastFilled: null, hydrated: false }),
  setOwn: (own, currentId) =>
    set((s) => {
      const voulu = currentId ?? s.current?.id ?? null;
      const current = own.find((b) => b.id === voulu) ?? own.find((b) => b.isPrimary) ?? own[0] ?? null;
      // `publishedAt` suit le bento courant : c'est lui que le composer
      // regarde pour choisir entre « Publier » et « Voir mon bento public ».
      return { own, current, publishedAt: current?.publishedAt ?? null };
    }),
  setPublishedAt: (publishedAt) => set({ publishedAt }),
  beginWrite: () => set((s) => ({ pendingWrites: s.pendingWrites + 1 })),
  // `Math.max` plutôt qu'une simple décrémentation : un `endWrite` en trop,
  // par exemple sur un chemin d'erreur remanié, rendrait le compteur négatif
  // et `hydrate` ne se rebloquerait plus jamais.
  endWrite: () => set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) })),
  filledCount: () => Object.keys(get().slots).length,
}));
