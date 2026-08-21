import { useRouter } from 'expo-router';
import { MessagesSquare, Settings, Sparkles } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { invertColor } from '@/lib/utils';
import { useCoreStore } from '@/stores/app/core-store';
import { useIsChatEnabled } from '@/stores/feature-flags/store';
import { useStatusBottomSheetStore } from '@/stores/status/store';

import ZeroState from '../common/zero-state';
import { SidebarCallCard } from './call-sidebar';
import { CheckInSidebarWidget } from './check-in-sidebar-widget';
import { SidebarRolesCard } from './roles-sidebar';
import { SidebarStatusCard } from './status-sidebar';
import { SidebarUnitCard } from './unit-sidebar';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
  const activeStatuses = useCoreStore((state) => state.activeStatuses);
  const setIsOpen = useStatusBottomSheetStore((state) => state.setIsOpen);
  const isChatEnabled = useIsChatEnabled();
  const { t } = useTranslation();
  const router = useRouter();

  const isActiveStatusesEmpty = !activeStatuses?.Statuses || activeStatuses.Statuses.length === 0;

  const handleNavigateToSettings = () => {
    onClose?.();
    router.push('/settings');
  };

  const handleNavigateToChat = () => {
    onClose?.();
    router.push('/chat');
  };

  const handleNavigateToAssistant = () => {
    onClose?.();
    router.push('/chatbot');
  };

  return (
    <ScrollView className="size-full pt-4" contentContainerStyle={{ flexGrow: 1 }}>
      <VStack space="md" className="w-full flex-1 p-2">
        {/* First row - Two cards side by side */}
        <HStack space="md">
          <SidebarUnitCard unitName={t('common.no_unit')} unitType="" unitGroup={t('common.no_unit_selected')} bgColor="bg-background-50" />
          <VStack space="xs" className="flex-1">
            <SidebarStatusCard />
            <SidebarRolesCard />
          </VStack>
        </HStack>

        {/* Second row - Single card */}
        <SidebarCallCard />

        {/* Check-in timer widget */}
        <CheckInSidebarWidget />

        {/* Chat + Assistant navigation (hidden when the Chat.System feature flag is off) */}
        {isChatEnabled ? (
          <HStack space="md">
            <Button variant="outline" action="secondary" size="md" className="flex-1" onPress={handleNavigateToChat}>
              <MessagesSquare size={18} color="#2563eb" />
              <ButtonText className="ml-2">{t('tabs.chat')}</ButtonText>
            </Button>
            <Button variant="outline" action="secondary" size="md" className="flex-1" onPress={handleNavigateToAssistant}>
              <Sparkles size={18} color="#7c3aed" />
              <ButtonText className="ml-2">{t('tabs.assistant')}</ButtonText>
            </Button>
          </HStack>
        ) : null}

        {/* Third row - Status buttons or empty state */}
        {isActiveStatusesEmpty ? (
          <ZeroState
            icon={Settings}
            iconSize={60}
            iconColor="#64748b"
            heading={t('common.noActiveUnit')}
            description={t('common.noActiveUnitDescription')}
            className="mt-0"
            viewClassName="w-full flex-1 px-6 pb-6 pt-0"
            centerClassName="flex-1 p-6"
          >
            <Button variant="solid" action="primary" size="md" onPress={handleNavigateToSettings} className="mt-0">
              <ButtonText>{t('settings.title')}</ButtonText>
            </Button>
          </ZeroState>
        ) : (
          <VStack space="sm" className="mb-4 w-full">
            {activeStatuses?.Statuses.map((status) => (
              <Button
                key={status.Id}
                variant="solid"
                className="w-full justify-center overflow-visible px-3 py-2"
                action="primary"
                size="lg"
                style={{
                  backgroundColor: status.BColor,
                }}
                onPress={() => setIsOpen(true, status)}
              >
                <ButtonText
                  numberOfLines={1}
                  style={{
                    color: invertColor(status.BColor, true),
                    flexShrink: 0,
                  }}
                >
                  {status.Text}
                </ButtonText>
              </Button>
            ))}
          </VStack>
        )}
      </VStack>
    </ScrollView>
  );
};

export default Sidebar;
