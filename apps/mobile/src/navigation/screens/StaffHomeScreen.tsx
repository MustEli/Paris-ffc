import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBox } from '../../core/components/MenuBox';
import { colors } from '../../core/theme/colors';
import { spacing } from '../../core/theme/spacing';
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
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <MenuBox label={t('mainMenu.reception')} onPress={() => navigation.navigate('ReceptionStart')} />
      <MenuBox label={t('mainMenu.floorTasks')} onPress={() => navigation.navigate('FloorTasks')} />
      <MenuBox
        label={t('mainMenu.openPoolTasks')}
        onPress={() => navigation.navigate('OpenPool')}
        badgeCount={availableOpenPoolTasks?.length}
      />
      <MenuBox
        label={t('mainMenu.issueReporting')}
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
