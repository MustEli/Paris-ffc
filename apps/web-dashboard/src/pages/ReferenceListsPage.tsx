import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  addReferenceListValue,
  fetchAllReferenceLists,
  removeReferenceListValue,
  REFERENCE_LIST_LABELS,
  type ReferenceListCategory,
} from '../core/api/referenceLists';
import { ApiError } from '../core/api/client';
import { useAuth } from '../core/auth/AuthContext';

const CATEGORIES = Object.keys(REFERENCE_LIST_LABELS) as ReferenceListCategory[];

/**
 * One generic screen for every admin-managed dropdown category — see
 * schema.prisma's ReferenceListCategory doc comment. Adding a new
 * category to that enum is all that's needed for it to show up here
 * too, no new UI required.
 */
export function ReferenceListsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['reference-lists'],
    queryFn: () => fetchAllReferenceLists(token!),
    enabled: !!token,
  });

  return (
    <div>
      <h1>Manage Lists</h1>
      <p className="page-subtitle">
        These values feed the dropdowns staff use on the mobile app (e.g. Reception's Transporter Company and
        Packaging Type fields) — anything added or removed here shows up there right away.
      </p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data &&
        CATEGORIES.map((category) => (
          <ReferenceListCard
            key={category}
            category={category}
            values={data[category]}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ['reference-lists'] })}
          />
        ))}
    </div>
  );
}

function ReferenceListCard({
  category,
  values,
  onChanged,
}: {
  category: ReferenceListCategory;
  values: { id: string; value: string }[];
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAdd() {
    if (!draft.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addReferenceListValue(token!, category, draft.trim());
      setDraft('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add value');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeReferenceListValue(token!, category, id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove value');
    }
  }

  return (
    <div className="card">
      <h2>{REFERENCE_LIST_LABELS[category]}</h2>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {values.length === 0 && <span className="hint-text">No values yet.</span>}
        {values.map((v) => (
          <span key={v.id} className="chip">
            {v.value}
            <button className="chip-remove" onClick={() => handleRemove(v.id)} title="Remove" aria-label={`Remove ${v.value}`}>
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex-row">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a value…"
          disabled={isSubmitting}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={isSubmitting || !draft.trim()}>
          Add
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
