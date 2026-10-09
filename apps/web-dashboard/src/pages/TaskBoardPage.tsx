import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../core/api/client';
import { createDirective, DIRECTIVE_TYPE_LABELS, DIRECTIVE_TYPES, fetchAllDirectives } from '../core/api/directives';
import { createOpenPoolTask, fetchAllOpenPoolTasks } from '../core/api/openPool';
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

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

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

      <DirectivesSection onShiftStaff={onShiftStaff} highlightId={highlightId} />

      <OpenPoolSection highlightId={highlightId} />

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

const STATUS_PILL_CLASS: Record<string, string> = {
  open: 'pill-gray',
  claimed: 'pill-amber',
  completed: 'pill-green',
  pushed: 'pill-gray',
  in_progress: 'pill-amber',
  resolved: 'pill-green',
};

/**
 * Admin to Staff doc: an urgent, real-time push to one staff member or
 * "anyone available." Deliberately does not model a hard pause of the
 * target's current activity — see the backend's Directive doc comment.
 */
function DirectivesSection({
  onShiftStaff,
  highlightId,
}: {
  onShiftStaff: OnShiftStaffMember[];
  highlightId: string | null;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: directives, isPending, error } = useQuery({
    queryKey: ['directives'],
    queryFn: () => fetchAllDirectives(token!),
    enabled: !!token,
    refetchInterval: 10_000,
  });

  const highlightRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, directives]);

  const [targetUserId, setTargetUserId] = useState<string>(''); // '' means "anyone available"
  const [type, setType] = useState<(typeof DIRECTIVE_TYPES)[number]>('verify_location');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handlePush() {
    if (!message.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createDirective(token!, { targetUserId: targetUserId || undefined, type, message: message.trim() });
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['directives'] });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to push directive');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Admin Directives</h2>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Push an urgent demand to a specific on-shift staff member, or anyone available — they get a real-time alert with
        sound.
      </p>

      <div className="form-row">
        <label className="form-label">Target</label>
        <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">Anyone available</option>
          {onShiftStaff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.userName}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">Directive type</label>
        <div className="chip-row">
          {DIRECTIVE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`btn ${type === t ? 'btn-primary' : 'btn-outline'}`}
              style={type === t ? undefined : { color: '#0f172a', borderColor: '#d1d5db' }}
              onClick={() => setType(t)}
            >
              {DIRECTIVE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">Message</label>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Upload photo of missing item at Aisle 4B Rack 3 immediately"
        />
      </div>
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePush} disabled={isSubmitting || !message.trim()}>
        {isSubmitting ? 'Sending…' : 'Send Alert to Staff'}
      </button>

      <h2 style={{ marginTop: 24 }}>Directive status</h2>
      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Message</th>
            <th>Target</th>
            <th>Status</th>
            <th>Pushed</th>
          </tr>
        </thead>
        <tbody>
          {directives?.length === 0 && (
            <tr>
              <td colSpan={5}>No directives pushed yet.</td>
            </tr>
          )}
          {directives?.map((d) => (
            <tr
              key={d.id}
              ref={d.id === highlightId ? highlightRef : undefined}
              className={d.id === highlightId ? 'highlight-row' : undefined}
            >
              <td>{DIRECTIVE_TYPE_LABELS[d.type]}</td>
              <td>{d.message}</td>
              <td>{d.targetUserId ? onShiftStaff.find((s) => s.userId === d.targetUserId)?.userName ?? d.targetUserId : 'Anyone'}</td>
              <td>
                <span className={`pill ${STATUS_PILL_CLASS[d.status]}`}>{d.status}</span>
              </td>
              <td>{new Date(d.pushedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Open Pool Tasks doc: a task with no specific assignee — any active
 * staff member can claim it. Deliberately separate from the drag-drop
 * board above, since it's not "assign this pending item to that
 * person" — it's "publish this for whoever gets there first."
 */
function OpenPoolSection({ highlightId }: { highlightId: string | null }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: tasks, isPending, error } = useQuery({
    queryKey: ['open-pool-tasks'],
    queryFn: () => fetchAllOpenPoolTasks(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const highlightRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, tasks]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handlePublish() {
    if (!title.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createOpenPoolTask(token!, { title: title.trim(), description: description.trim() || undefined, priority });
      setTitle('');
      setDescription('');
      setPriority('normal');
      queryClient.invalidateQueries({ queryKey: ['open-pool-tasks'] });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to publish task');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Open Pool Tasks</h2>
      <p className="page-subtitle" style={{ marginBottom: 16 }}>
        Publish a task for any active staff member to claim — first to tap wins, no specific assignment needed.
      </p>

      <div className="form-row">
        <label className="form-label">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Recount aisle 4" />
      </div>
      <div className="form-row">
        <label className="form-label">Description (optional)</label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
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
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePublish} disabled={isSubmitting || !title.trim()}>
        {isSubmitting ? 'Publishing…' : 'Publish to Open Pool'}
      </button>

      <h2 style={{ marginTop: 24 }}>Open Pool status</h2>
      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks?.length === 0 && (
            <tr>
              <td colSpan={4}>No open pool tasks yet.</td>
            </tr>
          )}
          {tasks?.map((t) => (
            <tr
              key={t.id}
              ref={t.id === highlightId ? highlightRef : undefined}
              className={t.id === highlightId ? 'highlight-row' : undefined}
            >
              <td>{t.title}</td>
              <td>{PRIORITY_LABELS[t.priority]}</td>
              <td>
                <span className={`pill ${STATUS_PILL_CLASS[t.status]}`}>{t.status}</span>
              </td>
              <td>{new Date(t.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
