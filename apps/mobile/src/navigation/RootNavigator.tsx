import { NavigationContainer } from '@react-navigation/native';

import { useAuthStore } from '../core/auth/authStore';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { ManagementNavigator } from './ManagementNavigator';
import { StaffNavigator } from './StaffNavigator';

/**
 * Routes to a role-specific stack once actually logged in (real JWT from
 * the backend — see core/auth/authStore), or the login stack otherwise.
 * Each role stack is self-contained, so a feature like Attendance only
 * needs to add screens to StaffNavigator — nothing here changes.
 */
export function RootNavigator() {
  const user = useAuthStore((state) => state.user);

  return (
    <NavigationContainer>
      {user === null && <AuthNavigator />}
      {user?.role === 'staff' && <StaffNavigator />}
      {user?.role === 'admin' && <AdminNavigator />}
      {user?.role === 'management' && <ManagementNavigator />}
    </NavigationContainer>
  );
}
