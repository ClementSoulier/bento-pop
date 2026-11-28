import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { askVisible, enqueueAsk, removeAsk, type QueuedAsk } from './ask-rules';

const ask = (id: number, key?: string): QueuedAsk => ({
  id,
  key,
  title: `Question ${id}`,
  primary: 'Oui',
});

/** La file des demandes (chantier 32, D10). */
describe('la file des demandes', () => {
  it('garde l’ordre d’arrivée, et n’en montre qu’une : la tête', () => {
    let queue: QueuedAsk[] = [];
    queue = enqueueAsk(queue, ask(1, 'keep'));
    queue = enqueueAsk(queue, ask(2, 'editorial'));
    queue = enqueueAsk(queue, ask(3));
    assert.deepEqual(
      queue.map((q) => q.id),
      [1, 2, 3],
    );
    // « Garde ton bento » d'abord ; l'accord des éditions quand on la quitte.
    queue = removeAsk(queue, 1);
    assert.equal(queue[0]?.id, 2);
    queue = removeAsk(queue, 2);
    queue = removeAsk(queue, 3);
    assert.deepEqual(queue, []);
  });

  it('ne pose pas deux fois la même demande en même temps', () => {
    // Le composer et le sélecteur d'éditions lèvent tous deux l'accord des éditions.
    let queue = enqueueAsk([], ask(1, 'editorial'));
    queue = enqueueAsk(queue, ask(2, 'editorial'));
    assert.deepEqual(
      queue.map((q) => q.id),
      [1],
    );
    // Une fois répondue, elle peut revenir.
    queue = enqueueAsk(removeAsk(queue, 1), ask(3, 'editorial'));
    assert.deepEqual(
      queue.map((q) => q.id),
      [3],
    );
    // Sans clé, rien ne se fusionne.
    queue = enqueueAsk(enqueueAsk([], ask(4)), ask(5));
    assert.equal(queue.length, 2);
  });

  it('ne touche pas la file qu’on lui donne', () => {
    const queue: QueuedAsk[] = [ask(1)];
    enqueueAsk(queue, ask(2));
    removeAsk(queue, 1);
    assert.equal(queue.length, 1);
  });

  it('attend que la recherche d’une case soit partie pour se montrer', () => {
    const queue = [ask(1)];
    assert.equal(askVisible(queue, 'search-modal'), false);
    assert.equal(askVisible(queue, '(tabs)'), true);
    assert.equal(askVisible(queue, 'u'), true);
    assert.equal(askVisible(queue, undefined), true);
    assert.equal(askVisible([], '(tabs)'), false);
  });
});
