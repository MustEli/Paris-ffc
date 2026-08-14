import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ShiftScreen } from '../features/attendance/screens/ShiftScreen';

export type StaffStackParamList = {
  StaffHome: undefined;
};

const Stack = createNativeStackNavigator<StaffStackParamList>();

export function StaffNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StaffHome" component={ShiftScreen} options={{ title: 'Staff' }} />
    </Stack.Navigator>
  );
}
