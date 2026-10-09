import { NavigationContainer } from '@react-navigation/native';
import { useEffect } from 'react';

import { useAuthStore } from '../core/auth/authStore';
import { useLanguageStore } from '../core/i18n/languageStore'; // importing this also initializes the i18next instance (see languageStore.ts's own import of i18n.ts) before anything calls useTranslation()
import { useCurrentRouteStore } from '../core/navigation/currentRouteStore';
import { navigationRef } from '../core/navigation/navigationRef';
import { useRealtimeConnection } from '../core/realtime/useRealtimeConnection';
import { DirectiveOverlay } from '../features/directives/components/DirectiveOverlay';
import { AdminNavigator } from './AdminNavigator';
import { AuthNavigator } from './AuthNavigator';
import { ManagementNavigator } from './ManagementNavigator';
import { StaffNavigator } from './StaffNavigator';

function syncCurrentRoute(): void {
  useCurrentRouteStore.getState().setRouteName(navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name ?? null : null);
}

/**
 * Routes to a role-specific stack once actually logged in (real JWT from
 * the backend — see core/auth/authStore), or the login stack otherwise.
 * Each role stack is self-contained, so a feature like Attendance only
 * needs to add screens to StaffNavigator — nothing here changes.
 */
export function RootNavigator() {
  const user = useAuthStore((state) => state.user);
  // Owns the shared real-time socket's teardown on logout — see its own
  // doc comment for why it doesn't need to *create* the socket too.
  useRealtimeConnection();

  // Loads the staff member's saved language choice (if any) once, on
  // launch — see languageStore.ts. Defaults to English until this
  // resolves, which is deliberately not gated on with a loading screen:
  // the saved preference, if any, almost always resolves well before
  // anyone's actually reading text (right as the splash screen clears).
  useEffect(() => {
    void useLanguageStore.getState().loadSaved();
  }, []);

  return (
    <NavigationContainer ref={navigationRef} onReady={syncCurrentRoute} onStateChange={syncCurrentRoute}>
      {user === null && <AuthNavigator />}
      {user?.role === 'staff' && <StaffNavigator />}
      {user?.role === 'admin' && <AdminNavigator />}
      {user?.role === 'management' && <ManagementNavigator />}
      <DirectiveOverlay />
    </NavigationContainer>
  );
}
