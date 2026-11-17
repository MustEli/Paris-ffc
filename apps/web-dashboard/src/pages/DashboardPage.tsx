import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import {
  fetchAdminDashboard,
  fetchStaffActivity,
  fetchStaffHistory,
  type AdminDashboardReport,
  type StaffActivityEntry,
  type StaffHistoryDay,
  type StaffHistoryReport,
} from '../core/api/reports';
import { useAuth } from '../core/auth/AuthContext';

function elapsedSince(iso: string): string {
  const totalSeconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** `ms` may be negative for lunch (no real cap — see LUNCH_BREAK_SUGGESTED_DURATION_MS on the backend). */
function formatMinutesSeconds(ms: number): string {
  const totalSeconds = Math.round(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDayHeader(day: string): string {
  // "YYYY-MM-DD" -> "Nov 1" — parsed as UTC (the "Txx" suffix) so it doesn't shift a day depending on the viewer's timezone.
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatHours(hours: number): string {
  return `${hours}h`;
}

const STAFF_HISTORY_CATEGORY_COLUMNS: { key: keyof StaffHistoryDay; labelKey: string }[] = [
  { key: 'plannedHours', labelKey: 'staffHistory.columns.planned' },
  { key: 'floorTaskHours', labelKey: 'staffHistory.columns.floorTask' },
  { key: 'receptionHours', labelKey: 'staffHistory.columns.reception' },
  { key: 'openPoolHours', labelKey: 'staffHistory.columns.openPool' },
  { key: 'urgentTaskHours', labelKey: 'staffHistory.columns.urgentTask' },
  { key: 'actualHours', labelKey: 'staffHistory.columns.actual' },
];

function downloadStaffHistory(report: StaffHistoryReport, t: TFunction<'dashboard'>) {
  const orderedDays = [...report.days].reverse();
  const header: string[] = [t('staffHistory.staffColumn')];
  for (const day of orderedDays) {
    for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
      header.push(`${day} ${t(col.labelKey)} (h)`);
    }
  }
  for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
    header.push(`${t('staffHistory.cumulative')} ${t(col.labelKey)} (h)`);
  }

  const rows: (string | number)[][] = report.staff.map((staffRow) => {
    const row: (string | number)[] = [staffRow.userName];
    for (const day of orderedDays) {
      const entry = staffRow.days[day] ?? { plannedHours: 0, actualHours: 0, floorTaskHours: 0, receptionHours: 0, openPoolHours: 0, urgentTaskHours: 0 };
      for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
        row.push(entry[col.key]);
      }
    }
    for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
      row.push(staffRow.cumulative[col.key]);
    }
    return row;
  });

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, t('staffHistory.heading'));
  XLSX.writeFile(book, `elno-staff-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function breakLabel(staff: AdminDashboardReport['staff'][number], t: TFunction<'dashboard'>): string {
  if (staff.breakType === 'short') {
    const remaining = staff.shortBreakRemainingMs ?? 0;
    return t('staffTable.shortBreakRemaining', { time: formatMinutesSeconds(Math.max(0, remaining)) });
  }
  if (staff.breakType === 'lunch') {
    const remaining = staff.lunchBreakRemainingMs ?? 0;
    return remaining >= 0
      ? t('staffTable.lunchBreakRemaining', { time: formatMinutesSeconds(remaining) })
      : t('staffTable.lunchBreakOver', { time: formatMinutesSeconds(remaining) });
  }
  return t('staffTable.onBreak');
}

/**
 * Same underlying GET /reports/admin-dashboard the mobile Admin
 * dashboard uses — this is the one screen in this app that's
 * deliberately a rough mirror of mobile, since "what's happening right
 * now" is exactly as useful from a desk as from a phone. Everything
 * else in this app (reference lists, bulk instructions, bulk photo
 * download) has no mobile equivalent at all.
 */
export function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { token } = useAuth();
  const { data, isPending, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => fetchAdminDashboard(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, data]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-orange">
          <LayoutDashboard />
        </span>
        <div className="page-header-text">
          <h1>{t('title')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {today}
          </p>
        </div>
      </div>

      {isPending && <p>{t('loading')}</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <>
          <div className="section-toolbar">
            <h2 style={{ margin: 0 }}>{t('currentStatus.heading')}</h2>
            <button className="btn btn-outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw size={14} className={isRefetching ? 'spin' : undefined} />
              {isRefetching ? t('currentStatus.refreshing') : t('currentStatus.refresh')}
            </button>
          </div>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="icon-badge icon-badge-blue">
                  <Users />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('currentStatus.staffOnShift')}</div>
                  <div className="stat-tile-value">
                    {data.liveSummary.staffOnShiftCount} / {data.liveSummary.totalStaffCount}
                  </div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-red">
                  <PackageSearch />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('currentStatus.palletsPendingReview')}</div>
                  <div className="stat-tile-value">{data.liveSummary.palletsPendingReviewCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-purple">
                  <Boxes />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('currentStatus.openPutAwayTasks')}</div>
                  <div className="stat-tile-value">{data.liveSummary.openPutAwayTaskCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-green">
                  <ShoppingCart />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('currentStatus.activeOrderPrepSessions')}</div>
                  <div className="stat-tile-value">{data.liveSummary.activeOrderPrepSessionCount}</div>
                </div>
              </div>
            </div>
          </div>

          <h2>{t('today.heading')}</h2>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="icon-badge icon-badge-blue">
                  <Truck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('today.receptionsLogged')}</div>
                  <div className="stat-tile-value">{data.today.receptionsLoggedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-green">
                  <CheckCircle2 />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('today.receptionsCompleted')}</div>
                  <div className="stat-tile-value">{data.today.receptionsCompletedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-orange">
                  <PackageCheck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('today.palletsLogged')}</div>
                  <div className="stat-tile-value">{data.today.palletsLoggedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-purple">
                  <ClipboardCheck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">{t('today.putAwayCompleted')}</div>
                  <div className="stat-tile-value">{data.today.putAwayCompletedCount}</div>
                </div>
              </div>
            </div>
          </div>

          <StaffActivitySection highlightId={highlightId} highlightRef={highlightRef} />

          <div className="flex-row" style={{ marginBottom: 12 }}>
            <span className="icon-badge icon-badge-sm icon-badge-blue">
              <Users />
            </span>
            <h2 style={{ margin: 0 }}>{t('staffTable.heading')}</h2>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>{t('staffTable.name')}</th>
                  <th>{t('staffTable.status')}</th>
                  <th>{t('staffTable.shiftsToday')}</th>
                  <th>{t('staffTable.hoursWorkedToday')}</th>
                  <th>{t('staffTable.putAwayDone')}</th>
                  <th>{t('staffTable.orderPrepDone')}</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.length === 0 && (
                  <tr>
                    <td colSpan={6}>{t('staffTable.noStaffAccounts')}</td>
                  </tr>
                )}
                {data.staff.map((s) => (
                  <tr
                    key={s.userId}
                    ref={s.userId === highlightId ? highlightRef : undefined}
                    className={s.userId === highlightId ? 'highlight-row' : undefined}
                  >
                    <td>{s.userName}</td>
                    <td>
                      {s.onShift ? (
                        <span className="pill pill-green">
                          {s.shiftStartedAt
                            ? t('staffTable.onShiftSince', { time: formatLocalTime(s.shiftStartedAt) })
                            : t('staffTable.onShift')}
                        </span>
                      ) : (
                        <span className="pill pill-gray">{t('staffTable.offShift')}</span>
                      )}
                      {s.onBreak && (
                        <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                          {breakLabel(s, t)}
                        </span>
                      )}
                    </td>
                    <td>{s.shiftsToday}</td>
                    <td>{s.hoursWorkedToday}</td>
                    <td>{s.putAwayCompletedToday}</td>
                    <td>{s.orderPrepCompletedToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <StaffHistorySection />
        </>
      )}
    </div>
  );
}

/** Reusable 6-sub-column group header + body cells, shared by every day-group and the final Cumulative group. */
function StaffHistoryGroupHeader({ title }: { title: string }) {
  return (
    <th colSpan={STAFF_HISTORY_CATEGORY_COLUMNS.length} style={{ textAlign: 'center', borderLeft: '1px solid var(--gray-150)' }}>
      {title}
    </th>
  );
}

function StaffHistorySubHeaderRow({ groupCount, t }: { groupCount: number; t: TFunction<'dashboard'> }) {
  return (
    <tr>
      <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }} />
      {Array.from({ length: groupCount }).map((_, groupIndex) =>
        STAFF_HISTORY_CATEGORY_COLUMNS.map((col, i) => (
          <th
            key={`${groupIndex}-${col.key}`}
            style={{ textAlign: 'center', fontSize: 11, fontWeight: 'var(--weight-regular)', color: 'var(--gray-500)', minWidth: 64, borderLeft: i === 0 ? '1px solid var(--gray-150)' : undefined }}
          >
            {t(col.labelKey)}
          </th>
        )),
      )}
    </tr>
  );
}

function StaffHistoryCells({ entry }: { entry: StaffHistoryDay }) {
  return (
    <>
      {STAFF_HISTORY_CATEGORY_COLUMNS.map((col, i) => (
        <td key={col.key} style={{ textAlign: 'center', fontSize: 'var(--text-xs)', borderLeft: i === 0 ? '1px solid var(--gray-100)' : undefined }}>
          {formatHours(entry[col.key])}
        </td>
      ))}
    </>
  );
}

const EMPTY_DAY: StaffHistoryDay = { plannedHours: 0, actualHours: 0, floorTaskHours: 0, receptionHours: 0, openPoolHours: 0, urgentTaskHours: 0 };

/**
 * Today-first (admin scrolls right/left to see older days — a plain
 * reverse of the backend's ascending order), each day broken down by
 * category (Floor Task / Reception / Open Pool / Urgent Task), plus a
 * final Cumulative group summing every day since the app's first-ever
 * completed shift. No ratio/percentage column — dropped per customer
 * request. See ReportsService.staffHistory() for how each number's
 * computed.
 */
function StaffHistorySection() {
  const { t } = useTranslation('dashboard');
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['staff-history'],
    queryFn: () => fetchStaffHistory(token!),
    enabled: !!token,
  });

  // Ascending (oldest -> today), matching the backend's own order —
  // Cumulative is pinned right after the sticky Staff column (a
  // running total, not part of the day timeline) and the day-by-day
  // breakdown scrolls oldest-to-newest ending with Today as the
  // rightmost group, which is also where the view defaults to (see the
  // scroll effect below) so Today's columns are visible without the
  // admin needing to notice there's more to scroll to.
  const orderedDays = data ? data.days : [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  return (
    <>
      <div className="section-toolbar">
        <div className="flex-row">
          <span className="icon-badge icon-badge-sm icon-badge-purple">
            <ClipboardCheck />
          </span>
          <h2 style={{ margin: 0 }}>{t('staffHistory.heading')}</h2>
        </div>
        <button className="btn btn-outline" onClick={() => data && downloadStaffHistory(data, t)} disabled={!data || data.days.length === 0}>
          <Download size={14} />
          {t('staffHistory.download')}
        </button>
      </div>
      <div className="card">
        {isPending && <p>{t('staffHistory.loading')}</p>}
        {error && <p className="error-text">{error.message}</p>}
        {data && data.days.length === 0 && <p className="hint-text">{t('staffHistory.noShiftsYet')}</p>}
        {data && data.days.length > 0 && (
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, verticalAlign: 'bottom' }}>
                    {t('staffHistory.staffColumn')}
                  </th>
                  <StaffHistoryGroupHeader title={t('staffHistory.cumulative')} />
                  {orderedDays.map((day, i) => (
                    <StaffHistoryGroupHeader
                      key={day}
                      title={
                        i === orderedDays.length - 1
                          ? t('staffHistory.todaySuffix', { day: formatDayHeader(day) })
                          : formatDayHeader(day)
                      }
                    />
                  ))}
                </tr>
                <StaffHistorySubHeaderRow groupCount={orderedDays.length + 1} t={t} />
              </thead>
              <tbody>
                {data.staff.map((staffRow) => (
                  <tr key={staffRow.userId}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 'var(--weight-strong)' }}>{staffRow.userName}</td>
                    <StaffHistoryCells entry={staffRow.cumulative} />
                    {orderedDays.map((day) => (
                      <StaffHistoryCells key={day} entry={staffRow.days[day] ?? EMPTY_DAY} />
                    ))}
                  </tr>
                ))}
                {data.staff.length === 0 && (
                  <tr>
                    <td colSpan={(orderedDays.length + 1) * STAFF_HISTORY_CATEGORY_COLUMNS.length + 1}>{t('staffHistory.noStaffAccounts')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const STAFF_ACTIVITY_TYPE_KEYS: Record<StaffActivityEntry['type'], string> = {
  floor_task: 'staffActivity.types.floorTask',
  reception: 'staffActivity.types.reception',
  open_pool: 'staffActivity.types.openPool',
  directive: 'staffActivity.types.directive',
};

function staffActivityDetail(entry: StaffActivityEntry, t: TFunction<'dashboard'>): string {
  switch (entry.type) {
    case 'floor_task': {
      const label = entry.floorTaskCategory ? t(`floorTaskCategories.${entry.floorTaskCategory}`, { ns: 'common' }) : '—';
      if (entry.scannedBarcode === undefined) return label;
      return entry.scannedBarcode
        ? `${label} ${t('staffActivity.scannedSuffix', { barcode: entry.scannedBarcode })}`
        : `${label} ${t('staffActivity.notYetScanned')}`;
    }
    case 'reception':
      return entry.receptionOutcome === 'unfinished' ? t('staffActivity.receptionNoDelivery') : t('staffActivity.reception');
    case 'open_pool':
      return entry.openPoolTitle ?? '—';
    case 'directive':
      return entry.directiveType ? t(`directiveTypes.${entry.directiveType}`, { ns: 'common', defaultValue: entry.directiveType }) : '—';
  }
}

function formatDurationMs(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Merges the 4 "someone is doing something" sources (Floor Task, the
 * Reception timer, a claimed Open Pool task, an acknowledged Directive)
 * that used to only ever show Floor Tasks — see
 * packages/backend/src/reports/reports.types.ts's StaffActivityEntry
 * doc comment. "Recent" is also the only place a completed Dispatch
 * Floor Task's scanned barcode becomes visible, since it drops out of
 * "Live" the instant it ends.
 */
function StaffActivitySection({
  highlightId,
  highlightRef,
}: {
  highlightId: string | null;
  highlightRef: React.RefObject<HTMLTableRowElement | null>;
}) {
  const { t } = useTranslation('dashboard');
  const { token } = useAuth();
  const [scope, setScope] = useState<'live' | 'recent'>('live');
  const { data, isPending, error } = useQuery({
    queryKey: ['staff-activity', scope],
    queryFn: () => fetchStaffActivity(token!, scope),
    enabled: !!token,
    refetchInterval: scope === 'live' ? 15_000 : false,
  });

  return (
    <>
      <div className="section-toolbar">
        <div className="flex-row">
          <span className="icon-badge icon-badge-sm icon-badge-orange">
            <Activity />
          </span>
          <h2 style={{ margin: 0 }}>{t('staffActivity.heading')}</h2>
        </div>
        <div className="tab-group">
          <button className={`tab-btn ${scope === 'live' ? 'tab-btn-active' : ''}`} onClick={() => setScope('live')}>
            {t('staffActivity.live')}
          </button>
          <button className={`tab-btn ${scope === 'recent' ? 'tab-btn-active' : ''}`} onClick={() => setScope('recent')}>
            {t('staffActivity.recent')}
          </button>
        </div>
      </div>
      <div className="card">
        {isPending && <p>{t('staffActivity.loading')}</p>}
        {error && <p className="error-text">{error.message}</p>}
        <table>
          <thead>
            <tr>
              <th>{t('staffActivity.staffColumn')}</th>
              <th>{t('staffActivity.hoursWorkedToday')}</th>
              <th>{t('staffActivity.type')}</th>
              <th>{t('staffActivity.detail')}</th>
              <th>{t('staffActivity.started')}</th>
              <th>{scope === 'live' ? t('staffActivity.duration') : t('staffActivity.finished')}</th>
            </tr>
          </thead>
          <tbody>
            {data && data.entries.length === 0 && (
              <tr>
                <td colSpan={6}>{scope === 'live' ? t('staffActivity.noneLive') : t('staffActivity.noneRecent')}</td>
              </tr>
            )}
            {data?.entries.map((entry) => (
              <tr
                key={entry.id}
                ref={entry.id === highlightId ? highlightRef : undefined}
                className={entry.id === highlightId ? 'highlight-row' : undefined}
              >
                <td>{entry.userName}</td>
                <td>{entry.hoursWorkedToday}h</td>
                <td>{t(STAFF_ACTIVITY_TYPE_KEYS[entry.type])}</td>
                <td>
                  {staffActivityDetail(entry, t)}
                  {entry.floorTaskOutcome === 'cancelled' && (
                    <span className="pill pill-gray" style={{ marginLeft: 6 }}>
                      {t('staffActivity.cancelled')}
                    </span>
                  )}
                </td>
                <td>{formatLocalTime(entry.startedAt)}</td>
                <td>
                  {scope === 'live' ? elapsedSince(entry.startedAt) : entry.endedAt ? formatLocalTime(entry.endedAt) : '—'}
                  {scope === 'recent' && entry.durationMs !== null && (
                    <span style={{ color: 'var(--gray-500)', marginLeft: 6 }}>({formatDurationMs(entry.durationMs)})</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
