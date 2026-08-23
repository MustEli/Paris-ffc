import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { type ManagementStackParamList } from '../types';
import { MenuScreen } from './MenuScreen';

interface Props {
  navigation: NativeStackNavigationProp<ManagementStackParamList, 'ManagementHome'>;
}

export function ManagementHomeScreen({ navigation }: Props) {
  return (
    <MenuScreen
      roleLabel="Management"
      items={[
        {
          label: 'Dashboard',
          description: 'Aggregated performance data and visual analytics across all warehouse activity.',
          onPress: () => navigation.navigate('Dashboard'),
        },
        {
          label: 'Reception log',
          description: 'Browse incoming deliveries and their put-away status.',
          onPress: () => navigation.navigate('ReceptionList'),
        },
        {
          label: 'Seller Stock pipeline',
          description: 'Browse pallets, including damaged/overweight ones under review.',
          onPress: () => navigation.navigate('SellerStockList'),
        },
        {
          label: 'Put-Away Tasks',
          description: 'Browse task progress across all staff.',
          onPress: () => navigation.navigate('PutAwayTaskList'),
        },
        {
          label: 'Order Prep',
          description: 'Browse sessions, staffing calculations, and task progress.',
          onPress: () => navigation.navigate('OrderPrepSessionList'),
        },
      ]}
    />
  );
}
