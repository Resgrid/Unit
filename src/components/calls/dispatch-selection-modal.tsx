import { CheckIcon, SearchIcon, UsersIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { Loading } from '@/components/common/loading';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetFlatList } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DispatchSelection, useDispatchStore } from '@/stores/dispatch/store';

interface DispatchSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (selection: DispatchSelection) => void;
  initialSelection?: DispatchSelection;
}

const nameIncludesQuery = (name: string | null | undefined, query: string): boolean => name?.toLowerCase().includes(query) ?? false;

type RecipientKind = 'user' | 'group' | 'role' | 'unit';

/**
 * One flat, virtualized row stream instead of four mapped card lists inside a
 * ScrollView — a department with a few hundred recipients previously mounted
 * every card up front.
 */
type DispatchRow = { type: 'everyone'; key: string } | { type: 'header'; key: string; label: string } | { type: 'recipient'; key: string; kind: RecipientKind; id: string; name: string } | { type: 'empty'; key: string };

const rowKeyExtractor = (row: DispatchRow) => row.key;

interface RecipientRowProps {
  id: string;
  name: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const RecipientRow: React.FC<RecipientRowProps> = React.memo(({ id, name, isSelected, onToggle }) => {
  const handlePress = useCallback(() => onToggle(id), [onToggle, id]);

  return (
    <Card className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
      <TouchableOpacity onPress={handlePress} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }} accessibilityLabel={name}>
        <HStack className="items-center space-x-3">
          <Box className={`size-5 items-center justify-center rounded border-2 ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
            {isSelected ? <CheckIcon size={12} color="#ffffff" /> : null}
          </Box>
          <VStack className="flex-1">
            <Text className="pl-4 font-medium">{name}</Text>
          </VStack>
        </HStack>
      </TouchableOpacity>
    </Card>
  );
});

RecipientRow.displayName = 'RecipientRow';

export const DispatchSelectionModal: React.FC<DispatchSelectionModalProps> = ({ isVisible, onClose, onConfirm, initialSelection }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  // Selective subscriptions — a whole-store subscription re-rendered the
  // entire modal (incl. every recipient card) on each search keystroke.
  const data = useDispatchStore((state) => state.data);
  const selection = useDispatchStore((state) => state.selection);
  const isLoading = useDispatchStore((state) => state.isLoading);
  const error = useDispatchStore((state) => state.error);
  const searchQuery = useDispatchStore((state) => state.searchQuery);
  const fetchDispatchData = useDispatchStore((state) => state.fetchDispatchData);
  const setSelection = useDispatchStore((state) => state.setSelection);
  const toggleEveryone = useDispatchStore((state) => state.toggleEveryone);
  const toggleUser = useDispatchStore((state) => state.toggleUser);
  const toggleGroup = useDispatchStore((state) => state.toggleGroup);
  const toggleRole = useDispatchStore((state) => state.toggleRole);
  const toggleUnit = useDispatchStore((state) => state.toggleUnit);
  const setSearchQuery = useDispatchStore((state) => state.setSearchQuery);
  const clearSelection = useDispatchStore((state) => state.clearSelection);

  // Memoized filtering instead of recomputing getFilteredData() every render
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }
    const query = searchQuery.toLowerCase();
    return {
      users: data.users.filter((user) => nameIncludesQuery(user.Name, query)),
      groups: data.groups.filter((group) => nameIncludesQuery(group.Name, query)),
      roles: data.roles.filter((role) => nameIncludesQuery(role.Name, query)),
      units: data.units.filter((unit) => nameIncludesQuery(unit.Name, query)),
    };
  }, [data, searchQuery]);

  // Set-based membership: `selection.users.includes(id)` per card made selection
  // checks O(n²) across the list.
  const selectedUsers = useMemo(() => new Set(selection.users), [selection.users]);
  const selectedGroups = useMemo(() => new Set(selection.groups), [selection.groups]);
  const selectedRoles = useMemo(() => new Set(selection.roles), [selection.roles]);
  const selectedUnits = useMemo(() => new Set(selection.units), [selection.units]);

  const rows = useMemo<DispatchRow[]>(() => {
    const built: DispatchRow[] = [{ type: 'everyone', key: 'everyone' }];

    const sections: { kind: RecipientKind; labelKey: string; items: typeof filteredData.users }[] = [
      { kind: 'user', labelKey: 'calls.users', items: filteredData.users },
      { kind: 'group', labelKey: 'calls.groups', items: filteredData.groups },
      { kind: 'role', labelKey: 'calls.roles', items: filteredData.roles },
      { kind: 'unit', labelKey: 'calls.units', items: filteredData.units },
    ];

    for (const section of sections) {
      if (section.items.length === 0) {
        continue;
      }
      built.push({ type: 'header', key: `header-${section.kind}`, label: `${t(section.labelKey)} (${section.items.length})` });
      for (const item of section.items) {
        built.push({ type: 'recipient', key: `${section.kind}-${item.Id}`, kind: section.kind, id: item.Id, name: item.Name });
      }
    }

    if (searchQuery && built.length === 1) {
      built.push({ type: 'empty', key: 'empty' });
    }

    return built;
  }, [filteredData, searchQuery, t]);

  useEffect(() => {
    if (isVisible) {
      fetchDispatchData();
      if (initialSelection) {
        setSelection(initialSelection);
      }
    }
  }, [isVisible, initialSelection, fetchDispatchData, setSelection]);

  const handleConfirm = useCallback(() => {
    onConfirm(selection);
    onClose();
  }, [onConfirm, onClose, selection]);

  const handleCancel = useCallback(() => {
    clearSelection();
    onClose();
  }, [clearSelection, onClose]);

  const selectionCount = useMemo(() => {
    if (selection.everyone) return 1;
    return selection.users.length + selection.groups.length + selection.roles.length + selection.units.length;
  }, [selection]);

  const isRecipientSelected = useCallback(
    (kind: RecipientKind, id: string): boolean => {
      switch (kind) {
        case 'user':
          return selectedUsers.has(id);
        case 'group':
          return selectedGroups.has(id);
        case 'role':
          return selectedRoles.has(id);
        case 'unit':
          return selectedUnits.has(id);
      }
    },
    [selectedUsers, selectedGroups, selectedRoles, selectedUnits]
  );

  // Store actions are stable identities, so each row keeps a stable onToggle.
  const toggleForKind = useCallback(
    (kind: RecipientKind) => {
      switch (kind) {
        case 'user':
          return toggleUser;
        case 'group':
          return toggleGroup;
        case 'role':
          return toggleRole;
        case 'unit':
          return toggleUnit;
      }
    },
    [toggleUser, toggleGroup, toggleRole, toggleUnit]
  );

  const renderRow = useCallback(
    ({ item }: { item: DispatchRow }) => {
      if (item.type === 'everyone') {
        return (
          <Card className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <TouchableOpacity onPress={toggleEveryone} accessibilityRole="checkbox" accessibilityState={{ checked: selection.everyone }} accessibilityLabel={t('calls.everyone')}>
              <HStack className="items-center space-x-3">
                <Box className={`size-6 items-center justify-center rounded border-2 ${selection.everyone ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {selection.everyone ? <CheckIcon size={16} color="#ffffff" /> : null}
                </Box>
                <VStack className="flex-1">
                  <Text className="pl-4 text-lg font-semibold">{t('calls.everyone')}</Text>
                  <Text className="pl-4 text-sm text-neutral-500">{t('calls.dispatch_to_everyone')}</Text>
                </VStack>
              </HStack>
            </TouchableOpacity>
          </Card>
        );
      }

      if (item.type === 'header') {
        return <Text className="mb-3 mt-3 text-lg font-semibold">{item.label}</Text>;
      }

      if (item.type === 'empty') {
        return (
          <Box className="items-center justify-center py-8">
            <Text className="text-center text-neutral-500">{t('common.no_results_found')}</Text>
          </Box>
        );
      }

      return <RecipientRow id={item.id} name={item.name} isSelected={isRecipientSelected(item.kind, item.id)} onToggle={toggleForKind(item.kind)} />;
    },
    [toggleEveryone, selection.everyone, t, isRecipientSelected, toggleForKind]
  );

  return (
    <Actionsheet isOpen={isVisible} onClose={handleCancel} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="w-full items-center justify-between border-b border-gray-200 p-2 pb-3 dark:border-gray-700">
          <HStack className="flex-1 items-center">
            <UsersIcon size={22} color={colorScheme === 'dark' ? '#d1d5db' : '#374151'} />
            <Text className="pl-3 text-lg font-bold" numberOfLines={1}>
              {t('calls.select_dispatch_recipients')}
            </Text>
          </HStack>
          <TouchableOpacity onPress={handleCancel} className="p-1" accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <X size={22} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </HStack>

        {/* Search */}
        <Box className="w-full px-2 py-3">
          <Input>
            <SearchIcon size={20} className="ml-3 mr-2 text-neutral-500" />
            <InputField placeholder={t('common.search')} value={searchQuery} onChangeText={setSearchQuery} className="flex-1" />
          </Input>
        </Box>

        {/* Content */}
        {isLoading ? (
          <Box className="w-full flex-1 items-center justify-center">
            <Loading />
          </Box>
        ) : error ? (
          <Box className="w-full flex-1 items-center justify-center p-4">
            <Text className="text-center text-red-500">{error}</Text>
          </Box>
        ) : (
          <ActionsheetFlatList className="w-full flex-1 px-2" data={rows} renderItem={renderRow as never} keyExtractor={rowKeyExtractor as never} keyboardShouldPersistTaps="handled" testID="dispatch-recipients-list" />
        )}

        {/* Footer */}
        <Box className="w-full border-t border-gray-200 p-4 dark:border-gray-700">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {selectionCount} {t('calls.selected')}
          </Text>
          <HStack space="sm" className="w-full">
            <Button variant="outline" onPress={handleCancel} className="flex-1">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button variant="solid" action="primary" onPress={handleConfirm} disabled={selectionCount === 0} className="flex-1">
              <ButtonText>{t('common.confirm')}</ButtonText>
            </Button>
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};
