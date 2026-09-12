/**
 * L'entonnoir d'usage de l'app mobile, et le modèle de ligne de la liste.
 *
 * Fonctions pures, sans accès réseau : c'est ce qui permet de les tester, et
 * elles portent la seule logique de ce chantier qui puisse se tromper en
 * silence. Un compteur faux ne lève aucune erreur, il oriente juste mal les
 * décisions.
 */

export type UserKind = 'member' | 'editorial';

/** Ce que l'admin sait d'un compte d'authentification. */
export type AuthAccount = { id: string; createdAt: string };

/** Une ligne de `public.users`, telle que lue par le service-role. */
export type ProfileRow = {
  id: string;
  pseudo: string;
  display_name: string | null;
  kind: UserKind;
  created_at: string;
  last_seen_at: string | null;
  platform: 'ios' | 'android' | null;
  app_version: string | null;
};

/** Le bento d'une personne, s'il existe. */
export type BentoRow = {
  user_id: string;
  published_at: string | null;
  is_featured: boolean;
  slots: number;
};

export type UserListRow = {
  id: string;
  pseudo: string;
  displayName: string | null;
  kind: UserKind;
  createdAt: string;
  lastSeenAt: string | null;
  platform: 'ios' | 'android' | null;
  appVersion: string | null;
  /** `true` si un compte d'authentification existe pour cet identifiant. */
  hasAuthAccount: boolean;
  slots: number;
  publishedAt: string | null;
  isFeatured: boolean;
};

/**
 * Une installation qui n'a jamais choisi de pseudo.
 *
 * On n'en connaît que l'identifiant et la date. C'est peu, mais les compter
 * est tout l'intérêt : ils représentent un tiers des installations, et
 * personne ne les voyait.
 */
export type OrphanRow = { id: string; createdAt: string };

/**
 * Trois nombres, et surtout trois noms.
 *
 * « Nombre d'utilisateurs » ne veut rien dire ici : 106 personnes ont
 * installé l'app, 70 ont choisi un pseudo, 26 ont publié. Les confondre fait
 * prendre de mauvaises décisions, donc l'écran les nomme séparément.
 *
 * Les profils éditoriaux ne comptent dans aucun des trois : ils n'ont pas
 * installé l'app, et leur bento a été composé par l'équipe.
 */
export type Funnel = {
  installs: number;
  members: number;
  started: number;
  published: number;
  editorial: number;
  /** Installations sans profil. */
  orphans: number;
};

export function computeFunnel(
  accounts: AuthAccount[],
  profiles: ProfileRow[],
  bentos: BentoRow[],
): Funnel {
  const members = profiles.filter((p) => p.kind === 'member');
  const memberIds = new Set(members.map((m) => m.id));
  const profileIds = new Set(profiles.map((p) => p.id));

  // Un bento ne compte que s'il appartient à un membre : ceux des profils
  // éditoriaux sont du contenu, pas de l'usage.
  const memberBentos = bentos.filter((b) => memberIds.has(b.user_id));

  return {
    installs: accounts.length,
    members: members.length,
    started: memberBentos.length,
    published: memberBentos.filter((b) => b.published_at !== null).length,
    editorial: profiles.length - members.length,
    orphans: accounts.filter((a) => !profileIds.has(a.id)).length,
  };
}

/** Part d'une étape sur les installations, arrondie à l'entier. */
export function funnelShare(step: number, installs: number): number {
  if (installs <= 0) return 0;
  return Math.round((step / installs) * 100);
}

/**
 * Assemble les trois sources en lignes affichables.
 *
 * Trié par dernière visite décroissante, en repli sur la date d'inscription.
 * Le repli n'est pas cosmétique : tant que l'app instrumentée n'est pas
 * déployée, `last_seen_at` est nul pour tout le monde, et un tri sur une
 * colonne vide rendrait une liste dans un ordre arbitraire.
 */
export function buildUserRows(
  profiles: ProfileRow[],
  bentos: BentoRow[],
  authIds: ReadonlySet<string>,
): UserListRow[] {
  const bentoByUser = new Map(bentos.map((b) => [b.user_id, b]));

  return profiles
    .map((p) => {
      const bento = bentoByUser.get(p.id);
      return {
        id: p.id,
        pseudo: p.pseudo,
        displayName: p.display_name,
        kind: p.kind,
        createdAt: p.created_at,
        lastSeenAt: p.last_seen_at,
        platform: p.platform,
        appVersion: p.app_version,
        hasAuthAccount: authIds.has(p.id),
        slots: bento?.slots ?? 0,
        publishedAt: bento?.published_at ?? null,
        isFeatured: bento?.is_featured ?? false,
      };
    })
    .sort((a, b) => {
      const left = a.lastSeenAt ?? a.createdAt;
      const right = b.lastSeenAt ?? b.createdAt;
      return right.localeCompare(left);
    });
}

/** Les comptes d'authentification sans profil, du plus récent au plus ancien. */
export function buildOrphanRows(
  accounts: AuthAccount[],
  profiles: ProfileRow[],
): OrphanRow[] {
  const known = new Set(profiles.map((p) => p.id));
  return accounts
    .filter((a) => !known.has(a.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Filtre de recherche, sur le pseudo et le nom affiché.
 *
 * Insensible à la casse et aux accents : chercher « eleonore » doit trouver
 * « Éléonore ». `normalize('NFD')` sépare les accents de leur lettre, la
 * plage Unicode retirée étant celle des diacritiques combinants.
 */
export function filterUsers(rows: UserListRow[], query: string): UserListRow[] {
  const needle = fold(query);
  if (!needle) return rows;
  return rows.filter(
    (r) => fold(r.pseudo).includes(needle) || fold(r.displayName ?? '').includes(needle),
  );
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
