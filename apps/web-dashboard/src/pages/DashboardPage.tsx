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
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import { DIRECTIVE_TYPE_LABELS } from '../core/api/directives';
import { FLOOR_TASK_CATEGORY_LABELS } from '../core/api/floorTasks';
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

const STAFF_HISTORY_CATEGORY_COLUMNS: { key: keyof StaffHistoryDay; label: string }[] = [
  { key: 'plannedHours', label: 'Planned' },
  { key: 'floorTaskHours', label: 'Floor Task' },
  { key: 'receptionHours', label: 'Reception' },
  { key: 'openPoolHours', label: 'Open Pool' },
  { key: 'urgentTaskHours', label: 'Urgent Task' },
  { key: 'actualHours', label: 'Actual' },
];

function downloadStaffHistory(report: StaffHistoryReport) {
  const orderedDays = [...report.days].reverse();
  const header: string[] = ['Staff'];
  for (const day of orderedDays) {
    for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
      header.push(`${day} ${col.label} (h)`);
    }
  }
  for (const col of STAFF_HISTORY_CATEGORY_COLUMNS) {
    header.push(`Cumulative ${col.label} (h)`);
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
  XLSX.utils.book_append_sheet(book, sheet, 'Staff History');
  XLSX.writeFile(book, `elno-staff-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function breakLabel(staff: AdminDashboardReport['staff'][number]): string {
  if (staff.breakType === 'short') {
    const remaining = staff.shortBreakRemainingMs ?? 0;
    return `Short break — ${formatMinutesSeconds(Math.max(0, remaining))} remaining`;
  }
  if (staff.breakType === 'lunch') {
    const remaining = staff.lunchBreakRemainingMs ?? 0;
    return `Lunch break — ${formatMinutesSeconds(remaining)} ${remaining >= 0 ? 'remaining' : 'over'}`;
  }
  return 'On break';
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
          <h1>Dashboard</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {today}
          </p>
        </div>
      </div>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <>
          <div className="section-toolbar">
            <h2 style={{ margin: 0 }}>Current status</h2>
            <button className="btn btn-outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw size={14} className={isRefetching ? 'spin' : undefined} />
              {isRefetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="icon-badge icon-badge-blue">
                  <Users />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Staff on shift</div>
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
                  <div className="stat-tile-label">Pallets pending review</div>
                  <div className="stat-tile-value">{data.liveSummary.palletsPendingReviewCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-purple">
                  <Boxes />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Open put-away tasks</div>
                  <div className="stat-tile-value">{data.liveSummary.openPutAwayTaskCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-green">
                  <ShoppingCart />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Active order-prep sessions</div>
                  <div className="stat-tile-value">{data.liveSummary.activeOrderPrepSessionCount}</div>
                </div>
              </div>
            </div>
          </div>

          <h2>Today</h2>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <span className="icon-badge icon-badge-blue">
                  <Truck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Receptions logged</div>
                  <div className="stat-tile-value">{data.today.receptionsLoggedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-green">
                  <CheckCircle2 />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Receptions completed</div>
                  <div className="stat-tile-value">{data.today.receptionsCompletedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-orange">
                  <PackageCheck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Pallets logged</div>
                  <div className="stat-tile-value">{data.today.palletsLoggedCount}</div>
                </div>
              </div>
              <div className="stat-tile">
                <span className="icon-badge icon-badge-purple">
                  <ClipboardCheck />
                </span>
                <div className="stat-tile-body">
                  <div className="stat-tile-label">Put-away completed</div>
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
            <h2 style={{ margin: 0 }}>Staff</h2>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Shifts today</th>
                  <th>Hours worked today</th>
                  <th>Put-away done</th>
                  <th>Order prep done</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.length === 0 && (
                  <tr>
                    <td colSpan={6}>No staff accounts yet.</td>
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
                          On shift{s.shiftStartedAt ? ` since ${formatLocalTime(s.shiftStartedAt)}` : ''}
                        </span>
                      ) : (
                        <span className="pill pill-gray">Off shift</span>
                      )}
                      {s.onBreak && (
                        <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                          {breakLabel(s)}
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

function StaffHistorySubHeaderRow({ groupCount }: { groupCount: number }) {
  return (
    <tr>
      <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }} />
      {Array.from({ length: groupCount }).map((_, groupIndex) =>
        STAFF_HISTORY_CATEGORY_COLUMNS.map((col, i) => (
          <th
            key={`${groupIndex}-${col.key}`}
            style={{ textAlign: 'center', fontSize: 11, fontWeight: 'var(--weight-regular)', color: 'var(--gray-500)', minWidth: 64, borderLeft: i === 0 ? '1px solid var(--gray-150)' : undefined }}
          >
            {col.label}
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
          <h2 style={{ margin: 0 }}>Staff History</h2>
        </div>
        <button className="btn btn-outline" onClick={() => data && downloadStaffHistory(data)} disabled={!data || data.days.length === 0}>
          <Download size={14} />
          Download
        </button>
      </div>
      <div className="card">
        {isPending && <p>Loading…</p>}
        {error && <p className="error-text">{error.message}</p>}
        {data && data.days.length === 0 && <p className="hint-text">No completed shifts yet.</p>}
        {data && data.days.length > 0 && (
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, verticalAlign: 'bottom' }}>
                    Staff
                  </th>
                  <StaffHistoryGroupHeader title="Cumulative" />
                  {orderedDays.map((day, i) => (
                    <StaffHistoryGroupHeader
                      key={day}
                      title={i === orderedDays.length - 1 ? `${formatDayHeader(day)} (Today)` : formatDayHeader(day)}
                    />
                  ))}
                </tr>
                <StaffHistorySubHeaderRow groupCount={orderedDays.length + 1} />
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
                    <td colSpan={(orderedDays.length + 1) * STAFF_HISTORY_CATEGORY_COLUMNS.length + 1}>No staff accounts yet.</td>
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

const STAFF_ACTIVITY_TYPE_LABELS: Record<StaffActivityEntry['type'], string> = {
  floor_task: 'Floor Task',
  reception: 'Reception',
  open_pool: 'Open Pool',
  directive: 'Urgent Task',
};

function staffActivityDetail(entry: StaffActivityEntry): string {
  switch (entry.type) {
    case 'floor_task': {
      const label = entry.floorTaskCategory ? FLOOR_TASK_CATEGORY_LABELS[entry.floorTaskCategory as keyof typeof FLOOR_TASK_CATEGORY_LABELS] : '—';
      return entry.scannedBarcode !== undefined
        ? `${label}${entry.scannedBarcode ? ` — scanned: ${entry.scannedBarcode}` : ' — not yet scanned'}`
        : label;
    }
    case 'reception':
      return entry.receptionOutcome === 'unfinished' ? 'Reception — no confirmed delivery' : 'Reception';
    case 'open_pool':
      return entry.openPoolTitle ?? '—';
    case 'directive':
      return entry.directiveType ? (DIRECTIVE_TYPE_LABELS[entry.directiveType as keyof typeof DIRECTIVE_TYPE_LABELS] ?? entry.directiveType) : '—';
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
          <h2 style={{ margin: 0 }}>Staff Activity</h2>
        </div>
        <div className="tab-group">
          <button className={`tab-btn ${scope === 'live' ? 'tab-btn-active' : ''}`} onClick={() => setScope('live')}>
            Live
          </button>
          <button className={`tab-btn ${scope === 'recent' ? 'tab-btn-active' : ''}`} onClick={() => setScope('recent')}>
            Recent
          </button>
        </div>
      </div>
      <div className="card">
        {isPending && <p>Loading…</p>}
        {error && <p className="error-text">{error.message}</p>}
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Hours worked today</th>
              <th>Type</th>
              <th>Detail</th>
              <th>Started</th>
              <th>{scope === 'live' ? 'Duration' : 'Finished'}</th>
            </tr>
          </thead>
          <tbody>
            {data && data.entries.length === 0 && (
              <tr>
                <td colSpan={6}>{scope === 'live' ? 'No one is on anything right now.' : 'Nothing finished yet.'}</td>
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
                <td>{STAFF_ACTIVITY_TYPE_LABELS[entry.type]}</td>
                <td>
                  {staffActivityDetail(entry)}
                  {entry.floorTaskOutcome === 'cancelled' && (
                    <span className="pill pill-gray" style={{ marginLeft: 6 }}>
                      Cancelled
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
