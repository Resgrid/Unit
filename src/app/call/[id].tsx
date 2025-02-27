import React, { useEffect } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText, ButtonIcon } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import RenderHtml from 'react-native-render-html';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { format } from 'date-fns';
import {
  MapIcon,
  FileTextIcon,
  ImageIcon,
  PaperclipIcon,
  ArrowLeftIcon,
  InfoIcon,
  UserIcon,
  UsersIcon,
  ClockIcon,
} from 'lucide-react-native';

// Import a static map component instead of react-native-maps
import StaticMap from '@/components/maps/static-map';
import { SharedTabs, TabItem } from '@/components/ui/shared-tabs';
import { Loading } from '@/components/ui/loading';
import ZeroState from '@/components/common/zero-state';
import { styles } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetScrollable/BottomSheetFlashList';
export default function CallDetail() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { call, callExtraData, isLoading, error, fetchCallDetail, reset } =
    useCallDetailStore();

  useEffect(() => {
    reset();
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [callId, fetchCallDetail]);

  const handleBack = () => {
    router.back();
  };

  const openNotesModal = () => {
    // TODO: Implement notes modal
  };

  const openImagesModal = () => {
    // TODO: Implement images modal
  };

  const openFilesModal = () => {
    // TODO: Implement files modal
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar />
          <Loading />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
          }}
        />
        <View className="size-full flex-1">
          <FocusAwareStatusBar />
          <Box className="p-5 rounded-lg m-3 mt-5 bg-background-50 gap-5 min-h-[200px] max-w-[600px] lg:min-w-[700px] w-full self-center">
            <ZeroState
              heading={t('call_detail.not_found')}
              description={error}
              isError={true}
            />
          </Box>
        </View>
      </>
    );
  }

  if (!call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('call_detail.title'),
            headerShown: true,
          }}
        />
        <SafeAreaView className="size-full flex-1">
          <FocusAwareStatusBar />
          <Box className="p-5 rounded-lg m-3 mt-5 bg-background-50 gap-5 min-h-[200px] max-w-[600px] lg:min-w-[700px] w-full self-center">
            <Text className="text-center">{t('call_detail.not_found')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </SafeAreaView>
      </>
    );
  }

  const hasLocation = call.Latitude && call.Longitude;

  const renderTabs = () => {
    const tabs: TabItem[] = [
      {
        key: 'info',
        title: t('call_detail.tabs.info'),
        icon: <InfoIcon size={16} />,
        content: (
          <Box className="p-4">
              <VStack className="space-y-3">
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">{t('call_detail.priority')}</Text>
                  <Text className="font-medium">
                    
                   </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">{t('call_detail.timestamp')}</Text>
                  <Text className="font-medium">
                    {format(new Date(call.LoggedOn), 'MMM d, h:mm a')}
                   </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">{t('call_detail.type')}</Text>
                  <Text className="font-medium">
                    {call.Type}
                   </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">{t('call_detail.address')}</Text>
                  <Text className="font-medium">
                    {call.Address}
                   </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">{t('call_detail.note')}</Text>
                  <Text className="font-medium">
                    {call.Note}
                   </Text>
                </Box>
              </VStack>
          </Box>
        ),
      },
      {
        key: 'contact',
        title: t('call_detail.tabs.contact'),
        icon: <UserIcon size={16} />,
        content: (
          <Box className="p-4">
              <VStack className="space-y-3">
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">
                    {t('call_detail.reference_id')}
                  </Text>
                  <Text className="font-medium">
                    {call.ReferenceId}
                  </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">
                    {t('call_detail.external_id')}
                  </Text>
                  <Text className="font-medium">
                    {call.ExternalId}
                  </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">
                    {t('call_detail.contact_name')}
                  </Text>
                  <Text className="font-medium">
                    {call.ContactName}
                  </Text>
                </Box>
                <Box className="border-b border-gray-100 pb-2">
                  <Text className="text-gray-500 text-sm">
                    {t('call_detail.contact_info')}
                  </Text>
                  <Text className="font-medium">
                    {call.ContactInfo}
                  </Text>
                </Box>
              </VStack>
          </Box>
        ),
      },
      {
        key: 'protocols',
        title: t('call_detail.tabs.protocols'),
        icon: <FileTextIcon size={16} />,
        content: (
          <Box className="p-4">
            {callExtraData?.Protocols && callExtraData.Protocols.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Protocols.map((protocol, index) => (
                  <Box key={index} className="bg-gray-50 p-3 rounded-lg">
                    <Text className="font-semibold">{protocol.Name}</Text>
                    <Text className="text-sm text-gray-600">
                      {protocol.Description}
                    </Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_protocols')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'dispatched',
        title: t('call_detail.tabs.dispatched'),
        icon: <UsersIcon size={16} />,
        content: (
          <Box className="p-4">
            {callExtraData?.Dispatched &&
            callExtraData.Dispatched.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Dispatched.map((dispatched, index) => (
                  <Box key={index} className="bg-gray-50 p-3 rounded-lg">
                    <Text className="font-semibold">{dispatched.Name}</Text>
                    <HStack className="mt-1">
                      <Text className="text-sm text-gray-600 mr-2">
                        {t('call_detail.unit')}: {dispatched.Unit}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('call_detail.status')}: {dispatched.Status}
                      </Text>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_dispatched')}</Text>
            )}
          </Box>
        ),
      },
      {
        key: 'timeline',
        title: t('call_detail.tabs.timeline'),
        icon: <ClockIcon size={16} />,
        badge: callExtraData?.Timeline?.length || 0,
        content: (
          <Box className="p-4">
            {callExtraData?.Timeline && callExtraData.Timeline.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Timeline.map((event, index) => (
                  <Box
                    key={index}
                    className="border-l-4 border-blue-500 pl-3 py-1"
                  >
                    <Text className="font-semibold">{event.Status}</Text>
                    <Text className="text-sm text-gray-600">
                      {event.User} - {event.Unit}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {new Date(event.Timestamp).toLocaleString()}
                    </Text>
                  </Box>
                ))}
              </VStack>
            ) : (
              <Text>{t('call_detail.no_timeline')}</Text>
            )}
          </Box>
        ),
      },
    ];

    return tabs;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('call_detail.title'),
          headerShown: true,
        }}
      />
      <View className="size-full flex-1">
        <FocusAwareStatusBar />
        <ScrollView className="flex-1 bg-gray-50">
          {/* Header */}
          <Box className="p-4 bg-white shadow-sm">
            <HStack className="items-center mb-2">
              <Heading size="md">{call.Name} ({call.Number})</Heading>
            </HStack>
            <VStack className="space-y-1">
              <RenderHtml
              source={{ html: call.Nature }}
              tagsStyles={{
                body: {
                  fontSize: 16,
                },
                p: {
                  margin: 0,
                  padding: 0,
                },
              }}
            />
            </VStack>
          </Box>

          {/* Map */}
          <Box className="w-full">
            <StaticMap
              latitude={call.Latitude}
              longitude={call.Longitude}
              address={call.Address}
              zoom={15}
              height={200}
              showUserLocation={true}
            />
          </Box>

          {/* Action Buttons */}
          <HStack className="p-4 justify-around bg-white">
            <Button
              onPress={openNotesModal}
              variant="outline"
              className="flex-1 mx-1"
            >
              <ButtonIcon as={FileTextIcon} />
              <ButtonText>{t('call_detail.notes')}</ButtonText>
            </Button>
            <Button
              onPress={openImagesModal}
              variant="outline"
              className="flex-1 mx-1"
            >
              <ButtonIcon as={ImageIcon} />
              <ButtonText>{t('call_detail.images')}</ButtonText>
            </Button>
            <Button
              onPress={openFilesModal}
              variant="outline"
              className="flex-1 mx-1"
            >
              <ButtonIcon as={PaperclipIcon} />
              <ButtonText>{t('call_detail.files')}</ButtonText>
            </Button>
          </HStack>

          {/* Tabs */}
          <Box className="bg-white mt-4 pb-8 flex-1">
            <SharedTabs tabs={renderTabs()} variant="underlined" size="md" />
          </Box>
        </ScrollView>
      </View>
    </>
  );
}
