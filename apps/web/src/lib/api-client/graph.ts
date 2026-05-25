import type { GraphData } from '../types';
import { request } from './core';

export const graphApi = {
  getGraph: (memberId: string, depth = 2) =>
    request<GraphData>(`/graph/member/${memberId}?depth=${depth}`),
};
