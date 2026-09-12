'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryKey } from '@bento-pop/supabase-mobile/types';
import { checkPseudoShape } from '@/lib/pseudo-rules';
import { createEditorialBento, searchCatalogItems, type FoundItem } from './actions';

type Category = { key: CategoryKey; label: string };
type Chosen = Partial<Record<CategoryKey, FoundItem>>;

export function NewEditorialClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pseudo, setPseudo] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [chosen, setChosen] = useState<Chosen>({});
  const [publish, setPublish] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shape = checkPseudoShape(pseudo);
  const filled = categories.filter((c) => chosen[c.key]).length;
  const complete = filled === categories.length;

  // Publier un bento incomplet montrerait des cases vides dans le fil, sur
  // un contenu qu'on met justement en avant. La case se désactive plutôt que
  // d'échouer à l'envoi.
  const canPublish = complete;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const slots: Record<string, string> = {};
      for (const c of categories) {
        const item = chosen[c.key];
        if (item) slots[c.key] = item.id;
      }
      const res = await createEditorialBento({
        pseudo: pseudo.trim(),
        displayName,
        slots,
        publish: publish && canPublish,
        featured,
      });
      if (res.ok) router.push(`/utilisateurs?q=${encodeURIComponent(res.pseudo)}`);
      else setError(res.error);
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="admin-card p-5 text-[13px] text-admin-muted">
        Ce profil <strong>n&apos;aura pas de compte</strong> : personne ne pourra s&apos;y
        connecter, et il ne comptera pas dans les utilisateurs. Son bento apparaîtra dans
        le fil comme les autres, avec une étiquette « Invité ».
      </div>

      <div className="admin-card space-y-4 p-5">
        <label className="block text-[12px] font-medium">
          Pseudo du créateur
          <input
            className="admin-input mt-1 block w-full max-w-sm"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="joueur_du_grenier"
          />
        </label>
        {pseudo.length > 0 && !shape.ok ? (
          <p className="text-[12px] text-bento-red">{shape.message}</p>
        ) : null}
        {shape.ok ? (
          <p className="text-[12px] text-admin-muted">
            Adresse publique : <code className="font-mono">/u/{pseudo.trim()}</code>
          </p>
        ) : null}

        <label className="block text-[12px] font-medium">
          Nom affiché
          <input
            className="admin-input mt-1 block w-full max-w-sm"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="facultatif"
          />
        </label>
      </div>

      <div className="admin-card p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold">Les six cases</h2>
          <span className="text-[12px] text-admin-muted">{filled} / {categories.length}</span>
        </div>
        <div className="mt-4 space-y-4">
          {categories.map((c) => (
            <SlotPicker
              key={c.key}
              category={c}
              chosen={chosen[c.key] ?? null}
              onPick={(item) => setChosen((prev) => ({ ...prev, [c.key]: item }))}
              onClear={() =>
                setChosen((prev) => {
                  const next = { ...prev };
                  delete next[c.key];
                  return next;
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="admin-card space-y-3 p-5">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={publish && canPublish}
            disabled={!canPublish}
            onChange={(e) => setPublish(e.target.checked)}
          />
          Publier tout de suite
          {!canPublish ? (
            <span className="text-[12px] text-admin-muted">
              (les six cases doivent être remplies)
            </span>
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Mettre en avant comme coup de cœur
        </label>
      </div>

      {error ? (
        <p className="admin-card border-bento-red px-4 py-3 text-[13px] text-bento-red">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={submit}
          disabled={pending || !shape.ok || filled === 0}
        >
          {pending ? 'Création…' : 'Créer le bento'}
        </button>
      </div>
    </div>
  );
}

/**
 * Une case : recherche dans le catalogue, puis choix.
 *
 * La recherche tape `search_items`, la fonction que l'app utilise déjà.
 * Chercher autrement afficherait un autre catalogue, classé autrement, et on
 * composerait des bentos avec des items que personne ne retrouve.
 */
function SlotPicker({
  category,
  chosen,
  onPick,
  onClear,
}: {
  category: Category;
  chosen: FoundItem | null;
  onPick: (item: FoundItem) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundItem[]>([]);
  const [searching, startSearch] = useTransition();

  const run = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => setResults(await searchCatalogItems(category.key, value)));
  };

  return (
    <div className="border-t border-admin-border pt-4 first:border-t-0 first:pt-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
        {category.label}
      </div>

      {chosen ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[14px] font-semibold">{chosen.title}</span>
          {chosen.subtitle ? (
            <span className="text-[12px] text-admin-muted">{chosen.subtitle}</span>
          ) : null}
          <button type="button" className="admin-btn admin-btn-sm admin-btn-ghost" onClick={onClear}>
            Changer
          </button>
        </div>
      ) : (
        <>
          <input
            className="admin-input mt-2 block w-full max-w-sm"
            value={query}
            onChange={(e) => run(e.target.value)}
            placeholder={`Chercher ${category.label.toLowerCase()}…`}
          />
          {searching ? <p className="mt-1 text-[12px] text-admin-muted">Recherche…</p> : null}
          {results.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left text-[13px] hover:bg-admin-bg"
                    onClick={() => {
                      onPick(r);
                      setQuery('');
                      setResults([]);
                    }}
                  >
                    {r.title}
                    {r.subtitle ? (
                      <span className="ml-2 text-[12px] text-admin-muted">{r.subtitle}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {query.trim().length >= 2 && !searching && results.length === 0 ? (
            <p className="mt-1 text-[12px] text-admin-muted">
              Rien dans le catalogue. Ajoute l&apos;item depuis Catalogue, puis reviens.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
