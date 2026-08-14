import { NavigationContainer } from '@react-navigation/native';

import { useAuthStore } from '../core/auth/authStore';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { ManagementNavigator } from './ManagementNavigator';
import { StaffNavigator } from './StaffNavigator';

/**
 * Routes to a role-specific stack once "logged in" (see core/auth/authStore
 * for why that's in quotes), or the login stack otherwise. Each role stack
 * is self-contained, so a future feature (e.g. Attendance) only needs to
 * add screens to StaffNavigator/AdminNavigator — nothing here changes.
 */
export function RootNavigator() {
  const role = useAuthStore((state) => state.role);

  return (
    <NavigationContainer>
      {role === null && <AuthNavigator />}
      {role === 'staff' && <StaffNavigator />}
      {role === 'admin' && <AdminNavigator />}
      {role === 'management' && <ManagementNavigator />}
    </NavigationContainer>
  );
}
