import { create } from 'zustand';

import { getAllGroups } from '@/api/groups/groups';
import { getAllPersonnelInfos } from '@/api/personnel/personnel';
import { getAllUnitRolesAndAssignmentsForDepartment } from '@/api/units/unitRoles';
import { getUnits } from '@/api/units/units';
import { type GroupResultData } from '@/models/v4/groups/groupsResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitRoleResultData } from '@/models/v4/unitRoles/unitRoleResultData';
import { type UnitResultData } from '@/models/v4/units/unitResultData';

export interface DispatchSelection {
  everyone: boolean;
  users: string[];
  groups: string[];
  roles: string[];
  units: string[];
}

export interface DispatchData {
  users: PersonnelInfoResultData[];
  groups: GroupResultData[];
  roles: UnitRoleResultData[];
  units: UnitResultData[];
}

interface DispatchState {
  data: DispatchData;
  selection: DispatchSelection;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  fetchDispatchData: () => Promise<void>;
  setSelection: (selection: DispatchSelection) => void;
  toggleEveryone: () => void;
  toggleUser: (userId: string) => void;
  toggleGroup: (groupId: string) => void;
  toggleRole: (roleId: string) => void;
  toggleUnit: (unitId: string) => void;
  setSearchQuery: (query: string) => void;
  clearSelection: () => void;
  getFilteredData: () => DispatchData;
}

const initialSelection: DispatchSelection = {
  everyone: false,
  users: [],
  groups: [],
  roles: [],
  units: [],
};

export const useDispatchStore = create<DispatchState>((set, get) => ({
  data: {
    users: [],
    groups: [],
    roles: [],
    units: [],
  },
  selection: initialSelection,
  isLoading: false,
  error: null,
  searchQuery: '',

  fetchDispatchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [usersResponse, groupsResponse, rolesResponse, unitsResponse] = await Promise.all([getAllPersonnelInfos(''), getAllGroups(), getAllUnitRolesAndAssignmentsForDepartment(), getUnits()]);

      set({
        data: {
          users: usersResponse.Data,
          groups: groupsResponse.Data,
          roles: rolesResponse.Data,
          units: unitsResponse.Data,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error: 'Failed to fetch dispatch data',
        isLoading: false,
      });
    }
  },

  setSelection: (selection: DispatchSelection) => {
    set({ selection });
  },

  toggleEveryone: () => {
    const { selection } = get();
    if (selection.everyone) {
      // If everyone was selected, deselect it
      set({
        selection: {
          ...selection,
          everyone: false,
        },
      });
    } else {
      // If everyone wasn't selected, select it and clear all others
      set({
        selection: {
          everyone: true,
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
      });
    }
  },

  toggleUser: (userId: string) => {
    const { selection } = get();
    const isSelected = selection.users.includes(userId);

    set({
      selection: {
        ...selection,
        everyone: false, // Deselect everyone when selecting specific items
        users: isSelected ? selection.users.filter((id) => id !== userId) : [...selection.users, userId],
      },
    });
  },

  toggleGroup: (groupId: string) => {
    const { selection } = get();
    const isSelected = selection.groups.includes(groupId);

    set({
      selection: {
        ...selection,
        everyone: false, // Deselect everyone when selecting specific items
        groups: isSelected ? selection.groups.filter((id) => id !== groupId) : [...selection.groups, groupId],
      },
    });
  },

  toggleRole: (roleId: string) => {
    const { selection } = get();
    const isSelected = selection.roles.includes(roleId);

    set({
      selection: {
        ...selection,
        everyone: false, // Deselect everyone when selecting specific items
        roles: isSelected ? selection.roles.filter((id) => id !== roleId) : [...selection.roles, roleId],
      },
    });
  },

  toggleUnit: (unitId: string) => {
    const { selection } = get();
    const isSelected = selection.units.includes(unitId);

    set({
      selection: {
        ...selection,
        everyone: false, // Deselect everyone when selecting specific items
        units: isSelected ? selection.units.filter((id) => id !== unitId) : [...selection.units, unitId],
      },
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearSelection: () => {
    set({ selection: initialSelection });
  },

  getFilteredData: () => {
    const { data, searchQuery } = get();
    if (!searchQuery.trim()) {
      return data;
    }

    const query = searchQuery.toLowerCase();
    return {
      users: data.users.filter((user) => `${user.FirstName} ${user.LastName}`.toLowerCase().includes(query) || user.EmailAddress.toLowerCase().includes(query)),
      groups: data.groups.filter((group) => group.Name.toLowerCase().includes(query)),
      roles: data.roles.filter((role) => role.Name.toLowerCase().includes(query)),
      units: data.units.filter((unit) => unit.Name.toLowerCase().includes(query)),
    };
  },
}));
