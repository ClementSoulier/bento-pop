import { clsx } from '@/lib/clsx';
import { formatNumber } from '@/lib/format';
import { formatAgo, formatParis, recentError, tickState, type TickState } from '@/lib/push/health';
import { type PushHealthView, readPushHealth } from '@/lib/push/store';
import { createMobileClient } from '@/lib/supabase/mobile';

/**
 * Le contrôle de santé des notifications push (D19 du chantier 17).
 *
 * Le back-office se redéploie à la main : une chaîne qui cesse de tourner ne
 * se verrait pas. Cette carte dit, à chaque connexion, si le battement passe
 * toutes les 5 minutes, quand un envoi a réussi pour la dernière fois, et la
 * dernière erreur de la semaine.
 */

const STATE: Record<TickState, { label: string; badge: string }> = {
  ok: { label: 'En marche', badge: 'admin-badge-success' },
  late: { label: 'En panne', badge: 'admin-badge-live' },
  never: { label: 'Pas encore branchée', badge: 'admin-badge-muted' },
};

const KIND_LABEL = {
  item_moderated: 'item modéré',
  edition_released: 'édition annoncée',
} as const;

export async function PushHealthCard() {
  const db = createMobileClient();
  if (!db) {
    return (
      <Frame>
        <p className="px-1 py-3 text-[12px] text-admin-muted">Supabase mobile non configuré.</p>
      </Frame>
    );
  }

  const now = new Date();
  let view: PushHealthView;
  try {
    view = await readPushHealth(db, now);
  } catch (error) {
    return (
      <Frame>
        <p className="px-1 py-3 text-[12px] text-bento-red">
          Lecture impossible : {error instanceof Error ? error.message : String(error)}
        </p>
      </Frame>
    );
  }

  const state = tickState(view.lastTickAt, now);
  const error = recentError(view.lastErrorAt, view.lastError, now);
  // « InvalidCredentials : la clé APNs… » : le code en valeur, le reste dessous.
  const [errorCode, ...errorRest] = error?.message.split(' : ') ?? [];
  const errorDetail = errorRest.join(' : ');

  return (
    <Frame state={state}>
      <dl className="grid grid-cols-4 gap-4 py-3">
        <Fact label="Battement">
          <Value tone={state === 'late' ? 'alert' : undefined}>
            {view.lastTickAt ? formatAgo(view.lastTickAt, now) : 'jamais'}
          </Value>
          <Hint>{view.lastTickAt ? formatParis(view.lastTickAt) : 'attendu toutes les 5 minutes'}</Hint>
        </Fact>

        <Fact label="Dernier envoi réussi">
          <Value>{view.lastSentAt ? formatAgo(view.lastSentAt, now) : 'aucun'}</Value>
          <Hint>
            {view.lastSentAt && view.lastSentKind
              ? `${KIND_LABEL[view.lastSentKind]}, ${formatParis(view.lastSentAt)}`
              : 'rien n’est encore parti'}
          </Hint>
        </Fact>

        <Fact label="Dernière erreur">
          <Value tone={error ? 'alert' : undefined}>{errorCode ?? 'aucune'}</Value>
          <Hint title={error?.message}>
            {error ? [formatParis(error.at), errorDetail].filter(Boolean).join(' · ') : 'rien sur 7 jours'}
          </Hint>
        </Fact>

        <Fact label="Appareils">
          <Value>{count(view.activeDevices, 'actif', 'actifs')}</Value>
          <Hint>
            {count(view.editorialDevices, 'accepte les éditions', 'acceptent les éditions')} ·{' '}
            {count(view.revokedDevices, 'perdu', 'perdus')}
          </Hint>
        </Fact>
      </dl>

      {state !== 'ok' ? (
        <p className="border-t border-admin-border px-1 py-3 text-[12px] text-admin-muted">
          {state === 'never'
            ? 'Aucun battement reçu : la chaîne n’est pas encore branchée. Il faut les secrets de coffre push_webhook_url et push_webhook_token, et la variable PUSH_WEBHOOK_TOKEN du back-office.'
            : 'Le battement doit passer toutes les 5 minutes. Vérifier que le back-office répond, et que sa variable PUSH_WEBHOOK_TOKEN est celle du coffre.'}
        </p>
      ) : null}
    </Frame>
  );
}

/** « 0 actif », « 1 actif », « 2 actifs » : le pluriel français commence à 2. */
function count(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n >= 2 ? many : one}`;
}

function Frame({ state, children }: { state?: TickState; children: React.ReactNode }) {
  return (
    <section className="admin-card overflow-hidden">
      <header className="flex items-center justify-between border-b border-admin-border px-4 py-3.5">
        <h3 className="text-[14px] font-semibold">Notifications push</h3>
        {state ? (
          <span className={clsx('admin-badge', STATE[state].badge)}>{STATE[state].label}</span>
        ) : null}
      </header>
      <div className="px-4">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">{children}</dd>
    </div>
  );
}

function Value({ tone, children }: { tone?: 'alert'; children: React.ReactNode }) {
  return (
    <span className={clsx('truncate text-[15px] font-semibold', tone === 'alert' && 'text-bento-red')}>
      {children}
    </span>
  );
}

function Hint({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <span className="truncate text-[11px] text-admin-muted" title={title}>
      {children}
    </span>
  );
}
