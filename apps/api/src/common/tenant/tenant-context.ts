import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextValue {
  familyId?: string | null;
  bypassFamilyScope?: boolean;
}

const tenantStorage = new AsyncLocalStorage<TenantContextValue>();

export function runWithTenantContext<T>(context: TenantContextValue, callback: () => T) {
  return tenantStorage.run(context, callback);
}

export function getTenantContext() {
  return tenantStorage.getStore();
}
