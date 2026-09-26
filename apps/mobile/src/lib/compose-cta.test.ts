import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_ORDER } from '@bento-pop/supabase-mobile/bento';
import { MAIN_CASES } from '@bento-pop/supabase-mobile/bento';
import { composeCta, firstEmptyCase } from './compose-cta';

const ALL = [...CATEGORY_ORDER];
const CASES = MAIN_CASES;
const cta = (
  filled: readonly string[],
  over: {
    hasPending?: boolean;
    publishing?: boolean;
    published?: boolean;
    hasProfile?: boolean;
    awaitingValidation?: boolean;
  } = {},
) =>
  composeCta({ cases: CASES, filled, hasPending: false, publishing: false, published: false, ...over });

test('bento vide : oriente vers la première case, jamais inerte', () => {
  const r = cta([]);
  assert.equal(r.kind, 'open-slot');
  assert.equal(r.disabled, false);
  // « ton film », et pas « film » : c'était le libellé d'origine, perdu au
  // lot 4 du chantier 13 et retrouvé à la recette. Ce test l'avait suivi au
  // lieu de l'attraper ; il redit maintenant l'exigence.
  assert.equal(r.label, 'Commence par ton film');
  assert.equal(r.kind === 'open-slot' && r.caseKey, CATEGORY_ORDER[0]);
});

test('bento partiel : le bouton AGIT, c’est le bug du 13 septembre', () => {
  // Avant correction : libellé « Compléter (n) », bouton actif, et
  // `onPublish` sortait en silence. Rien ne se passait.
  for (let n = 1; n <= 5; n++) {
    const r = cta(ALL.slice(0, n));
    assert.equal(r.kind, 'open-slot', `${n} case(s) rempli(es)`);
    assert.equal(r.disabled, false, `${n} case(s) : le bouton doit rester actif`);
    assert.ok(r.kind === 'open-slot' && r.caseKey, `${n} case(s) : une cible est requise`);
  }
});

test('la case ouverte est la première vide dans l’ordre de la boîte', () => {
  // Trou au milieu : on ouvre le trou, pas la suite de la liste.
  const filled = [CATEGORY_ORDER[0]!, CATEGORY_ORDER[2]!, CATEGORY_ORDER[3]!];
  const r = cta(filled);
  assert.equal(r.kind === 'open-slot' && r.caseKey, CATEGORY_ORDER[1]);
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

test('chantier 18 : bento marqué, un item attend : « Publication à la validation », inactif', () => {
  const r = cta(ALL, { hasPending: true, awaitingValidation: true });
  assert.equal(r.kind, 'awaiting-validation');
  assert.equal(r.label, 'Publication à la validation');
  assert.equal(r.disabled, true);
});

test('chantier 18 : la marque pas encore confirmée garde « En attente de validation »', () => {
  // Hors ligne, la marque ne se pose pas : le bouton ne promet rien que la
  // base ne sache (promesse du chantier 5).
  const r = cta(ALL, { hasPending: true, awaitingValidation: false });
  assert.equal(r.kind, 'blocked');
  assert.equal(r.label, 'En attente de validation');
});

test('chantier 18 : sans profil, un item attend : « Publier dès la validation », actif (D3)', () => {
  const r = cta(ALL, { hasPending: true, hasProfile: false });
  assert.equal(r.kind, 'publish-on-validation');
  assert.equal(r.label, 'Publier dès la validation');
  assert.equal(r.disabled, false);
});

test('chantier 18 : sans profil et rien en attente, on publie comme avant', () => {
  assert.equal(cta(ALL, { hasProfile: false }).kind, 'publish');
});

test('chantier 18 : une marque sur un bento où plus rien n’attend ne retient pas (D2)', () => {
  // La base la lève ; tant que l'app ne l'a pas relue, on publie à la main.
  assert.equal(cta(ALL, { awaitingValidation: true }).kind, 'publish');
  assert.equal(cta(ALL.slice(0, 5), { hasPending: true, awaitingValidation: true }).kind, 'open-slot');
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
        for (const hasProfile of [false, true]) {
          for (const awaitingValidation of [false, true]) {
            const r = composeCta({
              cases: CASES,
              filled,
              hasPending,
              publishing: false,
              published,
              hasProfile,
              awaitingValidation,
            });
            if (!r.disabled) {
              assert.ok(
                r.kind === 'open-slot' ||
                  r.kind === 'publish' ||
                  r.kind === 'publish-on-validation' ||
                  r.kind === 'view-public',
                `état actif sans action : ${JSON.stringify(r)}`,
              );
            }
          }
        }
      }
    }
  }
});

test('firstEmptyCategory rend null sur un bento complet', () => {
  assert.equal(firstEmptyCase(CASES, ALL), null);
});
