import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';
import { useRolesStore } from '@/stores/roles/store';
import { useToastStore } from '@/stores/toast/store';

import { Button, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { ScrollView } from '../ui/scroll-view';
import { VStack } from '../ui/vstack';
import { RoleAssignmentItem } from './role-assignment-item';

type RolesBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const RolesBottomSheet: React.FC<RolesBottomSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { trackEvent } = useAnalytics();
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const roles = useRolesStore((state) => state.roles);
  const unitRoleAssignments = useRolesStore((state) => state.unitRoleAssignments);
  const users = useRolesStore((state) => state.users);
  const isLoading = useRolesStore((state) => state.isLoading);
  const error = useRolesStore((state) => state.error);

  // Add state to track pending changes
  const [pendingAssignments, setPendingAssignments] = React.useState<{ roleId: string; userId?: string }[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && activeUnit) {
      useRolesStore.getState().fetchAllForUnit(activeUnit.UnitId);
      // Reset pending assignments when bottom sheet opens
      setPendingAssignments([]);
    }
  }, [isOpen, activeUnit]);

  // Track when roles bottom sheet is opened/rendered
  React.useEffect(() => {
    if (isOpen) {
      trackEvent('roles_bottom_sheet_opened', {
        unitId: activeUnit?.UnitId || '',
        unitName: activeUnit?.Name || '',
        rolesCount: roles.length,
        usersCount: users.length,
        hasError: !!error,
      });
    }
  }, [isOpen, trackEvent, activeUnit, roles.length, users.length, error]);

  // Handle user assignment changes - auto-unassign from previous role when swapping
  const handleAssignUser = React.useCallback(
    (roleId: string, userId?: string) => {
      setPendingAssignments((current) => {
        let updated = current.filter((a) => a.roleId !== roleId);
        // If assigning a user, check if they're currently in another role and unassign them
        if (userId && userId.trim() !== '') {
          // Check effective assignments (server + pending) for this user in another role
          const serverAssignment = unitRoleAssignments.find((a) => a.UserId === userId && a.UnitRoleId !== roleId && a.UserId.trim() !== '');
          const pendingForUser = updated.find((a) => a.userId === userId && a.roleId !== roleId);
          // If user is assigned elsewhere on server and not already pending-unassigned, add unassignment
          if (serverAssignment && !updated.some((a) => a.roleId === serverAssignment.UnitRoleId)) {
            updated = [...updated, { roleId: serverAssignment.UnitRoleId, userId: undefined }];
          }
          // If user is pending-assigned to another role, remove that pending assignment
          if (pendingForUser) {
            updated = updated.filter((a) => !(a.roleId === pendingForUser.roleId && a.userId === userId));
            // Add unassignment for that role if it had a server assignment
            const hadServerAssignment = unitRoleAssignments.find((a) => a.UnitRoleId === pendingForUser.roleId && a.UserId && a.UserId.trim() !== '');
            if (hadServerAssignment) {
              updated = [...updated.filter((a) => a.roleId !== pendingForUser.roleId), { roleId: pendingForUser.roleId, userId: undefined }];
            }
          }
        }
        return [...updated, { roleId, userId }];
      });
    },
    [unitRoleAssignments]
  );

  const filteredRoles = React.useMemo(() => {
    return roles.filter((role) => role.UnitId === activeUnit?.UnitId);
  }, [roles, activeUnit]);

  // Handle save button
  const handleSave = React.useCallback(async () => {
    if (!activeUnit) return;

    setIsSaving(true);
    try {
      // Get all roles for this unit, allowing empty UserId for unassignments
      const allUnitRoles = filteredRoles
        .map((role) => {
          const pendingAssignment = pendingAssignments.find((a) => a.roleId === role.UnitRoleId);
          const currentAssignment = unitRoleAssignments.find((a) => a.UnitRoleId === role.UnitRoleId);
          // If there's a pending assignment for this role, use it (even if empty for unassignment)
          const assignedUserId = pendingAssignment ? pendingAssignment.userId || '' : currentAssignment?.UserId || '';

          return {
            RoleId: role.UnitRoleId,
            UserId: assignedUserId,
            Name: '',
          };
        })
        .filter((role) => {
          // Only filter out entries lacking a RoleId - allow empty UserId for unassignments
          return role.RoleId && role.RoleId.trim() !== '';
        });

      // Save only valid role assignments
      await useRolesStore.getState().assignRoles({
        UnitId: activeUnit.UnitId,
        Roles: allUnitRoles,
      });

      // Refresh role assignments after all updates
      await useRolesStore.getState().fetchRolesForUnit(activeUnit.UnitId);
      useToastStore.getState().showToast('success', t('roles.saved_successfully', 'Role assignments saved successfully'));
      onClose();
    } catch (err) {
      logger.error({
        message: 'Error saving role assignments',
        context: {
          error: err,
        },
      });
      useToastStore.getState().showToast('error', t('roles.save_error', 'Error saving role assignments'));
    } finally {
      setIsSaving(false);
    }
  }, [activeUnit, pendingAssignments, onClose, t, filteredRoles, unitRoleAssignments]);

  const handleClose = React.useCallback(() => {
    setPendingAssignments([]);
    onClose();
  }, [onClose]);

  // Build effective assignments: pending overrides server, ensuring a person can only be in one role
  const effectiveAssignments = React.useMemo(() => {
    const merged: { roleId: string; userId: string; roleName?: string }[] = [];

    // Start with server assignments that have valid userIds
    for (const a of unitRoleAssignments) {
      if (a.UserId && a.UserId.trim() !== '') {
        merged.push({ roleId: a.UnitRoleId, userId: a.UserId, roleName: a.Name });
      }
    }

    // Override with pending assignments
    for (const p of pendingAssignments) {
      const idx = merged.findIndex((m) => m.roleId === p.roleId);
      const roleDef = filteredRoles.find((r) => r.UnitRoleId === p.roleId);
      if (idx >= 0) {
        if (p.userId && p.userId.trim() !== '') {
          merged[idx] = { roleId: p.roleId, userId: p.userId, roleName: roleDef?.Name };
        } else {
          // Unassignment: remove from merged
          merged.splice(idx, 1);
        }
      } else if (p.userId && p.userId.trim() !== '') {
        merged.push({ roleId: p.roleId, userId: p.userId, roleName: roleDef?.Name });
      }
    }

    return merged;
  }, [unitRoleAssignments, pendingAssignments, filteredRoles]);

  const hasChanges = pendingAssignments.length > 0;

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={handleClose} isLoading={isLoading} loadingText={t('common.loading')} snapPoints={[80]} minHeight="min-h-[600px]" testID="roles-bottom-sheet">
      <VStack space="md" className="w-full flex-1">
        <HStack className="items-center justify-between">
          <Text className="text-xl font-bold">{t('roles.title', 'Unit Role Assignments')}</Text>
          {activeUnit && <Text className="text-sm text-gray-500">{activeUnit.Name}</Text>}
        </HStack>

        {error ? (
          <Text className="py-4 text-center text-red-500" testID="error-message">
            {error}
          </Text>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} testID="roles-scroll-view">
            <VStack space="sm" className="pb-4">
              {filteredRoles.map((role) => {
                const pendingAssignment = pendingAssignments.find((a) => a.roleId === role.UnitRoleId);
                const assignment = unitRoleAssignments.find((a) => a.UnitRoleId === role.UnitRoleId);
                // If there's a pending assignment for this role, use it (even if userId is empty for unassignment)
                const effectiveUserId = pendingAssignment !== undefined ? pendingAssignment.userId : assignment?.UserId;
                const assignedUser = effectiveUserId ? users.find((u) => u.UserId === effectiveUserId) : undefined;

                return (
                  <RoleAssignmentItem
                    key={role.UnitRoleId}
                    role={role}
                    assignedUser={assignedUser}
                    availableUsers={users}
                    onAssignUser={(userId) => handleAssignUser(role.UnitRoleId, userId)}
                    currentAssignments={effectiveAssignments}
                  />
                );
              })}
            </VStack>
          </ScrollView>
        )}

        <HStack space="md" className="pt-4">
          <Button variant="outline" action="secondary" className="flex-1" onPress={handleClose} isDisabled={isSaving} testID="cancel-button">
            <ButtonText>{t('common.cancel', 'Cancel')}</ButtonText>
          </Button>
          <Button variant="solid" action="primary" className="flex-1" onPress={handleSave} isDisabled={isSaving || !hasChanges} testID="save-button">
            {isSaving ? <Spinner size="small" /> : <ButtonText>{t('common.save', 'Save')}</ButtonText>}
          </Button>
        </HStack>
      </VStack>
    </CustomBottomSheet>
  );
};
