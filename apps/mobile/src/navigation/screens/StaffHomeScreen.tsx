import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBox } from '../../core/components/MenuBox';
import { colors } from '../../core/theme/colors';
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
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <MenuBox label="Reception" onPress={() => navigation.navigate('ReceptionMenu')} />
      <MenuBox label="Floor Tasks" onPress={() => navigation.navigate('FloorTasks')} />
      <MenuBox label="Open Pool Tasks" onPress={() => navigation.navigate('OpenPool')} />
      <MenuBox
        label="Issue Reporting"
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
    padding: 20,
    paddingTop: 32,
    gap: 14,
  },
});
