import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Clock,
  PackageX,
  SlidersHorizontal,
  Truck,
  X,
} from 'lucide-react';
import { type ComponentType, useState } from 'react';

import {
  fetchReceptionDuration,
  fetchReceptionReliability,
  fetchReceptionSources,
  fetchReceptionVolume,
  fetchSellerStockQuality,
  type ReportDateRangeParams,
  type ReportGranularity,
} from '../core/api/reports';
import { useAuth } from '../core/auth/AuthContext';
import {
  CATEGORICAL_COLORS,
  LineChart,
  PercentChangeBadge,
  RankedBarChart,
  StackedBarChart,
  StatTile,
} from '../components/charts/ReportCharts';

const CATEGORY_LABELS: Record<string, string> = {
  return_parcels: 'Return Parcels',
  packaging_stock: 'Packaging Stock',
  sellers_stock: 'Sellers Stock',
  equipment_other: 'Equipment & Other',
};

const WEEKDAY_LABELS: Record<string, string> = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
const WEEKDAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const numberFormatter = new Intl.NumberFormat();
function formatCount(n: number): string {
  return numberFormatter.format(n);
}

/** Shared look for native select/date controls — this page only; the
    global stylesheet doesn't style these elements yet. */
const controlStyle: React.CSSProperties = {
  width: 'auto',
  padding: '8px 10px',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  color: 'var(--gray-950)',
  background: '#fff',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--weight-strong)',
  color: 'var(--gray-600)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

function SectionHeading({ icon: Icon, tint, title }: { icon: ComponentType<{ size?: number }>; tint: string; title: string }) {
  return (
    <div className="flex-row" style={{ marginBottom: 14 }}>
      <span className={`icon-badge icon-badge-sm icon-badge-${tint}`}>
        <Icon />
      </span>
      <h2 style={{ margin: 0 }}>{title}</h2>
    </div>
  );
}

/**
 * Manager-facing analytics for Reception — delivery volume, how long
 * deliveries take, Seller Stock quality/overweight rates, where
 * deliveries come from, and how often a Reception is left with no
 * confirmed delivery. One shared date-range/granularity filter drives
 * all 5 sections. See reports.types.ts on the backend for exactly how
 * each number is computed.
 */
export function ReceptionReportsPage() {
  const { token } = useAuth();
  const [granularity, setGranularity] = useState<ReportGranularity>('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params: ReportDateRangeParams = {
    granularity,
    from: from || undefined,
    to: to || undefined,
  };
  const key = [granularity, from, to];

  const volume = useQuery({
    queryKey: ['reception-volume', ...key],
    queryFn: () => fetchReceptionVolume(token!, params),
    enabled: !!token,
  });
  const duration = useQuery({
    queryKey: ['reception-duration', ...key],
    queryFn: () => fetchReceptionDuration(token!, params),
    enabled: !!token,
  });
  const quality = useQuery({
    queryKey: ['seller-stock-quality', ...key],
    queryFn: () => fetchSellerStockQuality(token!, params),
    enabled: !!token,
  });
  const sources = useQuery({
    queryKey: ['reception-sources', ...key],
    queryFn: () => fetchReceptionSources(token!, params),
    enabled: !!token,
  });
  const reliability = useQuery({
    queryKey: ['reception-reliability', ...key],
    queryFn: () => fetchReceptionReliability(token!, params),
    enabled: !!token,
  });

  const [durationDimension, setDurationDimension] = useState<'category' | 'staff'>('category');
  const [qualityView, setQualityView] = useState<'all' | 'overweight'>('all');

  // Headline stats — most recent period's figures from each report
  // (documented here since there's no single backend "overall" field):
  // total deliveries is that period's total; duration/problem/abandoned
  // rates are that period's average/rate, not a range-wide blend.
  const latestVolume = volume.data?.byPeriod.at(-1);
  const latestDuration = duration.data?.byPeriod.at(-1);
  const latestQuality = quality.data?.byPeriod.at(-1);
  const latestReliability = reliability.data?.byPeriod.at(-1);

  const isLoading = volume.isPending || duration.isPending || quality.isPending || sources.isPending || reliability.isPending;
  const firstError = volume.error || duration.error || quality.error || sources.error || reliability.error;

  return (
    <div>
      <div className="page-header-row">
        <span className="icon-badge icon-badge-orange">
          <BarChart3 />
        </span>
        <div className="page-header-text">
          <h1>Reception Reports</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Delivery volume, processing time, Seller Stock quality, sources, and reliability.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 20 }}>
          <div className="flex-row">
            <span style={filterLabelStyle}>
              <SlidersHorizontal size={14} />
              Granularity
            </span>
            <select style={controlStyle} value={granularity} onChange={(e) => setGranularity(e.target.value as ReportGranularity)}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </div>
          <div className="flex-row">
            <span style={filterLabelStyle}>
              <Calendar size={14} />
              From
            </span>
            <input style={controlStyle} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-row">
            <span style={filterLabelStyle}>
              <Calendar size={14} />
              To
            </span>
            <input style={controlStyle} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              <X size={14} />
              Clear dates
            </button>
          )}
        </div>

        <div className="stat-grid" style={{ marginTop: 18 }}>
          <StatTile icon={Truck} tint="blue" label="Deliveries (latest period)" value={latestVolume ? formatCount(latestVolume.total) : '—'} />
          <StatTile
            icon={Clock}
            tint="purple"
            label="Avg. reception duration"
            value={latestDuration?.averageMinutes != null ? `${round1(latestDuration.averageMinutes)} min` : '—'}
          />
          <StatTile
            icon={PackageX}
            tint="red"
            label="Seller Stock problem rate"
            value={latestQuality != null ? `${round1(latestQuality.problemRatePercent)}%` : '—'}
          />
          <StatTile
            icon={AlertCircle}
            tint="orange"
            label="Abandoned-reception rate"
            value={latestReliability != null ? `${round1(latestReliability.unfinishedRatePercent)}%` : '—'}
          />
        </div>
      </div>

      {isLoading && <p>Loading…</p>}
      {firstError && <p className="error-text">{firstError.message}</p>}

      {volume.data && (
        <div className="card">
          <SectionHeading icon={BarChart3} tint="blue" title="Delivery Volume" />
          <StackedBarChart
            title="By Category"
            extra={<PercentChangeBadge percent={volume.data.percentChangeVsPreviousPeriod} />}
            data={volume.data.byPeriod.map((p) => ({
              label: p.period,
              segments: Object.entries(p.byCategory).map(([category, value]) => ({ key: category, value: value ?? 0 })),
            }))}
            legend={Object.keys(CATEGORY_LABELS)
              .filter((category) => volume.data!.byPeriod.some((p) => p.byCategory[category as keyof typeof p.byCategory] !== undefined))
              .map((category, i) => ({ key: category, color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length], label: CATEGORY_LABELS[category] }))}
          />
          <div style={{ marginTop: 20 }}>
            <RankedBarChart
              title="Deliveries by Day of Week"
              data={WEEKDAY_ORDER.map((weekday) => ({
                label: WEEKDAY_LABELS[weekday],
                value: volume.data!.byWeekday.find((w) => w.weekday === weekday)?.total ?? 0,
              }))}
            />
          </div>
        </div>
      )}

      {duration.data && (
        <div className="card">
          <SectionHeading icon={Clock} tint="purple" title="Reception Duration" />
          <LineChart title="Trend" data={duration.data.byPeriod.map((p) => ({ x: p.period, y: p.averageMinutes }))} unit=" min" />
          <div style={{ marginTop: 20 }}>
            <div className="tab-group" style={{ marginBottom: 12 }}>
              <button
                className={`tab-btn ${durationDimension === 'category' ? 'tab-btn-active' : ''}`}
                onClick={() => setDurationDimension('category')}
              >
                By Category
              </button>
              <button
                className={`tab-btn ${durationDimension === 'staff' ? 'tab-btn-active' : ''}`}
                onClick={() => setDurationDimension('staff')}
              >
                By Staff
              </button>
            </div>
            <RankedBarChart
              title={durationDimension === 'category' ? 'Average Duration by Category' : 'Average Duration by Staff'}
              unit=" min"
              data={
                durationDimension === 'category'
                  ? duration.data.byCategory
                      .filter((c) => c.averageMinutes !== null)
                      .sort((a, b) => (b.averageMinutes ?? 0) - (a.averageMinutes ?? 0))
                      .map((c) => ({ label: CATEGORY_LABELS[c.category] ?? c.category, value: round1(c.averageMinutes ?? 0) }))
                  : duration.data.byStaff
                      .filter((s) => s.averageMinutes !== null)
                      .sort((a, b) => (b.averageMinutes ?? 0) - (a.averageMinutes ?? 0))
                      .map((s) => ({ label: s.userName, value: round1(s.averageMinutes ?? 0) }))
              }
            />
          </div>
        </div>
      )}

      {quality.data && (
        <div className="card">
          <SectionHeading icon={PackageX} tint="red" title="Seller Stock Quality" />
          <div className="tab-group" style={{ marginBottom: 12 }}>
            <button className={`tab-btn ${qualityView === 'all' ? 'tab-btn-active' : ''}`} onClick={() => setQualityView('all')}>
              All problems
            </button>
            <button className={`tab-btn ${qualityView === 'overweight' ? 'tab-btn-active' : ''}`} onClick={() => setQualityView('overweight')}>
              Overweight only
            </button>
          </div>
          {qualityView === 'all' ? (
            <RankedBarChart
              title="Problem Rate by Seller"
              unit="%"
              color="#d03b3b"
              data={[...quality.data.bySeller].sort((a, b) => b.problemRatePercent - a.problemRatePercent).map((s) => ({ label: s.sellerName, value: round1(s.problemRatePercent) }))}
            />
          ) : (
            <RankedBarChart
              title="Overweight Rate by Seller"
              unit="%"
              color="#d03b3b"
              data={[...quality.data.overweight.bySeller]
                .sort((a, b) => b.overweightRatePercent - a.overweightRatePercent)
                .map((s) => ({ label: s.sellerName, value: round1(s.overweightRatePercent) }))}
            />
          )}
          <div style={{ marginTop: 20 }}>
            <LineChart
              title="Trend"
              color="#d03b3b"
              unit="%"
              data={
                qualityView === 'all'
                  ? quality.data.byPeriod.map((p) => ({ x: p.period, y: round1(p.problemRatePercent) }))
                  : quality.data.overweight.byPeriod.map((p) => ({ x: p.period, y: round1(p.overweightRatePercent) }))
              }
            />
          </div>
        </div>
      )}

      {sources.data && (
        <div className="card">
          <SectionHeading icon={Truck} tint="blue" title="Reception Sources" />
          <RankedBarChart
            title="Volume by Transporter Company"
            data={[...sources.data.topTransporters].sort((a, b) => b.totalQuantity - a.totalQuantity).map((t) => ({ label: t.transporterCompany, value: t.totalQuantity }))}
          />
        </div>
      )}

      {reliability.data && (
        <div className="card">
          <SectionHeading icon={AlertCircle} tint="orange" title="Reception Reliability" />
          <RankedBarChart
            title="Abandoned-Reception Rate by Staff"
            unit="%"
            color="#d03b3b"
            data={[...reliability.data.byStaff].sort((a, b) => b.unfinishedRatePercent - a.unfinishedRatePercent).map((s) => ({ label: s.userName, value: round1(s.unfinishedRatePercent) }))}
          />
          <div style={{ marginTop: 20 }}>
            <LineChart title="Trend" color="#d03b3b" unit="%" data={reliability.data.byPeriod.map((p) => ({ x: p.period, y: round1(p.unfinishedRatePercent) }))} />
          </div>
        </div>
      )}
    </div>
  );
}
