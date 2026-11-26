'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PhotoUploader } from '@/components/PhotoUploader';
import { StatusBadge } from '@/components/StatusBadge';
import { TrashIcon } from '@/components/icons';
import { AuthorsField } from '@/components/blog/AuthorsField';
import { RelatedEpisodesField, type EpisodeOption } from '@/components/blog/RelatedEpisodesField';
import { RichTextEditor } from '@/components/blog/RichTextEditor';
import type { TeamMemberOption } from '@/components/episodes/HostsField';
import { SlugField } from '@/components/episodes/SlugField';
import { EMPTY_DOC, type BlogDoc } from '@/lib/blog/document';
import { BLOG_BUCKET } from '@/lib/blog/image-upload';
import type { PollSnapshot } from '@/lib/blog/poll';
import { blogPostSchema, type BlogPostPayload, type RelatedEpisodeRef } from '@/lib/blog/schemas';
import { POST_STATE_LABELS, postState } from '@/lib/blog/status';
import { datetimeLocalToIso, isoToDatetimeLocal } from '@/lib/episodes/format';
import { slugify } from '@/lib/slugify';
import { clsx } from '@/lib/clsx';
import { deletePost, getPreviewLink, savePost } from '../actions';

export type EditablePost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: BlogDoc;
  cover_url: string | null;
  cover_alt: string;
  category_id: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  author_ids: string[];
  related: RelatedEpisodeRef[];
};

type Props = {
  post: EditablePost | null;
  team: TeamMemberOption[];
  categories: Array<{ id: string; name: string }>;
  episodes: EpisodeOption[];
  polls: PollSnapshot[];
  landingUrl: string | null;
};

type FormValues = BlogPostPayload;

export function PostEditor({ post, team, categories, episodes, polls, landingUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const contentRef = useRef<BlogDoc>(post?.content ?? EMPTY_DOC);
  const [contentDirty, setContentDirty] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      id: post?.id,
      slug: post?.slug ?? '',
      title: post?.title ?? '',
      excerpt: post?.excerpt ?? '',
      cover_url: post?.cover_url ?? '',
      cover_alt: post?.cover_alt ?? '',
      category_id: post?.category_id ?? '',
      status: post?.status ?? 'draft',
      published_at: isoToDatetimeLocal(post?.published_at),
      seo_title: post?.seo_title ?? '',
      seo_description: post?.seo_description ?? '',
      author_ids: post?.author_ids ?? [],
      related: post?.related ?? [],
    },
  });

  const dirty = isDirty || contentDirty;

  // Garde-fou : quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Slug suivi depuis le titre tant qu'il n'a pas été retouché (même logique que les épisodes).
  const isNew = !post;
  const [autoSlug, setAutoSlug] = useState(isNew);
  const lastAutoRef = useRef<string>(post?.slug ?? '');
  const title = watch('title');
  const slugRegister = register('slug', {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value !== lastAutoRef.current) setAutoSlug(false);
    },
  });
  useEffect(() => {
    if (!autoSlug) return;
    const next = slugify(title ?? '');
    lastAutoRef.current = next;
    setValue('slug', next, { shouldValidate: false, shouldDirty: true });
  }, [title, autoSlug, setValue]);
  const onResyncSlug = () => {
    setAutoSlug(true);
    const next = slugify(title ?? '');
    lastAutoRef.current = next;
    setValue('slug', next, { shouldValidate: true, shouldDirty: true });
  };

  const status = watch('status');
  const publishedAtLocal = watch('published_at') ?? '';
  const publishedIso = datetimeLocalToIso(publishedAtLocal);
  const state = postState(status ?? 'draft', publishedIso);
  const coverUrl = watch('cover_url') ?? '';
  const excerpt = watch('excerpt') ?? '';
  const seoTitle = watch('seo_title') ?? '';
  const seoDescription = watch('seo_description') ?? '';
  const slug = watch('slug') ?? '';

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      // Heure de Paris convertie ici, dans le navigateur (cf. lib/episodes/format).
      // Le document repasse par JSON : ProseMirror crée ses `attrs` sans prototype, et React
      // refuse alors de les transmettre à l'action serveur (« temporary client reference »).
      const result = await savePost({
        ...values,
        content: JSON.parse(JSON.stringify(contentRef.current)) as BlogDoc,
        published_at: datetimeLocalToIso(values.published_at ?? '') ?? '',
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      reset(getValues());
      setContentDirty(false);
      setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      if (isNew && result.id) {
        router.replace(`/blog/${result.id}`);
      } else {
        router.refresh();
      }
    });
  };

  const onDelete = () => {
    if (!post) return;
    if (!confirm(`Supprimer définitivement « ${post.title} » ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setContentDirty(false);
      reset(getValues());
      router.replace('/blog');
    });
  };

  const onPreview = async () => {
    if (!post) return;
    // Fenêtre ouverte tout de suite, dans le geste du clic : sinon le navigateur la bloque.
    const win = window.open('about:blank', '_blank');
    const result = await getPreviewLink(post.id);
    if (!result.ok) {
      win?.close();
      setServerError(result.error);
      return;
    }
    if (win) win.location.href = result.url;
    else window.location.href = result.url;
  };

  const publicUrl = landingUrl && post ? `${landingUrl.replace(/\/$/, '')}/blog/${post.slug}` : null;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      {/* Colonne de rédaction */}
      <div className="min-w-0 space-y-4">
        <div className="admin-card space-y-4 p-5">
          <label className="block">
            <span className="sr-only">Titre</span>
            <input
              className="w-full border-none bg-transparent text-[28px] font-bold leading-tight outline-none placeholder:text-admin-muted"
              placeholder="Titre de l’article"
              {...register('title')}
            />
            {errors.title?.message ? (
              <span className="mt-1 block text-[11px] text-bento-red">{errors.title.message}</span>
            ) : null}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <SlugField registerProps={slugRegister} onResync={onResyncSlug} error={errors.slug?.message} />
          </div>
          <label className="block">
            <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              <span>Chapô</span>
              <span className={clsx('font-mono', excerpt.length > 400 && 'text-bento-red')}>
                {excerpt.length}/400
              </span>
            </span>
            <textarea
              className="admin-textarea"
              rows={3}
              placeholder="Deux ou trois phrases qui donnent envie de lire : affichées sous le titre, dans les cartes et le flux RSS."
              {...register('excerpt')}
            />
            {errors.excerpt?.message ? (
              <span className="mt-1 block text-[11px] text-bento-red">{errors.excerpt.message}</span>
            ) : null}
          </label>
        </div>

        <RichTextEditor
          initialContent={post?.content ?? EMPTY_DOC}
          polls={polls}
          onChange={(doc) => {
            contentRef.current = doc;
            setContentDirty(true);
          }}
        />
      </div>

      {/* Colonne de réglages */}
      <aside className="space-y-4 xl:sticky xl:top-[88px]">
        <Panel title="Publication">
          <div className="mb-3 flex items-center gap-2">
            <StatusBadge
              status={state === 'published' ? 'live' : state === 'scheduled' ? 'soon' : 'draft'}
              label={POST_STATE_LABELS[state]}
            />
            {dirty ? (
              <span className="text-[11px] text-admin-muted">Modifications non enregistrées</span>
            ) : savedAt ? (
              <span className="text-[11px] text-admin-muted">Enregistré à {savedAt}</span>
            ) : null}
          </div>
          <label className="mb-3 block">
            <FieldLabel>Statut</FieldLabel>
            <select className="admin-select" {...register('status')}>
              <option value="draft">Brouillon (invisible sur le site)</option>
              <option value="published">Publié</option>
            </select>
          </label>
          <label className="block">
            <FieldLabel>Date de publication (heure de Paris)</FieldLabel>
            <input className="admin-input" type="datetime-local" {...register('published_at')} />
            <span className="mt-1.5 block text-[11px] text-admin-muted">
              {status === 'published' && !publishedAtLocal
                ? 'Vide : l’article sera daté de l’enregistrement.'
                : state === 'scheduled'
                  ? 'Date future : l’article apparaîtra tout seul à cette heure (une heure au plus de délai sur sa page).'
                  : 'Une date future programme la mise en ligne.'}
            </span>
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className={clsx('admin-btn admin-btn-primary flex-1', pending && 'opacity-70')}
              disabled={pending}
            >
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {post ? (
              <button
                type="button"
                className="admin-btn"
                onClick={onPreview}
                disabled={pending || dirty}
                title={dirty ? 'Enregistre d’abord pour prévisualiser la dernière version' : 'Ouvrir l’aperçu (lien valable 24 h)'}
              >
                Aperçu
              </button>
            ) : null}
            {post && state === 'published' && publicUrl ? (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="admin-btn">
                Voir sur le site
              </a>
            ) : null}
          </div>
          {serverError ? (
            <div className="mt-3 rounded-admin-input border border-admin-border bg-admin-red-soft px-3 py-2 text-[12px] text-bento-red">
              {serverError}
            </div>
          ) : null}
          {Object.keys(errors).length > 0 && !serverError ? (
            <p className="mt-3 text-[12px] text-bento-red">
              {firstError(errors) ?? 'Certains champs sont à corriger.'}
            </p>
          ) : null}
        </Panel>

        <Panel title="Classement">
          <label className="mb-4 block">
            <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              <span>Catégorie</span>
              <Link href="/blog/categories" className="normal-case tracking-normal underline">
                Gérer
              </Link>
            </span>
            <select className="admin-select" {...register('category_id')}>
              <option value="">Sans catégorie</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Controller
            control={control}
            name="author_ids"
            render={({ field }) => (
              <AuthorsField
                value={field.value ?? []}
                onChange={field.onChange}
                members={team}
                error={errors.author_ids?.message}
              />
            )}
          />
        </Panel>

        <Panel title="Image de couverture">
          <PhotoUploader
            currentUrl={coverUrl || null}
            bucket={BLOG_BUCKET}
            pathPrefix="covers/"
            outputFormat="webp"
            targetSize={1600}
            aspect={16 / 9}
            modalLabel="Couverture · format 16:9"
            onUploaded={(url) => setValue('cover_url', url, { shouldDirty: true, shouldValidate: true })}
          />
          {coverUrl ? (
            <button
              type="button"
              className="mt-2 text-[11px] text-admin-muted underline hover:text-bento-red"
              onClick={() => {
                setValue('cover_url', '', { shouldDirty: true });
                setValue('cover_alt', '', { shouldDirty: true, shouldValidate: true });
              }}
            >
              Retirer la couverture
            </button>
          ) : null}
          <label className="mt-3 block">
            <FieldLabel>Texte alternatif</FieldLabel>
            <input
              className="admin-input"
              placeholder="Ce que montre l’image"
              disabled={!coverUrl}
              {...register('cover_alt')}
            />
            {errors.cover_alt?.message ? (
              <span className="mt-1 block text-[11px] text-bento-red">{errors.cover_alt.message}</span>
            ) : null}
          </label>
          <p className="mt-2 text-[11px] text-admin-muted">
            Sert aussi d’image de partage (réseaux sociaux). Sans couverture, le site prend l’image Bento Pop.
          </p>
        </Panel>

        <Panel title="Épisodes liés">
          <Controller
            control={control}
            name="related"
            render={({ field }) => (
              <RelatedEpisodesField
                value={field.value ?? []}
                onChange={field.onChange}
                options={episodes}
                error={errors.related?.message}
              />
            )}
          />
        </Panel>

        <Panel title="Référencement">
          <label className="mb-3 block">
            <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              <span>Titre SEO</span>
              <span className={clsx('font-mono', seoTitle.length > 60 && 'text-bento-red')}>{seoTitle.length}/60</span>
            </span>
            <input className="admin-input" placeholder="Vide : le titre de l’article" {...register('seo_title')} />
          </label>
          <label className="block">
            <span className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
              <span>Description SEO</span>
              <span className={clsx('font-mono', seoDescription.length > 160 && 'text-bento-red')}>
                {seoDescription.length}/160
              </span>
            </span>
            <textarea
              className="admin-textarea"
              rows={3}
              placeholder="Vide : le chapô"
              {...register('seo_description')}
            />
          </label>
          <div className="mt-3 rounded-admin-input border border-admin-border bg-admin-surface-2 p-3">
            <div className="font-mono text-[10px] text-admin-muted">bento-pop.com › blog › {slug || '…'}</div>
            <div className="mt-0.5 line-clamp-1 text-[14px] font-medium text-[#1a0dab]">
              {(seoTitle || title || 'Titre de l’article') + ' · Bento Pop'}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[12px] text-admin-ink-2">
              {seoDescription || excerpt || 'Le chapô de l’article s’affichera ici.'}
            </div>
          </div>
        </Panel>

        {post ? (
          <button
            type="button"
            className="admin-btn admin-btn-danger w-full"
            onClick={onDelete}
            disabled={pending}
          >
            <TrashIcon />
            Supprimer l’article
          </button>
        ) : null}
      </aside>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-4">
      <h2 className="mb-3 border-b border-admin-border pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-muted">
      {children}
    </span>
  );
}

function firstError(errors: Record<string, unknown>): string | null {
  for (const value of Object.values(errors)) {
    const message = (value as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string' && message) return message;
  }
  return null;
}
