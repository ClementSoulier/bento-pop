'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, FormGrid, Modal } from '@/components/Modal';
import { SlugField } from '@/components/episodes/SlugField';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { blogCategorySchema, type BlogCategoryPayload } from '@/lib/blog/schemas';
import { slugify } from '@/lib/slugify';
import { clsx } from '@/lib/clsx';
import { deleteCategory, saveCategory } from './actions';

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  display_order: number;
  post_count: number;
};

export function CategoriesClient({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-[13px] text-admin-muted">
          Une catégorie par article. Celles sans article publié n’apparaissent pas sur le site.
        </p>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => setEditing('new')}>
          <PlusIcon />
          Nouvelle catégorie
        </button>
      </div>

      <div className="admin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-admin-border bg-admin-surface-2">
            <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-admin-muted">
              <th className="px-4 py-2.5">Ordre</th>
              <th className="px-4 py-2.5">Nom</th>
              <th className="px-4 py-2.5">Articles</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-[13px] text-admin-muted">
                  Aucune catégorie. Exemples : Cinéma, Jeux vidéo, Manga, Conventions.
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="border-b border-admin-border last:border-b-0">
                  <td className="px-4 py-3 font-mono text-[12px] text-admin-muted">{c.display_order}</td>
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold">{c.name}</div>
                    <div className="font-mono text-[11px] text-admin-muted">/blog/categorie/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px]">{c.post_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-ghost"
                      onClick={() => setEditing(c)}
                    >
                      <PencilIcon />
                      Éditer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CategoryEditor
        open={editing !== null}
        category={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function CategoryEditor({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: CategoryRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BlogCategoryPayload>({
    resolver: zodResolver(blogCategorySchema),
    values: {
      id: category?.id,
      slug: category?.slug ?? '',
      name: category?.name ?? '',
      description: category?.description ?? '',
      display_order: category?.display_order ?? 0,
    },
  });

  const [autoSlug, setAutoSlug] = useState(!category);
  useEffect(() => setAutoSlug(!category), [category, open]);
  const lastAutoRef = useRef(category?.slug ?? '');
  const name = watch('name');
  const slugRegister = register('slug', {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value !== lastAutoRef.current) setAutoSlug(false);
    },
  });
  useEffect(() => {
    if (!autoSlug) return;
    const next = slugify(name ?? '');
    lastAutoRef.current = next;
    setValue('slug', next, { shouldValidate: false });
  }, [name, autoSlug, setValue]);

  const onSubmit = (values: BlogCategoryPayload) => {
    setServerError(null);
    startTransition(async () => {
      const result = await saveCategory(values);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      reset();
      onClose();
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!category) return;
    const extra =
      category.post_count > 0
        ? ` Ses ${category.post_count} article${category.post_count > 1 ? 's' : ''} resteront en ligne, sans catégorie.`
        : '';
    if (!confirm(`Supprimer la catégorie « ${category.name} » ?${extra}`)) return;
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      crumbs={category ? `Catégorie · ${category.name}` : 'Nouvelle catégorie'}
      title={category ? category.name : 'Ajouter une catégorie'}
      footer={
        <>
          {category ? (
            <button
              type="button"
              className="admin-btn admin-btn-danger mr-auto"
              onClick={onDelete}
              disabled={pending}
            >
              <TrashIcon />
              Supprimer
            </button>
          ) : null}
          <button type="button" className="admin-btn" onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button
            type="submit"
            form="blog-category-form"
            className={clsx('admin-btn admin-btn-primary', pending && 'opacity-70')}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="blog-category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormGrid>
          <Field full label="Nom" error={errors.name?.message}>
            <input className="admin-input" placeholder="Ex. Jeux vidéo" {...register('name')} />
          </Field>
          <SlugField
            registerProps={slugRegister}
            onResync={() => {
              setAutoSlug(true);
            }}
            error={errors.slug?.message}
          />
          <Field
            full
            label="Description"
            hint="Affichée en tête de la page de la catégorie, et reprise par Google."
            error={errors.description?.message}
          >
            <textarea className="admin-textarea" rows={3} {...register('description')} />
          </Field>
          <Field label="Ordre d’affichage" hint="0 en premier" error={errors.display_order?.message}>
            <input
              className="admin-input"
              type="number"
              min={0}
              {...register('display_order', { valueAsNumber: true })}
            />
          </Field>
        </FormGrid>
        {serverError ? (
          <div className="mt-4 rounded-admin-input border border-admin-border bg-admin-red-soft px-3 py-2 text-[12px] text-bento-red">
            {serverError}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
