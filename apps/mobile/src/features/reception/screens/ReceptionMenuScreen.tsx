import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBox } from '../../../core/components/MenuBox';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'ReceptionMenu'>;
}

/** Reception's 4-way split — tap a category, land in its own world (history + add new), or Seller Stock's own feature for pallets. */
export function ReceptionMenuScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={styles.title}>Reception</Text>

      <MenuBox
        label="Return Parcels"
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'return_parcels' })}
      />
      <MenuBox
        label="Packaging Stock"
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'packaging_stock' })}
      />
      <MenuBox label="Sellers Stock" onPress={() => navigation.navigate('SellerStockList')} />
      <MenuBox
        label="Equipment & Other"
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'equipment_other' })}
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
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
});
