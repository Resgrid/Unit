import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ClockIcon,
  FileTextIcon,
  ImageIcon,
  InfoIcon,
  PaperclipIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import RenderHtml from 'react-native-render-html';

import ZeroState from '@/components/common/zero-state';
// Import a static map component instead of react-native-maps
import StaticMap from '@/components/maps/static-map';
import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Loading } from '@/components/ui/loading';
import { SharedTabs, type TabItem } from '@/components/ui/shared-tabs';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import CallImagesModal from '../../components/calls/call-images-modal';
import CallNotesModal from '../../components/calls/call-notes-modal';

export default function CallDetail() {
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [coordinates, setCoordinates] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });
  const {
    call,
    callExtraData,
    callPriority,
    isLoading,
    error,
    fetchCallDetail,
    reset,
  } = useCallDetailStore();
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);

  useEffect(() => {
    reset();
    if (callId) {
      fetchCallDetail(callId);
    }
  }, [callId, fetchCallDetail]);

  useEffect(() => {
    if (call) {
      if (call.Latitude && call.Longitude) {
        setCoordinates({
          latitude: parseFloat(call.Latitude),
          longitude: parseFloat(call.Longitude),
        });
      } else if (call.Geolocation) {
        const [lat, lng] = call.Geolocation.split(',');
        setCoordinates({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        });
      }
    }
  }, [call]);

  const handleBack = () => {
    router.back();
  };

  const openNotesModal = () => {
    useCallDetailStore.getState().fetchCallNotes(callId);
    setIsNotesModalOpen(true);
  };

  const openImagesModal = () => {
    setIsImagesModalOpen(true);
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
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
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
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="text-center">{t('call_detail.not_found')}</Text>
            <Button onPress={handleBack} className="self-center">
              <ButtonText>{t('common.go_back')}</ButtonText>
            </Button>
          </Box>
        </SafeAreaView>
      </>
    );
  }

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
                <Text className="text-sm text-gray-500">
                  {t('call_detail.priority')}
                </Text>
                <Text
                  className="font-medium"
                  style={{ color: callPriority?.Color }}
                >
                  {callPriority?.Name}
                </Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.timestamp')}
                </Text>
                <Text className="font-medium">
                  {format(new Date(call.LoggedOn), 'MMM d, h:mm a')}
                </Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.type')}
                </Text>
                <Text className="font-medium">{call.Type}</Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.address')}
                </Text>
                <Text className="font-medium">{call.Address}</Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.note')}
                </Text>
                <Box>
                  <Text className="text-gray-800">
                    <RenderHtml
                      contentWidth={width}
                      source={{ html: call.Note }}
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
                  </Text>
                </Box>
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
                <Text className="text-sm text-gray-500">
                  {t('call_detail.reference_id')}
                </Text>
                <Text className="font-medium">{call.ReferenceId}</Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.external_id')}
                </Text>
                <Text className="font-medium">{call.ExternalId}</Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.contact_name')}
                </Text>
                <Text className="font-medium">{call.ContactName}</Text>
              </Box>
              <Box className="border-b border-gray-100 pb-2">
                <Text className="text-sm text-gray-500">
                  {t('call_detail.contact_info')}
                </Text>
                <Text className="font-medium">{call.ContactInfo}</Text>
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
                  <Box key={index} className="rounded-lg bg-gray-50 p-3">
                    <Text className="font-semibold">{protocol.Name}</Text>
                    <Text className="text-sm text-gray-600">
                      {protocol.Description}
                    </Text>
                    <Box>
                      <Text className="text-gray-800">
                        <RenderHtml
                          contentWidth={width}
                          source={{ html: protocol.ProtocolText }}
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
                      </Text>
                    </Box>
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
            {callExtraData?.Dispatches &&
            callExtraData.Dispatches.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Dispatches.map((dispatched, index) => (
                  <Box key={index} className="rounded-lg bg-gray-50 p-3">
                    <Text className="font-semibold">{dispatched.Name}</Text>
                    <HStack className="mt-1">
                      <Text className="mr-2 text-sm text-gray-600">
                        {t('call_detail.group')}: {dispatched.Group}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {t('call_detail.type')}: {dispatched.Type}
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
        badge: callExtraData?.Activity?.length || 0,
        content: (
          <Box className="p-4">
            {callExtraData?.Activity && callExtraData.Activity.length > 0 ? (
              <VStack className="space-y-3">
                {callExtraData.Activity.map((event, index) => (
                  <Box
                    key={index}
                    className="border-l-4 border-blue-500 py-1 pl-3"
                  >
                    <Text
                      className="font-semibold"
                      style={{ color: event.StatusColor }}
                    >
                      {event.StatusText}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {event.Name} - {event.Group}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {new Date(event.Timestamp).toLocaleString()}
                    </Text>
                    <Text className="text-xs text-gray-500">{event.Note}</Text>
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
          <Box className="bg-white p-4 shadow-sm">
            <HStack className="mb-2 items-center">
              <Heading size="md">
                {call.Name} ({call.Number})
              </Heading>
            </HStack>
            <VStack className="space-y-1">
              <Box>
                <Text className="text-gray-800">
                  <RenderHtml
                    contentWidth={width}
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
                </Text>
              </Box>
            </VStack>
          </Box>

          {/* Map */}
          <Box className="w-full">
            {coordinates.latitude && coordinates.longitude ? (
              <StaticMap
                latitude={coordinates.latitude}
                longitude={coordinates.longitude}
                address={call.Address}
                zoom={15}
                height={200}
                showUserLocation={true}
              />
            ) : null}
          </Box>

          {/* Action Buttons */}
          <HStack className="justify-around bg-white p-4">
            <Button
              onPress={() => openNotesModal()}
              variant="outline"
              className="mx-1 flex-1"
            >
              <ButtonIcon as={FileTextIcon} />
              <ButtonText>{t('call_detail.notes')}</ButtonText>
              {call?.NotesCount ? (
                <Box className="bg-primary ml-1 rounded-full px-1.5 py-0.5">
                  <Text className="text-xs font-medium">{call.NotesCount}</Text>
                </Box>
              ) : null}
            </Button>
            <Button
              onPress={openImagesModal}
              variant="outline"
              className="mx-1 flex-1"
            >
              <ButtonIcon as={ImageIcon} />
              <ButtonText>{t('call_detail.images')}</ButtonText>
              {call?.ImgagesCount ? (
                <Box className="bg-primary ml-1 rounded-full px-1.5 py-0.5">
                  <Text className="text-xs font-medium">
                    {call.ImgagesCount}
                  </Text>
                </Box>
              ) : null}
            </Button>
            <Button
              onPress={openFilesModal}
              variant="outline"
              className="mx-1 flex-1"
            >
              <ButtonIcon as={PaperclipIcon} />
              <ButtonText>{t('call_detail.files')}</ButtonText>
              {call?.FileCount ? (
                <Box className="bg-primary ml-1 rounded-full px-1.5 py-0.5">
                  <Text className="text-xs font-medium">{call.FileCount}</Text>
                </Box>
              ) : null}
            </Button>
          </HStack>

          {/* Tabs */}
          <Box className="mt-4 flex-1 bg-white pb-8">
            <SharedTabs tabs={renderTabs()} variant="underlined" size="md" />
          </Box>
        </ScrollView>
      </View>
      <CallNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        callId={callId}
      />
      <CallImagesModal
        isOpen={isImagesModalOpen}
        onClose={() => setIsImagesModalOpen(false)}
        callId={callId}
      />
    </>
  );
}
