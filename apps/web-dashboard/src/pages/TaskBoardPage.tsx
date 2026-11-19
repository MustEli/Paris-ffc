import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, Megaphone, Radio, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../core/api/client';
import { createDirective, DIRECTIVE_TYPES, type DirectiveType, fetchAllDirectives } from '../core/api/directives';
import { createOpenPoolTask, fetchAllOpenPoolTasks } from '../core/api/openPool';
import {
  fetchTaskBoard,
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

/** How IssueReportsPage's "Create task" action pre-fills this page's Directive form — see its taskPicker flow. */
export interface DirectivePrefill {
  type: DirectiveType;
  message: string;
  creationPhotoUrl?: string;
  creationComment?: string;
}

/** Same idea as DirectivePrefill, for the Open Pool form. */
export interface OpenPoolPrefill {
  title: string;
  description?: string;
  creationPhotoUrl?: string;
  creationComment?: string;
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
  const { t } = useTranslation('taskBoard');
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ['task-board'],
    queryFn: () => fetchTaskBoard(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');

  // IssueReportsPage's "Create task" action lands here with a pre-fill
  // for one of the two forms below, passed via navigation state rather
  // than a query param since it carries free text/photo URLs, not just
  // an id. Cleared from history right after reading it once, so
  // reloading or navigating back here later doesn't re-apply it.
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { prefillDirective?: DirectivePrefill; prefillOpenPool?: OpenPoolPrefill } | null;
  const prefillDirective = state?.prefillDirective;
  const prefillOpenPool = state?.prefillOpenPool;
  useEffect(() => {
    if (prefillDirective || prefillOpenPool) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // Only ever meant to run once, right after landing with a pre-fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onShiftStaff = data?.onShiftStaff ?? [];

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-orange">
          <ClipboardList />
        </span>
        <div className="page-header-text">
          <h1>{t('pageTitle')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {t('pageSubtitle')}
          </p>
        </div>
      </div>

      <DirectivesSection onShiftStaff={onShiftStaff} highlightId={highlightId} prefill={prefillDirective} />

      <OpenPoolSection highlightId={highlightId} prefill={prefillOpenPool} />
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
  prefill,
}: {
  onShiftStaff: OnShiftStaffMember[];
  highlightId: string | null;
  prefill?: DirectivePrefill;
}) {
  const { t } = useTranslation('taskBoard');
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

  // Arrived here from IssueReportsPage's "Create task" action — fill
  // the form in and draw the eye to it, but still require the admin to
  // review/edit and press Send themselves (nothing auto-submits).
  const sectionRef = useRef<HTMLDivElement>(null);
  const [justPrefilled, setJustPrefilled] = useState(false);
  useEffect(() => {
    if (!prefill) return;
    setType(prefill.type);
    setMessage(prefill.message);
    setCreationPhotoUrl(prefill.creationPhotoUrl ?? null);
    setCreationComment(prefill.creationComment ?? '');
    setJustPrefilled(true);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => setJustPrefilled(false), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

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
      setSubmitError(err instanceof ApiError ? err.message : t('directives.failedToPush'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div ref={sectionRef} className={`card${justPrefilled ? ' highlight-row' : ''}`} style={{ marginTop: 'var(--space-6)' }}>
      <div className="flex-row" style={{ marginBottom: 4 }}>
        <span className="icon-badge icon-badge-sm icon-badge-red">
          <Megaphone />
        </span>
        <h2 style={{ margin: 0 }}>{t('directives.heading')}</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
        {t('directives.description')}
      </p>

      <div className="form-row">
        <label className="form-label">{t('directives.targetLabel')}</label>
        <select style={SELECT_STYLE} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">{t('directives.anyoneAvailable')}</option>
          {onShiftStaff.map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.userName}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">{t('directives.typeLabel')}</label>
        <div className="chip-row">
          {DIRECTIVE_TYPES.map((directiveType) => (
            <button
              key={directiveType}
              type="button"
              className={`btn ${type === directiveType ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setType(directiveType)}
            >
              {t(`directiveTypes.${directiveType}`, { ns: 'common' })}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label className="form-label">{t('directives.messageLabel')}</label>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('directives.messagePlaceholder')}
        />
      </div>
      <PhotoUploadField label={t('directives.photoLabel')} value={creationPhotoUrl} onChange={setCreationPhotoUrl} />
      <div className="form-row">
        <label className="form-label">{t('directives.commentLabel')}</label>
        <textarea
          rows={2}
          value={creationComment}
          onChange={(e) => setCreationComment(e.target.value)}
          placeholder={t('directives.commentPlaceholder')}
        />
      </div>
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePush} disabled={isSubmitting || !message.trim()}>
        <Send size={14} />
        {isSubmitting ? t('directives.sending') : t('directives.sendAlert')}
      </button>

      <div className="flex-row" style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
        <span className="icon-badge icon-badge-sm icon-badge-gray">
          <History />
        </span>
        <h2 style={{ margin: 0 }}>{t('directives.statusHeading')}</h2>
      </div>
      {isPending && <p>{t('directives.loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>{t('directives.table.type')}</th>
            <th>{t('directives.table.message')}</th>
            <th>{t('directives.table.target')}</th>
            <th>{t('directives.table.status')}</th>
            <th>{t('directives.table.pushed')}</th>
            <th>{t('directives.table.completionPhoto')}</th>
            <th>{t('directives.table.completionComment')}</th>
            <th>{t('directives.table.doneAt')}</th>
            <th>{t('directives.table.doneBy')}</th>
          </tr>
        </thead>
        <tbody>
          {directives?.length === 0 && (
            <tr>
              <td colSpan={9}>{t('directives.empty')}</td>
            </tr>
          )}
          {directives?.map((d) => (
            <tr
              key={d.id}
              ref={d.id === highlightId ? highlightRef : undefined}
              className={d.id === highlightId ? 'highlight-row' : undefined}
            >
              <td>{t(`directiveTypes.${d.type}`, { ns: 'common' })}</td>
              <td>{d.message}</td>
              <td className="staff-name-cell">
                {d.targetUserId
                  ? onShiftStaff.find((s) => s.userId === d.targetUserId)?.userName ?? d.targetUserId
                  : t('directives.anyone')}
              </td>
              <td>
                <span className={`pill ${STATUS_PILL_CLASS[d.status]}`}>{t(`status.${d.status}`)}</span>
              </td>
              <td>{new Date(d.pushedAt).toLocaleString()}</td>
              <td>{d.completionPhotoUrl ? <PhotoThumbnailLink url={d.completionPhotoUrl} /> : '—'}</td>
              <td>{d.completionComment ?? '—'}</td>
              <td>{d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : '—'}</td>
              <td className="staff-name-cell">{staffName(d.receivedByUserId)}</td>
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
function OpenPoolSection({ highlightId, prefill }: { highlightId: string | null; prefill?: OpenPoolPrefill }) {
  const { t } = useTranslation('taskBoard');
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

  // See DirectivesSection's matching effect — same IssueReportsPage origin.
  const sectionRef = useRef<HTMLDivElement>(null);
  const [justPrefilled, setJustPrefilled] = useState(false);
  useEffect(() => {
    if (!prefill) return;
    setTitle(prefill.title);
    setDescription(prefill.description ?? '');
    setCreationPhotoUrl(prefill.creationPhotoUrl ?? null);
    setCreationComment(prefill.creationComment ?? '');
    setJustPrefilled(true);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = setTimeout(() => setJustPrefilled(false), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

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
      setSubmitError(err instanceof ApiError ? err.message : t('openPool.failedToPublish'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div ref={sectionRef} className={`card${justPrefilled ? ' highlight-row' : ''}`} style={{ marginTop: 'var(--space-6)' }}>
      <div className="flex-row" style={{ marginBottom: 4 }}>
        <span className="icon-badge icon-badge-sm icon-badge-blue">
          <Radio />
        </span>
        <h2 style={{ margin: 0 }}>{t('openPool.heading')}</h2>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 'var(--space-4)' }}>
        {t('openPool.description')}
      </p>

      <div className="form-row">
        <label className="form-label">{t('openPool.titleLabel')}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('openPool.titlePlaceholder')}
        />
      </div>
      <div className="form-row">
        <label className="form-label">{t('openPool.targetLabel')}</label>
        <select style={SELECT_STYLE} value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
          <option value="">{t('openPool.anyoneAvailable')}</option>
          {staffUsers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label className="form-label">{t('openPool.descriptionLabel')}</label>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-row">
        <label className="form-label">{t('openPool.priorityLabel')}</label>
        <div className="chip-row">
          {TASK_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn ${priority === p ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPriority(p)}
            >
              {t(`priority.${p}`, { ns: 'common' })}
            </button>
          ))}
        </div>
      </div>
      <PhotoUploadField label={t('openPool.photoLabel')} value={creationPhotoUrl} onChange={setCreationPhotoUrl} />
      <div className="form-row">
        <label className="form-label">{t('openPool.commentLabel')}</label>
        <textarea
          rows={2}
          value={creationComment}
          onChange={(e) => setCreationComment(e.target.value)}
          placeholder={t('openPool.commentPlaceholder')}
        />
      </div>
      {submitError && <p className="error-text">{submitError}</p>}
      <button className="btn btn-accent" onClick={handlePublish} disabled={isSubmitting || !title.trim()}>
        <Send size={14} />
        {isSubmitting ? t('openPool.publishing') : t('openPool.publish')}
      </button>

      <div className="flex-row" style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
        <span className="icon-badge icon-badge-sm icon-badge-gray">
          <History />
        </span>
        <h2 style={{ margin: 0 }}>{t('openPool.statusHeading')}</h2>
      </div>
      {isPending && <p>{t('openPool.loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>{t('openPool.table.title')}</th>
            <th>{t('openPool.table.description')}</th>
            <th>{t('openPool.table.target')}</th>
            <th>{t('openPool.table.priority')}</th>
            <th>{t('openPool.table.status')}</th>
            <th>{t('openPool.table.created')}</th>
            <th>{t('openPool.table.completionPhoto')}</th>
            <th>{t('openPool.table.completionComment')}</th>
            <th>{t('openPool.table.completedAt')}</th>
            <th>{t('openPool.table.completedBy')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks?.length === 0 && (
            <tr>
              <td colSpan={10}>{t('openPool.empty')}</td>
            </tr>
          )}
          {tasks?.map((task) => (
            <tr
              key={task.id}
              ref={task.id === highlightId ? highlightRef : undefined}
              className={task.id === highlightId ? 'highlight-row' : undefined}
            >
              <td>{task.title}</td>
              <td>{task.description ?? '—'}</td>
              <td className="staff-name-cell">{task.targetUserId ? staffName(task.targetUserId) : t('openPool.anyone')}</td>
              <td>{t(`priority.${task.priority}`, { ns: 'common' })}</td>
              <td>
                <span className={`pill ${STATUS_PILL_CLASS[task.status]}`}>{t(`status.${task.status}`)}</span>
              </td>
              <td>{new Date(task.createdAt).toLocaleString()}</td>
              <td>{task.completionPhotoUrl ? <PhotoThumbnailLink url={task.completionPhotoUrl} /> : '—'}</td>
              <td>{task.completionComment ?? '—'}</td>
              <td>{task.completedAt ? new Date(task.completedAt).toLocaleString() : '—'}</td>
              <td className="staff-name-cell">{staffName(task.claimedByUserId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
