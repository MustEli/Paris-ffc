import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '../../../core/components/ListRow';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { CATEGORY_META } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'IssueReportingMenu'>;
}

/** One-tap floor-blocker capture — see issue-report.types.ts (backend) for the per-category field doc. */
export function IssueReportingMenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>Issue Reporting</Text>
      {CATEGORY_META.map((meta, index) => (
        <ListRow
          key={meta.category}
          label={meta.label}
          strongDividerBelow={CATEGORY_META[index + 1]?.strongDividerAbove}
          onPress={() => navigation.navigate('IssueReportForm', { category: meta.category })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    padding: 20,
  },
});
