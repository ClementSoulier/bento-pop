import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeApp } from './telemetry';

describe('describeApp', () => {
  it('reconnaît les deux plateformes du parc', () => {
    assert.deepEqual(describeApp('ios', '1.2.3'), { platform: 'ios', appVersion: '1.2.3' });
    assert.deepEqual(describeApp('android', '1.2.3'), { platform: 'android', appVersion: '1.2.3' });
  });

  /**
   * `users.platform` est contraint à `ios | android` en base. Envoyer « web »
   * ferait échouer l'écriture au lieu de simplement ne rien dire, et le web
   * ne sert qu'au développement : il n'a rien à faire dans les statistiques
   * du parc.
   */
  it('rend null sur une plateforme hors contrainte SQL', () => {
    for (const os of ['web', 'windows', 'macos', '']) {
      assert.equal(describeApp(os, '1.0.0').platform, null, os);
    }
  });

  it('ramène une version absente ou vide à null', () => {
    for (const v of [null, undefined, '', '   ']) {
      assert.equal(describeApp('ios', v).appVersion, null, JSON.stringify(v));
    }
  });

  it('nettoie les espaces autour de la version', () => {
    assert.equal(describeApp('ios', ' 0.1.0 ').appVersion, '0.1.0');
  });
});
