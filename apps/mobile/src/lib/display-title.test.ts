import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extendaTextWidth } from '@/components/bento/extenda-metrics';
import { EXTENDA_ACCENT_ROOM_EM, displayTitleScale, extendaAccentRoom } from './display-title';

/** Ligne d'un titre d'accueil sur iPhone 17 Pro : 402 pt moins deux marges de 24. */
const LINE_17_PRO = 354;

describe('displayTitleScale', () => {
  it('ne touche pas un titre dont chaque mot tient', () => {
    // Le splash d'un 17 Pro, à la taille par défaut : « POP / CULTURE. » passe à
    // la ligne entre ses mots, et aucun ne dépasse.
    assert.equal(displayTitleScale('Compose\nton bento\npop culture.', LINE_17_PRO, 56, -1), 1);
    assert.equal(displayTitleScale('Les règles\ndu jeu.', 362, 30, -0.3), 1);
  });

  it('fait tenir le mot le plus large, et lui seul décide', () => {
    // Au plafond de 1,2 sur un écran de 360 dp, « CULTURE. » ne tient plus.
    const fontSize = 56 * 1.2;
    const room = 360 - 48;
    const scale = displayTitleScale('Compose\nton bento\npop culture.', room, fontSize, -1);
    assert.ok(scale < 1, `${scale}`);
    const widest = Math.max(
      ...['COMPOSE', 'TON', 'BENTO', 'POP', 'CULTURE.'].map((w) =>
        extendaTextWidth(w, fontSize * scale, -1),
      ),
    );
    assert.ok(widest <= room, `${widest.toFixed(1)} pour ${room}`);
    // Pas plus que nécessaire : au centième près, le mot le plus large remplit la ligne.
    assert.ok(widest > room - 1, `${widest.toFixed(1)} pour ${room}`);
  });

  it('prend sur Android la taille arrondie au pixel supérieur', () => {
    const room = 300;
    const fontSize = 80;
    const android = displayTitleScale('CULTURE.', room, fontSize, -1, 2.625);
    const rendered = Math.ceil(fontSize * android * 2.625) / 2.625;
    assert.ok(extendaTextWidth('CULTURE.', rendered, -1) <= room);
  });

  it('lit des mesures absurdes comme « ne rien toucher »', () => {
    assert.equal(displayTitleScale('Crédits', 0, 36, 1), 1);
    assert.equal(displayTitleScale('Crédits', 300, 0, 1), 1);
    assert.equal(displayTitleScale('', 300, 36, 1), 1);
  });
});

describe('extendaAccentRoom', () => {
  it('réserve la place d’un accent de la première ligne', () => {
    assert.equal(extendaAccentRoom('Les règles\ndu jeu.', 30), Math.ceil(30 * EXTENDA_ACCENT_ROOM_EM));
    assert.equal(extendaAccentRoom('Une boîte.\nSix envies.', 28), Math.ceil(28 * EXTENDA_ACCENT_ROOM_EM));
    assert.equal(extendaAccentRoom('Crédits', 36), Math.ceil(36 * EXTENDA_ACCENT_ROOM_EM));
  });

  it('ne réserve rien sans accent en première ligne, pour ne rien déplacer', () => {
    assert.equal(extendaAccentRoom('Mon bento', 28), 0);
    assert.equal(extendaAccentRoom('Compose\nton bento\npop culture.', 56), 0);
    // L'accent de la seconde ligne tient dans la boîte de la première.
    assert.equal(extendaAccentRoom('Tout le monde\nà table.', 28), 0);
  });

  it('ignore la cédille, dessinée sous la lettre', () => {
    assert.equal(extendaAccentRoom('Ça coince', 22), 0);
  });

  it('reconnaît un accent écrit en caractère décomposé', () => {
    assert.equal(extendaAccentRoom('Re\u0300gles', 30), Math.ceil(30 * EXTENDA_ACCENT_ROOM_EM));
  });

  /**
   * Émulateur Pixel 8, 26 septembre 2026 : 7 dp de réserve tombent sur
   * 18,375 pixels, et le titre remontait d'un pixel. Arrondie au pixel
   * supérieur, elle ne déplace plus rien.
   */
  it('s’arrondit au pixel supérieur quand on lui donne la densité d’Android', () => {
    const titres = [
      ['Édition de recette', 28],
      ['Été 85', 24.1],
      ['Élite', 11],
    ] as const;
    for (const pixelRatio of [2, 2.625, 3, 3.5]) {
      for (const [titre, taille] of titres) {
        const reserve = extendaAccentRoom(titre, taille, pixelRatio);
        const pixels = reserve * pixelRatio;
        assert.ok(Math.abs(pixels - Math.round(pixels)) < 1e-9, `${titre} : ${pixels} px`);
        assert.ok(reserve >= taille * EXTENDA_ACCENT_ROOM_EM, `${titre} : ${reserve}`);
        assert.ok(
          reserve < taille * EXTENDA_ACCENT_ROOM_EM + 1 / pixelRatio,
          `${titre} : ${reserve}`,
        );
      }
    }
    assert.equal(extendaAccentRoom('Édition de recette', 28, 2.625), 19 / 2.625);
    assert.equal(extendaAccentRoom('Mon bento', 28, 2.625), 0);
  });
});
