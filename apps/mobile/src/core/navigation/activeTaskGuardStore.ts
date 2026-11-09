import { create } from 'zustand';

/**
 * Set by a screen with a running (started, not paused) task so the
 * global Home icon knows to block leaving instead of silently jumping
 * away — mirrors useUnsavedChangesStore. Needed because the Home icon
 * navigates straight to StaffHome in a different part of the stack,
 * which doesn't trigger a screen's own `beforeRemove` listener the way
 * Back's goBack() does, so that guard alone isn't enough to stop it.
 */
interface ActiveTaskGuardState {
  isTaskRunning: boolean;
  setIsTaskRunning: (value: boolean) => void;
}

export const useActiveTaskGuardStore = create<ActiveTaskGuardState>((set) => ({
  isTaskRunning: false,
  setIsTaskRunning: (value) => set({ isTaskRunning: value }),
}));
