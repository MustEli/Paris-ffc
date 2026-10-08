import { create } from 'zustand';

/**
 * Mirrors the active route name, updated from RootNavigator's
 * onReady/onStateChange — ShiftStatusBar reads this (rather than
 * useNavigationState, which needs to be called from inside a Screen) to
 * know whether it's currently on the main menu, so it can hide the Home
 * icon there. See navigationRef.ts for the non-reactive navigate side.
 */
interface CurrentRouteState {
  routeName: string | null;
  setRouteName: (name: string | null) => void;
}

export const useCurrentRouteStore = create<CurrentRouteState>((set) => ({
  routeName: null,
  setRouteName: (routeName) => set({ routeName }),
}));
