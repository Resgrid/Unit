import { api } from '@/api/common/client';
import type { InventoryApiResult, InventoryCount, InventoryCountDetail, InventoryCountResult, InventoryEquipment, InventoryFieldAccess, InventoryPage } from '@/models/v4/inventory';

// v4 Inventory for the apparatus tablet: what the unit carries and the counts crews run against it. Every
// count call needs AdjustInventory at the unit's holder location; the server re-checks all of it.

export const getInventoryAccess = async (unitId: number) => (await api.get<InventoryApiResult<InventoryFieldAccess>>('/Inventory/GetAccess', { params: { unitId } })).data.Data;

export const getUnitEquipment = async (unitId: number) => (await api.get<InventoryApiResult<InventoryEquipment[]>>('/Inventory/GetUnitEquipment', { params: { unitId } })).data.Data;

export const getCounts = async (locationId: string, page = 0) => (await api.get<InventoryApiResult<InventoryPage<InventoryCount>>>('/Inventory/GetCounts', { params: { page, locationId } })).data.Data;

export const getCount = async (id: string) => (await api.get<InventoryApiResult<InventoryCountDetail>>('/Inventory/GetCount', { params: { id } })).data.Data;

/**
 * A field count of one unit location: its compartments and kit containers are included, the department's
 * whole catalog is not padded in (that would exceed the 100-line count limit), and the snapshot fence covers
 * only these positions so work elsewhere does not void the count.
 */
export const startCount = async (id: string, locationId: string, name: string, note?: string | null) =>
  (await api.post<InventoryApiResult<InventoryCountDetail>>('/Inventory/StartCount', { Id: id, LocationId: locationId, Name: name, Note: note ?? null, IncludeCatalogItems: false, IncludeChildLocations: true })).data
    .Data;

export const saveCount = async (countId: string, revision: number, lines: { Id: string; Quantity: number }[]) =>
  (await api.post<InventoryApiResult<InventoryCountDetail>>('/Inventory/SaveCount', { CountId: countId, Revision: revision, Lines: lines })).data.Data;

export const completeCount = async (countId: string, revision: number, requestId: string) =>
  (await api.post<InventoryApiResult<InventoryCountResult>>('/Inventory/CompleteCount', { CountId: countId, Revision: revision, RequestId: requestId })).data.Data;

export const cancelCount = async (countId: string, revision: number) => (await api.post<InventoryApiResult<unknown>>('/Inventory/CancelCount', { CountId: countId, Revision: revision })).data;
