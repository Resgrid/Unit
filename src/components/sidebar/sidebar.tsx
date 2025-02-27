import { Bell, Settings, User } from 'lucide-react-native';
import React from 'react';
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { VStack } from '@/components/ui/vstack';
import { SidebarUnitCard } from './unit-sidebar';
import { SidebarStatusCard } from './status-sidebar';
import { SidebarRolesCard } from './roles-sidebar';
import { SidebarCallCard } from './call-sidebar';
import { useCoreStore } from '@/stores/app/core-store';
import { invertColor } from '@/lib/utils';
import { useStatusBottomSheetStore } from '@/stores/status/store';
import { StatusBottomSheet } from '../status/status-bottom-sheet';

const Sidebar = () => {
  const { activeUnit, activeStatuses } = useCoreStore();
  const { setIsOpen } = useStatusBottomSheetStore();
  const { t } = useTranslation();

  return (
    <ScrollView className="size-full pt-4">
      <VStack space="md" className="size-full p-4">
        {/* First row - Two cards side by side */}
        <HStack space="md">
          <SidebarUnitCard
            unitName="No Unit"
            unitType=""
            unitGroup="No Unit Selected"
            bgColor="bg-background-50"
          />
          <VStack space="xs" className="flex-1">
            <SidebarStatusCard />
            <SidebarRolesCard />
          </VStack>
        </HStack>

        {/* Second row - Single card */}
        <SidebarCallCard />

        {/* Third row - List of buttons */}
        <VStack space="sm" className="w-full">
          {activeStatuses?.Statuses.map((status) => (
            <Button
              key={status.Id}
              variant="solid"
              className="justify-center px-3 py-2"
              action="primary"
              size="lg"
              style={{
                backgroundColor: status.BColor,
              }}
              onPress={() => setIsOpen(true, status)}
            >
              <ButtonText style={{ color: invertColor(status.BColor, true) }}>
                {status.Text}
              </ButtonText>
            </Button>
          ))}
        </VStack>
        <StatusBottomSheet />
      </VStack>
    </ScrollView>
  );
};

export default Sidebar;
