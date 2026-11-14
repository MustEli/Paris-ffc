import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

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
      <h1>Reception Reports</h1>
      <p className="page-subtitle">Delivery volume, processing time, Seller Stock quality, sources, and reliability.</p>

      <div className="card">
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="flex-row">
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Granularity</label>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value as ReportGranularity)}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </div>
          <div className="flex-row">
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-row">
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              Clear dates
            </button>
          )}
        </div>

        <div className="stat-grid" style={{ marginTop: 16 }}>
          <StatTile label="Deliveries (latest period)" value={latestVolume?.total ?? '—'} />
          <StatTile label="Avg. reception duration" value={latestDuration?.averageMinutes != null ? `${round1(latestDuration.averageMinutes)} min` : '—'} />
          <StatTile label="Seller Stock problem rate" value={latestQuality != null ? `${round1(latestQuality.problemRatePercent)}%` : '—'} />
          <StatTile label="Abandoned-reception rate" value={latestReliability != null ? `${round1(latestReliability.unfinishedRatePercent)}%` : '—'} />
        </div>
      </div>

      {isLoading && <p>Loading…</p>}
      {firstError && <p className="error-text">{firstError.message}</p>}

      {volume.data && (
        <div className="card">
          <StackedBarChart
            title="Delivery Volume"
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
          <LineChart title="Reception Duration — Trend" data={duration.data.byPeriod.map((p) => ({ x: p.period, y: p.averageMinutes }))} unit=" min" />
          <div style={{ marginTop: 20 }}>
            <div className="flex-row" style={{ marginBottom: 8 }}>
              <button
                className={`btn ${durationDimension === 'category' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setDurationDimension('category')}
              >
                By Category
              </button>
              <button
                className={`btn ${durationDimension === 'staff' ? 'btn-primary' : 'btn-outline'}`}
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
          <div className="flex-row" style={{ marginBottom: 8 }}>
            <button
              className={`btn ${qualityView === 'all' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setQualityView('all')}
            >
              All problems
            </button>
            <button
              className={`btn ${qualityView === 'overweight' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setQualityView('overweight')}
            >
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
              title="Overall Problem Rate — Trend"
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
          <RankedBarChart
            title="Volume by Transporter Company"
            data={[...sources.data.topTransporters].sort((a, b) => b.totalQuantity - a.totalQuantity).map((t) => ({ label: t.transporterCompany, value: t.totalQuantity }))}
          />
        </div>
      )}

      {reliability.data && (
        <div className="card">
          <RankedBarChart
            title="Abandoned-Reception Rate by Staff"
            unit="%"
            color="#d03b3b"
            data={[...reliability.data.byStaff].sort((a, b) => b.unfinishedRatePercent - a.unfinishedRatePercent).map((s) => ({ label: s.userName, value: round1(s.unfinishedRatePercent) }))}
          />
          <div style={{ marginTop: 20 }}>
            <LineChart title="Abandoned-Reception Rate — Trend" color="#d03b3b" unit="%" data={reliability.data.byPeriod.map((p) => ({ x: p.period, y: round1(p.unfinishedRatePercent) }))} />
          </div>
        </div>
      )}
    </div>
  );
}
