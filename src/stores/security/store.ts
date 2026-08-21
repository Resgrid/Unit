import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUsersRights } from '@/api/security/security';
import { cacheManager } from '@/lib/cache/cache-manager';
import { setCacheScope } from '@/lib/cache/cache-scope';
import { logger } from '@/lib/logging';
import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';
import { isNetworkError } from '@/utils/network';

import { zustandStorage } from '../../lib/storage';

export interface SecurityState {
  error: string | null;
  getRights: () => Promise<void>;
  rights: DepartmentRightsResultData | null;
}

export const securityStore = create<SecurityState>()(
  persist(
    (set, _get) => ({
      error: null,
      rights: null,
      getRights: async () => {
        try {
          const response = await getCurrentUsersRights();
          // Only update if rights actually changed to prevent unnecessary re-renders
          const current = _get().rights;
          if (!current || JSON.stringify(current) !== JSON.stringify(response.Data)) {
            set({
              rights: response.Data,
              error: null,
            });
          } else if (_get().error) {
            // Clear a previous failure even when the rights themselves are unchanged.
            set({ error: null });
          }
        } catch (error) {
          // Rights are refreshed on init and on resume; a failure here leaves the
          // previously persisted rights in place rather than blocking startup.
          // Transient connectivity failures stay at warn so they never reach
          // Sentry — genuine server/parse failures still report as errors.
          if (isNetworkError(error)) {
            logger.warn({
              message: 'Failed to fetch user rights due to network connectivity',
              context: { error },
            });
          } else {
            logger.error({
              message: 'Failed to fetch user rights',
              context: { error },
            });
          }
          set({ error: error instanceof Error ? error.message : 'Failed to fetch user rights' });
        }
      },
    }),
    {
      name: 'security-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        rights: state.rights,
        // Exclude: error (transient)
      }),
    }
  )
);

// The API cache is scoped to the department as well as the signed-in user, and rights are where the
// active department is decided -- a user can be moved between departments without ever signing out.
// This subscription lives here rather than beside the user-scope one in the auth store: that module
// would have to import this one, closing the auth -> security -> api client -> auth cycle the
// session-cleanup registry exists to avoid.
securityStore.subscribe((state, previousState) => {
  // DepartmentId is a string that defaults to empty, so treat blank as "no department" rather than
  // letting '' become a scope of its own.
  const departmentId = state.rights?.DepartmentId || null;
  const previousDepartmentId = previousState.rights?.DepartmentId || null;

  if (departmentId === previousDepartmentId) {
    return;
  }

  // Only a move between two real departments can serve the wrong rows. The first rights load of a
  // session moves the scope off 'nodept', which leaves anything cached before it unaddressable
  // rather than wrong, and clearing there would throw away the data app startup just fetched.
  if (previousDepartmentId) {
    try {
      cacheManager.clear();
    } catch (error) {
      // Cache hygiene must never break a department switch. Stale entries expire on their own, and
      // the scope moves on below, so they are no longer addressable by the new department.
      logger.warn({
        message: 'Failed to clear the API cache on department change',
        context: { error },
      });
    }
  }

  // Deliberately outside the clear() attempt: leaving the scope on the previous department is the
  // one failure that actually leaks, since cache keys embed it and the entries the clear just
  // failed to drop are still there.
  try {
    setCacheScope({ departmentId });
  } catch (error) {
    logger.warn({
      message: 'Failed to update the API cache scope on department change',
      context: { error },
    });
  }
});

export const useSecurityStore = () => {
  const rights = securityStore((state) => state.rights);
  const getRights = securityStore((state) => state.getRights);
  return {
    getRights,
    isUserDepartmentAdmin: rights?.IsAdmin,
    isUserGroupAdmin: (groupId: number) => rights?.Groups?.some((right) => right.GroupId === groupId && right.IsGroupAdmin) ?? false,
    canUserCreateCalls: rights?.CanCreateCalls,
    canUserCreateNotes: rights?.CanAddNote,
    canUserCreateMessages: rights?.CanCreateMessage,
    canUserViewPII: rights?.CanViewPII,
    departmentCode: rights?.DepartmentCode,
  };
};
