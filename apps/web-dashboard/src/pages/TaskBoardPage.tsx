import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '../core/api/client';
import {
  assignOrderPrep,
  assignPutAway,
  fetchTaskBoard,
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type OnShiftStaffMember,
  type PendingTaskItem,
  type TaskPriority,
} from '../core/api/tasks';
import { useAuth } from '../core/auth/AuthContext';

const PENDING_ITEM_MIME = 'application/x-elno-pending-item';
const STAFF_MIME = 'application/x-elno-staff';

function pendingItemLabel(item: PendingTaskItem): string {
  if (item.type === 'put_away') {
    const statusLabel = item.status === 'pending_admin_review' ? 'Pending admin review' : 'Ready for put-away';
    return `${item.palletIndex} — ${item.sellerName} (${statusLabel})`;
  }
  const roleLabel = item.role === 'picker' ? 'Picker' : 'Packer';
  return `${roleLabel} needed — Order Prep (${item.totalParts} parts)`;
}

function pendingItemKey(item: PendingTaskItem): string {
  return item.type === 'put_away' ? `put_away:${item.palletId}` : `order_prep:${item.sessionId}:${item.role}`;
}

interface AssignDraft {
  pendingItem: PendingTaskItem;
  staff: OnShiftStaffMember;
}

/**
 * The drag-and-drop task-assignment board from the feedback: on-shift
 * staff on one side, pending work (unassigned-ready pallets + unfilled
 * Order Prep picker/packer slots — see tasks.ts's doc comment for why
 * these are derived, not real rows) on the other. Dragging either card
 * onto the other opens a small confirm step for priority + instructions
 * before the actual assignment call fires — same underlying
 * POST /put-away-tasks / POST /order-prep/sessions/:id/tasks endpoints
 * mobile's one-at-a-time AssignTaskScreen already uses.
 */
export function TaskBoardPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['task-board'],
    queryFn: () => fetchTaskBoard(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const [draggedOverKey, setDraggedOverKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssignDraft | null>(null);
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [instructions, setInstructions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onShiftStaff = data?.onShiftStaff ?? [];
  const pendingItems = data?.pendingItems ?? [];

  function openDraft(pendingItem: PendingTaskItem, staff: OnShiftStaffMember) {
    setDraft({ pendingItem, staff });
    setLocation('');
    setPriority('normal');
    setInstructions('');
    setSubmitError(null);
  }

  function handleDropOnStaff(e: React.DragEvent, staff: OnShiftStaffMember) {
    e.preventDefault();
    setDraggedOverKey(null);
    const raw = e.dataTransfer.getData(PENDING_ITEM_MIME);
    if (!raw) return;
    openDraft(JSON.parse(raw) as PendingTaskItem, staff);
  }

  function handleDropOnPendingItem(e: React.DragEvent, pendingItem: PendingTaskItem) {
    e.preventDefault();
    setDraggedOverKey(null);
    const raw = e.dataTransfer.getData(STAFF_MIME);
    if (!raw) return;
    openDraft(pendingItem, JSON.parse(raw) as OnShiftStaffMember);
  }

  async function handleConfirm() {
    if (!draft) return;
    if (draft.pendingItem.type === 'put_away' && !location.trim()) {
      setSubmitError('Location is required to assign a put-away task.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (draft.pendingItem.type === 'put_away') {
        await assignPutAway(token!, {
          palletId: draft.pendingItem.palletId,
          assignedToUserId: draft.staff.userId,
          location: location.trim(),
          priority,
          instructions: instructions.trim() || undefined,
        });
      } else {
        await assignOrderPrep(token!, {
          sessionId: draft.pendingItem.sessionId,
          assignedToUserId: draft.staff.userId,
          role: draft.pendingItem.role,
          priority,
          instructions: instructions.trim() || undefined,
        });
      }
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ['task-board'] });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to assign task');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Task Board</h1>
      <p className="page-subtitle">Drag a pending task onto a staff member (or a staff member onto a task) to assign it.</p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <div className="task-board-columns">
          <div className="card task-board-column">
            <h2 style={{ margin: 0, marginBottom: 12 }}>Pending tasks ({pendingItems.length})</h2>
            {pendingItems.length === 0 && <p className="hint-text">Nothing waiting on assignment right now.</p>}
            {pendingItems.map((item) => {
              const key = pendingItemKey(item);
              return (
                <div
                  key={key}
                  className={`task-card${draggedOverKey === key ? ' task-card-drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(PENDING_ITEM_MIME, JSON.stringify(item))}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggedOverKey(key);
                  }}
                  onDragLeave={() => setDraggedOverKey((k) => (k === key ? null : k))}
                  onDrop={(e) => handleDropOnPendingItem(e, item)}
                >
                  {pendingItemLabel(item)}
                </div>
              );
            })}
          </div>

          <div className="card task-board-column">
            <h2 style={{ margin: 0, marginBottom: 12 }}>On-shift staff ({onShiftStaff.length})</h2>
            {onShiftStaff.length === 0 && <p className="hint-text">No staff currently on shift.</p>}
            {onShiftStaff.map((staff) => {
              const key = `staff:${staff.userId}`;
              return (
                <div
                  key={staff.userId}
                  className={`task-card${draggedOverKey === key ? ' task-card-drag-over' : ''}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(STAFF_MIME, JSON.stringify(staff))}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggedOverKey(key);
                  }}
                  onDragLeave={() => setDraggedOverKey((k) => (k === key ? null : k))}
                  onDrop={(e) => handleDropOnStaff(e, staff)}
                >
                  {staff.userName}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {draft && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setDraft(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>Assign to {draft.staff.userName}</h2>
              <button className="modal-close" onClick={() => setDraft(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="page-subtitle" style={{ margin: '0 0 16px' }}>{pendingItemLabel(draft.pendingItem)}</p>

            {draft.pendingItem.type === 'put_away' && (
              <div className="form-row">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Aisle 7, bay 3"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="form-row">
              <label className="form-label">Priority</label>
              <div className="chip-row">
                {TASK_PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn ${priority === p ? 'btn-primary' : 'btn-outline'}`}
                    style={priority === p ? undefined : { color: '#0f172a', borderColor: '#d1d5db' }}
                    onClick={() => setPriority(p)}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <label className="form-label">Instructions (optional)</label>
              <textarea
                rows={3}
                placeholder="Anything the assignee should know"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {submitError && <p className="error-text">{submitError}</p>}

            <div className="flex-row">
              <button className="btn btn-primary" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Assigning…' : 'Confirm assignment'}
              </button>
              <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => setDraft(null)} disabled={isSubmitting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
