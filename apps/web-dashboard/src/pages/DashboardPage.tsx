import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import { fetchActiveFloorTasks, FLOOR_TASK_CATEGORY_LABELS } from '../core/api/floorTasks';
import { fetchAdminDashboard, fetchStaffHistory, type AdminDashboardReport, type StaffHistoryReport } from '../core/api/reports';
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

/** null when plannedHours is 0 — nothing to compare against (day off, or no schedule configured). */
function ratioPercent(plannedHours: number, actualHours: number): number | null {
  if (plannedHours === 0) return null;
  return Math.round((actualHours / plannedHours) * 100);
}

function ratioPillClass(percent: number): string {
  if (percent >= 100) return 'pill-green';
  if (percent >= 75) return 'pill-amber';
  return 'pill-red';
}

function downloadStaffHistory(report: StaffHistoryReport) {
  const header: string[] = ['Staff'];
  for (const day of report.days) {
    header.push(`${day} Planned (h)`, `${day} Actual (h)`, `${day} Actual/Planned`);
  }

  const rows: (string | number)[][] = report.staff.map((staffRow) => {
    const row: (string | number)[] = [staffRow.userName];
    for (const day of report.days) {
      const entry = staffRow.days[day] ?? { plannedHours: 0, actualHours: 0 };
      const percent = ratioPercent(entry.plannedHours, entry.actualHours);
      row.push(entry.plannedHours, entry.actualHours, percent === null ? '' : `${percent}%`);
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

  // Staff View / Integration docs: "not all items need Admin's
  // instructions... she needs just to see who is on the task, duration
  // since start, and declared counts so far" — read-only, no action here.
  const { data: activeFloorTasks } = useQuery({
    queryKey: ['floor-tasks-active'],
    queryFn: () => fetchActiveFloorTasks(token!),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, data, activeFloorTasks]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="page-subtitle">{today}</p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <>
          <div className="section-toolbar">
            <h2 style={{ margin: 0 }}>Current status</h2>
            <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-tile-label">Staff on shift</div>
                <div className="stat-tile-value">
                  {data.liveSummary.staffOnShiftCount} / {data.liveSummary.totalStaffCount}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Pallets pending review</div>
                <div className="stat-tile-value">{data.liveSummary.palletsPendingReviewCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Open put-away tasks</div>
                <div className="stat-tile-value">{data.liveSummary.openPutAwayTaskCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Active order-prep sessions</div>
                <div className="stat-tile-value">{data.liveSummary.activeOrderPrepSessionCount}</div>
              </div>
            </div>
          </div>

          <h2>Today</h2>
          <div className="card">
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-tile-label">Receptions logged</div>
                <div className="stat-tile-value">{data.today.receptionsLoggedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Receptions completed</div>
                <div className="stat-tile-value">{data.today.receptionsCompletedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Pallets logged</div>
                <div className="stat-tile-value">{data.today.palletsLoggedCount}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">Put-away completed</div>
                <div className="stat-tile-value">{data.today.putAwayCompletedCount}</div>
              </div>
            </div>
          </div>

          <h2>Floor Tasks — Live</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Task</th>
                  <th>Started</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {(!activeFloorTasks || activeFloorTasks.length === 0) && (
                  <tr>
                    <td colSpan={4}>No one is on a floor task right now.</td>
                  </tr>
                )}
                {activeFloorTasks?.map((t) => (
                  <tr
                    key={t.id}
                    ref={t.id === highlightId ? highlightRef : undefined}
                    className={t.id === highlightId ? 'highlight-row' : undefined}
                  >
                    <td>{t.userName}</td>
                    <td>{FLOOR_TASK_CATEGORY_LABELS[t.category]}</td>
                    <td>{formatLocalTime(t.startedAt)}</td>
                    <td>{elapsedSince(t.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Staff</h2>
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

/** Planned (from StaffSchedule) vs. actual (completed shifts, net of lunch) worked hours, one column per day since the app's first-ever completed shift. See ReportsService.staffHistory() for how each day's numbers are computed. */
function StaffHistorySection() {
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['staff-history'],
    queryFn: () => fetchStaffHistory(token!),
    enabled: !!token,
  });

  return (
    <>
      <div className="section-toolbar">
        <h2 style={{ margin: 0 }}>Staff History</h2>
        <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => data && downloadStaffHistory(data)} disabled={!data || data.days.length === 0}>
          Download
        </button>
      </div>
      <div className="card">
        {isPending && <p>Loading…</p>}
        {error && <p className="error-text">{error.message}</p>}
        {data && data.days.length === 0 && <p className="hint-text">No completed shifts yet.</p>}
        {data && data.days.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>Staff</th>
                  {data.days.map((day) => (
                    <th key={day} style={{ textAlign: 'center', minWidth: 90 }}>
                      {formatDayHeader(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.staff.map((staffRow) => (
                  <tr key={staffRow.userId}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{staffRow.userName}</td>
                    {data.days.map((day) => {
                      const entry = staffRow.days[day] ?? { plannedHours: 0, actualHours: 0 };
                      const percent = ratioPercent(entry.plannedHours, entry.actualHours);
                      return (
                        <td key={day} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>P: {formatHours(entry.plannedHours)}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>A: {formatHours(entry.actualHours)}</div>
                          {percent === null ? (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>
                          ) : (
                            <span className={`pill ${ratioPillClass(percent)}`}>{percent}%</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {data.staff.length === 0 && (
                  <tr>
                    <td colSpan={data.days.length + 1}>No staff accounts yet.</td>
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
