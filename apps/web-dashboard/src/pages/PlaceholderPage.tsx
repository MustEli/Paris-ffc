import { Clock, PackageSearch, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ICON_BY_VARIANT = {
  orderPrep: { Icon: PackageSearch, tint: 'orange' },
  returnProcessing: { Icon: RotateCcw, tint: 'blue' },
} as const;

/** Nav sections the customer named that don't have a real page built yet — see Layout.tsx's NAV_ITEMS. */
export function PlaceholderPage({
  title,
  description,
  variant,
}: {
  title: string;
  description: string;
  variant: keyof typeof ICON_BY_VARIANT;
}) {
  const { t } = useTranslation('common');
  const { Icon, tint } = ICON_BY_VARIANT[variant] ?? { Icon: Sparkles, tint: 'purple' };

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
          {t('placeholder.comingSoon')}
        </p>
      </div>
    </div>
  );
}
