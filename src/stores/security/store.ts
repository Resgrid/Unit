import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getCurrentUsersRights } from '@/api/security/security';
import { type DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';

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
            });
          }
        } catch (error) {
          // If refresh fails, log out the user
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
