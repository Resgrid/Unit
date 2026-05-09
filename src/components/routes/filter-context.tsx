import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { type PoiSortOption } from '@/lib/poi-utils';

interface FilterState {
  isFilterOpen: boolean;
  selectedPoiTypeId: number | null;
  sortBy: PoiSortOption;
  activeFilterCount: number;
}

interface FilterActions {
  openFilter: () => void;
  closeFilter: () => void;
  setSelectedPoiTypeId: (id: number | null) => void;
  setSortBy: (option: PoiSortOption) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<(FilterState & FilterActions) | null>(null);

export function useFilterContext() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
}

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedPoiTypeId, setSelectedPoiTypeId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<PoiSortOption>('display');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedPoiTypeId !== null) count++;
    if (sortBy !== 'display') count++;
    return count;
  }, [selectedPoiTypeId, sortBy]);

  const openFilter = useCallback(() => {
    setIsFilterOpen(true);
  }, []);

  const closeFilter = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedPoiTypeId(null);
    setSortBy('display');
  }, []);

  const value = useMemo(
    () => ({
      isFilterOpen,
      selectedPoiTypeId,
      sortBy,
      activeFilterCount,
      openFilter,
      closeFilter,
      setSelectedPoiTypeId,
      setSortBy,
      clearFilters,
    }),
    [isFilterOpen, selectedPoiTypeId, sortBy, activeFilterCount, openFilter, closeFilter, clearFilters]
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
