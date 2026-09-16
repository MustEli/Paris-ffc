import { apiRequest } from './client';

/** Mirrors packages/backend/src/reports/reports.types.ts's AdminDashboardReport. */
export interface AdminDashboardReport {
  date: string;
  liveSummary: {
    staffOnShiftCount: number;
    totalStaffCount: number;
    palletsPendingReviewCount: number;
    openPutAwayTaskCount: number;
    activeOrderPrepSessionCount: number;
  };
  today: {
    receptionsLoggedCount: number;
    receptionsCompletedCount: number;
    palletsLoggedCount: number;
    putAwayCompletedCount: number;
    orderPrepSessionsCreatedCount: number;
  };
  staff: {
    userId: string;
    userName: string;
    onShift: boolean;
    shiftStartedAt: string | null;
    onBreak: boolean;
    shiftsToday: number;
    hoursWorkedToday: number;
    putAwayCompletedToday: number;
    orderPrepCompletedToday: number;
  }[];
}

export function fetchAdminDashboard(token: string) {
  return apiRequest<AdminDashboardReport>('/reports/admin-dashboard', { token });
}
