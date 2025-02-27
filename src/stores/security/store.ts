import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { setItem, zustandStorage } from '../../lib/storage';
import { DepartmentRightsResultData } from '@/models/v4/security/departmentRightsResultData';
import { getCurrentUsersRights } from '@/api/security/security';

export interface SecurityState {
  error: string | null;
  getRights: () => Promise<void>;
  rights: DepartmentRightsResultData | null;
}

const securityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      error: null,
      rights: null,
      getRights: async () => {
        try {
          const response = await getCurrentUsersRights();

          set({
            rights: response.Data,
          });
        } catch (error) {
          // If refresh fails, log out the user
        }
      },
    }),
    {
      name: 'security-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);

export const useSecurityStore = () => {
  const store = securityStore();
  return {
    getRights: store.getRights,
    isUserDepartmentAdmin: store.rights?.IsAdmin,
    isUserGroupAdmin: (groupId: number) =>
      store.rights?.Groups.some(
        (right) => right.GroupId === groupId && right.IsGroupAdmin
      ),
    canUserCreateCalls: store.rights?.CanCreateCalls,
    canUserCreateNotes: store.rights?.CanAddNote,
    canUserCreateMessages: store.rights?.CanCreateMessage,
    canUserViewPII: store.rights?.CanViewPII,
  };
};
