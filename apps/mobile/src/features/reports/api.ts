import { apiRequest } from '../../core/api/client';
import {
  type AdminDashboardReport,
  type AttendanceReport,
  type OrderPrepReport,
  type OverviewReport,
  type PutAwayReport,
  type ReceptionReport,
} from './types';

export function fetchOverviewReport(token: string) {
  return apiRequest<OverviewReport>('/reports/overview', { token });
}

export function fetchAttendanceReport(token: string) {
  return apiRequest<AttendanceReport>('/reports/attendance', { token });
}

export function fetchReceptionReport(token: string) {
  return apiRequest<ReceptionReport>('/reports/reception', { token });
}

export function fetchPutAwayReport(token: string) {
  return apiRequest<PutAwayReport>('/reports/put-away', { token });
}

export function fetchOrderPrepReport(token: string) {
  return apiRequest<OrderPrepReport>('/reports/order-prep', { token });
}

export function fetchAdminDashboardReport(token: string) {
  return apiRequest<AdminDashboardReport>('/reports/admin-dashboard', { token });
}
