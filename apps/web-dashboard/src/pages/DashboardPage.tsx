import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
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

import { type FilterOption, FilterPopover } from '../core/components/FilterPopover';
import {
  fetchAdminDashboard,
  fetchStaffActivity,
  fetchStaffHistory,
  fetchStaffHistoryExport,
  fetchStaffSummary,
  type BreakKind,
  type IdleKind,
  type OpenPoolBucketKind,
  type ReceptionCategory,
  type StaffActivityBreakdown,
  type StaffActivityEntry,
  type StaffHistoryExportReport,
} from '../core/api/reports';
import { fetchStaffUsers } from '../core/api/users';
import { useAuth } from '../core/auth/AuthContext';

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDayHeader(day: string): string {
  // "YYYY-MM-DD" -> "Nov 1" — parsed as UTC (the "Txx" suffix) so it doesn't shift a day depending on the viewer's timezone.
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Every duration in all 3 tables renders this way — "HH:MM ( X mins )" — per the Nov 2026 table redesign. */
function formatDurationHHMM(ms: number): string {
  const totalMinutes = Math.round(Math.max(0, ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ( ${totalMinutes} mins )`;
}

const RECEPTION_CATEGORY_KEYS: ReceptionCategory[] = ['return_parcels', 'packaging_stock', 'sellers_stock', 'equipment_other'];
const FLOOR_TASK_CATEGORY_KEYS = [
  'pick',
  'pack',
  'dispatch',
  'return_processing',
  'box_prep',
  'warehousing_inventory_check',
  'warehousing_location_adjustment',
  'backup_box',
  'backup_shredder',
  'backup_other',
];
const OPEN_POOL_KEYS: OpenPoolBucketKind[] = ['directive', 'general'];
const BREAK_KEYS: BreakKind[] = ['lunch', 'short'];
const IDLE_KEYS: IdleKind[] = ['unclaimed', 'off_shift'];
/** IdleKind's backend values use snake_case; this JSON's keys stay camelCase, matching every other i18n file in this app. */
const IDLE_KIND_I18N_KEY: Record<IdleKind, string> = { unclaimed: 'unclaimed', off_shift: 'offShift' };

function receptionOptions(t: TFunction<'dashboard'>): FilterOption[] {
  return RECEPTION_CATEGORY_KEYS.map((k) => ({ key: k, label: t(`receptionCategory.${k}`, { ns: 'common' }) }));
}
function floorTaskOptions(t: TFunction<'dashboard'>): FilterOption[] {
  return FLOOR_TASK_CATEGORY_KEYS.map((k) => ({ key: k, label: t(`floorTaskCategories.${k}`, { ns: 'common' }) }));
}
function openPoolOptions(t: TFunction<'dashboard'>): FilterOption[] {
  return OPEN_POOL_KEYS.map((k) => ({ key: k, label: t(`openPoolKinds.${k}`) }));
}
function breakOptions(t: TFunction<'dashboard'>): FilterOption[] {
  return BREAK_KEYS.map((k) => ({ key: k, label: t(`breakKinds.${k}`) }));
}
function idleOptions(t: TFunction<'dashboard'>): FilterOption[] {
  return IDLE_KEYS.map((k) => ({ key: k, label: t(`idleKinds.${IDLE_KIND_I18N_KEY[k]}`) }));
}

/** Sums every value in `record`, or only the keys in `selected` when non-empty — an empty `selected` set means "all categories," matching FilterPopover's convention. */
function sumSelected(record: Record<string, number>, selected: Set<string>): number {
  const entries = Object.entries(record);
  if (selected.size === 0) return entries.reduce((sum, [, v]) => sum + v, 0);
  return entries.reduce((sum, [k, v]) => sum + (selected.has(k) ? v : 0), 0);
}

const ZERO_BREAKDOWN: StaffActivityBreakdown = {
  plannedMs: 0,
  onlineMs: 0,
  claimedMs: 0,
  receptionMs: { return_parcels: 0, packaging_stock: 0, sellers_stock: 0, equipment_other: 0 },
  floorTaskMs: {},
  openPoolMs: { directive: 0, general: 0 },
  breakMs: { lunch: 0, short: 0 },
  idleMs: { unclaimed: 0, off_shift: 0 },
};

interface CategoryFilterSets {
  reception: Set<string>;
  floorTask: Set<string>;
  openPool: Set<string>;
  breakF: Set<string>;
  idle: Set<string>;
}

/** Shared Planned/Online/Claimed/Reception/Floor Task/Open-Pool/Break/Idle cell set — used by both the Staff table (table 2, one breakdown per row) and Staff History (table 3, one breakdown per day-group + Cumulative). */
function BreakdownCells({
  breakdown,
  filters,
  t,
}: {
  breakdown: StaffActivityBreakdown;
  filters: CategoryFilterSets;
  t: TFunction<'dashboard'>;
}) {
  return (
    <>
      <td className="breakdown-data-cell breakdown-group-start">
        {breakdown.plannedMs === null ? (
          <span className="alert-chip">
            <AlertTriangle size={11} />
            {t('staffTable.noPlannedShift')}
          </span>
        ) : (
          formatDurationHHMM(breakdown.plannedMs)
        )}
      </td>
      <td className="breakdown-data-cell">{formatDurationHHMM(breakdown.onlineMs)}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(breakdown.claimedMs)}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(sumSelected(breakdown.receptionMs, filters.reception))}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(sumSelected(breakdown.floorTaskMs, filters.floorTask))}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(sumSelected(breakdown.openPoolMs, filters.openPool))}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(sumSelected(breakdown.breakMs, filters.breakF))}</td>
      <td className="breakdown-data-cell">{formatDurationHHMM(sumSelected(breakdown.idleMs, filters.idle))}</td>
    </>
  );
}

/** One `useQuery` call behind this shared key — every section that needs the staff-name filter's option list reuses the same cached fetch. */
function useStaffFilterOptions(): FilterOption[] {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ['dashboard-staff-filter-options'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });
  return (data ?? []).map((u) => ({ key: u.id, label: u.name }));
}

function downloadStaffHistoryExcel(report: StaffHistoryExportReport, t: TFunction<'dashboard'>) {
  const toMin = (ms: number) => Math.round(ms / 60_000);
  const header = [
    t('staffHistory.staffColumn'),
    t('staffHistory.dateColumn'),
    `${t('activityColumns.planned')} (min)`,
    `${t('activityColumns.online')} (min)`,
    `${t('activityColumns.claimed')} (min)`,
    ...RECEPTION_CATEGORY_KEYS.map((k) => `${t('activityColumns.reception')}: ${t(`receptionCategory.${k}`, { ns: 'common' })} (min)`),
    ...FLOOR_TASK_CATEGORY_KEYS.map((k) => `${t('activityColumns.floorTask')}: ${t(`floorTaskCategories.${k}`, { ns: 'common' })} (min)`),
    ...OPEN_POOL_KEYS.map((k) => `${t('activityColumns.openPool')}: ${t(`openPoolKinds.${k}`)} (min)`),
    ...BREAK_KEYS.map((k) => `${t('activityColumns.break')}: ${t(`breakKinds.${k}`)} (min)`),
    ...IDLE_KEYS.map((k) => `${t('activityColumns.idle')}: ${t(`idleKinds.${IDLE_KIND_I18N_KEY[k]}`)} (min)`),
  ];

  const rows: (string | number)[][] = report.rows.map((row) => [
    row.userName,
    row.date,
    row.breakdown.plannedMs === null ? '' : toMin(row.breakdown.plannedMs),
    toMin(row.breakdown.onlineMs),
    toMin(row.breakdown.claimedMs),
    ...RECEPTION_CATEGORY_KEYS.map((k) => toMin(row.breakdown.receptionMs[k] ?? 0)),
    ...FLOOR_TASK_CATEGORY_KEYS.map((k) => toMin(row.breakdown.floorTaskMs[k] ?? 0)),
    ...OPEN_POOL_KEYS.map((k) => toMin(row.breakdown.openPoolMs[k] ?? 0)),
    ...BREAK_KEYS.map((k) => toMin(row.breakdown.breakMs[k] ?? 0)),
    ...IDLE_KEYS.map((k) => toMin(row.breakdown.idleMs[k] ?? 0)),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Excel's native filter-dropdown header row — "filterable like the dashboard version," applied the way a static downloaded file can be.
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, t('staffHistory.heading'));
  XLSX.writeFile(book, `elno-staff-history-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
          <StaffSummarySection />
          <StaffHistorySection />
        </>
      )}
    </div>
  );
}

/** Table 2 — today's Planned/Online/Claimed + Reception/Floor Task/Open-Pool/Break/Idle breakdown, one row per staff member. */
function StaffSummarySection() {
  const { t } = useTranslation('dashboard');
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['staff-summary'],
    queryFn: () => fetchStaffSummary(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });
  const staffOptions = useStaffFilterOptions();

  const [staffFilter, setStaffFilter] = useState<Set<string>>(new Set());
  const [receptionFilter, setReceptionFilter] = useState<Set<string>>(new Set());
  const [floorTaskFilter, setFloorTaskFilter] = useState<Set<string>>(new Set());
  const [openPoolFilter, setOpenPoolFilter] = useState<Set<string>>(new Set());
  const [breakFilter, setBreakFilter] = useState<Set<string>>(new Set());
  const [idleFilter, setIdleFilter] = useState<Set<string>>(new Set());
  const filters: CategoryFilterSets = { reception: receptionFilter, floorTask: floorTaskFilter, openPool: openPoolFilter, breakF: breakFilter, idle: idleFilter };

  const rows = (data?.staff ?? []).filter((row) => staffFilter.size === 0 || staffFilter.has(row.userId));

  return (
    <>
      <div className="flex-row" style={{ marginBottom: 12 }}>
        <span className="icon-badge icon-badge-sm icon-badge-blue">
          <Users />
        </span>
        <h2 style={{ margin: 0 }}>{t('staffTable.heading')}</h2>
      </div>
      <div className="card">
        {isPending && <p>{t('staffTable.loading')}</p>}
        {error && <p className="error-text">{error.message}</p>}
        {data && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th className="staff-header-cell">
                    {t('staffTable.name')}
                    <FilterPopover
                      options={staffOptions}
                      selected={staffFilter}
                      onChange={setStaffFilter}
                      triggerLabel={t('filters.staff.trigger')}
                      allLabel={t('filters.staff.all')}
                      searchPlaceholder={t('filters.staff.search')}
                    />
                  </th>
                  <th className="breakdown-header-cell breakdown-group-start">{t('activityColumns.planned')}</th>
                  <th className="breakdown-header-cell">{t('activityColumns.online')}</th>
                  <th className="breakdown-header-cell">{t('activityColumns.claimed')}</th>
                  <th className="breakdown-header-cell">
                    {t('activityColumns.reception')}
                    <FilterPopover options={receptionOptions(t)} selected={receptionFilter} onChange={setReceptionFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />
                  </th>
                  <th className="breakdown-header-cell">
                    {t('activityColumns.floorTask')}
                    <FilterPopover options={floorTaskOptions(t)} selected={floorTaskFilter} onChange={setFloorTaskFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />
                  </th>
                  <th className="breakdown-header-cell">
                    {t('activityColumns.openPool')}
                    <FilterPopover options={openPoolOptions(t)} selected={openPoolFilter} onChange={setOpenPoolFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />
                  </th>
                  <th className="breakdown-header-cell">
                    {t('activityColumns.break')}
                    <FilterPopover options={breakOptions(t)} selected={breakFilter} onChange={setBreakFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />
                  </th>
                  <th className="breakdown-header-cell">
                    {t('activityColumns.idle')}
                    <FilterPopover options={idleOptions(t)} selected={idleFilter} onChange={setIdleFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9}>{t('staffTable.noStaffAccounts')}</td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td>{row.userName}</td>
                    <BreakdownCells breakdown={row.breakdown} filters={filters} t={t} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** Reusable 8-sub-column group header, shared by every day-group and the Cumulative group. */
function ActivityGroupHeader({ title }: { title: string }) {
  return (
    <th colSpan={8} style={{ textAlign: 'center', borderLeft: '1px solid var(--gray-150)' }}>
      {title}
    </th>
  );
}

/** The 8 sub-column labels repeated under every group — filter icons only render once, on the first (Cumulative) group, since all 5 category filters are shared across every group per the Nov 2026 design decision. */
function ActivitySubHeaderCells({
  withFilters,
  t,
  receptionFilter,
  setReceptionFilter,
  floorTaskFilter,
  setFloorTaskFilter,
  openPoolFilter,
  setOpenPoolFilter,
  breakFilter,
  setBreakFilter,
  idleFilter,
  setIdleFilter,
}: {
  withFilters: boolean;
  t: TFunction<'dashboard'>;
  receptionFilter: Set<string>;
  setReceptionFilter: (s: Set<string>) => void;
  floorTaskFilter: Set<string>;
  setFloorTaskFilter: (s: Set<string>) => void;
  openPoolFilter: Set<string>;
  setOpenPoolFilter: (s: Set<string>) => void;
  breakFilter: Set<string>;
  setBreakFilter: (s: Set<string>) => void;
  idleFilter: Set<string>;
  setIdleFilter: (s: Set<string>) => void;
}) {
  return (
    <>
      <th className="breakdown-header-cell breakdown-group-start">{t('activityColumns.planned')}</th>
      <th className="breakdown-header-cell">{t('activityColumns.online')}</th>
      <th className="breakdown-header-cell">{t('activityColumns.claimed')}</th>
      <th className="breakdown-header-cell">
        {t('activityColumns.reception')}
        {withFilters && <FilterPopover options={receptionOptions(t)} selected={receptionFilter} onChange={setReceptionFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />}
      </th>
      <th className="breakdown-header-cell">
        {t('activityColumns.floorTask')}
        {withFilters && <FilterPopover options={floorTaskOptions(t)} selected={floorTaskFilter} onChange={setFloorTaskFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />}
      </th>
      <th className="breakdown-header-cell">
        {t('activityColumns.openPool')}
        {withFilters && <FilterPopover options={openPoolOptions(t)} selected={openPoolFilter} onChange={setOpenPoolFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />}
      </th>
      <th className="breakdown-header-cell">
        {t('activityColumns.break')}
        {withFilters && <FilterPopover options={breakOptions(t)} selected={breakFilter} onChange={setBreakFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />}
      </th>
      <th className="breakdown-header-cell">
        {t('activityColumns.idle')}
        {withFilters && <FilterPopover options={idleOptions(t)} selected={idleFilter} onChange={setIdleFilter} triggerLabel={t('filters.categories.trigger')} allLabel={t('filters.categories.all')} />}
      </th>
    </>
  );
}

/**
 * Table 3 — today-first (admin scrolls right/left to see older days — a
 * plain reverse of the backend's ascending order), one 8-column group
 * per day (Planned/Online/Claimed/Reception/Floor Task/Open-Pool/
 * Break/Idle — same shape as table 2), plus a Cumulative group pinned
 * right after the sticky Staff column. The 5 category filters
 * (Reception/Floor Task/Open-Pool/Break/Idle) are shared across every
 * group at once — see ActivitySubHeaderCells.
 */
function StaffHistorySection() {
  const { t } = useTranslation('dashboard');
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['staff-history'],
    queryFn: () => fetchStaffHistory(token!),
    enabled: !!token,
  });
  const staffOptions = useStaffFilterOptions();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [staffFilter, setStaffFilter] = useState<Set<string>>(new Set());
  const [receptionFilter, setReceptionFilter] = useState<Set<string>>(new Set());
  const [floorTaskFilter, setFloorTaskFilter] = useState<Set<string>>(new Set());
  const [openPoolFilter, setOpenPoolFilter] = useState<Set<string>>(new Set());
  const [breakFilter, setBreakFilter] = useState<Set<string>>(new Set());
  const [idleFilter, setIdleFilter] = useState<Set<string>>(new Set());
  const filters: CategoryFilterSets = { reception: receptionFilter, floorTask: floorTaskFilter, openPool: openPoolFilter, breakF: breakFilter, idle: idleFilter };

  const orderedDays = data ? data.days : [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  const rows = (data?.staff ?? []).filter((row) => staffFilter.size === 0 || staffFilter.has(row.userId));

  async function handleDownload() {
    if (!token) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const exportReport = await fetchStaffHistoryExport(token);
      downloadStaffHistoryExcel(exportReport, t);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="section-toolbar">
        <div className="flex-row">
          <span className="icon-badge icon-badge-sm icon-badge-purple">
            <ClipboardCheck />
          </span>
          <h2 style={{ margin: 0 }}>{t('staffHistory.heading')}</h2>
        </div>
        <button className="btn btn-outline" onClick={handleDownload} disabled={downloading}>
          <Download size={14} />
          {downloading ? t('staffHistory.downloading') : t('staffHistory.download')}
        </button>
      </div>
      <div className="card">
        {isPending && <p>{t('staffHistory.loading')}</p>}
        {error && <p className="error-text">{error.message}</p>}
        {downloadError && <p className="error-text">{downloadError}</p>}
        {data && data.days.length === 0 && <p className="hint-text">{t('staffHistory.noShiftsYet')}</p>}
        {data && data.days.length > 0 && (
          <div ref={scrollRef} style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content' }}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="staff-header-cell"
                    style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, verticalAlign: 'bottom' }}
                  >
                    {t('staffHistory.staffColumn')}
                    <FilterPopover
                      options={staffOptions}
                      selected={staffFilter}
                      onChange={setStaffFilter}
                      triggerLabel={t('filters.staff.trigger')}
                      allLabel={t('filters.staff.all')}
                      searchPlaceholder={t('filters.staff.search')}
                    />
                  </th>
                  <ActivityGroupHeader title={t('staffHistory.cumulative')} />
                  {orderedDays.map((day, i) => (
                    <ActivityGroupHeader
                      key={day}
                      title={i === orderedDays.length - 1 ? t('staffHistory.todaySuffix', { day: formatDayHeader(day) }) : formatDayHeader(day)}
                    />
                  ))}
                </tr>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1 }} />
                  {Array.from({ length: orderedDays.length + 1 }).map((_, groupIndex) => (
                    <ActivitySubHeaderCells
                      key={groupIndex}
                      withFilters={groupIndex === 0}
                      t={t}
                      receptionFilter={receptionFilter}
                      setReceptionFilter={setReceptionFilter}
                      floorTaskFilter={floorTaskFilter}
                      setFloorTaskFilter={setFloorTaskFilter}
                      openPoolFilter={openPoolFilter}
                      setOpenPoolFilter={setOpenPoolFilter}
                      breakFilter={breakFilter}
                      setBreakFilter={setBreakFilter}
                      idleFilter={idleFilter}
                      setIdleFilter={setIdleFilter}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 'var(--weight-strong)' }}>{row.userName}</td>
                    <BreakdownCells breakdown={row.cumulative} filters={filters} t={t} />
                    {orderedDays.map((day) => (
                      <BreakdownCells key={day} breakdown={row.days[day] ?? ZERO_BREAKDOWN} filters={filters} t={t} />
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={(orderedDays.length + 1) * 8 + 1}>{t('staffHistory.noStaffAccounts')}</td>
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
  lunch_break: 'staffActivity.types.lunchBreak',
  short_break: 'staffActivity.types.shortBreak',
  idle: 'staffActivity.types.idle',
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
    case 'lunch_break':
    case 'short_break': {
      if (entry.breakRemainingMs === undefined || entry.breakRemainingMs === null) return '—';
      const mins = Math.round(entry.breakRemainingMs / 60_000);
      return mins >= 0 ? t('staffActivity.breakRemaining', { mins }) : t('staffActivity.breakOver', { mins: Math.abs(mins) });
    }
    case 'idle':
      return '';
  }
}

/**
 * Table 1 — merges the 4 "someone is doing something" sources (Floor
 * Task, the Reception timer, a claimed Open Pool task, an acknowledged
 * Directive) plus, live scope only, a Break or Idle row for every other
 * on-shift staff member — see packages/backend/src/reports/
 * reports.types.ts's StaffActivityEntry doc comment. "Recent" is also
 * the only place a completed Dispatch Floor Task's scanned barcode
 * becomes visible, since it drops out of "Live" the instant it ends.
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
  const staffOptions = useStaffFilterOptions();
  const [staffFilter, setStaffFilter] = useState<Set<string>>(new Set());

  const entries = (data?.entries ?? []).filter((e) => staffFilter.size === 0 || staffFilter.has(e.userId));

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
              <th className="staff-header-cell">
                {t('staffActivity.staffColumn')}
                <FilterPopover
                  options={staffOptions}
                  selected={staffFilter}
                  onChange={setStaffFilter}
                  triggerLabel={t('filters.staff.trigger')}
                  allLabel={t('filters.staff.all')}
                  searchPlaceholder={t('filters.staff.search')}
                />
              </th>
              <th className="nowrap-cell">{t('staffActivity.currentActivity')}</th>
              <th>{t('staffActivity.detail')}</th>
              <th className="nowrap-cell">{t('staffActivity.started')}</th>
              <th className="nowrap-cell">{scope === 'live' ? t('staffActivity.duration') : t('staffActivity.finished')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5}>{scope === 'live' ? t('staffActivity.noneLive') : t('staffActivity.noneRecent')}</td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr
                key={entry.id}
                ref={entry.id === highlightId ? highlightRef : undefined}
                className={entry.id === highlightId ? 'highlight-row' : undefined}
              >
                <td>{entry.userName}</td>
                <td className="nowrap-cell">{t(STAFF_ACTIVITY_TYPE_KEYS[entry.type])}</td>
                <td>
                  {staffActivityDetail(entry, t)}
                  {entry.floorTaskOutcome === 'cancelled' && (
                    <span className="pill pill-gray" style={{ marginLeft: 6 }}>
                      {t('staffActivity.cancelled')}
                    </span>
                  )}
                </td>
                <td className="nowrap-cell">{formatLocalTime(entry.startedAt)}</td>
                <td className="duration-cell">
                  {scope === 'live' ? (
                    formatDurationHHMM(Date.now() - new Date(entry.startedAt).getTime())
                  ) : entry.endedAt ? (
                    formatLocalTime(entry.endedAt)
                  ) : (
                    '—'
                  )}
                  {scope === 'recent' && entry.durationMs !== null && (
                    <span style={{ color: 'var(--gray-500)', marginLeft: 6 }}>{formatDurationHHMM(entry.durationMs)}</span>
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
