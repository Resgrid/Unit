import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, CircleX, Eye, MapPin } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';

import { CallCard } from '../calls/call-card';
import { Button, ButtonIcon } from '../ui/button';
import { Card } from '../ui/card';
import { HStack } from '../ui/hstack';

export const SidebarCallCard = () => {
  const { colorScheme } = useColorScheme();
  const { activeCall, activePriority, setActiveCall } = useCoreStore((state) => ({
    activeCall: state.activeCall,
    activePriority: state.activePriority,
    setActiveCall: state.setActiveCall,
  }));

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
    Alert.alert(
      t('calls.confirm_deselect_title'),
      t('calls.confirm_deselect_message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.confirm'),
          onPress: () => setActiveCall(null),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <>
      <Pressable onPress={() => setIsBottomSheetOpen(true)} className="w-full" testID="call-selection-trigger">
        {activeCall && activePriority ? (
          <CallCard call={activeCall} priority={activePriority} />
        ) : (
          <Card className="w-full bg-background-50">
            <Text className="font-medium">{t('calls.no_call_selected')}</Text>
            <Text className="text-sm text-gray-500">{t('calls.no_call_selected_info')}</Text>
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
              router.push(`/call/${activeCall.CallId}`);
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

          <Button variant="outline" className="flex-1" size="sm" action="primary" onPress={handleDeselect}>
            <ButtonIcon as={CircleX} />
          </Button>
        </HStack>
      )}

      <CustomBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} isLoading={isLoading} loadingText={t('common.loading')} snapPoints={[60]} testID="call-selection-bottom-sheet">
        <VStack space="md" className="w-full flex-1">
          <Text className="text-lg font-bold">{t('calls.select_active_call')}</Text>
          <ScrollView className="w-full flex-1" showsVerticalScrollIndicator={false}>
            <VStack space="md" className="w-full">
              {openCallsData?.map((call) => (
                <Pressable
                  key={call.CallId}
                  onPress={async () => {
                    await setActiveCall(call.CallId);
                    setIsBottomSheetOpen(false);
                  }}
                  className={`rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'} ${activeCall?.CallId === call.CallId ? (colorScheme === 'dark' ? 'bg-primary-900' : 'bg-primary-50') : ''
                    }`}
                  testID={`call-item-${call.CallId}`}
                >
                  <HStack space="md" className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text className={`font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{call.Name}</Text>
                      <Text size="sm" className={colorScheme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}>
                        {call.Type}
                      </Text>
                    </VStack>
                    {activeCall?.CallId === call.CallId && <Check size={20} color={colorScheme === 'dark' ? '#60a5fa' : '#2563eb'} />}
                  </HStack>
                </Pressable>
              ))}
              {!isLoading && openCallsData?.length === 0 && (
                <Text className="py-8 text-center text-gray-500" testID="no-calls-message">
                  {t('calls.no_open_calls')}
                </Text>
              )}
            </VStack>
          </ScrollView>
        </VStack>
      </CustomBottomSheet>
    </>
  );
};
