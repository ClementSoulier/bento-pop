'use client';

import { useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extensions';
import { ImageInsertDialog } from '@/components/blog/ImageInsertDialog';
import { PollInsertDialog } from '@/components/blog/PollInsertDialog';
import { PollNode } from '@/components/blog/PollNode';
import { isSafeHref, youtubeIdFromUrl, type BlogDoc } from '@/lib/blog/document';
import { pollNodeAttrs, type PollSnapshot } from '@/lib/blog/poll';
import { clsx } from '@/lib/clsx';

type Props = {
  initialContent: BlogDoc;
  onChange: (doc: BlogDoc) => void;
  /** Sondages du Thermomètre proposés par le bouton « Sondage ». */
  polls?: PollSnapshot[];
};

/**
 * Éditeur visuel des articles (docs/BLOG.md D1 à D3). Les extensions chargées ici sont
 * exactement celles que `validateBlogDoc` accepte et que la landing sait rendre :
 * en ajouter une demande de toucher aux trois.
 */
export function RichTextEditor({ initialContent, onChange, polls = [] }: Props) {
  const [imageOpen, setImageOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);

  const editor = useEditor({
    // Rendu côté client uniquement : évite un écart d'hydratation avec Next.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          /* Sans autolien, un lien ne s'étend plus au texte tapé juste après lui (Tiptap
             rend la marque « inclusive » quand l'autolien est actif). Coller une adresse
             sur une sélection crée toujours le lien. */
          autolink: false,
          defaultProtocol: 'https',
          isAllowedUri: (url) => isSafeHref(url),
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ nocookie: true, modestBranding: true, width: 640, height: 360 }),
      PollNode,
      Placeholder.configure({
        placeholder: 'Écris ton article ici. Les intertitres, images et vidéos sont dans la barre ci-dessus.',
      }),
    ],
    // Un document sans bloc laisse ProseMirror sans paragraphe où écrire : on lui laisse
    // créer le sien.
    content: initialContent.content && initialContent.content.length > 0 ? initialContent : '',
    editorProps: {
      attributes: {
        class: 'blog-prose min-h-[420px] px-6 py-5 focus:outline-none',
        'aria-label': 'Contenu de l’article',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as BlogDoc),
  });

  return (
    <div className="admin-card overflow-hidden">
      {editor ? (
        <Toolbar editor={editor} onImage={() => setImageOpen(true)} onPoll={() => setPollOpen(true)} />
      ) : null}
      <EditorContent editor={editor} />
      <ImageInsertDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        onInsert={({ url, width, height, alt, caption }) => {
          editor
            ?.chain()
            .focus()
            .setImage({ src: url, alt, title: caption || undefined, width, height })
            .run();
        }}
      />
      <PollInsertDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        polls={polls}
        onInsert={(snapshot) => {
          editor?.chain().focus().insertPoll(pollNodeAttrs(snapshot)).run();
        }}
      />
    </div>
  );
}

function Toolbar({
  editor,
  onImage,
  onPoll,
}: {
  editor: Editor;
  onImage: () => void;
  onPoll: () => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive('paragraph'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      image: e.isActive('image'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const onLink = () => {
    const current = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Adresse du lien (vide pour retirer le lien)', current || 'https://');
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === '' || trimmed === 'https://') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!isSafeHref(trimmed)) {
      window.alert('Lien refusé : utilise une adresse http(s), mailto: ou un chemin du site (/emissions/…).');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const onVideo = () => {
    const url = window.prompt('Adresse de la vidéo YouTube');
    if (!url) return;
    if (!youtubeIdFromUrl(url.trim())) {
      window.alert('Adresse YouTube non reconnue (youtube.com/watch?v=…, youtu.be/…, /shorts/…).');
      return;
    }
    editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
  };

  const onImageText = () => {
    const attrs = editor.getAttributes('image') as { alt?: string; title?: string };
    const alt = window.prompt('Texte alternatif de l’image (obligatoire)', attrs.alt ?? '');
    if (alt === null) return;
    if (!alt.trim()) {
      window.alert('Le texte alternatif ne peut pas être vide.');
      return;
    }
    const caption = window.prompt('Légende (vide pour aucune)', attrs.title ?? '');
    if (caption === null) return;
    editor
      .chain()
      .focus()
      .updateAttributes('image', { alt: alt.trim(), title: caption.trim() || null })
      .run();
  };

  return (
    <div
      role="toolbar"
      aria-label="Mise en forme"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-admin-border bg-admin-surface-2 px-3 py-2"
    >
      <Btn label="Paragraphe" active={state.paragraph} onClick={() => editor.chain().focus().setParagraph().run()}>
        ¶
      </Btn>
      <Btn label="Intertitre" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn label="Sous-intertitre" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <Sep />
      <Btn label="Gras (Cmd+B)" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn label="Italique (Cmd+I)" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Btn>
      <Btn label="Souligné (Cmd+U)" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </Btn>
      <Btn label="Barré" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </Btn>
      <Btn label="Lien" active={state.link} onClick={onLink}>
        Lien
      </Btn>
      <Sep />
      <Btn label="Liste à puces" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • Liste
      </Btn>
      <Btn label="Liste numérotée" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. Liste
      </Btn>
      <Btn label="Citation" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        « Citation »
      </Btn>
      <Btn label="Séparateur" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ―
      </Btn>
      <Sep />
      <Btn label="Insérer une image" onClick={onImage}>
        Image
      </Btn>
      {state.image ? (
        <Btn label="Texte alternatif et légende de l’image sélectionnée" onClick={onImageText}>
          Alt / légende
        </Btn>
      ) : null}
      <Btn label="Insérer une vidéo YouTube" onClick={onVideo}>
        Vidéo
      </Btn>
      <Btn label="Insérer les résultats d’un sondage du Thermomètre" onClick={onPoll}>
        Sondage
      </Btn>
      <div className="flex-1" />
      <Btn label="Annuler (Cmd+Z)" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </Btn>
      <Btn label="Rétablir (Cmd+Maj+Z)" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        'min-w-[32px] rounded-md px-2 py-1 text-[12px] font-semibold transition-colors',
        active ? 'bg-admin-ink text-bento-cream' : 'text-admin-ink-2 hover:bg-admin-bg',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-admin-border" />;
}
