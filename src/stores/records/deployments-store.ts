import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  getRecordDeployment,
  getRecordDeploymentConnector,
  getRecordDeploymentConnectorRuns,
  getRecordDeploymentConnectors,
  getRecordDeploymentReconciliation,
  getRecordDeployments,
  runRecordDeploymentConnector,
} from '@/api/records/deployments';
import { logger } from '@/lib/logging';
import { sortDeployments, upsertDeployment } from '@/lib/records/deployments';
import { zustandStorage } from '@/lib/storage';
import { type RecordDeploymentConnectorData, type RecordDeploymentConnectorRunData, type RecordDeploymentData, type RecordDeploymentReconciliationData } from '@/models/v4/records/deployments';

// Deployments and external ordering-system connectors for this app (RMS plan section 4.1). The
// server owns every list and every decision; this store holds what it returned so the screens can
// show it, and issues exactly one command: "read the feed now". Nothing here changes a fill, an
// order or a connector, and nothing here decides who is an administrator — a refused call is shown
// as a refusal, never retried as someone else.

export interface DeploymentsState {
  deployments: RecordDeploymentData[];
  includeClosed: boolean;
  reconciliation: RecordDeploymentReconciliationData[];
  connectors: RecordDeploymentConnectorData[];
  runs: Record<string, RecordDeploymentConnectorRunData[]>;
  isLoading: boolean;
  runningConnectorId: string | null;
  error: string | null;
  connectorsError: string | null;
  lastFetchedOn: string | null;

  fetchDeployments: (options?: { includeClosed?: boolean }) => Promise<RecordDeploymentData[]>;
  fetchDeployment: (orderId: string) => Promise<RecordDeploymentData | null>;
  fetchReconciliation: (connectorId?: string | null) => Promise<RecordDeploymentReconciliationData[]>;
  fetchConnectors: () => Promise<RecordDeploymentConnectorData[]>;
  fetchConnector: (connectorId: string) => Promise<RecordDeploymentConnectorData | null>;
  fetchRuns: (connectorId: string) => Promise<RecordDeploymentConnectorRunData[]>;
  runConnector: (connectorId: string) => Promise<{ ok: boolean; run?: RecordDeploymentConnectorRunData; error?: string }>;
  reset: () => void;
}

const statusOf = (error: unknown): number | undefined => (error as { response?: { status?: number } })?.response?.status;

/** A refusal or a missing row is an answer about access, not a transient failure; nothing cached outlives it. */
const isAccessAnswer = (error: unknown): boolean => {
  const status = statusOf(error);
  return status === 403 || status === 404;
};

const messageOf = (error: unknown, fallback: string): string => {
  const status = statusOf(error);
  if (status === 403) {
    return 'forbidden';
  }
  if (status === 404) {
    return 'not_found';
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

// Bumped by reset(). An answer still in flight at sign-out must not write the previous session's
// deployments back into the store, and through persistence back onto the device.
let sessionGeneration = 0;

/** A setter bound to the session a request started in; it does nothing once reset() has run. */
const sessionSet = (set: (partial: Partial<DeploymentsState>) => void) => {
  const started = sessionGeneration;
  return (partial: Partial<DeploymentsState>) => {
    if (started === sessionGeneration) {
      set(partial);
    }
  };
};

export const useDeploymentsStore = create<DeploymentsState>()(
  persist(
    (set, get) => ({
      deployments: [],
      includeClosed: false,
      reconciliation: [],
      connectors: [],
      runs: {},
      isLoading: false,
      runningConnectorId: null,
      error: null,
      connectorsError: null,
      lastFetchedOn: null,

      fetchDeployments: async (options) => {
        const commit = sessionSet(set);
        const includeClosed = options?.includeClosed ?? get().includeClosed;
        set({ isLoading: true, error: null, includeClosed });
        try {
          const response = await getRecordDeployments(includeClosed);
          const deployments = sortDeployments(response?.Data ?? []);
          commit({ deployments, isLoading: false, lastFetchedOn: new Date().toISOString() });
          return deployments;
        } catch (error) {
          logger.error({ message: 'Deployments fetch failed', context: { error } });
          // Offline keeps what was last read; a refusal drops it rather than showing it past revoked access.
          commit({ isLoading: false, error: messageOf(error, 'load_failed'), ...(isAccessAnswer(error) ? { deployments: [] } : {}) });
          return get().deployments;
        }
      },

      fetchDeployment: async (orderId) => {
        const commit = sessionSet(set);
        set({ isLoading: true, error: null });
        try {
          const response = await getRecordDeployment(orderId);
          const deployment = response?.Data ?? null;
          if (deployment) {
            commit({ deployments: upsertDeployment(get().deployments, deployment), isLoading: false });
          } else {
            // Gone or no longer visible: it is dropped rather than shown from the last fetch.
            commit({ deployments: get().deployments.filter((existing) => existing.OrderId !== orderId), isLoading: false, error: 'not_found' });
          }
          return deployment;
        } catch (error) {
          logger.error({ message: 'Deployment fetch failed', context: { error, orderId } });
          if (isAccessAnswer(error)) {
            // Refused or gone: dropped the same way as an empty answer, never shown from the last fetch.
            commit({ deployments: get().deployments.filter((existing) => existing.OrderId !== orderId), isLoading: false, error: messageOf(error, 'load_failed') });
            return null;
          }
          commit({ isLoading: false, error: messageOf(error, 'load_failed') });
          return get().deployments.find((existing) => existing.OrderId === orderId) ?? null;
        }
      },

      fetchReconciliation: async (connectorId) => {
        const commit = sessionSet(set);
        try {
          const response = await getRecordDeploymentReconciliation(connectorId);
          const items = response?.Data ?? [];
          // One connector's items replace only that connector's slice; the rest stays as last seen.
          const kept = connectorId ? get().reconciliation.filter((item) => item.ConnectorId !== connectorId) : [];
          commit({ reconciliation: [...kept, ...items], connectorsError: null });
          return items;
        } catch (error) {
          logger.error({ message: 'Reconciliation fetch failed', context: { error, connectorId } });
          commit({ connectorsError: messageOf(error, 'load_failed') });
          return [];
        }
      },

      fetchConnectors: async () => {
        const commit = sessionSet(set);
        set({ connectorsError: null });
        try {
          const response = await getRecordDeploymentConnectors();
          const connectors = (response?.Data ?? []).slice().sort((a, b) => a.Name.localeCompare(b.Name));
          commit({ connectors });
          return connectors;
        } catch (error) {
          logger.error({ message: 'Connectors fetch failed', context: { error } });
          commit({ connectorsError: messageOf(error, 'load_failed') });
          return [];
        }
      },

      fetchConnector: async (connectorId) => {
        const commit = sessionSet(set);
        try {
          const response = await getRecordDeploymentConnector(connectorId);
          const connector = response?.Data ?? null;
          if (connector) {
            commit({ connectors: [connector, ...get().connectors.filter((existing) => existing.Id !== connectorId)].sort((a, b) => a.Name.localeCompare(b.Name)), connectorsError: null });
          }
          return connector;
        } catch (error) {
          logger.error({ message: 'Connector fetch failed', context: { error, connectorId } });
          commit({ connectorsError: messageOf(error, 'load_failed') });
          return get().connectors.find((existing) => existing.Id === connectorId) ?? null;
        }
      },

      fetchRuns: async (connectorId) => {
        const commit = sessionSet(set);
        try {
          const response = await getRecordDeploymentConnectorRuns(connectorId);
          const runs = response?.Data ?? [];
          commit({ runs: { ...get().runs, [connectorId]: runs } });
          return runs;
        } catch (error) {
          logger.error({ message: 'Connector runs fetch failed', context: { error, connectorId } });
          commit({ connectorsError: messageOf(error, 'load_failed') });
          return get().runs[connectorId] ?? [];
        }
      },

      runConnector: async (connectorId) => {
        if (get().runningConnectorId) {
          return { ok: false, error: 'busy' };
        }
        const commit = sessionSet(set);
        set({ runningConnectorId: connectorId, connectorsError: null });
        try {
          const response = await runRecordDeploymentConnector(connectorId);
          const run = response?.Data;
          if (!run) {
            commit({ runningConnectorId: null, connectorsError: 'load_failed' });
            return { ok: false, error: 'load_failed' };
          }
          // The run row is the newest entry in that connector's log; then everything it may have
          // changed is re-read from the server rather than guessed at from the counts.
          commit({ runs: { ...get().runs, [connectorId]: [run, ...(get().runs[connectorId] ?? []).filter((existing) => existing.Id !== run.Id)] }, runningConnectorId: null });
          await Promise.all([get().fetchConnector(connectorId), get().fetchReconciliation(connectorId), get().fetchDeployments()]);
          return { ok: run.Outcome === 'ok', run, error: run.Outcome === 'ok' ? undefined : (run.Error ?? run.Outcome) };
        } catch (error) {
          logger.error({ message: 'Connector run failed', context: { error, connectorId } });
          const message = messageOf(error, 'run_failed');
          commit({ runningConnectorId: null, connectorsError: message });
          return { ok: false, error: message };
        }
      },

      reset: () => {
        sessionGeneration += 1;
        set({
          deployments: [],
          includeClosed: false,
          reconciliation: [],
          connectors: [],
          runs: {},
          isLoading: false,
          runningConnectorId: null,
          error: null,
          connectorsError: null,
          lastFetchedOn: null,
        });
      },
    }),
    {
      name: 'records-deployments-storage',
      storage: createJSONStorage(() => zustandStorage),
      // The department's own deployments are worth a glance offline. Connector rows carry feed roots
      // and error text, and run logs carry source messages, so neither is written to the device.
      partialize: (state) => ({
        deployments: state.deployments,
        includeClosed: state.includeClosed,
        lastFetchedOn: state.lastFetchedOn,
      }),
    }
  )
);

export const useOpenDeploymentCount = () => useDeploymentsStore((state) => state.deployments.filter((deployment) => deployment.Status !== 'ClosedOut').length);

export const useReconciliationCount = () => useDeploymentsStore((state) => state.reconciliation.length);
