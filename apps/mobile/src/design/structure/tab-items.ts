import { notificationsTabLabel } from '@/lib/notifications';
import type { IconName } from '../icons';
import { border, size } from '../tokens';

export type TabKey = 'table' | 'trouver' | 'compose' | 'notifs' | 'profil';

/**
 * Les cinq onglets du design, dans leur ordre (chantier 31) : La table,
 * Trouver, Compose au centre, Notifs, Profil. Compose et Profil n'ont pas
 * d'icône : la pastille jaune pour l'un, l'avatar de la personne pour l'autre.
 */
export const TABS: readonly { key: TabKey; label: string; icon?: IconName }[] = [
  { key: 'table', label: 'La table', icon: 'bowl-steam' },
  { key: 'trouver', label: 'Trouver', icon: 'magnifying-glass' },
  { key: 'compose', label: 'Compose' },
  { key: 'notifs', label: 'Notifs', icon: 'bell' },
  { key: 'profil', label: 'Profil' },
];

/**
 * Les onglets que la barre montre : les cinq, ou quatre quand la zone de
 * notifications est coupée depuis le back-office, Compose devenant le
 * troisième (D2 du 31).
 */
export function visibleTabs(notificationsOn: boolean): TabKey[] {
  return TABS.map((tab) => tab.key).filter((key) => notificationsOn || key !== 'notifs');
}

/**
 * La hauteur de la barre : ses onglets (`size-tabbar`), son filet et la zone
 * sûre du bas, 57 points à l'iPhone SE, 91 aux iPhone à indicateur d'accueil.
 */
export function tabBarHeight(insetBottom: number): number {
  const inset = Number.isFinite(insetBottom) ? Math.max(0, insetBottom) : 0;
  return size.tabbar + border.hairline + inset;
}

/**
 * Ce que le lecteur d'écran entend d'un onglet : « La table, onglet 1 sur 5 » ;
 * Notifs avec le nombre de nouveautés, « Notifications, 2 nouvelles, onglet 4
 * sur 5 » (D20 du chantier 24).
 */
export function tabAccessibilityLabel(
  key: TabKey,
  position: number,
  total: number,
  notifications = 0,
): string {
  if (key === 'notifs') return notificationsTabLabel(notifications, position, total);
  const label = TABS.find((tab) => tab.key === key)?.label ?? key;
  return `${label}, onglet ${position} sur ${total}`;
}
