import { PageShell } from '@/components/AppShell/PageShell';
import { createMobileClient } from '@/lib/supabase/mobile';
import {
  buildOrphanRows,
  buildUserRows,
  computeFunnel,
  type AuthAccount,
  type BentoRow,
  type ProfileRow,
} from '@/lib/user-funnel';
import { purgeDeletionRegistry } from './actions';
import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

/**
 * Liste des comptes de l'app mobile, et l'entonnoir d'usage.
 *
 * Trois sources, assemblées côté serveur :
 *
 *   - `auth.users`, par l'API d'administration. Ce n'est pas une table
 *     exposée par PostgREST, il n'y a donc pas de jointure possible : c'est
 *     la seule façon de connaître le nombre d'installations, et les comptes
 *     qui n'ont jamais choisi de pseudo ;
 *   - `public.users`, les profils ;
 *   - `bentos` et le compte de leurs cases.
 *
 * Cf. `docs/UX-14-BACK-OFFICE-UTILISATEURS.md`.
 */
export default async function UtilisateursPage() {
  const mobile = createMobileClient();
  if (!mobile) {
    return (
      <PageShell crumbs="Mobile" title="Utilisateurs">
        <div className="admin-card p-6 text-[14px] text-admin-muted">
          Le projet Supabase <strong>mobile</strong> n&apos;est pas configuré. Renseigne{' '}
          <code className="font-mono">MOBILE_SUPABASE_URL</code> et{' '}
          <code className="font-mono">MOBILE_SUPABASE_SERVICE_ROLE_KEY</code> dans{' '}
          <code className="font-mono">apps/admin/.env</code>.
        </div>
      </PageShell>
    );
  }

  // La purge du registre à 12 mois se fait ici, faute d'ordonnanceur dans le
  // projet. Elle est lancée sans être attendue et n'est jamais remontée : une
  // purge ratée n'empêche personne de travailler et repassera au chargement
  // suivant. Cf. la décision D8 de la spec.
  void purgeDeletionRegistry();

  const [accounts, profiles, bentos] = await Promise.all([
    listAuthAccounts(mobile),
    loadProfiles(mobile),
    loadBentos(mobile),
  ]);

  const funnel = computeFunnel(accounts, profiles, bentos);
  const rows = buildUserRows(profiles, bentos, new Set(accounts.map((a) => a.id)));
  const orphans = buildOrphanRows(accounts, profiles);

  return (
    <PageShell
      crumbs={`Mobile · ${funnel.installs} installations · ${funnel.members} inscrits`}
      title="Utilisateurs"
    >
      <UsersClient funnel={funnel} rows={rows} orphans={orphans} />
    </PageShell>
  );
}

type Mobile = NonNullable<ReturnType<typeof createMobileClient>>;

/**
 * Parcourt `auth.users` par pages de 200.
 *
 * La pagination n'est pas du zèle : à 106 comptes un seul appel suffirait,
 * mais le compteur se figerait silencieusement à 200 le jour où la base
 * grossira, et un entonnoir faux est pire qu'un entonnoir absent.
 */
async function listAuthAccounts(mobile: Mobile): Promise<AuthAccount[]> {
  const all: AuthAccount[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await mobile.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Lecture des comptes échouée : ${error.message}`);
    const users = data?.users ?? [];
    all.push(...users.map((u) => ({ id: u.id, createdAt: u.created_at })));
    if (users.length < 200) return all;
  }
}

async function loadProfiles(mobile: Mobile): Promise<ProfileRow[]> {
  const { data, error } = await mobile
    .from('users')
    .select('id, pseudo, display_name, kind, created_at, last_seen_at, platform, app_version');
  if (error) throw new Error(`Lecture des profils échouée : ${error.message}`);
  return data ?? [];
}

/**
 * Les bentos, avec le nombre de cases remplies.
 *
 * `bento_items(count)` fait compter par PostgREST plutôt que de ramener les
 * lignes : à 282 cases la différence est modeste, elle ne le restera pas.
 */
async function loadBentos(mobile: Mobile): Promise<BentoRow[]> {
  const { data, error } = await mobile
    .from('bentos')
    .select('user_id, published_at, is_featured, bento_items(count)');
  if (error) throw new Error(`Lecture des bentos échouée : ${error.message}`);

  return (data ?? []).map((b) => {
    // PostgREST rend l'agrégat sous la forme `[{ count: n }]`.
    const items = b.bento_items as unknown as { count: number }[] | null;
    return {
      user_id: b.user_id,
      published_at: b.published_at,
      is_featured: b.is_featured,
      slots: items?.[0]?.count ?? 0,
    };
  });
}
