import { EditIcon, MoreVerticalIcon, XIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Pressable } from '@/components/ui/';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '@/components/ui/actionsheet';
import { HStack } from '@/components/ui/hstack';

interface CallDetailMenuProps {
  onEditCall: () => void;
  onCloseCall: () => void;
}

export const useCallDetailMenu = ({ onEditCall, onCloseCall }: CallDetailMenuProps) => {
  const { t } = useTranslation();
  const [isKebabMenuOpen, setIsKebabMenuOpen] = useState(false);

  const openMenu = () => {
    console.log('openMenu');
    setIsKebabMenuOpen(true);
  };
  const closeMenu = () => setIsKebabMenuOpen(false);

  const HeaderRightMenu = () => (
    <Pressable onPressOut={openMenu} testID="kebab-menu-button" className="rounded p-2">
      <MoreVerticalIcon size={24} className="text-gray-700 dark:text-gray-300" />
    </Pressable>
  );

  const CallDetailActionSheet = () => (
    <Actionsheet isOpen={isKebabMenuOpen} onClose={closeMenu} snapPoints={[25]}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetItem
          onPress={() => {
            closeMenu();
            onEditCall();
          }}
        >
          <HStack className="items-center">
            <EditIcon size={16} className="mr-3 text-gray-700 dark:text-gray-300" />
            <ActionsheetItemText>{t('call_detail.edit_call')}</ActionsheetItemText>
          </HStack>
        </ActionsheetItem>

        <ActionsheetItem
          onPress={() => {
            closeMenu();
            onCloseCall();
          }}
        >
          <HStack className="items-center">
            <XIcon size={16} className="mr-3 text-gray-700 dark:text-gray-300" />
            <ActionsheetItemText>{t('call_detail.close_call')}</ActionsheetItemText>
          </HStack>
        </ActionsheetItem>
      </ActionsheetContent>
    </Actionsheet>
  );

  return {
    HeaderRightMenu,
    CallDetailActionSheet,
    isMenuOpen: isKebabMenuOpen,
    openMenu,
    closeMenu,
  };
};
