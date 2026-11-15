import { AlertTriangle, Clock, PackageSearch, RotateCcw, Sparkles } from 'lucide-react';

/** Picks a nav-consistent icon/tint purely from the title text, so each of the 3 "coming soon" routes (see Layout.tsx's NAV_ITEMS) gets its own identity without this component needing a new prop. */
function pickIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('order prep')) return { Icon: PackageSearch, tint: 'orange' };
  if (t.includes('return')) return { Icon: RotateCcw, tint: 'blue' };
  if (t.includes('issue') || t.includes('exception')) return { Icon: AlertTriangle, tint: 'red' };
  return { Icon: Sparkles, tint: 'purple' };
}

/** Nav sections the customer named that don't have a real page built yet — see Layout.tsx's NAV_ITEMS. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const { Icon, tint } = pickIcon(title);

  return (
    <div>
      <div className="page-header-row">
        <span className={`icon-badge icon-badge-${tint}`}>
          <Icon />
        </span>
        <div className="page-header-text">
          <h1>{title}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {description}
          </p>
        </div>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <span
          className="icon-badge icon-badge-gray"
          style={{ width: 64, height: 64, borderRadius: 'var(--radius-lg)', margin: '0 auto 16px' }}
        >
          <Clock size={30} />
        </span>
        <p className="hint-text" style={{ fontSize: 14 }}>
          This section is coming soon — check back after the next update.
        </p>
      </div>
    </div>
  );
}
