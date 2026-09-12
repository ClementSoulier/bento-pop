import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { itemImageUrl } from './item-image';

const TMDB = 'https://image.tmdb.org/t/p/w500/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg';
const SUPABASE =
  'https://ggjgktbcqumfxrixcdyx.supabase.co/storage/v1/object/public/item-images/abc/main.jpg?v=1';

describe('itemImageUrl, cas TMDb', () => {
  it('descend une tuile de 116 pt en w342 malgré les 6 px qui manquent', () => {
    // 116 × 3 = 348 px, donc w342 rate de six pixels. La tolérance de 10 %
    // le laisse passer : 104 Ko deviennent 52 Ko contre un agrandissement de
    // 1,7 %. C'est exactement le cas de l'iPhone 17, donc celui qui compte.
    assert.equal(
      itemImageUrl(TMDB, 116, 3),
      'https://image.tmdb.org/t/p/w342/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg',
    );
  });

  it('ne descend pas au-delà de la tolérance', () => {
    // 130 × 3 = 390 px. Même avec 10 % de marge il faut 351 px, donc w342
    // ne suffit plus et l'URL reste en w500.
    assert.equal(itemImageUrl(TMDB, 130, 3), TMDB);
  });

  it('descend une tuile de 107 pt en w342 sur un écran ×3', () => {
    // 107 × 3 = 321 px, donc w342 couvre.
    assert.equal(
      itemImageUrl(TMDB, 107, 3),
      'https://image.tmdb.org/t/p/w342/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg',
    );
  });

  it('descend plus bas encore sur un écran ×2', () => {
    // iPhone SE : 107 × 2 = 214 px → w342 est le premier palier qui couvre.
    assert.equal(
      itemImageUrl(TMDB, 107, 2),
      'https://image.tmdb.org/t/p/w342/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg',
    );
    // Une vignette minuscule tombe bien plus bas.
    assert.equal(
      itemImageUrl(TMDB, 40, 2),
      'https://image.tmdb.org/t/p/w92/aej3LRUga5rhgkmRP6XMFw3ejbl.jpg',
    );
  });

  /**
   * Le garde-fou qui compte : cette fonction ne doit jamais rendre une image
   * plus floue que ce que le catalogue propose, ni demander une largeur plus
   * grande que celle stockée (TMDb la servirait, mais on paierait un
   * agrandissement pour rien).
   */
  it('ne remonte jamais une taille', () => {
    const small = 'https://image.tmdb.org/t/p/w92/a.jpg';
    assert.equal(itemImageUrl(small, 400, 3), small);
    assert.equal(itemImageUrl(TMDB, 400, 3), TMDB, 'w500 demandé pour 1200 px reste w500');
    assert.equal(itemImageUrl(TMDB, 200, 3), TMDB, 'w780 n\'est jamais inventé au-dessus de w500');
  });

  it('choisit toujours un palier réellement servi par TMDb', () => {
    const servis = new Set([92, 154, 185, 342, 500, 780]);
    for (let width = 10; width <= 400; width += 7) {
      for (const ratio of [1, 2, 3]) {
        const out = itemImageUrl(TMDB, width, ratio);
        const w = /\/t\/p\/w(\d+)\//.exec(out)?.[1];
        assert.ok(w && servis.has(Number(w)), `largeur inventée : ${out}`);
      }
    }
  });

  it('est monotone : une tuile plus large ne donne pas une image plus petite', () => {
    let previous = 0;
    for (let width = 10; width <= 300; width += 3) {
      const w = Number(/\/t\/p\/w(\d+)\//.exec(itemImageUrl(TMDB, width, 3))?.[1]);
      assert.ok(w >= previous, `régression à ${width} pt : ${w} après ${previous}`);
      previous = w;
    }
  });
});

describe('itemImageUrl, tout le reste', () => {
  /**
   * Les 117 images du stockage Supabase sont servies en pleine résolution,
   * la transformation d'image étant indisponible sur le plan gratuit. Y
   * ajouter un `?width=` produirait une 403 et une tuile vide.
   */
  it('laisse les URL Supabase intactes', () => {
    assert.equal(itemImageUrl(SUPABASE, 116, 3), SUPABASE);
  });

  it('laisse les URL Wikimedia intactes', () => {
    const wiki = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg';
    assert.equal(itemImageUrl(wiki, 116, 3), wiki);
  });

  /**
   * L'expression est ancrée sur l'hôte TMDb. Une URL d'un autre domaine qui
   * contiendrait le même chemin ne doit pas être réécrite : on renverrait
   * l'utilisateur sur une ressource qui n'existe pas.
   */
  it('ne réécrit pas une URL qui imite le chemin TMDb ailleurs', () => {
    const leurre = 'https://exemple.test/t/p/w500/a.jpg';
    assert.equal(itemImageUrl(leurre, 116, 3), leurre);
    const sousDomaine = 'https://image.tmdb.org.exemple.test/t/p/w500/a.jpg';
    assert.equal(itemImageUrl(sousDomaine, 116, 3), sousDomaine);
  });

  it('laisse passer les entrées dégénérées sans jeter', () => {
    for (const url of ['', 'pas une url', 'https://image.tmdb.org/t/p/original/a.jpg']) {
      assert.equal(itemImageUrl(url, 116, 3), url);
    }
  });
});
