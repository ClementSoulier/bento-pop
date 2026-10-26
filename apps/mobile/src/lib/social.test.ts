import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COMMENT_MAX_LENGTH,
  REPORT_REASONS,
  actionBarModel,
  canSendComment,
  cleanComment,
  commentGate,
  commentLength,
  commentRemaining,
  formatCount,
  reportReasonLabel,
  socialErrorKey,
  socialErrorMessage,
  toBentoSocial,
  withCommentDelta,
  withLikeToggled,
  type BentoSocial,
} from './social';

const social = (over: Partial<BentoSocial> = {}): BentoSocial => ({
  likes: 3,
  comments: 2,
  liked: false,
  acceptsLikes: true,
  acceptsComments: true,
  ...over,
});

describe("le texte d'un commentaire (D6)", () => {
  it('tient sur une ligne, sans blancs autour, comme post_comment le garde', () => {
    assert.equal(
      cleanComment('  Super bento,\n\ntrès bon choix !  '),
      'Super bento, très bon choix !',
    );
  });

  it("n'est rien quand il n'est fait que de blancs, sauts de ligne compris", () => {
    assert.equal(cleanComment(' \n\t '), '');
    assert.equal(canSendComment('\n\n'), false);
  });

  it('se compte par caractère, un émoji pour un, comme char_length', () => {
    assert.equal(commentLength('🍙🍙'), 2);
    assert.equal(commentLength('é'.repeat(279) + '🍙'), COMMENT_MAX_LENGTH);
    assert.equal(canSendComment('é'.repeat(279) + '🍙'), true);
    assert.equal(canSendComment('a'.repeat(281)), false);
  });

  it("dit ce qu'il reste, négatif au-delà", () => {
    assert.equal(commentRemaining('a'.repeat(250)), 30);
    assert.equal(commentRemaining('a'.repeat(290)), -10);
  });
});

describe('les nombres', () => {
  it('se lisent de la base', () => {
    assert.deepEqual(
      toBentoSocial({
        bento_id: 'b',
        likes: null,
        comments: 4,
        liked: false,
        accepts_likes: false,
        accepts_comments: true,
      }),
      { likes: null, comments: 4, liked: false, acceptsLikes: false, acceptsComments: true },
    );
  });

  it('suivent le cœur avant la réponse, et reviennent au second toucher', () => {
    const once = withLikeToggled(social());
    assert.deepEqual([once.liked, once.likes], [true, 4]);
    const twice = withLikeToggled(once);
    assert.deepEqual([twice.liked, twice.likes], [false, 3]);
  });

  it('ne touchent pas un cœur refusé', () => {
    const refused = social({ likes: null, acceptsLikes: false });
    assert.equal(withLikeToggled(refused), refused);
  });

  it('comptent les commentaires sans descendre sous zéro', () => {
    assert.equal(withCommentDelta(social(), 1).comments, 3);
    assert.equal(withCommentDelta(social({ comments: 0 }), -1).comments, 0);
    assert.equal(withCommentDelta(social({ comments: null }), 1).comments, null);
  });

  it("s'écrivent court", () => {
    assert.equal(formatCount(12), '12');
    assert.equal(formatCount(1250), '1 250');
    assert.equal(formatCount(12_400), '12 k');
  });
});

describe("la barre d'actions (§5.1)", () => {
  it('reste vide tant que les nombres ne sont pas là', () => {
    assert.deepEqual(actionBarModel(undefined, { isOwn: false }), { heart: null, bubble: null });
  });

  it("dit « J'aime » et « Commenter » plutôt qu'un zéro", () => {
    const bar = actionBarModel(social({ likes: 0, comments: 0 }), { isOwn: false });
    assert.equal(bar.heart?.text, "J'aime");
    assert.equal(bar.bubble?.text, 'Commenter');
    assert.equal(bar.bubble?.accessibilityLabel, 'Commenter');
  });

  it('montre les nombres, le cœur plein quand on aime', () => {
    const bar = actionBarModel(social({ liked: true }), { isOwn: false });
    assert.deepEqual([bar.heart?.text, bar.heart?.active, bar.heart?.pressable], ['3', true, true]);
    assert.equal(bar.heart?.accessibilityLabel, "J'aime, 3");
    assert.equal(bar.bubble?.accessibilityLabel, 'Commentaires, 2');
  });

  it('ne laisse pas toucher son propre cœur, mais montre le nombre', () => {
    const bar = actionBarModel(social(), { isOwn: true });
    assert.equal(bar.heart?.pressable, false);
    assert.equal(bar.heart?.accessibilityLabel, "3 j'aime");
    assert.equal(bar.bubble?.pressable, true);
  });

  it("compacte, n'écrit que le nombre, et rien à zéro", () => {
    const bar = actionBarModel(social({ likes: 0, comments: 5 }), { isOwn: false, compact: true });
    assert.equal(bar.heart?.text, '');
    assert.equal(bar.heart?.accessibilityLabel, "J'aime, 0");
    assert.equal(bar.bubble?.text, '5');
    assert.equal(
      actionBarModel(social({ likes: 0 }), { isOwn: true, compact: true }).heart?.text,
      '',
    );
  });

  it("n'a ni cœur ni bulle pour ce que le propriétaire refuse (D14)", () => {
    const bar = actionBarModel(
      social({ likes: null, acceptsLikes: false, comments: null, acceptsComments: false }),
      { isOwn: false },
    );
    assert.deepEqual(bar, { heart: null, bubble: null });
  });
});

describe('qui peut commenter (D3)', () => {
  it("demande d'abord de publier, puis de garder son compte", () => {
    assert.equal(commentGate({ hasPublished: false, kept: false }), 'publish');
    assert.equal(commentGate({ hasPublished: false, kept: true }), 'publish');
    assert.equal(commentGate({ hasPublished: true, kept: false }), 'keep');
    assert.equal(commentGate({ hasPublished: true, kept: true }), null);
  });
});

describe('les signalements (D10)', () => {
  it('offrent six motifs, « Autre » en dernier', () => {
    assert.equal(REPORT_REASONS.length, 6);
    assert.equal(REPORT_REASONS.at(-1)?.code, 'other');
    assert.equal(reportReasonLabel('harassment'), 'Harcèlement ou insultes');
    assert.equal(reportReasonLabel('inconnu'), null);
  });
});

describe('les erreurs', () => {
  it('se disent en phrase, depuis la clé de la base', () => {
    assert.equal(
      socialErrorMessage(new Error('comment_needs_kept_account')),
      'Garde ton compte pour commenter.',
    );
    assert.equal(
      socialErrorMessage(new Error('comment_refused_filter')),
      'Ce commentaire contient un mot ou un lien refusé.',
    );
  });

  it('reconnaissent le réseau', () => {
    assert.equal(socialErrorKey(new TypeError('Network request failed')), 'network');
    assert.equal(
      socialErrorMessage(new TypeError('Failed to fetch')),
      'Pas de réseau. Réessaie dans un instant.',
    );
  });

  it('ont une phrase pour tout le reste', () => {
    assert.equal(socialErrorMessage(new Error('boom')), 'Une erreur est survenue. Réessaie.');
    assert.equal(socialErrorMessage(null), 'Une erreur est survenue. Réessaie.');
  });
});
