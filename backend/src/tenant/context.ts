import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantContext { hospitalId: string }

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(hospitalId: string, callback: () => T): T {
  return storage.run({ hospitalId }, callback);
}

export function currentHospitalId(): string | undefined {
  return storage.getStore()?.hospitalId;
}

