import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { invertColor } from '@/lib/utils';
import { useCoreStore } from '@/stores/app/core-store';
import { useStatusBottomSheetStore } from '@/stores/status/store';

import { StatusBottomSheet } from '../status/status-bottom-sheet';
import { SidebarCallCard } from './call-sidebar';
import { SidebarRolesCard } from './roles-sidebar';
import { SidebarStatusCard } from './status-sidebar';
import { SidebarUnitCard } from './unit-sidebar';

const Sidebar = () => {
  const { activeStatuses } = useCoreStore();
  const { setIsOpen } = useStatusBottomSheetStore();
  const { t } = useTranslation();

  return (
    <ScrollView className="size-full pt-4">
      <VStack space="md" className="size-full p-2">
        {/* First row - Two cards side by side */}
        <HStack space="md">
          <SidebarUnitCard unitName="No Unit" unitType="" unitGroup={t('common.no_unit_selected')} bgColor="bg-background-50" />
          <VStack space="xs" className="flex-1">
            <SidebarStatusCard />
            <SidebarRolesCard />
          </VStack>
        </HStack>

        {/* Second row - Single card */}
        <SidebarCallCard />

        {/* Third row - List of buttons */}
        <VStack space="sm" className="mb-4 w-full">
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
              <ButtonText style={{ color: invertColor(status.BColor, true) }}>{status.Text}</ButtonText>
            </Button>
          ))}
        </VStack>
        <StatusBottomSheet />
      </VStack>
    </ScrollView>
  );
};

export default Sidebar;
