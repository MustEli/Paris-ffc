import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ShiftScreen } from '../features/attendance/screens/ShiftScreen';
import { NewDeliveryScreen } from '../features/reception/screens/NewDeliveryScreen';
import { ReceptionDetailScreen } from '../features/reception/screens/ReceptionDetailScreen';
import { ReceptionListScreen } from '../features/reception/screens/ReceptionListScreen';
import { StaffHomeScreen } from './screens/StaffHomeScreen';
import { type StaffStackParamList } from './types';

const Stack = createNativeStackNavigator<StaffStackParamList>();

export function StaffNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StaffHome" component={StaffHomeScreen} options={{ title: 'Staff' }} />
      <Stack.Screen name="Attendance" component={ShiftScreen} options={{ title: 'Attendance' }} />
      <Stack.Screen name="ReceptionList" component={ReceptionListScreen} options={{ title: 'Reception' }} />
      <Stack.Screen name="NewDelivery" component={NewDeliveryScreen} options={{ title: 'New Delivery' }} />
      <Stack.Screen
        name="ReceptionDetail"
        component={ReceptionDetailScreen}
        options={{ title: 'Delivery' }}
      />
    </Stack.Navigator>
  );
}
