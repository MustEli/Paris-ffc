import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NewOrderPrepSessionScreen } from '../features/orderPrep/screens/NewOrderPrepSessionScreen';
import { OrderPrepSessionDetailScreen } from '../features/orderPrep/screens/OrderPrepSessionDetailScreen';
import { OrderPrepSessionListScreen } from '../features/orderPrep/screens/OrderPrepSessionListScreen';
import { OrderPrepTaskDetailScreen } from '../features/orderPrep/screens/OrderPrepTaskDetailScreen';
import { AssignTaskScreen } from '../features/putAway/screens/AssignTaskScreen';
import { PutAwayTaskDetailScreen } from '../features/putAway/screens/PutAwayTaskDetailScreen';
import { PutAwayTaskListScreen } from '../features/putAway/screens/PutAwayTaskListScreen';
import { ReceptionDetailScreen } from '../features/reception/screens/ReceptionDetailScreen';
import { ReceptionListScreen } from '../features/reception/screens/ReceptionListScreen';
import { SellerStockDetailScreen } from '../features/sellerStock/screens/SellerStockDetailScreen';
import { SellerStockListScreen } from '../features/sellerStock/screens/SellerStockListScreen';
import { AdminHomeScreen } from './screens/AdminHomeScreen';
import { type AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
      <Stack.Screen
        name="ReceptionList"
        component={ReceptionListScreen}
        options={{ title: 'Reception Log' }}
      />
      <Stack.Screen
        name="ReceptionDetail"
        component={ReceptionDetailScreen}
        options={{ title: 'Delivery' }}
      />
      <Stack.Screen
        name="SellerStockList"
        component={SellerStockListScreen}
        options={{ title: 'Seller Stock Pipeline' }}
      />
      <Stack.Screen
        name="SellerStockDetail"
        component={SellerStockDetailScreen}
        options={{ title: 'Pallet' }}
      />
      <Stack.Screen
        name="PutAwayTaskList"
        component={PutAwayTaskListScreen}
        options={{ title: 'Put-Away Tasks' }}
      />
      <Stack.Screen name="AssignTask" component={AssignTaskScreen} options={{ title: 'Assign Task' }} />
      <Stack.Screen
        name="PutAwayTaskDetail"
        component={PutAwayTaskDetailScreen}
        options={{ title: 'Put-Away Task' }}
      />
      <Stack.Screen
        name="OrderPrepSessionList"
        component={OrderPrepSessionListScreen}
        options={{ title: 'Order Prep' }}
      />
      <Stack.Screen
        name="NewOrderPrepSession"
        component={NewOrderPrepSessionScreen}
        options={{ title: 'New Session' }}
      />
      <Stack.Screen
        name="OrderPrepSessionDetail"
        component={OrderPrepSessionDetailScreen}
        options={{ title: 'Session' }}
      />
      <Stack.Screen
        name="OrderPrepTaskDetail"
        component={OrderPrepTaskDetailScreen}
        options={{ title: 'Order Prep Task' }}
      />
    </Stack.Navigator>
  );
}
