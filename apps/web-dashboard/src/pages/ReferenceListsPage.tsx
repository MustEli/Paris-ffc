import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  addReferenceListValue,
  fetchAllReferenceLists,
  REFERENCE_LIST_CATEGORIES,
  removeReferenceListValue,
  type ReferenceListCategory,
} from '../core/api/referenceLists';
import { ApiError } from '../core/api/client';
import { useAuth } from '../core/auth/AuthContext';

/**
 * One generic screen for every admin-managed dropdown category — see
 * schema.prisma's ReferenceListCategory doc comment. Adding a new
 * category to that enum is all that's needed for it to show up here
 * too, no new UI required.
 */
export function ReferenceListsPage() {
  const { t } = useTranslation('referenceLists');
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['reference-lists'],
    queryFn: () => fetchAllReferenceLists(token!),
    enabled: !!token,
  });

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-purple">
          <ListChecks />
        </span>
        <div className="page-header-text">
          <h1>{t('title')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {t('subtitle')}
          </p>
        </div>
      </div>

      {isPending && <p>{t('loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data &&
        REFERENCE_LIST_CATEGORIES.map((category) => (
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
  const { t } = useTranslation('referenceLists');
  const { t: tCommon } = useTranslation('common');
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
      setError(err instanceof ApiError ? err.message : t('errors.addFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeReferenceListValue(token!, category, id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.removeFailed'));
    }
  }

  return (
    <div className="card">
      <div className="flex-row" style={{ marginBottom: 14 }}>
        <span className="icon-badge icon-badge-sm icon-badge-gray">
          <ListChecks />
        </span>
        <h2 style={{ margin: 0 }}>{tCommon(`referenceListCategories.${category}`)}</h2>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {values.length === 0 && <span className="hint-text">{t('noValues')}</span>}
        {values.map((v) => (
          <span key={v.id} className="chip">
            {v.value}
            <button
              className="chip-remove"
              onClick={() => handleRemove(v.id)}
              title={t('remove')}
              aria-label={t('removeAriaLabel', { value: v.value })}
            >
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
          placeholder={t('addPlaceholder')}
          disabled={isSubmitting}
        />
        <button className="btn btn-primary" onClick={handleAdd} disabled={isSubmitting || !draft.trim()}>
          <Plus size={14} />
          {t('add')}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
