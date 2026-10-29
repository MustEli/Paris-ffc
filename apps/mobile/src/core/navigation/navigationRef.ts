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

/**
 * Jumps straight back to Staff's main menu — called after any
 * "finished a task" action (Floor Tasks Stop, Put-Away/Order-Prep
 * Complete, Reception's put-away confirm, Seller Stock's Log Pallet,
 * Reception's Log Delivery, Issue Reporting's Submit), per the user's
 * explicit "doesn't matter what task, go straight to main menu" rule.
 * Uses this global ref rather than each screen's own typed `navigation`
 * prop since several of these screens are shared across Staff/Admin/
 * Management stacks, none of which (besides Staff's) even have a
 * `StaffHome` route — the actions this is wired to are already
 * role-gated to staff only, so this only ever fires while the Staff
 * stack is actually the active one.
 */
export function goToStaffHome() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('StaffHome' as never);
  }
}
