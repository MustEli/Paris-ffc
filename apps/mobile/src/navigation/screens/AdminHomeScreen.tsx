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
      ]}
    />
  );
}
