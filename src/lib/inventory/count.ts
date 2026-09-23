import type { InventoryCountLine, InventoryEquipment, InventoryFieldLocation } from '@/models/v4/inventory';

// Pure helpers for the unit inventory screens. Row text lives in each row's Content JSON; a protected
// department without a grant sends it withheld, so parsing never throws and falls back to blanks.

export interface ContentText {
  Name?: string | null;
  Note?: string | null;
  ItemName?: string | null;
  UnitOfMeasure?: string | null;
  SerialNumber?: string | null;
  LotNumber?: string | null;
  AssetTag?: string | null;
  VarianceLineCount?: number | null;
}

export const contentOf = (content?: string | null): ContentText => {
  if (!content || !content.trim().startsWith('{')) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as ContentText) : {};
  } catch {
    return {};
  }
};

export const locationNames = (locations: InventoryFieldLocation[], fallback: string) =>
  locations.reduce<Record<string, string>>((names, location) => {
    names[location.Id] = location.Name?.trim() || fallback;
    return names;
  }, {});

/** The unit location first, then its compartments by name. */
export const orderLocations = (locations: InventoryFieldLocation[]) => [...locations].sort((a, b) => Number(b.IsRoot) - Number(a.IsRoot) || (a.Name ?? '').localeCompare(b.Name ?? ''));

export interface EquipmentRow {
  key: string;
  locationId: string;
  name: string;
  quantity: number;
  serial?: string | null;
  assetStatus?: number | null;
  issuedCount: number;
}

/** What the unit carries, one row per stock position or serialized asset, grouped by where it sits. */
export const groupEquipment = (equipment: InventoryEquipment[], fallbackName: string) => {
  const groups: Record<string, EquipmentRow[]> = {};
  equipment.forEach((row, index) => {
    const locationId = row.Asset?.CurrentLocationId ?? row.Stock?.LocationId ?? '';
    const details = contentOf(row.Asset?.Content);
    const item: EquipmentRow = {
      key: row.Asset?.Id ?? row.Stock?.Id ?? String(index),
      locationId,
      name: row.ItemName?.trim() || fallbackName,
      quantity: row.Asset ? 1 : (row.Stock?.Quantity ?? 0),
      serial: details.SerialNumber ?? details.AssetTag ?? null,
      assetStatus: row.Asset ? row.Asset.Status : null,
      issuedCount: row.Issuances?.length ?? 0,
    };
    (groups[locationId] ??= []).push(item);
  });
  Object.values(groups).forEach((rows) => rows.sort((a, b) => a.name.localeCompare(b.name)));
  return groups;
};

/** Counted values the person has entered, falling back to what the server already holds. */
export const observedQuantity = (line: InventoryCountLine, observed: Record<string, number>) => observed[line.Id] ?? line.CountedQuantity ?? null;

export const isComplete = (lines: InventoryCountLine[], observed: Record<string, number>) => lines.length > 0 && lines.every((line) => observedQuantity(line, observed) != null);

export const variances = (lines: InventoryCountLine[], observed: Record<string, number>) =>
  lines.filter((line) => {
    const counted = observedQuantity(line, observed);
    return counted != null && counted !== line.ExpectedQuantity;
  });

/** Only the lines whose counted value changed from what the server holds, in the server's 100-line batches. */
export const pendingObservations = (lines: InventoryCountLine[], observed: Record<string, number>) =>
  lines.filter((line) => observed[line.Id] != null && observed[line.Id] !== line.CountedQuantity).map((line) => ({ Id: line.Id, Quantity: observed[line.Id] }));

export const clampQuantity = (line: InventoryCountLine, value: number) => {
  if (!Number.isFinite(value) || value < 0) return 0;
  // A serialized asset is either there (1) or not (0).
  if (line.AssetId) return value >= 1 ? 1 : 0;
  return Math.round(value * 1000000) / 1000000;
};

/** A server refusal as its ProblemDetails code ("inventory_CountSnapshotChanged" → "CountSnapshotChanged"). */
export const inventoryError = (error: unknown): string => {
  const response = (error as { response?: { status?: number; data?: { type?: string; code?: string } } })?.response;
  const type = String(response?.data?.type ?? '');
  if (type === 'protected_data_required') return 'locked';
  if (response?.data?.code) return String(response.data.code);
  if (type.startsWith('inventory_')) return type.slice('inventory_'.length);
  if (response?.status === 401 || response?.status === 403 || response?.status === 404) return 'PermissionRequired';
  return 'retry';
};
