import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ShiftScreen } from '../features/attendance/screens/ShiftScreen';
import { useTaskAssignmentAlerts } from '../features/putAway/hooks/useTaskAssignmentAlerts';
import { PutAwayTaskDetailScreen } from '../features/putAway/screens/PutAwayTaskDetailScreen';
import { PutAwayTaskListScreen } from '../features/putAway/screens/PutAwayTaskListScreen';
import { NewDeliveryScreen } from '../features/reception/screens/NewDeliveryScreen';
import { ReceptionDetailScreen } from '../features/reception/screens/ReceptionDetailScreen';
import { ReceptionListScreen } from '../features/reception/screens/ReceptionListScreen';
import { NewPalletScreen } from '../features/sellerStock/screens/NewPalletScreen';
import { SellerStockDetailScreen } from '../features/sellerStock/screens/SellerStockDetailScreen';
import { SellerStockListScreen } from '../features/sellerStock/screens/SellerStockListScreen';
import { StaffHomeScreen } from './screens/StaffHomeScreen';
import { type StaffStackParamList } from './types';

const Stack = createNativeStackNavigator<StaffStackParamList>();

export function StaffNavigator() {
  // Polls for new task assignments and fires a local audible alert —
  // mounted here (not inside a specific screen) so it keeps running
  // for the whole staff session, regardless of which screen is active.
  useTaskAssignmentAlerts();

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
      <Stack.Screen
        name="SellerStockList"
        component={SellerStockListScreen}
        options={{ title: 'Seller Stock' }}
      />
      <Stack.Screen name="NewPallet" component={NewPalletScreen} options={{ title: 'New Pallet' }} />
      <Stack.Screen
        name="SellerStockDetail"
        component={SellerStockDetailScreen}
        options={{ title: 'Pallet' }}
      />
      <Stack.Screen
        name="PutAwayTaskList"
        component={PutAwayTaskListScreen}
        options={{ title: 'My Put-Away Tasks' }}
      />
      <Stack.Screen
        name="PutAwayTaskDetail"
        component={PutAwayTaskDetailScreen}
        options={{ title: 'Put-Away Task' }}
      />
    </Stack.Navigator>
  );
}
