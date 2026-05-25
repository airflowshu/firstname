import type { AuditLogRecord } from '../types';
import { request } from './core';
import { withQuery } from './query';

export type AuditLogQuery = {
  page?: number;
  pageSize?: number;
  keyword?: string;
};

export const auditLogsApi = {
  getAuditLogs: (params: AuditLogQuery) =>
    request<{
      total: number;
      page: number;
      pageSize: number;
      data: AuditLogRecord[];
    }>(withQuery('/audit-logs', params)),
};
