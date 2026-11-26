import type { ReactNode } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/SmartImage';
import { YouTubeEmbed } from '@/components/YouTubeEmbed';
import {
  headingAnchor,
  isHttpUrl,
  nodeText,
  positiveNumber,
  safeLink,
  youtubeIdFromUrl,
  type BlogDoc,
  type BlogMark,
  type BlogNode,
} from '@/lib/blog/document';

/**
 * Rendu d'un article (docs/BLOG.md D2) : chaque nœud connu devient un composant,
 * tout le reste est ignoré. Aucun HTML brut n'est injecté. Les images passent par
 * `SmartImage` (optimiseur de Next, egress Supabase).
 */
export function BlogContent({ doc }: { doc: BlogDoc }) {
  const anchors = new Set<string>();
  return (
    <div className="blog-article text-[18px] leading-[1.7] text-bento-ink/90">
      {(doc.content ?? []).map((node, i) => renderBlock(node, i, anchors))}
    </div>
  );
}

function renderBlock(node: BlogNode, key: number, anchors: Set<string>): ReactNode {
  switch (node.type) {
    case 'paragraph': {
      // Paragraphe vide : un retour à la ligne de trop dans l'éditeur, sans effet ici.
      if (!node.content || node.content.length === 0) return null;
      return (
        <p key={key} className="my-5 text-pretty">
          {renderInline(node.content)}
        </p>
      );
    }
    case 'heading': {
      const id = headingAnchor(nodeText(node), anchors);
      const children = renderInline(node.content ?? []);
      return node.attrs?.level === 3 ? (
        <h3 key={key} id={id} className="font-display-sm mt-10 mb-3 text-[22px] leading-tight text-bento-ink">
          {children}
        </h3>
      ) : (
        <h2 key={key} id={id} className="font-display mt-12 mb-4 text-[clamp(28px,3.5vw,38px)] leading-[1.05] text-bento-ink">
          {children}
        </h2>
      );
    }
    case 'bulletList':
      return (
        <ul key={key} className="my-5 list-disc space-y-2 pl-6 marker:text-bento-red">
          {(node.content ?? []).map((item, i) => renderListItem(item, i, anchors))}
        </ul>
      );
    case 'orderedList': {
      const start = positiveNumber(node.attrs?.start) ?? 1;
      return (
        <ol key={key} start={start} className="my-5 list-decimal space-y-2 pl-6 marker:font-bold marker:text-bento-red">
          {(node.content ?? []).map((item, i) => renderListItem(item, i, anchors))}
        </ol>
      );
    }
    case 'blockquote':
      return (
        <blockquote
          key={key}
          className="my-8 rounded-2xl border-[3px] border-bento-ink bg-bento-cream px-6 py-2 text-[20px] italic leading-[1.55] shadow-stamp [&_p]:my-3"
        >
          {(node.content ?? []).map((child, i) => renderBlock(child, i, anchors))}
        </blockquote>
      );
    case 'horizontalRule':
      return <hr key={key} className="my-10 border-0 border-t-[3px] border-dashed border-bento-ink/30" />;
    case 'image':
      return <ArticleImage key={key} attrs={node.attrs ?? {}} />;
    case 'youtube': {
      const youtubeId = youtubeIdFromUrl(node.attrs?.src);
      if (!youtubeId) return null;
      return (
        <div key={key} className="my-8">
          <YouTubeEmbed youtubeId={youtubeId} title="Vidéo YouTube" />
        </div>
      );
    }
    default:
      return null;
  }
}

function renderListItem(node: BlogNode, key: number, anchors: Set<string>): ReactNode {
  if (node.type !== 'listItem') return null;
  return (
    <li key={key} className="pl-1 [&>p]:my-0 [&>ol]:my-2 [&>ul]:my-2">
      {(node.content ?? []).map((child, i) => renderBlock(child, i, anchors))}
    </li>
  );
}

function renderInline(nodes: BlogNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === 'hardBreak') return <br key={i} />;
    if (node.type !== 'text' || typeof node.text !== 'string') return null;
    return applyMarks(node.text, node.marks ?? [], i);
  });
}

/** Le lien enveloppe le reste, pour qu'un mot gras cliquable reste un seul lien. */
function applyMarks(text: string, marks: BlogMark[], key: number): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        out = <strong className="font-bold text-bento-ink">{out}</strong>;
        break;
      case 'italic':
        out = <em>{out}</em>;
        break;
      case 'underline':
        out = <u>{out}</u>;
        break;
      case 'strike':
        out = <s>{out}</s>;
        break;
    }
  }
  const linkMark = marks.find((m) => m.type === 'link');
  const link = linkMark ? safeLink(linkMark.attrs?.href) : null;
  const linkClass =
    'font-semibold text-bento-ink underline decoration-bento-red decoration-[3px] underline-offset-[3px] hover:text-bento-red';
  if (link && !link.external && link.href.startsWith('/')) {
    return (
      <Link key={key} href={link.href} className={linkClass}>
        {out}
      </Link>
    );
  }
  if (link) {
    return (
      <a
        key={key}
        href={link.href}
        className={linkClass}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {out}
      </a>
    );
  }
  return <span key={key}>{out}</span>;
}

function ArticleImage({ attrs }: { attrs: Record<string, unknown> }) {
  const src = attrs.src;
  if (!isHttpUrl(src)) return null;
  const alt = typeof attrs.alt === 'string' ? attrs.alt : '';
  const caption = typeof attrs.title === 'string' ? attrs.title.trim() : '';
  const width = positiveNumber(attrs.width);
  const height = positiveNumber(attrs.height);
  // Ratio connu : l'espace est réservé avant le chargement (pas de saut de mise en page).
  const ratio = width && height ? width / height : 16 / 9;
  return (
    <figure className="my-8">
      <div
        className="relative w-full overflow-hidden rounded-2xl border-[3px] border-bento-ink bg-bento-cream shadow-stamp"
        style={{ aspectRatio: String(ratio) }}
      >
        <SmartImage
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className={width && height ? 'object-cover' : 'object-contain'}
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center font-mono text-[12px] uppercase tracking-[0.12em] text-bento-ink/60">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
