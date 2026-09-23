let mockUuid = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-00000000000${++mockUuid}` }));
jest.mock('@/api/inventory/inventory', () => ({
  getInventoryAccess: jest.fn(),
  getUnitEquipment: jest.fn(),
  getCounts: jest.fn(),
  getCount: jest.fn(),
  startCount: jest.fn(),
  saveCount: jest.fn(),
  completeCount: jest.fn(),
  cancelCount: jest.fn(),
}));
jest.mock('@/stores/auth/store', () => {
  const { create } = jest.requireActual('zustand');
  return { __esModule: true, default: create(() => ({ userId: 'me' })) };
});
jest.mock('@/stores/security/store', () => {
  const { create } = jest.requireActual('zustand');
  return { securityStore: create(() => ({ rights: { DepartmentId: '77' } })) };
});

import * as api from '@/api/inventory/inventory';
import { useInventoryStore } from '@/stores/inventory/store';

const server = jest.mocked(api);
const detail = (revision: number, counted: (number | null)[] = [null, null], status = 0) =>
  ({
    Count: { Id: 'c-1', Revision: revision, Status: status, LocationId: 'u', Content: '{"Name":"Engine 41 check"}' },
    Lines: counted.map((value, index) => ({ Id: `l-${index}`, Revision: 0, CountId: 'c-1', ItemId: `i-${index}`, LocationId: 'u', ExpectedQuantity: 2, CountedQuantity: value })),
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockUuid = 0;
  useInventoryStore.setState({ identity: null, unitId: null, access: null, equipment: [], counts: [], count: null, observed: {}, completionId: null, error: null, awaitingWitness: false });
  server.getInventoryAccess.mockResolvedValue({ Enabled: true, Migrated: true, CanCount: true, CanIssue: false, CanTransfer: false, UnitLocations: [{ Id: 'u', Name: 'Engine 41', LocationType: 2, IsRoot: true }, { Id: 'l1', Name: 'L1', LocationType: 0, IsRoot: false }] });
  server.getUnitEquipment.mockResolvedValue([]);
  server.getCounts.mockResolvedValue({ Items: [], HasMore: false });
});

it('loads the unit, lists counts only for a counter and starts a count at the chosen location', async () => {
  await useInventoryStore.getState().load(41);
  expect(server.getInventoryAccess).toHaveBeenCalledWith(41);
  expect(server.getCounts).toHaveBeenCalledWith('u');
  expect(server.getCounts).toHaveBeenCalledWith('l1');

  server.startCount.mockResolvedValue(detail(1));
  expect(await useInventoryStore.getState().start('u', 'Engine 41 check')).toBe('c-1');
  expect(server.startCount).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', 'u', 'Engine 41 check');

  server.getInventoryAccess.mockResolvedValue({ Enabled: true, Migrated: true, CanCount: false, CanIssue: false, CanTransfer: false, UnitLocations: [{ Id: 'u', Name: 'E', LocationType: 2, IsRoot: true }] });
  server.getCounts.mockClear();
  await useInventoryStore.getState().load(41);
  expect(server.getCounts).not.toHaveBeenCalled();
});

it('saves only changed values, then completes with a stable request id across a retry', async () => {
  server.getCount.mockResolvedValue(detail(1));
  await useInventoryStore.getState().open('c-1');
  useInventoryStore.getState().setObserved('l-0', 2);
  useInventoryStore.getState().setObserved('l-1', 1);
  server.saveCount.mockResolvedValue(detail(2, [2, 1]));
  server.completeCount.mockRejectedValueOnce({ response: { status: 500 } });
  expect(await useInventoryStore.getState().complete()).toBe(false);
  expect(server.saveCount).toHaveBeenCalledWith('c-1', 1, [
    { Id: 'l-0', Quantity: 2 },
    { Id: 'l-1', Quantity: 1 },
  ]);
  const firstRequest = server.completeCount.mock.calls[0][2];

  server.completeCount.mockResolvedValue({ AwaitingWitness: false });
  server.getCount.mockResolvedValue(detail(3, [2, 1], 2));
  expect(await useInventoryStore.getState().complete()).toBe(true);
  expect(server.saveCount).toHaveBeenCalledTimes(1);
  expect(server.completeCount).toHaveBeenLastCalledWith('c-1', 2, firstRequest);
  expect(useInventoryStore.getState().count?.Count.Status).toBe(2);
});

it('surfaces a voided snapshot as its code', async () => {
  server.getCount.mockResolvedValue(detail(1, [2, 2]));
  await useInventoryStore.getState().open('c-1');
  server.completeCount.mockRejectedValue({ response: { status: 409, data: { type: 'inventory_CountSnapshotChanged', code: 'CountSnapshotChanged' } } });
  expect(await useInventoryStore.getState().complete()).toBe(false);
  expect(useInventoryStore.getState().error).toBe('CountSnapshotChanged');
});
