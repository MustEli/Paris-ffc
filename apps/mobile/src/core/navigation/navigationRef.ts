import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Lets components that aren't a Screen themselves (ShiftStatusBar,
 * rendered once as a persistent shell around the whole Staff stack)
 * still navigate — e.g. the Home icon jumping to the main menu from
 * anywhere. Standard React Navigation pattern for navigating without a
 * `navigation` prop. See currentRouteStore.ts for the reactive
 * "what screen am I on" counterpart (this ref alone isn't reactive).
 */
// Explicit generic: the project doesn't declare a global
// ReactNavigation.RootParamList augmentation (each role stack has its
// own param list instead), so the default generic resolves to an
// unusable `never` for getCurrentRoute() without this.
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();
