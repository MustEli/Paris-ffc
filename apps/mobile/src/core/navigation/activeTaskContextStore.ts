import { create } from 'zustand';

/**
 * Set by whichever screen currently has a task open (Floor Task,
 * Reception, Put-Away, Order Prep) to a short human-readable label
 * (e.g. "Floor Task — Pick") — read by QuickIssueButton to decide
 * whether to show the floating "report an issue" shortcut, and to
 * stamp the report with what was going on when it was raised. Screens
 * should set this via useFocusEffect (not plain useEffect), clearing
 * it to null on blur/unmount, so switching between screens always
 * reflects whichever one is actually focused — mirrors
 * activeTaskGuardStore's pattern, but carries a label instead of a
 * plain boolean since this one feeds display text, not just a gate.
 */
interface ActiveTaskContextState {
  label: string | null;
  setLabel: (label: string | null) => void;
}

export const useActiveTaskContextStore = create<ActiveTaskContextState>((set) => ({
  label: null,
  setLabel: (label) => set({ label }),
}));
