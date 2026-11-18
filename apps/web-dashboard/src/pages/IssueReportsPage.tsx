import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Image, Megaphone, Radio, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type DirectivePrefill, type OpenPoolPrefill } from './TaskBoardPage';
import { ApiError } from '../core/api/client';
import {
  deleteIssueReport,
  fetchAllIssueReports,
  ISSUE_REPORT_CATEGORIES,
  markIssueReportSeen,
  type IssueReport,
} from '../core/api/issueReports';
import { resolvePhotoUrl } from '../core/api/upload';
import { useAuth } from '../core/auth/AuthContext';

/** Matches the filter-control style other admin list pages use (ReceptionsPage/SellerStockPage) — kept file-local, same as theirs. */
const filterControlStyle: React.CSSProperties = {
  appearance: 'none',
  background: '#fff',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  color: 'var(--gray-950)',
  width: 'auto',
};

/** Whichever of the category-specific fields this report actually has set, labeled for display. */
function detailFields(report: IssueReport, t: (key: string) => string): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (report.trackingId) fields.push({ label: t('fields.trackingId'), value: report.trackingId });
  if (report.orderNumber) fields.push({ label: t('fields.orderNumber'), value: report.orderNumber });
  if (report.errorNo) fields.push({ label: t('fields.errorNo'), value: report.errorNo });
  if (report.idNumber) fields.push({ label: t('fields.idNumber'), value: report.idNumber });
  if (report.locationId) fields.push({ label: t('fields.locationId'), value: report.locationId });
  return fields;
}

/** A short one-line summary of the report, reused as both the Directive message and the Open Pool task title. */
function summarize(report: IssueReport, categoryLabel: string, t: (key: string) => string): string {
  const details = detailFields(report, t)
    .map((f) => `${f.label}: ${f.value}`)
    .join(' · ');
  return [categoryLabel, details].filter(Boolean).join(' — ');
}

/**
 * Admin's review list for staff-raised Issue Reports (see
 * packages/backend/src/issue-reports — create + list only on the
 * backend before this page; "seen"/delete were added alongside it).
 * "Create task" doesn't call any issue-report-specific backend
 * endpoint — it just pre-fills Task Board's existing Directive/Open
 * Pool forms via navigation state and lets the admin edit before
 * sending, per the brief ("let admin edit and send it").
 */
export function IssueReportsPage() {
  const { t } = useTranslation('issueReports');
  const { t: tCommon } = useTranslation('common');
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ['issue-reports'],
    queryFn: () => fetchAllIssueReports(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const [categoryFilter, setCategoryFilter] = useState('');
  const [unseenOnly, setUnseenOnly] = useState(false);
  const [galleryReport, setGalleryReport] = useState<IssueReport | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [taskPickerReport, setTaskPickerReport] = useState<IssueReport | null>(null);
  const [markSeenPendingId, setMarkSeenPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reports = useMemo(() => {
    const list = (data ?? []).filter(
      (r) => (categoryFilter ? r.category === categoryFilter : true) && (unseenOnly ? !r.seenAt : true),
    );
    return [...list].sort((a, b) => {
      const aUnseen = a.seenAt ? 1 : 0;
      const bUnseen = b.seenAt ? 1 : 0;
      if (aUnseen !== bUnseen) return aUnseen - bUnseen;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data, categoryFilter, unseenOnly]);

  async function handleMarkSeen(id: string) {
    setMarkSeenPendingId(id);
    setActionError(null);
    try {
      await markIssueReportSeen(token!, id);
      queryClient.invalidateQueries({ queryKey: ['issue-reports'] });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('errors.markSeenFailed'));
    } finally {
      setMarkSeenPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('confirm.delete'))) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteIssueReport(token!, id);
      queryClient.invalidateQueries({ queryKey: ['issue-reports'] });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCreateTask(kind: 'directive' | 'openPool') {
    const report = taskPickerReport;
    if (!report) return;
    setTaskPickerReport(null);

    // Converting it to a task is a strong enough signal that it's been
    // handled — auto-mark it seen rather than making the admin do both.
    if (!report.seenAt) void handleMarkSeen(report.id);

    const categoryLabel = tCommon(`issueReportCategories.${report.category}`);
    const summary = summarize(report, categoryLabel, t);
    const creationPhotoUrl = report.photoUrls[0];
    const creationComment = report.comment ?? undefined;

    if (kind === 'directive') {
      const prefill: DirectivePrefill = { type: 'custom', message: summary, creationPhotoUrl, creationComment };
      navigate('/task-board', { state: { prefillDirective: prefill } });
    } else {
      const prefill: OpenPoolPrefill = { title: summary, description: report.comment ?? undefined, creationPhotoUrl, creationComment };
      navigate('/task-board', { state: { prefillOpenPool: prefill } });
    }
  }

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-red">
          <AlertTriangle />
        </span>
        <div className="page-header-text">
          <h1>{t('pageTitle')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {t('pageSubtitle')}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 14, gap: 10 }}>
          <select style={filterControlStyle} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">{t('filters.allCategories')}</option>
            {ISSUE_REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {tCommon(`issueReportCategories.${c}`)}
              </option>
            ))}
          </select>
          <label className="flex-row" style={{ alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={unseenOnly} onChange={(e) => setUnseenOnly(e.target.checked)} />
            {t('filters.unseenOnly')}
          </label>
        </div>

        {isPending && <p>{t('loading')}</p>}
        {error && <p className="error-text">{error.message}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        <table>
          <thead>
            <tr>
              <th>{t('table.category')}</th>
              <th>{t('table.reportedBy')}</th>
              <th>{t('table.when')}</th>
              <th>{t('table.details')}</th>
              <th>{t('table.photos')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr>
                <td colSpan={7}>{t('empty')}</td>
              </tr>
            )}
            {reports.map((report) => {
              const fields = detailFields(report, t);
              return (
                <tr key={report.id}>
                  <td>{tCommon(`issueReportCategories.${report.category}`)}</td>
                  <td>{report.userName}</td>
                  <td>{new Date(report.createdAt).toLocaleString()}</td>
                  <td>
                    {fields.map((f) => (
                      <div key={f.label} style={{ fontSize: 13 }}>
                        <strong>{f.label}:</strong> {f.value}
                      </div>
                    ))}
                    {report.comment && <div style={{ fontSize: 13, marginTop: fields.length > 0 ? 4 : 0 }}>{report.comment}</div>}
                    {report.contextLabel && (
                      <div className="hint-text" style={{ fontSize: 12, marginTop: 4 }}>
                        {t('fields.context')}: {report.contextLabel}
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-danger-text"
                      style={{ color: 'var(--gray-950)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setGalleryReport(report)}
                      disabled={report.photoUrls.length === 0}
                    >
                      <Image size={13} />
                      {report.photoUrls.length}
                    </button>
                  </td>
                  <td>
                    {report.seenAt ? (
                      <span className="pill pill-green">{t('status.seenBy', { name: report.seenByName })}</span>
                    ) : (
                      <span className="pill pill-red">{t('status.unseen')}</span>
                    )}
                  </td>
                  <td>
                    <div className="flex-row">
                      {!report.seenAt && (
                        <button
                          className="btn-danger-text"
                          style={{ color: 'var(--gray-950)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleMarkSeen(report.id)}
                          disabled={markSeenPendingId === report.id}
                        >
                          <Check size={13} />
                          {t('actions.markSeen')}
                        </button>
                      )}
                      <button
                        className="btn-danger-text"
                        style={{ color: 'var(--gray-950)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setTaskPickerReport(report)}
                      >
                        <Send size={13} />
                        {t('actions.createTask')}
                      </button>
                      <button
                        className="btn-danger-text"
                        style={{ color: '#dc2626', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleDelete(report.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 size={13} />
                        {t('actions.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {galleryReport && (
        <div className="modal-overlay" onClick={() => setGalleryReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{t('gallery.title')}</h2>
              <button className="modal-close" onClick={() => setGalleryReport(null)} aria-label={t('gallery.close')}>
                ✕
              </button>
            </div>
            {galleryReport.photoUrls.length === 0 ? (
              <p className="hint-text">{t('gallery.noPhotos')}</p>
            ) : (
              <div className="photo-grid">
                {galleryReport.photoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={resolvePhotoUrl(url)}
                    alt=""
                    className="photo-thumb"
                    onClick={() => setLightboxUrl(resolvePhotoUrl(url))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="lightbox-img" />
        </div>
      )}

      {taskPickerReport && (
        <div className="modal-overlay" onClick={() => setTaskPickerReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>{t('taskPicker.title')}</h2>
              <button className="modal-close" onClick={() => setTaskPickerReport(null)} aria-label={t('taskPicker.cancel')}>
                ✕
              </button>
            </div>
            <p className="page-subtitle">{t('taskPicker.subtitle')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
              <button className="btn btn-accent" onClick={() => handleCreateTask('directive')}>
                <Megaphone size={14} />
                {t('taskPicker.directive')}
              </button>
              <p className="hint-text" style={{ margin: '4px 0 12px' }}>
                {t('taskPicker.directiveHint')}
              </p>
              <button className="btn btn-accent" onClick={() => handleCreateTask('openPool')}>
                <Radio size={14} />
                {t('taskPicker.openPool')}
              </button>
              <p className="hint-text" style={{ margin: '4px 0 0' }}>
                {t('taskPicker.openPoolHint')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
