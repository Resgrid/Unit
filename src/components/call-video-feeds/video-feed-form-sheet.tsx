import React, { useCallback, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput } from 'react-native';

import type { EditCallVideoFeedInput, SaveCallVideoFeedInput } from '@/api/call-video-feeds/call-video-feeds';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';
import { useCallVideoFeedStore } from '@/stores/call-video-feeds/store';
import { useToastStore } from '@/stores/toast/store';

import { detectFeedFormat, FEED_FORMAT_LABELS, FEED_TYPE_LABELS, FeedFormat, FeedType } from './feed-format-utils';

interface VideoFeedFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  callId: number;
  existingFeed?: CallVideoFeedResultData;
}

interface FormValues {
  Name: string;
  Url: string;
  FeedType: number;
  FeedFormat: number;
  Description: string;
  Latitude: string;
  Longitude: string;
}

const FEED_TYPES = [
  { value: FeedType.Drone, key: 'type_drone' },
  { value: FeedType.FixedCamera, key: 'type_fixed_camera' },
  { value: FeedType.BodyCam, key: 'type_body_cam' },
  { value: FeedType.TrafficCam, key: 'type_traffic_cam' },
  { value: FeedType.WeatherCam, key: 'type_weather_cam' },
  { value: FeedType.SatelliteFeed, key: 'type_satellite_feed' },
  { value: FeedType.WebCam, key: 'type_web_cam' },
  { value: FeedType.Other, key: 'type_other' },
];

const FEED_FORMATS = [
  { value: FeedFormat.HLS, key: 'format_hls' },
  { value: FeedFormat.RTSP, key: 'format_rtsp' },
  { value: FeedFormat.MJPEG, key: 'format_mjpeg' },
  { value: FeedFormat.YouTubeLive, key: 'format_youtube_live' },
  { value: FeedFormat.WebRTC, key: 'format_webrtc' },
  { value: FeedFormat.DASH, key: 'format_dash' },
  { value: FeedFormat.Embed, key: 'format_embed' },
  { value: FeedFormat.Other, key: 'format_other' },
];

export const VideoFeedFormSheet: React.FC<VideoFeedFormSheetProps> = ({ isOpen, onClose, callId, existingFeed }) => {
  const { t } = useTranslation();
  const saveFeed = useCallVideoFeedStore((state) => state.saveFeed);
  const editFeed = useCallVideoFeedStore((state) => state.editFeed);
  const isSaving = useCallVideoFeedStore((state) => state.isSaving);
  const showToast = useToastStore((state) => state.showToast);

  const { control, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      Name: existingFeed?.Name ?? '',
      Url: existingFeed?.Url ?? '',
      FeedType: existingFeed?.FeedType ?? FeedType.Other,
      FeedFormat: existingFeed?.FeedFormat ?? FeedFormat.Other,
      Description: existingFeed?.Description ?? '',
      Latitude: existingFeed?.Latitude ?? '',
      Longitude: existingFeed?.Longitude ?? '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        Name: existingFeed?.Name ?? '',
        Url: existingFeed?.Url ?? '',
        FeedType: existingFeed?.FeedType ?? FeedType.Other,
        FeedFormat: existingFeed?.FeedFormat ?? FeedFormat.Other,
        Description: existingFeed?.Description ?? '',
        Latitude: existingFeed?.Latitude ?? '',
        Longitude: existingFeed?.Longitude ?? '',
      });
    }
  }, [isOpen, existingFeed, reset]);

  const selectedFeedType = watch('FeedType');
  const selectedFeedFormat = watch('FeedFormat');

  const handleUrlBlur = useCallback(
    (url: string) => {
      if (!url) return;
      const detected = detectFeedFormat(url);
      if (detected !== null) {
        setValue('FeedFormat', detected);
      }
    },
    [setValue]
  );

  const onSubmit = useCallback(
    async (data: FormValues) => {
      let success: boolean;

      if (existingFeed) {
        const input: EditCallVideoFeedInput = {
          CallVideoFeedId: existingFeed.CallVideoFeedId,
          CallId: callId,
          Name: data.Name,
          Url: data.Url,
          FeedType: data.FeedType,
          FeedFormat: data.FeedFormat,
          Description: data.Description || undefined,
          Latitude: data.Latitude || undefined,
          Longitude: data.Longitude || undefined,
        };
        success = await editFeed(input);
      } else {
        const input: SaveCallVideoFeedInput = {
          CallId: callId,
          Name: data.Name,
          Url: data.Url,
          FeedType: data.FeedType,
          FeedFormat: data.FeedFormat,
          Description: data.Description || undefined,
          Latitude: data.Latitude || undefined,
          Longitude: data.Longitude || undefined,
        };
        success = await saveFeed(input);
      }

      if (success) {
        showToast('success', t('video_feeds.save_success'));
        onClose();
      } else {
        showToast('error', t('video_feeds.save_error'));
      }
    },
    [existingFeed, callId, saveFeed, editFeed, showToast, t, onClose]
  );

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]} isLoading={isSaving} loadingText={t('common.submitting')}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <VStack space="md" className="w-full pb-8">
          <Heading size="md">{existingFeed ? t('video_feeds.edit_feed') : t('video_feeds.add_feed')}</Heading>

          {/* Name */}
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600">{t('video_feeds.name')} *</Text>
            <Controller
              control={control}
              name="Name"
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <Box className="rounded-lg border border-outline-200 p-2">
                  <TextInput value={value} onChangeText={onChange} placeholder={t('video_feeds.name')} />
                </Box>
              )}
            />
          </VStack>

          {/* URL */}
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600">{t('video_feeds.url')} *</Text>
            <Controller
              control={control}
              name="Url"
              rules={{ required: true }}
              render={({ field: { onChange, value } }) => (
                <Box className="rounded-lg border border-outline-200 p-2">
                  <TextInput value={value} onChangeText={onChange} onBlur={() => handleUrlBlur(value)} placeholder="https://" autoCapitalize="none" keyboardType="url" />
                </Box>
              )}
            />
          </VStack>

          {/* Feed Type */}
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600">{t('video_feeds.feed_type')}</Text>
            <HStack className="flex-wrap" space="sm">
              {FEED_TYPES.map((type) => (
                <Button key={type.value} variant={selectedFeedType === type.value ? 'solid' : 'outline'} size="sm" onPress={() => setValue('FeedType', type.value)} className="mb-1">
                  <ButtonText>{t(`video_feeds.${type.key}`)}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          {/* Feed Format */}
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600">{t('video_feeds.feed_format')}</Text>
            <HStack className="flex-wrap" space="sm">
              {FEED_FORMATS.map((fmt) => (
                <Button key={fmt.value} variant={selectedFeedFormat === fmt.value ? 'solid' : 'outline'} size="sm" onPress={() => setValue('FeedFormat', fmt.value)} className="mb-1">
                  <ButtonText>{t(`video_feeds.${fmt.key}`)}</ButtonText>
                </Button>
              ))}
            </HStack>
          </VStack>

          {/* Description */}
          <VStack space="xs">
            <Text className="text-sm font-medium text-gray-600">{t('video_feeds.description')}</Text>
            <Controller
              control={control}
              name="Description"
              render={({ field: { onChange, value } }) => (
                <Box className="rounded-lg border border-outline-200 p-2">
                  <TextInput value={value} onChangeText={onChange} placeholder={t('video_feeds.description')} multiline numberOfLines={3} style={{ minHeight: 60, textAlignVertical: 'top' }} />
                </Box>
              )}
            />
          </VStack>

          {/* Latitude / Longitude */}
          <HStack space="md">
            <VStack space="xs" className="flex-1">
              <Text className="text-sm font-medium text-gray-600">{t('video_feeds.latitude')}</Text>
              <Controller
                control={control}
                name="Latitude"
                render={({ field: { onChange, value } }) => (
                  <Box className="rounded-lg border border-outline-200 p-2">
                    <TextInput value={value} onChangeText={onChange} placeholder="0.0" keyboardType="numeric" />
                  </Box>
                )}
              />
            </VStack>
            <VStack space="xs" className="flex-1">
              <Text className="text-sm font-medium text-gray-600">{t('video_feeds.longitude')}</Text>
              <Controller
                control={control}
                name="Longitude"
                render={({ field: { onChange, value } }) => (
                  <Box className="rounded-lg border border-outline-200 p-2">
                    <TextInput value={value} onChangeText={onChange} placeholder="0.0" keyboardType="numeric" />
                  </Box>
                )}
              />
            </VStack>
          </HStack>

          {/* Submit */}
          <Button variant="solid" size="lg" onPress={handleSubmit(onSubmit)} disabled={isSaving} className="mt-2">
            <ButtonText>{existingFeed ? t('video_feeds.edit_feed') : t('video_feeds.add_feed')}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    </CustomBottomSheet>
  );
};
