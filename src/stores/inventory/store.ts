import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { cancelCount, completeCount, getCount, getCounts, getInventoryAccess, getUnitEquipment, saveCount, startCount } from '@/api/inventory/inventory';
import { inventoryError, pendingObservations } from '@/lib/inventory/count';
import type { InventoryCount, InventoryCountDetail, InventoryEquipment, InventoryFieldAccess } from '@/models/v4/inventory';
import { InventoryCountStatus } from '@/models/v4/inventory';
import useAuthStore from '@/stores/auth/store';
import { securityStore } from '@/stores/security/store';

// The active unit's inventory on the apparatus tablet: what it carries (by compartment) and the counts the
// crew runs. Counted values stay on the device until saved; the server holds the draft between saves.

export interface InventoryState {
  identity: string | null;
  unitId: number | null;
  access: InventoryFieldAccess | null;
  equipment: InventoryEquipment[];
  counts: InventoryCount[];
  count: InventoryCountDetail | null;
  observed: Record<string, number>;
  /** The completion's idempotency key, kept across retries of the same count. */
  completionId: string | null;
  busy: boolean;
  error: string | null;
  awaitingWitness: boolean;
  load: (unitId: number) => Promise<void>;
  start: (locationId: string, name: string) => Promise<string | null>;
  open: (countId: string) => Promise<void>;
  setObserved: (lineId: string, quantity: number) => void;
  save: () => Promise<boolean>;
  complete: () => Promise<boolean>;
  cancel: () => Promise<boolean>;
  close: () => void;
}

const initial = {
  identity: null as string | null,
  unitId: null,
  access: null,
  equipment: [],
  counts: [],
  count: null,
  observed: {},
  completionId: null,
  busy: false,
  error: null,
  awaitingWitness: false,
};

const currentIdentity = (): string | null => {
  const userId = useAuthStore.getState().userId;
  const departmentId = securityStore.getState().rights?.DepartmentId;
  return userId && departmentId ? `${userId}:${departmentId}` : null;
};

export const useInventoryStore = create<InventoryState>()((set, get) => {
  const settle = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    set({ busy: true, error: null });
    try {
      return await work();
    } catch (error) {
      set({ error: inventoryError(error) });
      return undefined;
    } finally {
      set({ busy: false });
    }
  };

  /** Push the counted values the server does not have yet; answers with the refreshed draft. */
  const flush = async (): Promise<InventoryCountDetail | null> => {
    const count = get().count;
    if (!count) return null;
    const pending = pendingObservations(count.Lines, get().observed);
    let current = count;
    for (let index = 0; index < pending.length; index += 100) current = await saveCount(current.Count.Id, current.Count.Revision, pending.slice(index, index + 100));
    set({ count: current });
    return current;
  };

  return {
    ...initial,
    load: async (unitId) => {
      const identity = currentIdentity();
      if (get().identity !== identity || get().unitId !== unitId) set({ ...initial, identity, unitId });
      await settle(async () => {
        const [access, equipment] = await Promise.all([getInventoryAccess(unitId), getUnitEquipment(unitId)]);
        const root = access.UnitLocations.find((location) => location.IsRoot);
        // Counts are only listed to people who may run them.
        const counts = access.CanCount && root ? (await getCounts(root.Id)).Items : [];
        const others = access.CanCount ? await Promise.all(access.UnitLocations.filter((location) => !location.IsRoot).map((location) => getCounts(location.Id).then((page) => page.Items))) : [];
        set({ access, equipment, counts: [...counts, ...others.flat()].sort((a, b) => String(b.SnapshotOn ?? '').localeCompare(String(a.SnapshotOn ?? ''))) });
      });
    },
    start: async (locationId, name) => {
      const started = await settle(async () => {
        const count = await startCount(randomUUID(), locationId, name);
        set({ count, observed: {}, completionId: null, awaitingWitness: false, counts: [count.Count, ...get().counts] });
        return count.Count.Id;
      });
      return started ?? null;
    },
    open: async (countId) => {
      await settle(async () => {
        const count = await getCount(countId);
        set({ count, observed: {}, completionId: null, awaitingWitness: count.Count.Status === InventoryCountStatus.AwaitingWitness });
      });
    },
    setObserved: (lineId, quantity) => set({ observed: { ...get().observed, [lineId]: quantity } }),
    save: async () => {
      const saved = await settle(async () => {
        await flush();
        set({ observed: {} });
        return true;
      });
      return saved === true;
    },
    complete: async () => {
      const done = await settle(async () => {
        const count = await flush();
        if (!count) return false;
        const requestId = get().completionId ?? randomUUID();
        set({ completionId: requestId, observed: {} });
        const result = await completeCount(count.Count.Id, count.Count.Revision, requestId);
        const refreshed = await getCount(count.Count.Id);
        set({ count: refreshed, awaitingWitness: result.AwaitingWitness, counts: get().counts.map((row) => (row.Id === refreshed.Count.Id ? refreshed.Count : row)) });
        return true;
      });
      return done === true;
    },
    cancel: async () => {
      const count = get().count;
      if (!count) return false;
      const cancelled = await settle(async () => {
        await cancelCount(count.Count.Id, count.Count.Revision);
        set({ count: null, observed: {}, counts: get().counts.map((row) => (row.Id === count.Count.Id ? { ...row, Status: InventoryCountStatus.Cancelled } : row)) });
        return true;
      });
      return cancelled === true;
    },
    close: () => set({ count: null, observed: {}, completionId: null, awaitingWitness: false, error: null }),
  };
});
