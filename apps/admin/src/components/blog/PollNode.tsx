'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { pollPercentages } from '@/lib/blog/poll';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poll: {
      /** Insère les résultats figés d'un sondage (attributs de `pollNodeAttrs`). */
      insertPoll: (attrs: Record<string, unknown>) => ReturnType;
    };
  }
}

function jsonAttr<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Bloc « Sondage » (docs/BLOG.md D17) : un nœud atomique, tout dans ses attributs.
 * On ne l'édite pas dans l'article ; on le déplace, on le supprime ou on en insère
 * un autre. Même schéma que `checkPollAttrs` (admin) et `PollResults` (landing).
 */
export const PollNode = Node.create({
  name: 'poll',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      weekId: { default: null },
      weekTag: { default: null },
      question: { default: '' },
      options: {
        default: [],
        parseHTML: (el) => jsonAttr(el.getAttribute('data-options'), []),
        renderHTML: (attrs) => ({ 'data-options': JSON.stringify(attrs.options ?? []) }),
      },
      total: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-total')) || 0,
        renderHTML: (attrs) => ({ 'data-total': String(attrs.total ?? 0) }),
      },
      closedAt: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-poll]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-poll': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PollNodeView);
  },

  addCommands() {
    return {
      insertPoll:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function PollNodeView({ node, selected }: NodeViewProps) {
  const options = (node.attrs.options ?? []) as Array<{ label: string; votes: number }>;
  const total = Number(node.attrs.total) || 0;
  const pcts = pollPercentages(options.map((o) => o.votes));
  const closedAt = typeof node.attrs.closedAt === 'string' ? new Date(node.attrs.closedAt) : null;
  return (
    <NodeViewWrapper
      data-drag-handle
      className={`my-4 rounded-xl border-2 bg-admin-surface-2 p-4 ${selected ? 'border-bento-yellow' : 'border-admin-border'}`}
    >
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
        Sondage du Thermomètre · résultats figés
        {closedAt && !Number.isNaN(closedAt.getTime()) ? ` au ${DATE.format(closedAt)}` : ''}
      </div>
      <div className="mb-3 text-[15px] font-semibold">{String(node.attrs.question ?? '')}</div>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={i} className="relative overflow-hidden rounded-md border border-admin-border bg-white px-3 py-1.5 text-[13px]">
            <span aria-hidden className="absolute inset-y-0 left-0 bg-bento-yellow/60" style={{ width: `${pcts[i] ?? 0}%` }} />
            <span className="relative flex justify-between gap-3">
              <span>{o.label}</span>
              <span className="font-mono">
                {pcts[i] ?? 0} % · {o.votes}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 font-mono text-[11px] text-admin-muted">
        {total} vote{total > 1 ? 's' : ''}
      </div>
    </NodeViewWrapper>
  );
}
