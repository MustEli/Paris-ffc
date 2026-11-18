import { create } from 'zustand';

/**
 * Set by whichever screen currently has a task open (Floor Task,
 * Reception, Put-Away, Order Prep) to a short human-readable label
 * (e.g. "Floor Task — Pick") — read by QuickIssueButton to decide
 * whether to show the floating "report an issue" shortcut, and to
 * stamp the report with what was going on when it was raised.
 * `taskRef` is the same idea but precise to one task instance (e.g.
 * "floor_task:abc123" rather than just "Floor Task — Pick") — lets a
 * task screen list back only the reports raised for *this* task, not
 * every task of that type. Screens should set both via useFocusEffect
 * (not plain useEffect), clearing to null on blur/unmount, so
 * switching between screens always reflects whichever one is actually
 * focused — mirrors activeTaskGuardStore's pattern, but carries
 * display/reference info instead of just a boolean.
 */
interface ActiveTaskContextState {
  label: string | null;
  taskRef: string | null;
  setLabel: (label: string | null, taskRef?: string | null) => void;
}

export const useActiveTaskContextStore = create<ActiveTaskContextState>((set) => ({
  label: null,
  taskRef: null,
  setLabel: (label, taskRef = null) => set({ label, taskRef: label ? taskRef : null }),
}));
