// Inventory on an apparatus as the v4 Inventory controller returns it. Row text (item names, serials, count
// names) travels inside each row's Content JSON; lists come back one page of up to 500 rows at a time.

export const InventoryLocationType = { Facility: 0, Station: 1, Unit: 2, Personnel: 3, Container: 4, External: 5 } as const;
export const InventoryAssetStatus = { InService: 0, Issued: 1, OutForRepair: 2, Damaged: 3, Lost: 4, Consumed: 5, Retired: 6 } as const;
export const InventoryCountStatus = { Draft: 0, AwaitingWitness: 1, Completed: 2, Cancelled: 3 } as const;

export interface InventoryApiResult<T> {
  Data: T;
  HasMore?: boolean;
}

export interface InventoryPage<T> {
  Items: T[];
  HasMore: boolean;
}

export interface InventoryFieldLocation {
  Id: string;
  Name?: string | null;
  ParentLocationId?: string | null;
  LocationType: number;
  /** The unit's own holder location; compartments and kit containers hang off it. */
  IsRoot: boolean;
}

export interface InventoryFieldAccess {
  Enabled: boolean;
  Migrated: boolean;
  /** AdjustInventory at the unit: start, save and complete counts. */
  CanCount: boolean;
  CanIssue: boolean;
  CanTransfer: boolean;
  UnitLocations: InventoryFieldLocation[];
}

interface InventoryRow {
  Id: string;
  Revision: number;
  Content?: string | null;
}

export interface InventoryAsset extends InventoryRow {
  ItemId: string;
  Status: number;
  CurrentLocationId?: string | null;
  ExpiresOn?: string | null;
}

export interface InventoryStock extends InventoryRow {
  ItemId: string;
  LocationId: string;
  LotId?: string | null;
  Quantity: number;
}

export interface InventoryIssuance extends InventoryRow {
  IssuedToUserId?: string | null;
  IssuedToUnitId?: number | null;
  Quantity: number;
  ExpectedReturnOn?: string | null;
}

export interface InventoryEquipment {
  Asset?: InventoryAsset | null;
  Stock?: InventoryStock | null;
  ItemName?: string | null;
  UnitId?: number | null;
  Issuances: InventoryIssuance[];
}

export interface InventoryCount extends InventoryRow {
  LocationId?: string | null;
  Status: number;
  SnapshotOn?: string | null;
  CompletedOn?: string | null;
}

export interface InventoryCountLine extends InventoryRow {
  CountId: string;
  ItemId: string;
  LocationId: string;
  LotId?: string | null;
  AssetId?: string | null;
  ExpectedQuantity: number;
  CountedQuantity?: number | null;
}

export interface InventoryCountDetail {
  Count: InventoryCount;
  Lines: InventoryCountLine[];
}

export interface InventoryCountResult {
  OperationId?: string | null;
  /** A controlled-substance variance waits for a second person to witness it (web). */
  AwaitingWitness: boolean;
  TransactionIds?: string[];
}
