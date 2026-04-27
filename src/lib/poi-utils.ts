import { type PoiResultData, type PoiTypeResultData } from '@/models/v4/mapping/poiResultData';

export type PoiSortOption = 'display' | 'type';

export interface PoiGroup {
  poiTypeId: number;
  title: string;
  items: PoiResultData[];
}

const normalizeText = (value?: string | null): string => {
  return value?.trim() ?? '';
};

export const createPoiTypeMap = (poiTypes: PoiTypeResultData[]): Record<number, PoiTypeResultData> => {
  return poiTypes.reduce<Record<number, PoiTypeResultData>>((accumulator, poiType) => {
    accumulator[poiType.PoiTypeId] = poiType;
    return accumulator;
  }, {});
};

export const getPoiTypeName = (poi: Pick<PoiResultData, 'PoiTypeId' | 'PoiTypeName'>, poiTypesById?: Record<number, PoiTypeResultData>): string => {
  return normalizeText(poi.PoiTypeName) || normalizeText(poiTypesById?.[poi.PoiTypeId]?.Name);
};

export const getPoiDisplayName = (poi: PoiResultData, poiTypesById?: Record<number, PoiTypeResultData>): string => {
  return normalizeText(poi.Name) || normalizeText(poi.Address) || normalizeText(poi.Note) || getPoiTypeName(poi, poiTypesById);
};

export const getPoiSelectionLabel = (poi: PoiResultData, poiTypesById?: Record<number, PoiTypeResultData>): string => {
  const name = normalizeText(poi.Name);
  const address = normalizeText(poi.Address);

  if (name && address) {
    return `${name} - ${address}`;
  }

  return getPoiDisplayName(poi, poiTypesById);
};

export const isPoiDestinationEnabled = (poi: PoiResultData, poiTypesById?: Record<number, PoiTypeResultData>): boolean => {
  return poi.IsDestination || !!poiTypesById?.[poi.PoiTypeId]?.IsDestination;
};

export const filterPois = (pois: PoiResultData[], options: { poiTypesById?: Record<number, PoiTypeResultData>; searchQuery?: string; poiTypeId?: number | null }): PoiResultData[] => {
  const normalizedQuery = normalizeText(options.searchQuery).toLowerCase();

  return pois.filter((poi) => {
    if (options.poiTypeId != null && poi.PoiTypeId !== options.poiTypeId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchableValues = [
      getPoiDisplayName(poi, options.poiTypesById),
      getPoiSelectionLabel(poi, options.poiTypesById),
      normalizeText(poi.Address),
      normalizeText(poi.Note),
      getPoiTypeName(poi, options.poiTypesById),
    ]
      .join(' ')
      .toLowerCase();

    return searchableValues.includes(normalizedQuery);
  });
};

export const sortPois = (pois: PoiResultData[], poiTypesById?: Record<number, PoiTypeResultData>, sortBy: PoiSortOption = 'display'): PoiResultData[] => {
  return [...pois].sort((left, right) => {
    if (sortBy === 'type') {
      const leftType = getPoiTypeName(left, poiTypesById);
      const rightType = getPoiTypeName(right, poiTypesById);
      const typeCompare = leftType.localeCompare(rightType, undefined, { sensitivity: 'base' });
      if (typeCompare !== 0) {
        return typeCompare;
      }
    }

    return getPoiDisplayName(left, poiTypesById).localeCompare(getPoiDisplayName(right, poiTypesById), undefined, { sensitivity: 'base' });
  });
};

export const groupPoisByType = (pois: PoiResultData[], poiTypes: PoiTypeResultData[]): PoiGroup[] => {
  const poiTypesById = createPoiTypeMap(poiTypes);
  const groups = pois.reduce<Map<number, PoiResultData[]>>((accumulator, poi) => {
    const currentGroup = accumulator.get(poi.PoiTypeId) ?? [];
    currentGroup.push(poi);
    accumulator.set(poi.PoiTypeId, currentGroup);
    return accumulator;
  }, new Map<number, PoiResultData[]>());

  return [...groups.entries()]
    .map(([poiTypeId, items]) => ({
      poiTypeId,
      title: getPoiTypeName({ PoiTypeId: poiTypeId, PoiTypeName: '' }, poiTypesById) || `Type ${poiTypeId}`,
      items: sortPois(items, poiTypesById, 'display'),
    }))
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }));
};
