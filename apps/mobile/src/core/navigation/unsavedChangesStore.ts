import { create } from 'zustand';

/**
 * Set by a screen with an in-progress form (data entered, not yet
 * submitted) so the global Home icon knows to confirm before leaving
 * instead of silently discarding it — same principle as End Shift's
 * confirm, applied narrower. A screen should set this true as soon as
 * the user enters anything, and false again on successful submit AND
 * on unmount (so leaving via hardware/gesture back doesn't leave a
 * stale "true" behind for whatever screen comes next).
 */
interface UnsavedChangesState {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>((set) => ({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: (value) => set({ hasUnsavedChanges: value }),
}));
