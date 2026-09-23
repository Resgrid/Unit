import type { Href } from 'expo-router';

import { useCoreStore } from '@/stores/app/core-store';

// What this app does with a deployment. The server enforces every rule again; this only shapes the UI.
// The apparatus tablet files its crew time report, fuel and usage; approval stays with supervisors.
export const operationsCapabilities = {
  /** Write crew / individual time reports (the active unit's Crew Time Report for the seated crew). */
  editTime: true,
  /** Record odometer / engine / fuel readings against a deployment unit. */
  recordUsage: true,
  /** Add expenses (meals, fuel, lodging) with a receipt photo. */
  recordExpenses: true,
  /** Approve submitted time reports when the person holds TimeReports_Approve. */
  approveTime: false,
  /** Draft and validate the CAL OES MARS F-42 from the field. */
  draftF42: true,
  homeRoute: '/(app)' as Href,
  useActiveUnitId: (): string | null => useCoreStore((state) => state.activeUnitId),
};
