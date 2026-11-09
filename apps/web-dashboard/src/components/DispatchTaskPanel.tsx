import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '../core/api/client';
import { type DispatchItemResult } from '../core/api/openPool';
import { fetchStaffUsers } from '../core/api/users';
import { useAuth } from '../core/auth/AuthContext';

interface DispatchTaskPanelProps {
  /** Selected items, in display order. */
  items: { id: string; label: string }[];
  onDispatch: (items: { id: string; comment: string }[], targetUserId: string | undefined) => Promise<DispatchItemResult[]>;
  /** Called after a dispatch where every item succeeded — the caller clears its own selection. */
  onAllSucceeded: () => void;
}

/**
 * Shared by Pending Instructions and Seller Stock Photos: each selected
 * item gets its own comment box (defaulting to whatever was typed in
 * "Comment for all"), a target picker (anyone, or one specific staff
 * member), and a Send button that dispatches one Open Pool task per
 * item — see OpenPoolService.dispatchFromReceptions/dispatchFromPallets.
 */
export function DispatchTaskPanel({ items, onDispatch, onAllSucceeded }: DispatchTaskPanelProps) {
  const { token } = useAuth();
  const { data: staff } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });

  const [bulkComment, setBulkComment] = useState('');
  const [comments, setComments] = useState<Record<string, string>>({});
  const [targetUserId, setTargetUserId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DispatchItemResult[] | null>(null);

  // Items arriving/leaving the selection keep their own comment draft; a brand-new one starts from whatever's in "Comment for all" so far.
  useEffect(() => {
    setComments((prev) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        next[item.id] = prev[item.id] ?? bulkComment;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(',')]);

  function applyToAll() {
    setComments((prev) => {
      const next = { ...prev };
      for (const item of items) next[item.id] = bulkComment;
      return next;
    });
  }

  async function handleSend() {
    const dispatchItems = items.map((item) => ({ id: item.id, comment: (comments[item.id] ?? '').trim() }));
    if (dispatchItems.some((i) => !i.comment)) {
      setError('Every selected item needs a comment before sending.');
      return;
    }
    setIsSending(true);
    setError(null);
    setResults(null);
    try {
      const outcome = await onDispatch(dispatchItems, targetUserId || undefined);
      setResults(outcome);
      if (outcome.every((r) => r.success)) {
        setComments({});
        setBulkComment('');
        onAllSucceeded();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send as Open Pool task(s)');
    } finally {
      setIsSending(false);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 16, background: '#f8fafc' }}>
      <h2 style={{ marginTop: 0 }}>Send {items.length} selected as Open Pool task(s)</h2>

      <div className="form-row">
        <label className="form-label">Comment for all</label>
        <div className="flex-row">
          <textarea
            rows={2}
            style={{ flex: 1 }}
            value={bulkComment}
            onChange={(e) => setBulkComment(e.target.value)}
            placeholder="e.g. Stack in aisle 4, bay 2"
          />
          <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={applyToAll}>
            Apply to all
          </button>
        </div>
      </div>

      <div className="form-row">
        <label className="form-label">Send to</label>
        <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">Anyone available</option>
          {staff?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label className="form-label">Per-item comment</label>
        {items.map((item) => (
          <div key={item.id} className="flex-row" style={{ marginBottom: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#374151', width: 220, flexShrink: 0 }}>{item.label}</span>
            <input
              type="text"
              style={{ flex: 1 }}
              value={comments[item.id] ?? ''}
              onChange={(e) => setComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
              placeholder="e.g. Stack in aisle 4, bay 2"
            />
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-accent" onClick={handleSend} disabled={isSending}>
        {isSending ? 'Sending…' : `Send ${items.length} task(s)`}
      </button>

      {results && (
        <ul style={{ margin: '12px 0 0', paddingLeft: 20 }}>
          {results.map((r) => {
            const label = items.find((i) => i.id === r.id)?.label ?? r.id;
            return (
              <li key={r.id} style={{ color: r.success ? '#15803d' : '#dc2626' }}>
                {r.success ? 'Sent' : `Failed: ${r.error}`} — {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
