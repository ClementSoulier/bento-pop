import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TABS, tabAccessibilityLabel, tabBarHeight, visibleTabs } from './tab-items';

/** La barre d'onglets du design (chantier 31, D1 et D2). */
describe('les onglets de la barre', () => {
  it('suivent l’ordre du design, Compose au centre', () => {
    assert.deepEqual(
      TABS.map((tab) => tab.label),
      ['La table', 'Trouver', 'Compose', 'Notifs', 'Profil'],
    );
    assert.deepEqual(visibleTabs(true), ['table', 'trouver', 'compose', 'notifs', 'profil']);
  });

  it('passent à quatre quand la zone de notifications est coupée, Compose troisième', () => {
    assert.deepEqual(visibleTabs(false), ['table', 'trouver', 'compose', 'profil']);
  });

  it('s’annoncent par leur place, à cinq comme à quatre', () => {
    assert.equal(tabAccessibilityLabel('table', 1, 5), 'La table, onglet 1 sur 5');
    assert.equal(tabAccessibilityLabel('compose', 3, 5), 'Compose, onglet 3 sur 5');
    assert.equal(tabAccessibilityLabel('profil', 5, 5), 'Profil, onglet 5 sur 5');
    assert.equal(tabAccessibilityLabel('profil', 4, 4), 'Profil, onglet 4 sur 4');
  });

  it('mesurent 56 points, plus le filet et la zone sûre du bas', () => {
    assert.equal(tabBarHeight(0), 57);
    assert.equal(tabBarHeight(34), 91);
    assert.equal(tabBarHeight(48), 105);
    assert.equal(tabBarHeight(Number.NaN), 57);
  });

  it('disent le nombre de nouveautés de Notifs', () => {
    assert.equal(tabAccessibilityLabel('notifs', 4, 5), 'Notifications, onglet 4 sur 5');
    assert.equal(
      tabAccessibilityLabel('notifs', 4, 5, 2),
      'Notifications, 2 nouvelles, onglet 4 sur 5',
    );
  });
});
