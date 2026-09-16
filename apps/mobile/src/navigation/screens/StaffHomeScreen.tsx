import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useShiftStatus } from '../../features/attendance/hooks/useShiftStatus';
import { type StaffStackParamList } from '../types';
import { MenuScreen } from './MenuScreen';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'StaffHome'>;
}

const LOCKED_HINT = 'Start your shift in Attendance to unlock this.';

/**
 * Staff can't use anything here except Attendance without an active
 * shift — enforced for real on the backend (ActiveShiftGuard), this is
 * just the matching UI: locked cards instead of a confusing rejected
 * request after tapping in. Lunch/short breaks don't count as "off
 * shift" — this only cares about status.active, same as the backend.
 */
export function StaffHomeScreen({ navigation }: Props) {
  const { status, isLoadingStatus } = useShiftStatus();
  // While status is still loading, don't flash the locked state — treat
  // as unlocked briefly rather than a misleading lock-then-unlock blink.
  const onShift = isLoadingStatus || !!status?.active;

  return (
    <MenuScreen
      roleLabel="Staff"
      items={[
        {
          label: 'Attendance',
          description: 'Clock in and out for your shift.',
          onPress: () => navigation.navigate('Attendance'),
        },
        {
          label: 'Reception',
          description: 'Log incoming deliveries and confirm put-away.',
          disabled: !onShift,
          disabledHint: LOCKED_HINT,
          onPress: () => navigation.navigate('ReceptionList'),
        },
        {
          label: 'Seller Stock',
          description: 'Log seller pallets, capture photos, and confirm placement.',
          disabled: !onShift,
          disabledHint: LOCKED_HINT,
          onPress: () => navigation.navigate('SellerStockList'),
        },
        {
          label: 'My Put-Away Tasks',
          description: 'Start, complete, or report an issue on assigned tasks.',
          disabled: !onShift,
          disabledHint: LOCKED_HINT,
          onPress: () => navigation.navigate('PutAwayTaskList'),
        },
        {
          label: 'My Order Prep Tasks',
          description: 'Start and complete your picking or packing tasks.',
          disabled: !onShift,
          disabledHint: LOCKED_HINT,
          onPress: () => navigation.navigate('OrderPrepTaskList'),
        },
      ]}
    />
  );
}
