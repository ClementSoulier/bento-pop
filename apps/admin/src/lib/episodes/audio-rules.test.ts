import assert from 'node:assert/strict';
import { test } from 'node:test';

import { problemeAudio } from './audio-rules';

/* Un épisode annoncé dans le flux RSS part chez tous les abonnés à la fois : ces règles
   arrêtent une saisie incomplète dans le formulaire, avant la base et avant le flux. */

test('sans date de sortie audio, rien n’est exigé', () => {
  // Le fichier arrive souvent avant qu'on sache quand publier.
  assert.equal(problemeAudio({}), null);
  assert.equal(problemeAudio({ audio_url: 'https://exemple.test/a.mp3', audio_bytes: 10 }), null);
});

test('une date sans fichier est refusée', () => {
  const p = problemeAudio({ audio_published_at: '2026-09-29T18:00' });
  assert.equal(p?.champ, 'audio_url');
});

test('une date sans taille est refusée', () => {
  const p = problemeAudio({
    audio_published_at: '2026-09-29T18:00',
    audio_url: 'https://exemple.test/a.mp3',
    audio_bytes: 0,
  });
  assert.equal(p?.champ, 'audio_bytes');
});

test('une taille négative est refusée comme une taille nulle', () => {
  const p = problemeAudio({
    audio_published_at: '2026-09-29T18:00',
    audio_url: 'https://exemple.test/a.mp3',
    audio_bytes: -1,
  });
  assert.equal(p?.champ, 'audio_bytes');
});

test('un épisode complet passe', () => {
  const p = problemeAudio({
    audio_published_at: '2026-09-29T18:00',
    audio_url: 'https://exemple.test/a.mp3',
    audio_bytes: 39_074_588,
  });
  assert.equal(p, null);
});

test('le fichier est signalé avant la taille : on corrige dans l’ordre de saisie', () => {
  const p = problemeAudio({ audio_published_at: '2026-09-29T18:00', audio_bytes: 0 });
  assert.equal(p?.champ, 'audio_url');
});
