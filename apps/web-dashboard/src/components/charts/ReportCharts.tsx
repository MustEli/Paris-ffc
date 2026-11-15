import { Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { type ComponentType, useState } from 'react';

/**
 * Small, self-contained chart set for the Reception Reports page — no
 * charting library is installed in this project (checked package.json),
 * so these are plain SVG. Built per the dataviz skill's non-negotiables:
 * fixed-order categorical hues (never cycled), a legend whenever there's
 * more than one series, a hover tooltip on every mark, and a "View as
 * table" fallback on every chart. Colors below are the skill's own
 * pre-validated reference palette (references/palette.md), used verbatim
 * rather than re-validated — appropriate for an internal admin tool with
 * no existing chart-specific brand palette to swap in instead.
 */

/** Categorical slots 1-3 — validated all-pairs (CVD + normal-vision) in light mode, the only mode this dashboard uses. Fixed order, never cycled. */
export const CATEGORICAL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
/** Single flat hue for a one-series ranked bar / line — categorical slot 1. */
export const SINGLE_SERIES_COLOR = '#2a78d6';
export const INK_PRIMARY = '#0b0b0b';
export const INK_SECONDARY = '#52514e';
export const INK_MUTED = '#898781';
export const GRIDLINE = '#e1e0d9';
export const BASELINE = '#c3c2b7';

const numberFormatter = new Intl.NumberFormat();
function fmt(n: number): string {
  return numberFormatter.format(n);
}

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        background: INK_PRIMARY,
        color: '#fff',
        fontSize: 12,
        padding: '6px 10px',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      {children}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 12, fontWeight: 500, color: INK_SECONDARY }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: 'inline-block' }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

function TableToggle({ showTable, onToggle }: { showTable: boolean; onToggle: () => void }) {
  return (
    <button
      className="btn btn-outline"
      style={{ fontSize: 'var(--text-xs)', padding: '6px 12px' }}
      onClick={onToggle}
    >
      <Table2 size={13} />
      {showTable ? 'View chart' : 'View as table'}
    </button>
  );
}

function ChartHeader({
  title,
  extra,
  showTable,
  onToggleTable,
}: {
  title: string;
  extra?: React.ReactNode;
  showTable: boolean;
  onToggleTable: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-strong)', color: 'var(--gray-950)' }}>{title}</h3>
        {extra}
      </div>
      <TableToggle showTable={showTable} onToggle={onToggleTable} />
    </div>
  );
}

export interface StackedBarDatum {
  label: string;
  segments: { key: string; value: number }[];
}

/** One bar per period, segments = fixed-order categorical series. */
export function StackedBarChart({
  title,
  extra,
  data,
  legend,
  height = 220,
}: {
  title: string;
  extra?: React.ReactNode;
  data: StackedBarDatum[];
  legend: { key: string; color: string; label: string }[];
  height?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; label: string; rows: { label: string; value: number }[] } | null>(null);

  const colorByKey = new Map(legend.map((l) => [l.key, l.color]));
  const totals = data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0));
  const max = Math.max(1, ...totals);
  const width = Math.max(320, data.length * 56);
  const barWidth = Math.min(36, (width - 40) / Math.max(1, data.length) - 8);
  const plotHeight = height - 36;

  return (
    <div style={{ position: 'relative' }}>
      <ChartHeader title={title} extra={extra} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
      <Legend items={legend.map((l) => ({ color: l.color, label: l.label }))} />
      {showTable ? (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                {legend.map((l) => (
                  <th key={l.key}>{l.label}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  {legend.map((l) => (
                    <td key={l.key}>{fmt(d.segments.find((s) => s.key === l.key)?.value ?? 0)}</td>
                  ))}
                  <td>{fmt(totals[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
          <line x1={32} y1={plotHeight} x2={width - 4} y2={plotHeight} stroke={BASELINE} strokeWidth={1} />
          {data.map((d, i) => {
            const x = 40 + i * (barWidth + 20);
            let yCursor = plotHeight;
            return (
              <g key={d.label}>
                {d.segments.map((seg) => {
                  const segHeight = (seg.value / max) * (plotHeight - 10);
                  yCursor -= segHeight;
                  const y = yCursor;
                  if (segHeight <= 0) return null;
                  return (
                    <rect
                      key={seg.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(0, segHeight)}
                      rx={0}
                      fill={colorByKey.get(seg.key) ?? SINGLE_SERIES_COLOR}
                      onMouseEnter={(e) =>
                        setHover({
                          x: e.currentTarget.ownerSVGElement!.getBoundingClientRect().left + x + barWidth / 2,
                          y: e.currentTarget.ownerSVGElement!.getBoundingClientRect().top + y,
                          label: d.label,
                          rows: d.segments.map((s) => ({ label: legend.find((l) => l.key === s.key)?.label ?? s.key, value: s.value })),
                        })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
                <text x={x + barWidth / 2} y={plotHeight + 16} fontSize={11} fill={INK_MUTED} textAnchor="middle">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (
        <Tooltip x={hover.x - (typeof window !== 'undefined' ? 0 : 0)} y={hover.y}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{hover.label}</div>
          {hover.rows.map((r) => (
            <div key={r.label}>
              {r.label}: {r.value}
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal bars, caller-sorted (worst/highest first by convention). */
export function RankedBarChart({
  title,
  extra,
  data,
  unit = '',
  color = SINGLE_SERIES_COLOR,
  height,
}: {
  title: string;
  extra?: React.ReactNode;
  data: { label: string; value: number }[];
  unit?: string;
  color?: string;
  height?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const rowHeight = 28;
  const chartHeight = height ?? Math.max(60, data.length * rowHeight + 10);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <ChartHeader title={title} extra={extra} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
      {data.length === 0 ? (
        <p className="hint-text">No data for this period.</p>
      ) : showTable ? (
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>
                  {fmt(d.value)}
                  {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg width="100%" height={chartHeight} viewBox={`0 0 400 ${chartHeight}`} preserveAspectRatio="xMinYMid meet">
          {data.map((d, i) => {
            const barWidth = (d.value / max) * 230;
            const y = i * rowHeight;
            return (
              <g key={d.label}>
                <text x={0} y={y + 14} fontSize={11} fill={INK_SECONDARY}>
                  {d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}
                </text>
                <rect x={150} y={y + 4} width={Math.max(2, barWidth)} height={16} rx={2} fill={color}>
                  <title>
                    {d.label}: {fmt(d.value)}
                    {unit}
                  </title>
                </rect>
                <text x={150 + barWidth + 6} y={y + 16} fontSize={11} fill={INK_PRIMARY}>
                  {fmt(d.value)}
                  {unit}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Single-series trend line over period, with a dot per point and a hover tooltip. */
export function LineChart({
  title,
  extra,
  data,
  unit = '',
  color = SINGLE_SERIES_COLOR,
  height = 180,
}: {
  title: string;
  extra?: React.ReactNode;
  data: { x: string; y: number | null }[];
  unit?: string;
  color?: string;
  height?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const values = data.map((d) => d.y).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const width = Math.max(320, data.length * 50);
  const plotHeight = height - 30;
  const stepX = data.length > 1 ? (width - 40) / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: 20 + i * stepX,
    y: d.y === null ? null : plotHeight - (d.y / max) * (plotHeight - 10),
    raw: d,
  }));
  const linePoints = points.filter((p) => p.y !== null) as { x: number; y: number; raw: { x: string; y: number | null } }[];
  const path = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  return (
    <div style={{ position: 'relative' }}>
      <ChartHeader title={title} extra={extra} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
      {showTable ? (
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.x}>
                <td>{d.x}</td>
                <td>{d.y === null ? '—' : `${fmt(d.y)}${unit}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
          <line x1={16} y1={plotHeight} x2={width - 4} y2={plotHeight} stroke={BASELINE} strokeWidth={1} />
          <path d={path} fill="none" stroke={color} strokeWidth={2} />
          {points.map((p, i) =>
            p.y === null ? null : (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 5 : 4}
                  fill={color}
                  onMouseEnter={() => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
                />
                <text x={p.x} y={plotHeight + 14} fontSize={10} fill={INK_MUTED} textAnchor="middle">
                  {p.raw.x}
                </text>
              </g>
            ),
          )}
        </svg>
      )}
      {hoverIndex !== null && points[hoverIndex]?.y !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${(points[hoverIndex]!.x / width) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -4px)',
            background: INK_PRIMARY,
            color: '#fff',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {points[hoverIndex]!.raw.x}: {points[hoverIndex]!.raw.y !== null ? fmt(points[hoverIndex]!.raw.y!) : '—'}
          {unit}
        </div>
      )}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tint = 'blue',
}: {
  label: string;
  value: React.ReactNode;
  icon?: ComponentType<{ size?: number }>;
  tint?: 'orange' | 'blue' | 'green' | 'purple' | 'gray' | 'red';
}) {
  return (
    <div className="stat-tile">
      {Icon && (
        <span className={`icon-badge icon-badge-${tint}`}>
          <Icon />
        </span>
      )}
      <div className="stat-tile-body">
        <div className="stat-tile-label">{label}</div>
        <div className="stat-tile-value">{value}</div>
      </div>
    </div>
  );
}

export function PercentChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const up = percent >= 0;
  return (
    <span className={`pill ${up ? 'pill-green' : 'pill-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(Math.round(percent))}% vs last period
    </span>
  );
}
