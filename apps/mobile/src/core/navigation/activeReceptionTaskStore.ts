import { create } from 'zustand';

/**
 * Mirrors activeTaskGuardStore.ts's role, but for the Reception-flow
 * timer specifically — kept separate (not folded into that store)
 * because Reception's leaving-guard offers 3 choices (Keep Working /
 * Pause / Leave Unfinished) where Floor Task only offers 2, and the
 * global Home-icon handler needs the task's id (to pause/leave it),
 * not just a boolean. Set by ReceptionMenuScreen while a Reception Task
 * is running (open, not paused), cleared on unmount.
 */
interface ActiveReceptionTaskState {
  activeReceptionTaskId: string | null;
  setActiveReceptionTaskId: (id: string | null) => void;
}

export const useActiveReceptionTaskStore = create<ActiveReceptionTaskState>((set) => ({
  activeReceptionTaskId: null,
  setActiveReceptionTaskId: (id) => set({ activeReceptionTaskId: id }),
}));
