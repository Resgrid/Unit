import * as React from 'react';
import { Text } from '@/components/ui/text';
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
} from '@/components/ui/select';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from 'lucide-react-native';
import { UnitRoleResultData } from '@/models/v4/unitRoles/unitRoleResultData';
import { PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';

type RoleAssignmentItemProps = {
  role: UnitRoleResultData;
  assignedUser?: PersonnelInfoResultData;
  availableUsers: PersonnelInfoResultData[];
  onAssignUser: (userId?: string) => void;
  currentAssignments: { roleId: string; userId: string }[];
};

export const RoleAssignmentItem: React.FC<RoleAssignmentItemProps> = ({
  role,
  assignedUser,
  availableUsers,
  onAssignUser,
  currentAssignments,
}) => {
  const { t } = useTranslation();

  const filteredUsers = availableUsers.filter((user) => {
    const isAssignedToOtherRole = currentAssignments.some(
      (assignment) =>
        assignment.userId === user.UserId &&
        assignment.roleId !== role.UnitRoleId
    );
    return !isAssignedToOtherRole;
  });

  return (
    <VStack className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg" space="xs">
      <Text className="font-medium text-base">{role.Name}</Text>
      <Select
        selectedValue={assignedUser?.UserId || ''}
        onValueChange={(value) => onAssignUser(value || undefined)}
      >
        <SelectTrigger>
          <SelectInput
            placeholder={t('roles.selectUser', 'Select user')}
            className="py-2 px-3"
            value={
              assignedUser
                ? `${assignedUser.FirstName} ${assignedUser.LastName}`
                : ''
            }
          />
          <SelectIcon as={ChevronDownIcon} />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            <SelectItem label={t('roles.unassigned', 'Unassigned')} value="" />
            {filteredUsers.map((user) => (
              <SelectItem
                key={user.UserId}
                label={`${user.FirstName} ${user.LastName}`}
                value={user.UserId}
              />
            ))}
          </SelectContent>
        </SelectPortal>
      </Select>
    </VStack>
  );
};
