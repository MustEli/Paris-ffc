/**
 * Backs the web dashboard's new global header search. Deliberately
 * scoped to what the dashboard can actually show a result *on* today —
 * see search.service.ts's doc comment for the full reasoning. Not a
 * general "search everything" index.
 */
export interface PalletSearchResult {
  id: string;
  palletIndex: string;
  sellerName: string;
  boxNumber: string;
}

export interface StaffSearchResult {
  id: string;
  name: string;
  role: string;
}

export type TaskSearchKind = 'floor_task' | 'open_pool' | 'directive';

export interface TaskSearchResult {
  id: string;
  kind: TaskSearchKind;
  label: string;
  /** Which dashboard page can actually show this result — see search.service.ts. */
  destination: 'task-board' | 'dashboard';
}

export interface SearchResults {
  pallets: PalletSearchResult[];
  staff: StaffSearchResult[];
  tasks: TaskSearchResult[];
}
