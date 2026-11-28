import { clsx } from '@/lib/clsx';
import { ISSUE_STATUS_LABELS, type IssueStatus } from '@/lib/newsletter/issue';

const STYLES: Record<IssueStatus, string> = {
  draft: 'admin-badge-warn',
  sending: 'admin-badge-info',
  scheduled: 'admin-badge-info',
  sent: 'admin-badge-success',
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return <span className={clsx('admin-badge', STYLES[status])}>{ISSUE_STATUS_LABELS[status]}</span>;
}
