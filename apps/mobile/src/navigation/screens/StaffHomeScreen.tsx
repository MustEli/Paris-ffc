import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useShiftStatus } from '../../features/attendance/hooks/useShiftStatus';
import { type StaffStackParamList } from '../types';
import { MenuScreen } from './MenuScreen';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'StaffHome'>;
}

const OFF_SHIFT_HINT = 'Start your shift in Attendance to unlock this.';
const ON_BREAK_HINT = 'End your break in Attendance to unlock this.';

/**
 * Staff can't use anything here except Attendance without an active
 * shift, NOR while on any break (lunch or short) — enforced for real on
 * the backend (ActiveShiftGuard), this is just the matching UI: locked
 * cards instead of a confusing rejected request after tapping in.
 * Starting a break locks these out exactly the same way as not having
 * started a shift at all, until the break is ended.
 */
export function StaffHomeScreen({ navigation }: Props) {
  const { status, isLoadingStatus } = useShiftStatus();
  // While status is still loading, don't flash the locked state — treat
  // as unlocked briefly rather than a misleading lock-then-unlock blink.
  const onShift = isLoadingStatus || !!status?.active;
  const onBreak = !isLoadingStatus && !!status?.onBreak;
  const canWork = onShift && !onBreak;
  const lockedHint = onBreak ? ON_BREAK_HINT : OFF_SHIFT_HINT;

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
          disabled: !canWork,
          disabledHint: lockedHint,
          onPress: () => navigation.navigate('ReceptionList'),
        },
        {
          label: 'Seller Stock',
          description: 'Log seller pallets, capture photos, and confirm placement.',
          disabled: !canWork,
          disabledHint: lockedHint,
          onPress: () => navigation.navigate('SellerStockList'),
        },
        {
          label: 'My Tasks',
          description: 'Start, complete, or report an issue on assigned put-away and order-prep tasks.',
          disabled: !canWork,
          disabledHint: lockedHint,
          onPress: () => navigation.navigate('MyTasks'),
        },
        {
          label: 'Floor Tasks',
          description: 'Pick, Pack, Return, Box Prep, Warehousing, and Backup — self-declared as you go.',
          disabled: !canWork,
          disabledHint: lockedHint,
          onPress: () => navigation.navigate('FloorTasks'),
        },
        {
          label: 'Open Pool Tasks',
          description: 'Claim an unassigned task before anyone else does.',
          disabled: !canWork,
          disabledHint: lockedHint,
          onPress: () => navigation.navigate('OpenPool'),
        },
      ]}
    />
  );
}
