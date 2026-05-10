/**
 * Schémas JSON-LD pour Bento Pop.
 *
 * Objectifs :
 *   - SEO classique (Google rich results / sitelinks / knowledge graph).
 *   - GEO — Generative Engine Optimization : les LLMs (ChatGPT, Perplexity,
 *     Gemini, Claude…) lisent ces blocs pour répondre à des requêtes type
 *     « c'est quoi Bento Pop », « qui anime Bento Pop »…
 *
 * Toutes les fonctions retournent un objet `@context: schema.org` sérialisable
 * dans un `<script type="application/ld+json">`.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bento-pop.com';
const YOUTUBE_CHANNEL = 'https://www.youtube.com/@BentoPop.Officiel';
const SPOTIFY_SHOW = 'https://open.spotify.com/show/0HmT9Na37Ujd3pvTl4to89';
const INSTAGRAM = 'https://www.instagram.com/bento.pop.officiel/';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Bento Pop',
    alternateName: ['Bento Pop · Le Talk-Show Pop Culture', 'BentoPop'],
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/icon/512`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}/opengraph-image`,
    description:
      "Bento Pop est un média pop culture français : un talk-show YouTube hebdomadaire et un podcast, animés par Dark Hifus. Émissions en live depuis les plus grandes conventions.",
    foundingDate: '2024',
    inLanguage: 'fr-FR',
    sameAs: [YOUTUBE_CHANNEL, SPOTIFY_SHOW, INSTAGRAM],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'business',
      email: 'contact@bento-pop.com',
      availableLanguage: ['French', 'fr'],
    },
    parentOrganization: {
      '@type': 'Organization',
      name: 'Liventure SAS',
    },
  } as const;
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Bento Pop',
    alternateName: 'Bento Pop · Le Talk-Show Pop Culture',
    url: SITE_URL,
    inLanguage: 'fr-FR',
    description:
      'Site officiel de Bento Pop, talk-show pop culture français : cinéma, gaming, mangas, débats société. YouTube + podcast.',
    publisher: { '@id': `${SITE_URL}/#organization` },
    copyrightHolder: { '@id': `${SITE_URL}/#organization` },
    copyrightYear: 2026,
  } as const;
}

export function tvSeriesSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${SITE_URL}/#talkshow`,
    name: 'Bento Pop',
    alternateName: 'Bento Pop · Le Talk-Show Pop Culture',
    description:
      "Talk-show pop culture français animé par Dark Hifus avec Thodalf, Elda et Rob. Cinéma, gaming, mangas et débats de société, en live depuis les plus grandes conventions (Japan Expo, Paris Manga, Comic Con…). Nouvel épisode tous les jeudis à 18h sur YouTube.",
    url: SITE_URL,
    inLanguage: 'fr-FR',
    countryOfOrigin: { '@type': 'Country', name: 'France' },
    genre: [
      'Talk-show',
      'Pop culture',
      'Cinéma',
      'Gaming',
      'Manga',
      'Anime',
      'Société',
    ],
    keywords:
      'talk-show pop culture, émission pop culture, émission YouTube, talk show YouTube, podcast pop culture, cinéma, gaming, mangas, conventions',
    actor: [
      { '@type': 'Person', name: 'Dark Hifus', jobTitle: 'Animateur principal' },
      { '@type': 'Person', name: 'Thodalf', alternateName: 'Keremasan', jobTitle: 'Chroniqueur' },
      { '@type': 'Person', name: 'Elda', jobTitle: 'Chroniqueuse' },
      { '@type': 'Person', name: 'Rob', jobTitle: 'Direction artistique & réalisation' },
    ],
    creator: { '@id': `${SITE_URL}/#organization` },
    productionCompany: { '@type': 'Organization', name: 'Liventure SAS' },
    publication: {
      '@type': 'PublicationEvent',
      publishedOn: {
        '@type': 'BroadcastService',
        name: 'YouTube',
        broadcastDisplayName: 'Bento Pop sur YouTube',
        url: YOUTUBE_CHANNEL,
      },
    },
    sameAs: [YOUTUBE_CHANNEL, SPOTIFY_SHOW],
  } as const;
}

export function podcastSeriesSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    '@id': `${SITE_URL}/#podcast`,
    name: 'Bento Pop · Les Débriefs',
    alternateName: 'Bento Pop Podcast',
    description:
      "Le podcast officiel de Bento Pop. Débriefs pop culture sans filtre : cinéma, gaming, mangas et débats société. Disponible sur Spotify, Apple Podcasts, Deezer et YouTube.",
    url: SPOTIFY_SHOW,
    inLanguage: 'fr-FR',
    webFeed: SPOTIFY_SHOW,
    author: { '@id': `${SITE_URL}/#organization` },
    publisher: { '@id': `${SITE_URL}/#organization` },
    sameAs: [SPOTIFY_SHOW, YOUTUBE_CHANNEL],
  } as const;
}

export function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: "Qu'est-ce que Bento Pop ?",
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "Bento Pop est un talk-show pop culture français diffusé sur YouTube et en podcast. Animé par Dark Hifus, il parle cinéma, gaming, mangas et débats de société, en live depuis les plus grandes conventions de France (Japan Expo, Paris Manga, Comic Con…).",
        },
      },
      {
        '@type': 'Question',
        name: 'Qui anime Bento Pop ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "L'émission est animée par Dark Hifus (le capitaine du plateau), accompagné de Thodalf (alias Keremasan, chroniqueur gaming et cinéma), Elda (chroniqueuse manga, webtoon et K-culture) et Rob (direction artistique et réalisation).",
        },
      },
      {
        '@type': 'Question',
        name: 'Où regarder Bento Pop ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "Bento Pop est diffusé sur YouTube (chaîne @BentoPop.Officiel) tous les jeudis à 18h. Le podcast audio est disponible sur Spotify, Apple Podcasts, Deezer et YouTube.",
        },
      },
      {
        '@type': 'Question',
        name: 'Quand sortent les nouveaux épisodes ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "Un nouvel épisode de Bento Pop sort chaque jeudi à 18h sur YouTube. Des lives spéciaux sont également organisés depuis les conventions partout en France.",
        },
      },
      {
        '@type': 'Question',
        name: 'De quoi parle Bento Pop ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "Bento Pop couvre quatre univers : cinéma (blockbusters, films d'auteur, sorties), gaming (AAA, indé, rétro), Japon et Corée (mangas, animes, webtoons, K-culture) et société (réseaux sociaux, santé mentale, débats).",
        },
      },
      {
        '@type': 'Question',
        name: 'Où retrouver Bento Pop en convention ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text:
            "Bento Pop est régulièrement présent en plateau aux grandes conventions françaises : Japan Expo (Paris Nord Villepinte), Paris Manga (Porte de Versailles), Comic Con (Paris Expo), Mang'Azur, TGS Toulouse et d'autres étapes en France.",
        },
      },
    ],
  } as const;
}
