import { clsx } from '@/lib/clsx';

export type StatusKind = 'live' | 'soon' | 'done' | 'draft' | 'archived';

const LABELS: Record<StatusKind, string> = {
  live: 'En direct',
  soon: 'À venir',
  done: 'Terminé',
  draft: 'Brouillon',
  archived: 'Archivé',
};

const STYLES: Record<StatusKind, string> = {
  live: 'admin-badge-live',
  soon: 'admin-badge-info',
  done: 'admin-badge-muted',
  draft: 'admin-badge-warn',
  archived: 'admin-badge-muted',
};

export function StatusBadge({ status, label }: { status: StatusKind; label?: string }) {
  return <span className={clsx('admin-badge', STYLES[status])}>{label ?? LABELS[status]}</span>;
}
