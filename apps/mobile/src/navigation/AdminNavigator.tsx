import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
    </Stack.Navigator>
  );
}
