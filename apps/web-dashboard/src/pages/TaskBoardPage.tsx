import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, Megaphone, Radio, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../core/api/client';
import { createDirective, DIRECTIVE_TYPE_LABELS, DIRECTIVE_TYPES, fetchAllDirectives } from '../core/api/directives';
import { createOpenPoolTask, fetchAllOpenPoolTasks } from '../core/api/openPool';
import {
  fetchTaskBoard,
  PRIORITY_LABELS,
  TASK_PRIORITIES,
  type OnShiftStaffMember,
  type TaskPriority,
} from '../core/api/tasks';
import { resolvePhotoUrl } from '../core/api/upload';
import { fetchStaffUsers } from '../core/api/users';
import { useAuth } from '../core/auth/AuthContext';
import { useStaffNames } from '../core/hooks/useStaffNames';
import { PhotoUploadField } from '../components/PhotoUploadField';

function PhotoThumbnailLink({ url }: { url: string }) {
  return (
    <a href={resolvePhotoUrl(url)} target="_blank" rel="noreferrer">
      <img src={resolvePhotoUrl(url)} alt="" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
    </a>
  );
}

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-base)',
  fontFamily: 'inherit',
  background: '#fff',
  color: 'var(--gray-950)',
};

/**
 * What's left on Task Board after the drag-and-drop pending-task
 * assignment board was removed entirely (customer: "Remove entirely" —
 * the only task type that ever needed admin instruction was seller-
 * stock deliveries with a condition problem, and that now has its own
 * dedicated rich section on Reception & Intake). This page is now just
 * the two push-style tools: urgent Directives and Open Pool tasks.
 */
export function TaskBoardPage() {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ['task-board'],
    queryFn: () => fetchTaskBoard(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const onShiftStaff = data?.onShiftStaff ?? [];

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-orange">
          <ClipboardList />
        </span>
        <div className="page-header-text">
          <h1>Task Board</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Push an urgent directive to staff, or publish a task for anyone on shift to claim.
          </p>
        </div>
      </div>

      <DirectivesSection onShiftStaff={onShiftStaff} highlightId={highlightId} />

      <OpenPoolSection highlightId={highlightId} />
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
  const [creationPhotoUrl, setCreationPhotoUrl] = useState<string | null>(null);
  const [creationComment, setCreationComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const staffName = useStaffNames();

  async function handlePush() {
    if (!message.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createDirective(token!, {
        targetUserId: targetUserId || undefined,
        type,
        message: message.trim(),
        creationPhotoUrl: creationPhotoUrl ?? undefined,
        creationComment: creationComment.trim() || undefined,
      });
      setMessage('');
      setCreationPhotoUrl(null);
      setCreationComment('');
      queryClient.invalidateQueries({ queryKey: ['directives'] });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to push directive');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 'var(--space-6)' }}>
      <div className="flex-row" style={{ marginBottom: 4 }}>
        <span className="icon-badge icon-badge-sm icon-badge-red">
          <Megaphone />
        </span>
        <h2 style={{ margin: 0 }}>Admin Directives</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
        Push an urgent demand to a specific on-shift staff member, or anyone available — they get a real-time alert with
        sound.
      </p>

      <div className="form-row">
        <label className="form-label">Target</label>
        <select style={SELECT_STYLE} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
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
      <PhotoUploadField label="Photo (optional)" value={creationPhotoUrl} onChange={setCreationPhotoUrl} />
      <div className="form-row">
        <label className="form-label">Comment (optional)</label>
        <textarea
          rows={2}
          value={creationComment}
          onChange={(e) => setCreationComment(e.target.value)}
          placeholder="Anything extra staff should see the moment they accept"
        />
      </div>
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePush} disabled={isSubmitting || !message.trim()}>
        <Send size={14} />
        {isSubmitting ? 'Sending…' : 'Send Alert to Staff'}
      </button>

      <div className="flex-row" style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
        <span className="icon-badge icon-badge-sm icon-badge-gray">
          <History />
        </span>
        <h2 style={{ margin: 0 }}>Directive status</h2>
      </div>
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
            <th>Completion photo</th>
            <th>Completion comment</th>
            <th>Done at</th>
            <th>Done by</th>
          </tr>
        </thead>
        <tbody>
          {directives?.length === 0 && (
            <tr>
              <td colSpan={9}>No directives pushed yet.</td>
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
              <td>{d.completionPhotoUrl ? <PhotoThumbnailLink url={d.completionPhotoUrl} /> : '—'}</td>
              <td>{d.completionComment ?? '—'}</td>
              <td>{d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : '—'}</td>
              <td>{staffName(d.receivedByUserId)}</td>
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

  const { data: staffUsers } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [targetUserId, setTargetUserId] = useState('');
  const [creationPhotoUrl, setCreationPhotoUrl] = useState<string | null>(null);
  const [creationComment, setCreationComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const staffName = useStaffNames();

  async function handlePublish() {
    if (!title.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createOpenPoolTask(token!, {
        title: title.trim(),
        targetUserId: targetUserId || undefined,
        description: description.trim() || undefined,
        priority,
        creationPhotoUrl: creationPhotoUrl ?? undefined,
        creationComment: creationComment.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setPriority('normal');
      setTargetUserId('');
      setCreationPhotoUrl(null);
      setCreationComment('');
      queryClient.invalidateQueries({ queryKey: ['open-pool-tasks'] });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to publish task');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 'var(--space-6)' }}>
      <div className="flex-row" style={{ marginBottom: 4 }}>
        <span className="icon-badge icon-badge-sm icon-badge-blue">
          <Radio />
        </span>
        <h2 style={{ margin: 0 }}>Open Pool Tasks</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
        Publish a task for any active staff member to claim — first to tap wins, no specific assignment needed.
      </p>

      <div className="form-row">
        <label className="form-label">Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Recount aisle 4" />
      </div>
      <div className="form-row">
        <label className="form-label">Target</label>
        <select style={SELECT_STYLE} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">Anyone available</option>
          {staffUsers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <PhotoUploadField label="Photo (optional)" value={creationPhotoUrl} onChange={setCreationPhotoUrl} />
      <div className="form-row">
        <label className="form-label">Comment (optional)</label>
        <textarea
          rows={2}
          value={creationComment}
          onChange={(e) => setCreationComment(e.target.value)}
          placeholder="Anything extra staff should see the moment they claim it"
        />
      </div>
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePublish} disabled={isSubmitting || !title.trim()}>
        <Send size={14} />
        {isSubmitting ? 'Publishing…' : 'Publish to Open Pool'}
      </button>

      <div className="flex-row" style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
        <span className="icon-badge icon-badge-sm icon-badge-gray">
          <History />
        </span>
        <h2 style={{ margin: 0 }}>Open Pool status</h2>
      </div>
      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Target</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Created</th>
            <th>Completion photo</th>
            <th>Completion comment</th>
            <th>Completed at</th>
            <th>Completed by</th>
          </tr>
        </thead>
        <tbody>
          {tasks?.length === 0 && (
            <tr>
              <td colSpan={10}>No open pool tasks yet.</td>
            </tr>
          )}
          {tasks?.map((t) => (
            <tr
              key={t.id}
              ref={t.id === highlightId ? highlightRef : undefined}
              className={t.id === highlightId ? 'highlight-row' : undefined}
            >
              <td>{t.title}</td>
              <td>{t.description ?? '—'}</td>
              <td>{t.targetUserId ? staffName(t.targetUserId) : 'Anyone'}</td>
              <td>{PRIORITY_LABELS[t.priority]}</td>
              <td>
                <span className={`pill ${STATUS_PILL_CLASS[t.status]}`}>{t.status}</span>
              </td>
              <td>{new Date(t.createdAt).toLocaleString()}</td>
              <td>{t.completionPhotoUrl ? <PhotoThumbnailLink url={t.completionPhotoUrl} /> : '—'}</td>
              <td>{t.completionComment ?? '—'}</td>
              <td>{t.completedAt ? new Date(t.completedAt).toLocaleString() : '—'}</td>
              <td>{staffName(t.claimedByUserId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
