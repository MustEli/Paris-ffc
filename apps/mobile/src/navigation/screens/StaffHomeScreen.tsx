import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CircleAlert, Footprints, Layers, Package } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBox } from '../../core/components/MenuBox';
import { colors } from '../../core/theme/colors';
import { spacing } from '../../core/theme/spacing';
import { useConfirmEndShift } from '../../features/attendance/components/ShiftStatusBar';
import { useShiftStatus } from '../../features/attendance/hooks/useShiftStatus';
import { useOpenPoolTasks } from '../../features/openPool/hooks/useOpenPool';
import { type StaffStackParamList } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'StaffHome'>;
}

/**
 * Staff-view redesign's main menu — 4 boxes. Seller Stock and My Tasks
 * are gone as their own entries (absorbed into Reception and Floor
 * Tasks respectively); Attendance is gone too (lives in the persistent
 * shift-status bar now — see StaffAppShell/ShiftStatusBar). Staff can't
 * even reach this screen's boxes without an active, non-break shift —
 * StaffAppShell's LockedGate covers this whole screen until then.
 */
export function StaffHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: availableOpenPoolTasks } = useOpenPoolTasks();
  const { end } = useShiftStatus();
  const confirmEndShift = useConfirmEndShift(end);

  // The Main Menu is the root of the Staff stack — there's nowhere for
  // the hardware back button to usefully go back to, so instead of
  // popping out of the app (or doing nothing), it now asks to end the
  // shift, reusing the exact same confirmation ShiftStatusBar's own
  // "End Shift" action uses. Scoped to this screen only via
  // useFocusEffect — every other screen keeps its normal back-button
  // behavior.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        confirmEndShift();
        return true;
      });
      return () => subscription.remove();
    }, [confirmEndShift]),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <MenuBox
        label={t('mainMenu.reception')}
        icon={<Package size={28} color={colors.brandOrange} />}
        onPress={() => navigation.navigate('ReceptionStart')}
      />
      <MenuBox
        label={t('mainMenu.floorTasks')}
        icon={<Footprints size={28} color={colors.brandOrange} />}
        onPress={() => navigation.navigate('FloorTasks')}
      />
      <MenuBox
        label={t('mainMenu.openPoolTasks')}
        icon={<Layers size={28} color={colors.brandOrange} />}
        onPress={() => navigation.navigate('OpenPool')}
        badgeCount={availableOpenPoolTasks?.length}
      />
      <MenuBox
        label={t('mainMenu.issueReporting')}
        icon={<CircleAlert size={28} color={colors.alert} />}
        variant="alert"
        spacedAbove
        onPress={() => navigation.navigate('IssueReportingMenu')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing[5],
    paddingTop: spacing[8],
    // 14 in the original, nudged up to the nearest scale step (16) —
    // imperceptible, consolidates with the handful of other near-14
    // gaps found elsewhere in this pass.
    gap: spacing[4],
  },
});
