import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ManagementHomeScreen } from './screens/ManagementHomeScreen';

export type ManagementStackParamList = {
  ManagementHome: undefined;
};

const Stack = createNativeStackNavigator<ManagementStackParamList>();

export function ManagementNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ManagementHome"
        component={ManagementHomeScreen}
        options={{ title: 'Management' }}
      />
    </Stack.Navigator>
  );
}
