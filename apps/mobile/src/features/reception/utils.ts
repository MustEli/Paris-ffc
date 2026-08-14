import { type Reception } from './types';

/** One-line human summary of a reception's category-specific details. */
export function summarizeDetails(reception: Reception): string {
  const { details } = reception;
  switch (details.category) {
    case 'return_parcels':
      return `${details.parcelCount} parcel(s) from ${details.transporterCompany}`;
    case 'packaging_stock':
      return `${details.parcelCount} parcel(s) — ${details.packagingType}`;
    case 'sellers_stock':
      return `${details.palletCount} pallet(s)`;
    case 'equipment_other':
      return `${details.parcelCount} parcel(s) — ${details.itemDescription}`;
  }
}

export const STATUS_LABELS: Record<Reception['status'], string> = {
  arrived: 'Awaiting instructions',
  ready_for_putaway: 'Ready for put-away',
  completed: 'Completed',
};
