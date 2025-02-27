import * as React from 'react';
import { Text } from '@/components/ui/text';
import { useCoreStore } from '@/stores/app/core-store';
import { Card } from '../ui/card';
import { CallCard } from '../calls/call-card';
import { useTranslation } from 'react-i18next';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import {
  Check,
  CircleX,
  Eye,
  MapPin,
  PhoneCall,
  XCircle,
} from 'lucide-react-native';
import { Pressable, ScrollView } from 'react-native';
import { HStack } from '../ui/hstack';
import { Button, ButtonIcon, ButtonText } from '../ui/button';
import { useCallsStore } from '@/stores/calls/store';
import { VStack } from '@/components/ui/vstack';
import { useColorScheme } from 'nativewind';
import { useQuery } from '@tanstack/react-query';

export const SidebarCallCard = () => {
  const { colorScheme } = useColorScheme();
  const { activeCall, activePriority, setActiveCall } = useCoreStore(
    (state) => ({
      activeCall: state.activeCall,
      activePriority: state.activePriority,
      setActiveCall: state.setActiveCall,
    })
  );

  const [isBottomSheetOpen, setIsBottomSheetOpen] = React.useState(false);
  const { t } = useTranslation();

  // Fetch calls data when bottom sheet opens
  const { data: openCallsData, isLoading } = useQuery({
    queryKey: ['calls', 'open'],
    queryFn: async () => {
      // Only fetch when bottom sheet is open
      if (!isBottomSheetOpen) return [];
      await useCallsStore.getState().fetchCalls();
      return useCallsStore.getState().calls;
    },
    enabled: isBottomSheetOpen, // Only run query when bottom sheet is open
  });

  const handleDeselect = () => {
    setActiveCall(null);
  };

  return (
    <>
      <Pressable onPress={() => setIsBottomSheetOpen(true)} className="w-full">
        {activeCall && activePriority ? (
          <CallCard call={activeCall} priority={activePriority} />
        ) : (
          <Card className="w-full bg-background-50">
            <Text className="font-medium">{t('calls.no_call_selected')}</Text>
            <Text className="text-sm text-gray-500">
              {t('calls.no_call_selected_info')}
            </Text>
          </Card>
        )}
      </Pressable>

      {activeCall && (
        <HStack className="w-full">
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            action="primary"
            onPress={() => {
              // Handle viewing call details
            }}
          >
            <ButtonIcon as={Eye} />
          </Button>

          {activeCall?.Address && (
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              action="primary"
              onPress={() => {
                // Handle viewing directions
              }}
            >
              <ButtonIcon as={MapPin} />
            </Button>
          )}

          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            action="primary"
            onPress={handleDeselect}
          >
            <ButtonIcon as={CircleX} />
          </Button>
        </HStack>
      )}

      <CustomBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        isLoading={isLoading}
        loadingText={t('common.loading')}
      >
        <ScrollView className="max-h-96 w-full">
          <VStack space="lg" className="w-full mt-4">
            <Text className="text-lg font-bold">
              {t('calls.select_active_call')}
            </Text>
            {openCallsData?.map((call) => (
              <Pressable
                key={call.CallId}
                onPress={async () => {
                  await setActiveCall(call.CallId);
                  setIsBottomSheetOpen(false);
                }}
                className={`p-4 rounded-lg border ${
                  colorScheme === 'dark'
                    ? 'border-neutral-800 bg-neutral-800'
                    : 'border-neutral-200 bg-neutral-50'
                } ${
                  activeCall?.CallId === call.CallId
                    ? colorScheme === 'dark'
                      ? 'bg-primary-900'
                      : 'bg-primary-50'
                    : ''
                }`}
              >
                <HStack space="md" className="items-center justify-between">
                  <VStack>
                    <Text
                      className={`font-medium ${
                        colorScheme === 'dark'
                          ? 'text-neutral-200'
                          : 'text-neutral-700'
                      }`}
                    >
                      {call.Name}
                    </Text>
                    <Text
                      size="sm"
                      className={
                        colorScheme === 'dark'
                          ? 'text-neutral-400'
                          : 'text-neutral-500'
                      }
                    >
                      {call.Type}
                    </Text>
                  </VStack>
                  {activeCall?.CallId === call.CallId && (
                    <Check
                      size={20}
                      className={
                        colorScheme === 'dark'
                          ? 'text-primary-400'
                          : 'text-primary-600'
                      }
                    />
                  )}
                </HStack>
              </Pressable>
            ))}
            {!isLoading && openCallsData?.length === 0 && (
              <Text className="text-center text-gray-500">
                {t('calls.no_open_calls')}
              </Text>
            )}
          </VStack>
        </ScrollView>
      </CustomBottomSheet>
    </>
  );
};
