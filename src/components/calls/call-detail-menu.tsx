import { EditIcon, MoreVerticalIcon, XIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable as RNPressable, StyleSheet, View } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { useAnalytics } from '@/hooks/use-analytics';
import { isIOS, showNativeActionSheet } from '@/utils/action-sheet';

interface CallDetailMenuProps {
  onEditCall: () => void;
  onCloseCall: () => void;
  canUserCreateCalls?: boolean;
}

interface HeaderRightMenuButtonProps {
  onPress: () => void;
}

/** Stable module-level component — React Navigation won't remount it across renders */
const HeaderRightMenuButton = ({ onPress }: HeaderRightMenuButtonProps) => {
  return (
    <Pressable onPress={onPress} testID="kebab-menu-button" className="rounded p-2">
      <MoreVerticalIcon size={24} color="#6B7280" />
    </Pressable>
  );
};

export const useCallDetailMenu = ({ onEditCall, onCloseCall, canUserCreateCalls = false }: CallDetailMenuProps) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [isKebabMenuOpen, setIsKebabMenuOpen] = useState(false);

  const closeMenu = () => setIsKebabMenuOpen(false);

  const openMenu = useCallback(() => {
    if (!canUserCreateCalls) return;

    // Track analytics on both platforms
    trackEvent('call_detail_menu_opened', {
      hasEditAction: canUserCreateCalls,
      hasCloseAction: canUserCreateCalls,
    });

    if (isIOS()) {
      const options = [t('call_detail.edit_call'), t('call_detail.close_call'), t('common.cancel')];
      showNativeActionSheet({ options, cancelButtonIndex: options.length - 1 }, (buttonIndex) => {
        if (buttonIndex === 0) {
          trackEvent('call_detail_menu_item_selected', { action: 'edit' });
          onEditCall();
        } else if (buttonIndex === 1) {
          trackEvent('call_detail_menu_item_selected', { action: 'close' });
          onCloseCall();
        }
      });
    } else {
      setIsKebabMenuOpen(true);
    }
  }, [canUserCreateCalls, t, onEditCall, onCloseCall, trackEvent]);

  const HeaderRightMenu = useCallback(() => {
    if (!canUserCreateCalls) return null;
    return <HeaderRightMenuButton onPress={openMenu} />;
  }, [canUserCreateCalls, openMenu]);

  const CallDetailActionSheet = useCallback(() => {
    // On iOS, the native ActionSheetIOS is used instead — skip rendering
    if (isIOS() || !canUserCreateCalls) {
      return null;
    }

    return (
      <Modal visible={isKebabMenuOpen} transparent={true} animationType="slide" onRequestClose={closeMenu} testID="call-detail-actionsheet">
        <RNPressable style={menuStyles.backdrop} onPress={closeMenu}>
          <RNPressable style={menuStyles.sheet}>
            <View style={menuStyles.handle} />

            <RNPressable
              style={menuStyles.item}
              onPress={() => {
                closeMenu();
                onEditCall();
              }}
              testID="edit-call-button"
            >
              <HStack className="items-center">
                <EditIcon size={20} color="#374151" style={{ marginRight: 12 }} />
                <Text className="text-base">{t('call_detail.edit_call')}</Text>
              </HStack>
            </RNPressable>

            <RNPressable
              style={menuStyles.item}
              onPress={() => {
                closeMenu();
                onCloseCall();
              }}
              testID="close-call-button"
            >
              <HStack className="items-center">
                <XIcon size={20} color="#EF4444" style={{ marginRight: 12 }} />
                <Text className="text-base text-red-500">{t('call_detail.close_call')}</Text>
              </HStack>
            </RNPressable>
          </RNPressable>
        </RNPressable>
      </Modal>
    );
  }, [isKebabMenuOpen, canUserCreateCalls, t, onEditCall, onCloseCall]);

  return {
    HeaderRightMenu,
    CallDetailActionSheet,
    isMenuOpen: isKebabMenuOpen,
    openMenu,
    closeMenu,
  };
};

const menuStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
});
