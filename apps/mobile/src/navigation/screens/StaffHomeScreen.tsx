import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { type StaffStackParamList } from '../types';
import { MenuScreen } from './MenuScreen';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'StaffHome'>;
}

export function StaffHomeScreen({ navigation }: Props) {
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
          onPress: () => navigation.navigate('ReceptionList'),
        },
        {
          label: 'Seller Stock',
          description: 'Log seller pallets, capture photos, and confirm placement.',
          onPress: () => navigation.navigate('SellerStockList'),
        },
        {
          label: 'My Put-Away Tasks',
          description: 'Start, complete, or report an issue on assigned tasks.',
          onPress: () => navigation.navigate('PutAwayTaskList'),
        },
      ]}
    />
  );
}
