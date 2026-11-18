import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Barcode,
  CircleAlert,
  CircleEllipsis,
  CircleHelp,
  CircleX,
  FileText,
  type LucideIcon,
  MapPin,
  Package,
  TriangleAlert,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '../../../core/components/ListRow';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { CATEGORY_META, type IssueReportCategory } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'IssueReportingMenu'>;
}

const CATEGORY_ICON: Record<IssueReportCategory, LucideIcon> = {
  non_traceable_return_parcel: CircleHelp,
  non_fulfillment_return_parcel: CircleX,
  no_return_request_generated: FileText,
  shipment_label_not_generatable: Barcode,
  item_found_out_of_location: MapPin,
  empty_crate: Package,
  part_broken_in_location: TriangleAlert,
  heavy_crate: CircleAlert,
  other: CircleEllipsis,
};

/** One-tap floor-blocker capture — see issue-report.types.ts (backend) for the per-category field doc. */
export function IssueReportingMenuScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>{t('issueReports.title')}</Text>
      {CATEGORY_META.map((meta, index) => (
        <ListRow
          key={meta.category}
          label={t(meta.label)}
          icon={CATEGORY_ICON[meta.category]}
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
