import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StaffHomeScreen } from './screens/StaffHomeScreen';

export type StaffStackParamList = {
  StaffHome: undefined;
};

const Stack = createNativeStackNavigator<StaffStackParamList>();

export function StaffNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StaffHome" component={StaffHomeScreen} options={{ title: 'Staff' }} />
    </Stack.Navigator>
  );
}
