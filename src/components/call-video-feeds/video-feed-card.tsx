import { CopyIcon, EditIcon, PlayIcon, TrashIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';

import { FEED_FORMAT_LABELS, FEED_STATUS_LABELS, FEED_TYPE_LABELS, FeedStatus } from './feed-format-utils';

const STATUS_COLORS: Record<number, string> = {
  [FeedStatus.Active]: '#22C55E',
  [FeedStatus.Inactive]: '#9CA3AF',
  [FeedStatus.Error]: '#EF4444',
};

interface VideoFeedCardProps {
  feed: CallVideoFeedResultData;
  onWatch: (feed: CallVideoFeedResultData) => void;
  onEdit: (feed: CallVideoFeedResultData) => void;
  onDelete: (feed: CallVideoFeedResultData) => void;
  onCopyUrl: (feed: CallVideoFeedResultData) => void;
}

export const VideoFeedCard: React.FC<VideoFeedCardProps> = ({ feed, onWatch, onEdit, onDelete, onCopyUrl }) => {
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[feed.Status] ?? '#9CA3AF';
  const typeLabel = FEED_TYPE_LABELS[feed.FeedType] ?? 'video_feeds.type_other';
  const formatLabel = FEED_FORMAT_LABELS[feed.FeedFormat] ?? 'video_feeds.format_other';
  const statusLabel = FEED_STATUS_LABELS[feed.Status] ?? 'video_feeds.status_inactive';

  return (
    <Box className="mb-2 rounded-xl border border-outline-100 p-3">
      <HStack className="items-center justify-between">
        <VStack className="flex-1">
          <Text className="font-semibold">{feed.Name}</Text>
          <HStack space="sm" className="mt-1">
            <Text className="text-xs text-gray-500">{t(typeLabel)}</Text>
            <Text className="text-xs text-gray-500">•</Text>
            <Text className="text-xs text-gray-500">{t(formatLabel)}</Text>
          </HStack>
        </VStack>
        <Box className="rounded-full px-2 py-1" style={{ backgroundColor: statusColor + '20' }}>
          <Text className="text-xs font-medium" style={{ color: statusColor }}>
            {t(statusLabel)}
          </Text>
        </Box>
      </HStack>

      {feed.Description ? <Text className="mt-1 text-sm text-gray-500">{feed.Description}</Text> : null}

      {feed.FullName ? (
        <Text className="mt-1 text-xs text-gray-400">
          {t('video_feeds.added_by')}: {feed.FullName}
          {feed.AddedOnFormatted ? ` • ${feed.AddedOnFormatted}` : ''}
        </Text>
      ) : null}

      <HStack space="sm" className="mt-3">
        <Button variant="solid" size="sm" onPress={() => onWatch(feed)} className="flex-1 bg-blue-600">
          <ButtonIcon as={PlayIcon} className="text-white" />
          <ButtonText className="text-white">{t('video_feeds.watch')}</ButtonText>
        </Button>
        <Button variant="outline" size="sm" onPress={() => onCopyUrl(feed)}>
          <ButtonIcon as={CopyIcon} />
        </Button>
        <Button variant="outline" size="sm" onPress={() => onEdit(feed)}>
          <ButtonIcon as={EditIcon} />
        </Button>
        <Button variant="outline" size="sm" onPress={() => onDelete(feed)} className="border-red-300">
          <ButtonIcon as={TrashIcon} className="text-red-500" />
        </Button>
      </HStack>
    </Box>
  );
};
