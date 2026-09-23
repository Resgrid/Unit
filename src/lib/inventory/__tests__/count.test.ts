import { clampQuantity, contentOf, groupEquipment, inventoryError, isComplete, locationNames, orderLocations, pendingObservations, variances } from '@/lib/inventory/count';
import type { InventoryCountLine } from '@/models/v4/inventory';

const line = (id: string, expected: number, patch: Partial<InventoryCountLine> = {}): InventoryCountLine => ({ Id: id, Revision: 0, CountId: 'c-1', ItemId: `i-${id}`, LocationId: 'loc-1', ExpectedQuantity: expected, CountedQuantity: null, ...patch });

it('reads row text from Content and never throws on withheld or malformed content', () => {
  expect(contentOf('{"ItemName":"SCBA bottle","UnitOfMeasure":"each"}').ItemName).toBe('SCBA bottle');
  expect(contentOf('REDACTED')).toEqual({});
  expect(contentOf('{broken')).toEqual({});
  expect(contentOf(null)).toEqual({});
});

it('orders the unit first and groups what it carries by compartment', () => {
  const locations = [
    { Id: 'c', Name: 'L2', LocationType: 0, IsRoot: false },
    { Id: 'u', Name: 'Engine 41', LocationType: 2, IsRoot: true },
    { Id: 'b', Name: 'L1', LocationType: 0, IsRoot: false },
  ];
  expect(orderLocations(locations).map((location) => location.Id)).toEqual(['u', 'b', 'c']);
  expect(locationNames([{ Id: 'x', Name: ' ', LocationType: 0, IsRoot: false }], 'Compartment')).toEqual({ x: 'Compartment' });
  const groups = groupEquipment(
    [
      { ItemName: 'Hose 1.75"', Stock: { Id: 's-1', Revision: 0, ItemId: 'i-1', LocationId: 'b', Quantity: 4 }, Issuances: [] },
      { ItemName: 'Thermal camera', Asset: { Id: 'a-1', Revision: 0, ItemId: 'i-2', Status: 0, CurrentLocationId: 'u', Content: '{"SerialNumber":"TC-9"}' }, Issuances: [] },
    ],
    'Item'
  );
  expect(groups.b[0]).toMatchObject({ name: 'Hose 1.75"', quantity: 4, assetStatus: null });
  expect(groups.u[0]).toMatchObject({ name: 'Thermal camera', quantity: 1, serial: 'TC-9', assetStatus: 0 });
});

it('tracks progress, differences and only the changed observations', () => {
  const lines = [line('1', 4), line('2', 1, { AssetId: 'a-1' }), line('3', 2, { CountedQuantity: 2 })];
  const observed = { '1': 3, '2': 1 };
  expect(isComplete(lines, observed)).toBe(true);
  expect(isComplete(lines, { '1': 3 })).toBe(false);
  expect(variances(lines, observed).map((row) => row.Id)).toEqual(['1']);
  expect(pendingObservations(lines, { ...observed, '3': 2 })).toEqual([
    { Id: '1', Quantity: 3 },
    { Id: '2', Quantity: 1 },
  ]);
  expect(clampQuantity(lines[1], 5)).toBe(1);
  expect(clampQuantity(lines[1], 0.2)).toBe(0);
  expect(clampQuantity(lines[0], -2)).toBe(0);
  expect(clampQuantity(lines[0], 2.5)).toBe(2.5);
});

it('maps ProblemDetails codes', () => {
  expect(inventoryError({ response: { status: 409, data: { type: 'inventory_CountSnapshotChanged', code: 'CountSnapshotChanged' } } })).toBe('CountSnapshotChanged');
  expect(inventoryError({ response: { status: 409, data: { type: 'inventory_CountScopeTooLarge' } } })).toBe('CountScopeTooLarge');
  expect(inventoryError({ response: { status: 403, data: { type: 'protected_data_required' } } })).toBe('locked');
  expect(inventoryError({ response: { status: 403 } })).toBe('PermissionRequired');
  expect(inventoryError(new Error('x'))).toBe('retry');
});
