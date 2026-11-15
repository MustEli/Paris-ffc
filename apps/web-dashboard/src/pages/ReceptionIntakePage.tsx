import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, PackageSearch, Trash2, Upload, User, Weight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { ApiError } from '../core/api/client';
import { CONDITION_FLAG_LABELS, fetchPallets, type SellerStockPallet } from '../core/api/sellerStock';
import { assignPutAway, fetchTaskBoard, PRIORITY_LABELS, TASK_PRIORITIES, type OnShiftStaffMember, type TaskPriority } from '../core/api/tasks';
import { resolvePhotoUrl, uploadPhoto } from '../core/api/upload';
import { useAuth } from '../core/auth/AuthContext';
import { DeliveriesSection } from './ReceptionsPage';
import { SellerStockSection } from './SellerStockPage';

/** Customer's nav spec bundles all received stuff — deliveries and seller stock pallets — under one "Reception & Intake" item, as two record tables plus (above them) the one place admin actually acts on anything: pallets a staff member flagged a problem with. */
export function ReceptionIntakePage() {
  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-orange">
          <PackageSearch />
        </span>
        <div className="page-header-text">
          <h1>Reception & Intake</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Every delivery and seller stock pallet received, with full details and photos.
          </p>
        </div>
      </div>
      <PendingReviewSection />
      <DeliveriesSection />
      <div style={{ marginTop: 32 }}>
        <SellerStockSection />
      </div>
    </div>
  );
}

function conditionSummary(pallet: SellerStockPallet): string {
  const flags = pallet.conditionFlags.filter((f) => f !== 'good').map((f) => CONDITION_FLAG_LABELS[f]);
  return flags.length > 0 ? flags.join(', ') : 'Flagged for review';
}

interface AssignTarget {
  pallet: SellerStockPallet;
  staff: OnShiftStaffMember | null;
}

/**
 * The admin's one actionable "pending tasks" view for Reception & Intake
 * — SellerStockPallet rows in `pending_admin_review` (damaged/overweight
 * on intake), newest-received first. Drag a card onto an online staff
 * member (or use the Assign button) to write an instruction, optionally
 * attach admin photos, and hand it off — same underlying
 * POST /put-away-tasks the old Task Board flow used (see
 * core/api/tasks.ts's assignPutAway), just reachable from here instead,
 * since these pallets are this page's business, not Task Board's.
 * Reception rows needing instruction (status `arrived`) are a separate,
 * much rarer case and stay exclusively on the Task Board tab.
 *
 * Layout: the online-staff column is `position: sticky` within the flex
 * row it shares with the card list, so it tracks the admin's scroll
 * through a long pending list and then scrolls away normally once this
 * section's container ends and the Deliveries table begins — no JS
 * scroll-locking involved, just where the sticky box's containing block
 * happens to end.
 */
function PendingReviewSection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: pallets } = useQuery({
    queryKey: ['seller-stock'],
    queryFn: () => fetchPallets(token!),
    enabled: !!token,
  });
  const { data: board } = useQuery({
    queryKey: ['task-board'],
    queryFn: () => fetchTaskBoard(token!),
    enabled: !!token,
  });

  const onShiftStaff = board?.onShiftStaff ?? [];
  const pending = useMemo(
    () =>
      (pallets ?? [])
        .filter((p) => p.status === 'pending_admin_review')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [pallets],
  );

  const [dragOverStaffId, setDragOverStaffId] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['seller-stock'] });
    queryClient.invalidateQueries({ queryKey: ['task-board'] });
  }

  function handleDrop(staff: OnShiftStaffMember, e: React.DragEvent) {
    e.preventDefault();
    setDragOverStaffId(null);
    const palletId = e.dataTransfer.getData('text/plain');
    const pallet = pending.find((p) => p.id === palletId);
    if (pallet) setAssignTarget({ pallet, staff });
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div className="section-toolbar">
        <div className="flex-row">
          <span className="icon-badge icon-badge-sm icon-badge-red">
            <AlertTriangle />
          </span>
          <h2 style={{ margin: 0 }}>Needs Admin Review</h2>
        </div>
        <span className="pill pill-red">{pending.length} pending</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {pending.length === 0 && (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={16} color="var(--tint-green-icon)" />
              <p className="hint-text" style={{ margin: 0 }}>
                Nothing waiting on review right now.
              </p>
            </div>
          )}
          {pending.map((pallet) => (
            <div
              key={pallet.id}
              className="card"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/plain', pallet.id)}
              style={{ cursor: 'grab', display: 'flex', gap: 14, marginBottom: 12 }}
            >
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {(pallet.damageEvidencePhotoUrls.length > 0 ? pallet.damageEvidencePhotoUrls : pallet.labelPhotoUrls).slice(0, 2).map((url, i) => (
                  <img
                    key={i}
                    src={resolvePhotoUrl(url)}
                    alt="Pallet"
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--gray-150)' }}
                  />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 'var(--weight-strong)' }}>
                    {pallet.palletIndex} — Box {pallet.boxNumber}
                  </div>
                  <span className="pill pill-red">{conditionSummary(pallet)}</span>
                </div>
                <div className="flex-row" style={{ gap: 14, marginTop: 4, color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>
                  <span className="flex-row" style={{ gap: 4 }}>
                    <User size={13} />
                    {pallet.sellerName}
                  </span>
                  <span className="flex-row" style={{ gap: 4 }}>
                    <Weight size={13} />
                    {pallet.weightKg.toLocaleString()} kg
                  </span>
                </div>
                {pallet.damageRemarks && (
                  <p style={{ margin: '6px 0 0', fontSize: 'var(--text-sm)', color: 'var(--gray-700)' }}>"{pallet.damageRemarks}"</p>
                )}
              </div>
              <button
                className="btn btn-outline"
                style={{ flexShrink: 0, alignSelf: 'center' }}
                onClick={() => setAssignTarget({ pallet, staff: null })}
              >
                Assign…
              </button>
            </div>
          ))}
        </div>

        <div style={{ width: 230, flexShrink: 0, position: 'sticky', top: 16 }}>
          <div className="card">
            <div className="stat-tile-label" style={{ marginBottom: 10 }}>
              Online staff — drag a card here
            </div>
            {onShiftStaff.length === 0 && <p className="hint-text" style={{ margin: 0 }}>No one is on shift.</p>}
            {onShiftStaff.map((s) => (
              <div
                key={s.userId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStaffId(s.userId);
                }}
                onDragLeave={() => setDragOverStaffId((cur) => (cur === s.userId ? null : cur))}
                onDrop={(e) => handleDrop(s, e)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 6,
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-strong)',
                  background: dragOverStaffId === s.userId ? '#fff1e2' : 'var(--gray-50)',
                  border: dragOverStaffId === s.userId ? '1px dashed var(--brand-orange)' : '1px solid var(--gray-150)',
                  transition: 'background-color 0.1s ease, border-color 0.1s ease',
                }}
              >
                {s.userName}
              </div>
            ))}
          </div>
        </div>
      </div>

      {assignTarget && (
        <AssignReviewModal
          target={assignTarget}
          staffOptions={onShiftStaff}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            setAssignTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function AssignReviewModal({
  target,
  staffOptions,
  onClose,
  onAssigned,
}: {
  target: AssignTarget;
  staffOptions: OnShiftStaffMember[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assignedToUserId, setAssignedToUserId] = useState(target.staff?.userId ?? '');
  const [location, setLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadPhoto(token!, file)));
      setPhotoUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload a photo');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit() {
    if (!assignedToUserId || !location.trim()) {
      setError('Pick a staff member and enter an instruction before sending.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await assignPutAway(token!, {
        palletId: target.pallet.id,
        assignedToUserId,
        location: location.trim(),
        priority,
        instructions: instructions.trim() || undefined,
        instructionPhotoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      onAssigned();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign this pallet');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>
              Assign {target.pallet.palletIndex} — {target.pallet.sellerName}
            </h2>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{conditionSummary(target.pallet)}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="form-row">
          <label className="form-label">Assign to</label>
          <select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)}>
            <option value="">Select a staff member…</option>
            {staffOptions.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.userName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label className="form-label">Instructions / put-away location</label>
          <input
            type="text"
            placeholder="e.g. Set aside in Aisle 4 — repackage before placing"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label className="form-label">Additional notes (optional)</label>
          <textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>

        <div className="form-row">
          <label className="form-label">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label className="form-label">Photos for staff (optional)</label>
          <div className="photo-grid" style={{ marginBottom: photoUrls.length > 0 ? 10 : 0 }}>
            {photoUrls.map((url, i) => (
              <div key={url} style={{ position: 'relative' }}>
                <img src={resolvePhotoUrl(url)} alt="" className="photo-thumb" />
                <button
                  className="modal-close"
                  style={{ position: 'absolute', top: -6, right: -6, background: '#fff', borderRadius: '50%', boxShadow: 'var(--shadow-sm)', padding: 2 }}
                  onClick={() => setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove photo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload size={14} />
            {isUploading ? 'Uploading…' : 'Upload photo(s)'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFilesSelected} />
        </div>

        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-accent" onClick={handleSubmit} disabled={isSubmitting} style={{ marginTop: 8 }}>
          {isSubmitting ? 'Sending…' : 'Send instructions'}
        </button>
      </div>
    </div>
  );
}
