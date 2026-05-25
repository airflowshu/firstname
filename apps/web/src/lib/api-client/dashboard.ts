import type { DashboardSummary } from '../types';
import { request } from './core';

export const dashboardApi = {
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),
};
