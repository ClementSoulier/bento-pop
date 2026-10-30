import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { ICONS_TS, iconsSource, readDesignIcons } from '../../scripts/design-icons';
import { icons, type IconName } from './icons';

/**
 * `icons.ts` est écrit par `scripts/design-icons.ts` depuis les SVG du dossier
 * de la refonte, qui font foi (chantier 30, D3). Un nom d'icône inconnu, lui,
 * est arrêté au typage : `Icon` n'accepte qu'un `IconName`.
 */
describe('icônes du design system v2', () => {
  it('sont celles que le dossier de la refonte donne, au caractère près', () => {
    assert.equal(readFileSync(ICONS_TS, 'utf8'), iconsSource(readDesignIcons()));
  });

  it('sont les 72 du dossier, chacune en bold et en fill', () => {
    assert.equal(Object.keys(icons).length, 72);
    for (const [name, paths] of Object.entries(icons)) {
      assert.deepEqual(Object.keys(paths), ['bold', 'fill'], name);
      assert.match(paths.bold, /^M[\d.,\-\sA-Za-z]+$/, name);
      assert.match(paths.fill, /^M[\d.,\-\sA-Za-z]+$/, name);
      assert.notEqual(paths.bold, paths.fill, name);
    }
  });

  it('comptent les actions et les onglets que le design nomme', () => {
    const named: IconName[] = [
      // Actions de référence.
      'caret-left',
      'x',
      'dots-three',
      'gear-six',
      'pencil-simple-line',
      'squares-four',
      'share-fat',
      'heart',
      'chat-circle',
      'flag',
      'prohibit',
      'hourglass-medium',
      'arrow-up-right',
      'wifi-slash',
      // Onglets.
      'bowl-steam',
      'magnifying-glass',
      'plus',
      'bell',
    ];
    for (const name of named) assert.ok(icons[name], name);
  });
});
