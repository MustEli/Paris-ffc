import { apiRequest } from './client';

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
  destination: 'task-board' | 'dashboard';
}

export interface SearchResults {
  pallets: PalletSearchResult[];
  staff: StaffSearchResult[];
  tasks: TaskSearchResult[];
}

export function fetchSearch(token: string, q: string) {
  return apiRequest<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { token });
}
