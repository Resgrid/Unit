import { CheckIcon, SearchIcon, UserIcon, UserXIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Box } from '@/components/ui/box';
import { Divider } from '@/components/ui/divider';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

type RoleUserSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roleName: string;
  selectedUserId?: string;
  users: PersonnelInfoResultData[];
  onSelectUser: (userId?: string) => void;
  currentAssignments?: { roleId: string; userId: string; roleName?: string }[];
  currentRoleId?: string;
};

export const RoleUserSelectionModal: React.FC<RoleUserSelectionModalProps> = ({ isOpen, onClose, roleName, selectedUserId, users, onSelectUser, currentAssignments = [], currentRoleId }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const fullName = `${user.FirstName} ${user.LastName}`.toLowerCase();
      const group = (user.GroupName || '').toLowerCase();
      return fullName.includes(query) || group.includes(query);
    });
  }, [users, searchQuery]);

  const handleSelect = React.useCallback(
    (userId?: string) => {
      onSelectUser(userId);
      onClose();
    },
    [onSelectUser, onClose]
  );

  const renderUserItem = React.useCallback(
    (item: PersonnelInfoResultData) => {
      const isSelected = item.UserId === selectedUserId;
      const fullName = `${item.FirstName} ${item.LastName}`.trim();
      const otherAssignment = currentAssignments.find((a) => a.userId === item.UserId && currentRoleId != null && a.roleId !== currentRoleId);
      const isAssignedElsewhere = !!otherAssignment;

      return (
        <Pressable
          key={item.UserId}
          onPress={() => handleSelect(item.UserId)}
          className={`px-4 py-3 ${isSelected ? (isDark ? 'bg-primary-900/30' : 'bg-primary-50') : ''}`}
          testID={`user-item-${item.UserId}`}
          accessibilityRole="button"
          accessibilityLabel={t('roles.selectUserLabel', { name: fullName, defaultValue: `Select ${fullName}` })}
        >
          <HStack className="items-center" space="md">
            <View className={`size-10 items-center justify-center rounded-full ${isSelected ? 'bg-primary-500' : isDark ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
              {isSelected ? <CheckIcon size={18} color="#ffffff" /> : <UserIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />}
            </View>

            <VStack className="flex-1" space="xs">
              <HStack className="items-center" space="sm">
                <Text className={`text-base font-medium ${isSelected ? 'text-primary-600 dark:text-primary-400' : ''}`}>{fullName}</Text>
                {isAssignedElsewhere ? (
                  <View className="rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/40">
                    <Text className="text-xs text-amber-700 dark:text-amber-400">{otherAssignment?.roleName ? otherAssignment.roleName : t('roles.assignedElsewhere', 'In another role')}</Text>
                  </View>
                ) : null}
              </HStack>
              <HStack space="sm" className="flex-wrap items-center">
                {item.GroupName ? <Text className="text-xs text-neutral-500 dark:text-neutral-400">{item.GroupName}</Text> : null}
                {item.GroupName && item.Status ? <Text className="text-xs text-neutral-300 dark:text-neutral-600">•</Text> : null}
                {item.Status ? (
                  <View className="flex-row items-center">
                    {item.StatusColor ? <View style={[styles.statusDot, { backgroundColor: item.StatusColor }]} /> : null}
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400">{item.Status}</Text>
                  </View>
                ) : null}
                {item.Staffing ? (
                  <>
                    <Text className="text-xs text-neutral-300 dark:text-neutral-600">•</Text>
                    <View className="flex-row items-center">
                      {item.StaffingColor ? <View style={[styles.statusDot, { backgroundColor: item.StaffingColor }]} /> : null}
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{item.Staffing}</Text>
                    </View>
                  </>
                ) : null}
              </HStack>
              {item.Roles && item.Roles.length > 0 ? (
                <HStack space="xs" className="flex-wrap">
                  {item.Roles.map((role, index) => (
                    <View key={`${item.UserId}-role-${index}`} className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-700">
                      <Text className="text-xs text-neutral-600 dark:text-neutral-300">{role}</Text>
                    </View>
                  ))}
                </HStack>
              ) : null}
            </VStack>

            {isSelected ? <CheckIcon size={20} color={isDark ? '#60a5fa' : '#2563eb'} /> : null}
          </HStack>
        </Pressable>
      );
    },
    [selectedUserId, isDark, handleSelect, t, currentAssignments, currentRoleId]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent className={`rounded-2xl ${Platform.OS === 'web' ? 'max-h-[80vh] w-full max-w-lg' : 'max-h-[85%]'}`} testID="role-user-selection-modal">
        <ModalHeader className="pb-2">
          <HStack className="w-full items-center justify-between">
            <VStack>
              <Text className="text-lg font-semibold">{t('roles.selectUserForRole', { role: roleName, defaultValue: `Assign: ${roleName}` })}</Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('roles.selectUserDescription', 'Choose a person to fill this role')}</Text>
            </VStack>
            <Pressable onPress={onClose} className="rounded-full p-2" accessibilityRole="button" accessibilityLabel={t('common.close', 'Close')}>
              <XIcon size={20} color={isDark ? '#a3a3a3' : '#737373'} />
            </Pressable>
          </HStack>
        </ModalHeader>

        <ModalBody className="px-0">
          {/* Search bar */}
          <Box className="px-4 pb-3">
            <Input size="md" className="rounded-lg">
              <InputSlot className="pl-3">
                <InputIcon as={SearchIcon} size={18} />
              </InputSlot>
              <InputField placeholder={t('roles.searchUsers', 'Search by name or group...')} value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" autoCorrect={false} testID="user-search-input" />
            </Input>
          </Box>

          {/* Unassigned option */}
          <Pressable
            onPress={() => handleSelect(undefined)}
            className={`px-4 py-3 ${!selectedUserId ? (isDark ? 'bg-primary-900/30' : 'bg-primary-50') : ''}`}
            testID="unassigned-option"
            accessibilityRole="button"
            accessibilityLabel={t('roles.unassigned', 'Unassigned')}
          >
            <HStack className="items-center" space="md">
              <View className={`size-10 items-center justify-center rounded-full ${!selectedUserId ? 'bg-primary-500' : isDark ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
                {!selectedUserId ? <CheckIcon size={18} color="#ffffff" /> : <UserXIcon size={18} color={isDark ? '#a3a3a3' : '#737373'} />}
              </View>
              <VStack className="flex-1">
                <Text className={`text-base font-medium ${!selectedUserId ? 'text-primary-600 dark:text-primary-400' : ''}`}>{t('roles.unassigned', 'Unassigned')}</Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">{t('roles.clearAssignment', 'Clear the current assignment')}</Text>
              </VStack>
              {!selectedUserId ? <CheckIcon size={20} color={isDark ? '#60a5fa' : '#2563eb'} /> : null}
            </HStack>
          </Pressable>

          <Divider />

          {/* User list - rendered directly inside ModalBody (which is already a ScrollView) */}
          <View testID="user-list">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user, index) => (
                <React.Fragment key={user.UserId}>
                  {index > 0 ? <Divider /> : null}
                  {renderUserItem(user)}
                </React.Fragment>
              ))
            ) : (
              <Box className="items-center py-8">
                <Text className="text-neutral-500 dark:text-neutral-400">{t('roles.noUsersFound', 'No users found')}</Text>
              </Box>
            )}
          </View>
        </ModalBody>
      </ModalContent>
    </Modal>
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
