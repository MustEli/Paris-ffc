import i18n from '../../core/i18n/i18n';
import { type Reception } from './types';

/** One-line human summary of a reception's category-specific details. Uses i18n's singleton directly (not a hook) since this is a plain utility, not a component. */
export function summarizeDetails(reception: Reception): string {
  const { details } = reception;
  switch (details.category) {
    case 'return_parcels':
      return i18n.t('reception.summary.returnParcels', {
        count: details.parcelCount,
        transporterCompany: details.transporterCompany,
      });
    case 'packaging_stock':
      return i18n.t('reception.summary.packagingStock', {
        count: details.parcelCount,
        packagingType: details.packagingType,
        sellerName: details.sellerName,
      });
    case 'sellers_stock':
      return i18n.t('reception.summary.sellersStock', { count: details.palletCount });
    case 'equipment_other':
      return i18n.t('reception.summary.equipmentOther', {
        count: details.parcelCount,
        itemDescription: details.itemDescription,
      });
  }
}

/** Values are i18n keys (see core/i18n/translations/en.ts's `reception.status` namespace), not display text — callers must wrap with t(). */
export const STATUS_LABELS: Record<Reception['status'], string> = {
  arrived: 'reception.status.awaitingInstructions',
  ready_for_putaway: 'reception.status.readyForPutAway',
  completed: 'reception.status.completed',
};
