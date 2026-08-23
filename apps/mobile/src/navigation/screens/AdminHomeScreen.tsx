import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { type AdminStackParamList } from '../types';
import { MenuScreen } from './MenuScreen';

interface Props {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;
}

export function AdminHomeScreen({ navigation }: Props) {
  return (
    <MenuScreen
      roleLabel="Admin"
      items={[
        {
          label: 'Reception log',
          description: 'Review incoming deliveries and give put-away instructions.',
          onPress: () => navigation.navigate('ReceptionList'),
        },
        {
          label: 'Seller Stock pipeline',
          description: 'Review pallets, especially damaged/overweight ones, and give put-away locations.',
          onPress: () => navigation.navigate('SellerStockList'),
        },
        {
          label: 'Put-Away Tasks',
          description: 'See task progress and reassign any that hit an issue.',
          onPress: () => navigation.navigate('PutAwayTaskList'),
        },
        {
          label: 'Order Prep',
          description: 'Calculate staffing for a volume of parts and assign pickers/packers.',
          onPress: () => navigation.navigate('OrderPrepSessionList'),
        },
      ]}
    />
  );
}
