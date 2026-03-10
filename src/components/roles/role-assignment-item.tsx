import { ChevronRightIcon, UserIcon, UserXIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import type { UnitRoleResultData } from '@/models/v4/unitRoles/unitRoleResultData';

import { RoleUserSelectionModal } from './role-user-selection-modal';

type RoleAssignmentItemProps = {
  role: UnitRoleResultData;
  assignedUser?: PersonnelInfoResultData;
  availableUsers: PersonnelInfoResultData[];
  onAssignUser: (userId?: string) => void;
  currentAssignments: { roleId: string; userId: string; roleName?: string }[];
};

export const RoleAssignmentItem: React.FC<RoleAssignmentItemProps> = ({ role, assignedUser, availableUsers, onAssignUser, currentAssignments }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleOpenModal = React.useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = React.useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSelectUser = React.useCallback(
    (userId?: string) => {
      onAssignUser(userId);
    },
    [onAssignUser]
  );

  return (
    <>
      <Pressable
        onPress={handleOpenModal}
        className={`rounded-lg border p-4 ${isDark ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-white'}`}
        testID={`role-assignment-${role.UnitRoleId}`}
        accessibilityRole="button"
        accessibilityLabel={t('roles.tapToAssign', {
          role: role.Name,
          defaultValue: `Tap to assign user to ${role.Name}`,
        })}
      >
        <HStack className="items-center" space="md">
          {/* Avatar / icon */}
          <View className={`size-10 items-center justify-center rounded-full ${assignedUser ? 'bg-primary-500' : isDark ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
            {assignedUser ? <UserIcon size={18} color="#ffffff" /> : <UserXIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />}
          </View>

          {/* Content */}
          <VStack className="flex-1" space="xs">
            <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{role.Name}</Text>

            {assignedUser ? (
              <>
                <Text className="text-base font-medium">{`${assignedUser.FirstName} ${assignedUser.LastName}`.trim()}</Text>
                <HStack space="sm" className="flex-wrap items-center">
                  {assignedUser.GroupName ? <Text className="text-xs text-neutral-500 dark:text-neutral-400">{assignedUser.GroupName}</Text> : null}
                  {assignedUser.GroupName && assignedUser.Status ? <Text className="text-xs text-neutral-300 dark:text-neutral-600">•</Text> : null}
                  {assignedUser.Status ? (
                    <View className="flex-row items-center">
                      {assignedUser.StatusColor ? <View style={[styles.statusDot, { backgroundColor: assignedUser.StatusColor }]} /> : null}
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{assignedUser.Status}</Text>
                    </View>
                  ) : null}
                  {assignedUser.Staffing ? (
                    <>
                      <Text className="text-xs text-neutral-300 dark:text-neutral-600">•</Text>
                      <View className="flex-row items-center">
                        {assignedUser.StaffingColor ? <View style={[styles.statusDot, { backgroundColor: assignedUser.StaffingColor }]} /> : null}
                        <Text className="text-xs text-neutral-500 dark:text-neutral-400">{assignedUser.Staffing}</Text>
                      </View>
                    </>
                  ) : null}
                </HStack>
              </>
            ) : (
              <Text className="text-base text-neutral-400 dark:text-neutral-500">{t('roles.unassigned', 'Unassigned')}</Text>
            )}
          </VStack>

          {/* Chevron */}
          <ChevronRightIcon size={20} color={isDark ? '#a3a3a3' : '#737373'} />
        </HStack>
      </Pressable>

      <RoleUserSelectionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        roleName={role.Name}
        selectedUserId={assignedUser?.UserId}
        users={availableUsers}
        onSelectUser={handleSelectUser}
        currentAssignments={currentAssignments}
        currentRoleId={role.UnitRoleId}
      />
    </>
  );
};

const styles = StyleSheet.create({
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
});
