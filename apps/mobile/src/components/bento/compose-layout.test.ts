import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CTA_BLOCK_H,
  CTA_GAP,
  CTA_GAP_MIN,
  HEADER_H,
  MAX_SCALE,
  MIN_SCALE,
  NATIVE_GRID_H,
  PSEUDO_LINE_H,
  STAMP_LABEL_LINE_H,
  STATUS_LINE_H,
  composeAvailableHeight,
  composeBentoScale,
  composeCtaBlockHeight,
  composeCtaGap,
  composeHeaderHeight,
  COMPOSE_TITLE_LETTER_SPACING,
  COMPOSE_TITLE_MIN_FONT_SIZE,
  composeSelectorHeight,
  composeTitleScale,
  selectorRevealOffset,
  type ComposeMetrics,
} from './compose-layout';
import { extendaTextWidth } from './extenda-metrics';
import { TITLE_ROUNDING_SLACK } from './tile-title';
import { CONTROL_MAX_FONT_MULTIPLIER, TITLE_MAX_FONT_MULTIPLIER } from './font-scaling';

/**
 * Appareils réels. La barre d'onglets inclut l'indicateur d'accueil, et mesure
 * 84 pt partout où sa hauteur est fixée, SE compris : relevé dans l'arbre
 * d'accessibilité au chantier 11, là où ce test supposait 49.
 */
const SE: ComposeMetrics = { screenHeight: 667, insetTop: 20, tabBarHeight: 84, fontScale: 1 };
const IPHONE_17: ComposeMetrics = { screenHeight: 874, insetTop: 59, tabBarHeight: 84, fontScale: 1 };
const PRO_MAX: ComposeMetrics = { screenHeight: 956, insetTop: 62, tabBarHeight: 84, fontScale: 1 };

/** Tailles de police système relevées : iOS xLarge, xxLarge, xxxLarge, AX5 ; Android 1,3 et 2,0. */
const FONT_SCALES = [0.823, 1, 1.118, 1.235, 1.3, 1.353, 2, 3.571];

describe('composeBentoScale', () => {
  it('reste dans ses bornes sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const scale = composeBentoScale(m);
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `${name} : ${scale}`);
    }
  });

  it('reste dans ses bornes même sur des métriques absurdes', () => {
    for (const h of [0, 100, 300, 2000]) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84, fontScale: 1 });
      assert.ok(scale >= MIN_SCALE && scale <= MAX_SCALE, `hauteur ${h} : ${scale}`);
      assert.ok(Number.isFinite(scale));
    }
  });

  it('est monotone : plus d\'écran, une grille au moins aussi grande', () => {
    let previous = 0;
    for (let h = 500; h <= 1200; h += 11) {
      const scale = composeBentoScale({ screenHeight: h, insetTop: 59, tabBarHeight: 84, fontScale: 1 });
      assert.ok(scale >= previous, `régression à ${h}`);
      previous = scale;
    }
  });
});

describe('écart entre la boîte et le bouton', () => {
  /**
   * Le défaut corrigé : `paddingBottom: tabBarHeight + 12` comptait la barre
   * d'onglets une seconde fois, alors que la zone de contenu l'exclut déjà.
   * Mesuré au pixel sur iPhone 17, bento plein : 0 pt entre la boîte et le
   * bouton, 93 pt de jaune mort sous le bouton.
   *
   * Ce test est la garantie qu'on ne peut plus retomber à zéro, sur aucun
   * appareil et quelle que soit la hauteur de barre d'onglets : l'écart visé
   * partout où la grille n'est pas à son plancher, l'écart minimal ailleurs.
   */
  it('ne descend jamais sous l’écart minimal, et vise CTA_GAP hors plancher', () => {
    for (let h = 560; h <= 1100; h += 7) {
      for (const inset of [20, 44, 47, 59, 62]) {
        for (const tab of [49, 56, 78, 84, 90]) {
          const m = { screenHeight: h, insetTop: inset, tabBarHeight: tab, fontScale: 1 };
          const gap = composeCtaGap(m);
          assert.ok(gap >= CTA_GAP_MIN, `${gap.toFixed(1)} pt à ${h}/${inset}/${tab}`);
          if (composeBentoScale(m) > MIN_SCALE) {
            assert.ok(gap >= CTA_GAP - 1e-9, `${gap.toFixed(1)} pt à ${h}/${inset}/${tab}`);
          }
        }
      }
    }
  });

  it('laisse respirer sur les appareils réels', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const gap = composeCtaGap(m);
      assert.ok(gap >= CTA_GAP_MIN, `${name} : ${gap.toFixed(1)} pt`);
      // Un écart démesuré voudrait dire que la grille est trop rabougrie.
      assert.ok(gap < 200, `${name} : ${gap.toFixed(1)} pt, la boîte est trop petite`);
    }
  });

  /**
   * Le modèle doit coller au rendu, pas l'approcher de loin. La première
   * version se trompait de 38 pt parce que `CTA_BLOCK_H` valait 100 au lieu
   * des 66 mesurés : le calcul annonçait 28 pt là où l'écran en affichait
   * 66. Un modèle faux qui donne un résultat acceptable reste un modèle
   * faux, et il aurait menti au premier changement de gabarit.
   */
  it('vaut exactement CTA_GAP tant que la grille n\'est ni plafonnée ni au plancher', () => {
    for (const [name, m] of Object.entries({ IPHONE_17 })) {
      assert.ok(composeBentoScale(m) < MAX_SCALE, `${name} : grille déjà plafonnée`);
      assert.ok(composeBentoScale(m) > MIN_SCALE, `${name} : grille au plancher`);
      assert.ok(
        Math.abs(composeCtaGap(m) - CTA_GAP) < 0.001,
        `${name} : ${composeCtaGap(m).toFixed(1)} pt au lieu de ${CTA_GAP}`,
      );
    }
  });

  it('dépasse CTA_GAP quand la grille plafonne', () => {
    assert.equal(composeBentoScale(PRO_MAX), MAX_SCALE);
    assert.ok(composeCtaGap(PRO_MAX) > CTA_GAP);
  });

  /**
   * Sur iPhone SE la grille est à son plancher dès la taille par défaut, donc le
   * ressort se réduit à rien et c'est la marge du bouton qui tient l'écart :
   * l'écart minimal, et non l'écart visé, qui poussait le bouton sous la barre
   * d'onglets dès la taille xLarge (chantier 11).
   */
  it('tient l\'écart minimal sur le plus petit écran', () => {
    assert.ok(composeAvailableHeight(SE) < NATIVE_GRID_H, 'la grille devrait être réduite sur SE');
    assert.equal(composeBentoScale(SE), MIN_SCALE);
    const gap = composeCtaGap(SE);
    assert.ok(gap >= CTA_GAP_MIN && gap < CTA_GAP, `${gap.toFixed(1)} pt`);
  });
});

describe('police système', () => {
  it('pose des lignes égales à celles qu’iOS rend sans elles', () => {
    // Arbre d'accessibilité de l'iPhone 17 Pro : 13,33, 14,67 et un bouton de 54.
    assert.equal(PSEUDO_LINE_H.toFixed(2), '13.33');
    assert.equal(STATUS_LINE_H.toFixed(2), '14.67');
    assert.equal(STAMP_LABEL_LINE_H, 20);
  });

  /**
   * La taille par défaut est celle que tout le monde voit : le budget y reste
   * exactement celui d'avant le chantier 11, donc la boîte ne bouge d'aucun
   * point sur aucun téléphone.
   */
  it('laisse le budget inchangé à la taille par défaut', () => {
    assert.equal(composeHeaderHeight(1), HEADER_H);
    assert.equal(composeCtaBlockHeight(1), CTA_BLOCK_H);
    // 874 − 62 − 46 − 88 − 84 − 66 − 56 = 472, sur 512.
    assert.equal(
      composeBentoScale({ screenHeight: 874, insetTop: 62, tabBarHeight: 84, fontScale: 1 }),
      472 / 512,
    );
  });

  it('fait grossir en-tête et bouton avec la police, jusqu’à leurs plafonds', () => {
    let previousHeader = 0;
    let previousCta = 0;
    for (const fontScale of FONT_SCALES) {
      const header = composeHeaderHeight(fontScale);
      const cta = composeCtaBlockHeight(fontScale);
      assert.ok(header >= previousHeader, `en-tête à ${fontScale}`);
      assert.ok(cta >= previousCta, `bouton à ${fontScale}`);
      previousHeader = header;
      previousCta = cta;
    }
    const capped = Math.max(CONTROL_MAX_FONT_MULTIPLIER, TITLE_MAX_FONT_MULTIPLIER);
    assert.equal(composeHeaderHeight(3.571), composeHeaderHeight(capped));
    assert.equal(composeCtaBlockHeight(3.571), composeCtaBlockHeight(capped));
    assert.equal(composeCtaBlockHeight(3.571), CTA_BLOCK_H + STAMP_LABEL_LINE_H * 0.2);
  });

  it('fait rétrécir la grille quand la police grossit, jamais sous le plancher', () => {
    for (const device of [SE, IPHONE_17, PRO_MAX]) {
      let previous = Number.POSITIVE_INFINITY;
      for (const fontScale of FONT_SCALES) {
        const scale = composeBentoScale({ ...device, fontScale });
        assert.ok(scale <= previous + 1e-9, `${device.screenHeight} pt à ${fontScale}`);
        assert.ok(scale >= MIN_SCALE);
        previous = scale;
      }
    }
  });

  /**
   * Là où le plancher mord, ce qui ne tient plus se rattrape en faisant défiler
   * l'écran : le bouton garde son écart, il ne passe plus sous la barre.
   */
  it('garde l’écart du bouton à toute police, quitte à défiler', () => {
    for (const device of [SE, IPHONE_17, PRO_MAX]) {
      for (const fontScale of FONT_SCALES) {
        assert.ok(composeCtaGap({ ...device, fontScale }) >= CTA_GAP_MIN);
      }
    }
  });
});

/**
 * Chantier 16. La bande de sélection du bento ne coûte rien tant qu'un compte
 * n'en a qu'un : le composer de tous les comptes existants doit rester
 * identique au pixel.
 */
describe('composeSelectorHeight, la bande de sélection', () => {
  it('ne prend aucune place tant qu’un compte n’a qu’un bento', () => {
    for (const fontScale of [0.823, 1, 1.235, 1.786, 3.571]) {
      assert.equal(composeSelectorHeight(fontScale), 0, `${fontScale}`);
      assert.equal(composeSelectorHeight(fontScale, 1), 0, `${fontScale}`);
      assert.equal(composeSelectorHeight(fontScale, 0), 0, `${fontScale}`);
    }
  });

  it('ne change pas la géométrie de la grille sans deuxième bento', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      assert.equal(composeBentoScale({ ...m, bentoCount: 1 }), composeBentoScale(m), name);
      assert.equal(composeCtaGap({ ...m, bentoCount: 1 }), composeCtaGap(m), name);
    }
  });

  it('prend la même place pour deux bentos que pour dix', () => {
    // Une bande, quel qu’en soit le nombre : elle défile horizontalement.
    assert.equal(composeSelectorHeight(1, 2), composeSelectorHeight(1, 10));
    assert.ok(composeSelectorHeight(1, 2) > 0);
  });

  it('retire à la grille exactement ce qu’elle prend', () => {
    for (const [name, m] of Object.entries({ SE, IPHONE_17, PRO_MAX })) {
      const avec = { ...m, bentoCount: 3 };
      assert.equal(
        composeAvailableHeight(m) - composeAvailableHeight(avec),
        composeSelectorHeight(m.fontScale, 3),
        name,
      );
      // Et le bouton ne se fait pas recouvrir : l'écart reste au moins son
      // minimum, ce qui est toute la raison de compter la bande ici.
      assert.ok(composeCtaGap(avec) >= CTA_GAP_MIN, name);
    }
  });
});

describe('selectorRevealOffset, la pastille active à l’écran', () => {
  // Géométrie relevée sur iPhone 17 Pro à la recette du 16 septembre : la
  // bande fait 402 points, « Mon bento » 105 et le bento « rec-deux » 95, avec
  // 20 de marge et 8 d’écart. L’édition tapée était au bout, bande défilée de
  // 374 points.
  const VIEWPORT = 402;

  it('ramène au début le bento qu’on vient de créer, derrière « Mon bento »', () => {
    // Le défaut de la recette : la pastille active à x = 133 et la bande à
    // 374, donc hors de l’écran. Revenir à zéro la montre, « Mon bento » avec.
    assert.equal(selectorRevealOffset({ x: 133, width: 95, offset: 374, viewport: VIEWPORT }), 0);
  });

  it('ne bouge pas une pastille déjà visible en entier', () => {
    assert.equal(selectorRevealOffset({ x: 133, width: 95, offset: 0, viewport: VIEWPORT }), null);
    assert.equal(selectorRevealOffset({ x: 586, width: 170, offset: 374, viewport: VIEWPORT }), null);
  });

  it('cale sur la marge de droite une pastille coupée à droite', () => {
    // 586 + 170 + 20 = 776, moins 402.
    assert.equal(selectorRevealOffset({ x: 586, width: 170, offset: 0, viewport: VIEWPORT }), 374);
  });

  it('cale sur la marge de gauche une pastille coupée à gauche, hors du premier écran', () => {
    assert.equal(selectorRevealOffset({ x: 586, width: 170, offset: 700, viewport: VIEWPORT }), 566);
  });

  it('ne défile jamais au-delà du contenu', () => {
    // La dernière pastille finit à la largeur du contenu, marge comprise :
    // l’offset rendu est exactement le défilement maximal.
    const contenu = 586 + 170 + 20;
    assert.equal(
      selectorRevealOffset({ x: 586, width: 170, offset: 0, viewport: VIEWPORT }),
      contenu - VIEWPORT,
    );
    // Et jamais en deçà de zéro.
    assert.equal(selectorRevealOffset({ x: 10, width: 95, offset: 50, viewport: VIEWPORT }), 0);
  });

  it('attend que la bande soit mesurée', () => {
    assert.equal(selectorRevealOffset({ x: 586, width: 170, offset: 0, viewport: 0 }), null);
  });
});

describe('composeTitleScale, le titre du composer sur une ligne', () => {
  // Largeurs d'écran relevées : iPhone 17 Pro 402, iPhone SE 375.
  it('laisse « Mon bento » et les titres courts à leur taille', () => {
    for (const nom of ['Mon bento', 'Le duel du samedi', 'Le grand inventaire']) {
      assert.equal(composeTitleScale(nom, 402, 28), 1, nom);
      assert.equal(composeTitleScale(nom, 375, 28), 1, nom);
    }
  });

  /**
   * Recette du 16 septembre : « LA SEMAINE DU FILM Q… ». Le titre rétrécit
   * désormais juste assez pour remplir sa ligne, 362 points sur iPhone 17 Pro.
   */
  it('rétrécit un titre d’édition long juste assez pour tenir entier', () => {
    const nom = 'La semaine du film qui pique';
    const scale = composeTitleScale(nom, 402, 28);
    assert.ok(scale < 1 && 28 * scale > COMPOSE_TITLE_MIN_FONT_SIZE, String(scale));
    const width = extendaTextWidth(nom.toUpperCase(), 28 * scale, COMPOSE_TITLE_LETTER_SPACING);
    assert.ok(Math.abs(width - (362 - TITLE_ROUNDING_SLACK)) < 1e-9, String(width));
  });

  it('affiche entier un titre réaliste de 30 caractères sur iPhone SE', () => {
    // 30 caractères, la borne de la base et du back-office. Le plus exigeant
    // des titres essayés demande 17,6 points sur un écran de 375.
    for (const nom of [
      'Le mois des mangas incontourna',
      'La rentrée des blockbusters 26',
      'Les films qui ont marqué 2026!',
    ]) {
      assert.equal(nom.length, 30, nom);
      const taille = 28 * composeTitleScale(nom, 375, 28);
      const largeur = extendaTextWidth(nom.toUpperCase(), taille, COMPOSE_TITLE_LETTER_SPACING);
      assert.ok(largeur <= 335 - TITLE_ROUNDING_SLACK + 1e-9, `${nom} : ${largeur} à ${taille} pt`);
    }
  });

  it('s’arrête au plancher, sous lequel le titre se tronque', () => {
    // Trente M demandent 12,1 points : un titre que personne n'écrira, mais
    // la borne tient.
    assert.equal(
      28 * composeTitleScale('MMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', 375, 28),
      COMPOSE_TITLE_MIN_FONT_SIZE,
    );
  });

  /**
   * Recette du 16 septembre, à la plus grande police : le titre, agrandi à
   * 33,6 points, se tronquait de nouveau, « LA SEMAINE DU FILM QUI… », alors
   * qu'il tient entier à la taille normale. Le plancher est en points.
   */
  it('laisse un titre agrandi redescendre vers sa taille normale plutôt que de se tronquer', () => {
    const nom = 'La semaine du film qui pique';
    const agrandi = 28 * 1.2;
    const taille = agrandi * composeTitleScale(nom, 402, agrandi);
    assert.ok(taille >= COMPOSE_TITLE_MIN_FONT_SIZE, String(taille));
    const width = extendaTextWidth(nom.toUpperCase(), taille, COMPOSE_TITLE_LETTER_SPACING);
    assert.ok(width <= 362 - TITLE_ROUNDING_SLACK + 1e-9, `${width} pour 362`);
  });
});
