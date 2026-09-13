import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import type { CategoryKey } from '@/supabase/types';
import { composeCta, firstEmptyCategory } from './compose-cta';

const ALL = [...CATEGORY_ORDER];
const cta = (
  filled: CategoryKey[],
  over: { hasPending?: boolean; publishing?: boolean; published?: boolean } = {},
) => composeCta({ filled, hasPending: false, publishing: false, published: false, ...over });

test('bento vide : oriente vers la première case, jamais inerte', () => {
  const r = cta([]);
  assert.equal(r.kind, 'open-slot');
  assert.equal(r.disabled, false);
  assert.equal(r.label, 'Commence par ton film');
  assert.equal(r.kind === 'open-slot' && r.category, CATEGORY_ORDER[0]);
});

test('bento partiel : le bouton AGIT, c’est le bug du 13 septembre', () => {
  // Avant correction : libellé « Compléter (n) », bouton actif, et
  // `onPublish` sortait en silence. Rien ne se passait.
  for (let n = 1; n <= 5; n++) {
    const r = cta(ALL.slice(0, n));
    assert.equal(r.kind, 'open-slot', `${n} case(s) rempli(es)`);
    assert.equal(r.disabled, false, `${n} case(s) : le bouton doit rester actif`);
    assert.ok(r.kind === 'open-slot' && r.category, `${n} case(s) : une cible est requise`);
  }
});

test('la case ouverte est la première vide dans l’ordre de la boîte', () => {
  // Trou au milieu : on ouvre le trou, pas la suite de la liste.
  const filled = [CATEGORY_ORDER[0]!, CATEGORY_ORDER[2]!, CATEGORY_ORDER[3]!];
  const r = cta(filled);
  assert.equal(r.kind === 'open-slot' && r.category, CATEGORY_ORDER[1]);
});

test('le décompte restant est juste, et s’accorde', () => {
  assert.equal(cta(ALL.slice(0, 1)).label, 'Compléter (5 restants)');
  assert.equal(cta(ALL.slice(0, 5)).label, 'Compléter (1 restant)');
});

test('bento complet et propre : publie', () => {
  const r = cta(ALL);
  assert.equal(r.kind, 'publish');
  assert.equal(r.disabled, false);
});

test('bento complet avec une case en modération : inactif et dit pourquoi', () => {
  const r = cta(ALL, { hasPending: true });
  assert.equal(r.kind, 'blocked');
  assert.equal(r.disabled, true);
});

test('une case en modération sur un bento partiel ne bloque pas la saisie', () => {
  // Le blocage porte sur la publication, pas sur le fait de continuer.
  const r = cta(ALL.slice(0, 3), { hasPending: true });
  assert.equal(r.kind, 'open-slot');
  assert.equal(r.disabled, false);
});

test('publication en cours : inactif, quel que soit le reste', () => {
  assert.equal(cta(ALL, { publishing: true }).kind, 'busy');
  assert.equal(cta([], { publishing: true }).kind, 'busy');
});

test('bento déjà en ligne : mène à la page publique, ne republie pas', () => {
  const r = cta(ALL, { published: true });
  assert.equal(r.kind, 'view-public');
  assert.equal(r.disabled, false);
});

test('déjà en ligne, une case passée en modération : reste en ligne', () => {
  // Publier est irréversible côté fil tant qu'on ne dépublie pas. Afficher
  // « en attente de validation » laisserait croire à un retrait.
  const r = cta(ALL, { published: true, hasPending: true });
  assert.equal(r.kind, 'view-public');
});

test('déjà en ligne mais une case vidée : on répare avant tout', () => {
  const r = cta(ALL.slice(0, 5), { published: true });
  assert.equal(r.kind, 'open-slot');
});

test('aucun état ne rend un bouton actif sans action', () => {
  // L'invariant qui manquait. Un bouton actif DOIT mener quelque part.
  const cases = [[], ALL.slice(0, 3), ALL];
  for (const filled of cases) {
    for (const hasPending of [false, true]) {
      for (const published of [false, true]) {
        const r = composeCta({ filled, hasPending, publishing: false, published });
        if (!r.disabled) {
          assert.ok(
            r.kind === 'open-slot' || r.kind === 'publish' || r.kind === 'view-public',
            `état actif sans action : ${JSON.stringify(r)}`,
          );
        }
      }
    }
  }
});

test('firstEmptyCategory rend null sur un bento complet', () => {
  assert.equal(firstEmptyCategory(ALL), null);
});
