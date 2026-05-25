import { request } from './core';

export const systemApi = {
  getSystemInfo: () =>
    request<{ name: string; version: string; status: string; timestamp: string }>('/'),
};
