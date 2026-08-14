import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AdminHomeScreen } from './screens/AdminHomeScreen';

export type AdminStackParamList = {
  AdminHome: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />
    </Stack.Navigator>
  );
}
