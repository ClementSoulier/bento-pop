// Ré-export depuis le package partagé. Garde le path `@/supabase/types`
// stable pour ne pas casser les imports existants côté mobile, tout en
// centralisant la déclaration dans `@bento-pop/supabase-mobile` (consommé
// aussi par `apps/admin`).
export type {
  Database,
  CategoryKey,
  ExternalSource,
  ReportReason,
  ReportTargetKind,
  BentoCommentRow,
  BentoWhyRow,
  FollowExportRow,
  FollowListKind,
  FollowListRow,
  FollowStatus,
  FollowSummaryRow,
  NotificationKind,
  NotificationRow,
  SocialLinksRow,
  SocialNetwork,
} from '@bento-pop/supabase-mobile/types';
