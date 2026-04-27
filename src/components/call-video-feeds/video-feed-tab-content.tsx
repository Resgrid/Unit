import * as Clipboard from 'expo-clipboard';
import { PlusIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList } from 'react-native';

import { Loading } from '@/components/common/loading';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';
import { useCallVideoFeedStore } from '@/stores/call-video-feeds/store';
import { useToastStore } from '@/stores/toast/store';

import { VideoFeedCard } from './video-feed-card';
import { VideoFeedFormSheet } from './video-feed-form-sheet';
import { VideoPlayerModal } from './video-player-modal';

interface VideoFeedTabContentProps {
  callId: number;
}

export const VideoFeedTabContent: React.FC<VideoFeedTabContentProps> = ({ callId }) => {
  const { t } = useTranslation();
  const feeds = useCallVideoFeedStore((state) => state.feeds);
  const isLoadingFeeds = useCallVideoFeedStore((state) => state.isLoadingFeeds);
  const fetchFeeds = useCallVideoFeedStore((state) => state.fetchFeeds);
  const deleteFeedAction = useCallVideoFeedStore((state) => state.deleteFeed);
  const showToast = useToastStore((state) => state.showToast);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CallVideoFeedResultData | undefined>(undefined);
  const [playerFeed, setPlayerFeed] = useState<CallVideoFeedResultData | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    fetchFeeds(callId);
  }, [callId, fetchFeeds]);

  const handleAddFeed = useCallback(() => {
    setEditingFeed(undefined);
    setIsFormOpen(true);
  }, []);

  const handleWatch = useCallback((feed: CallVideoFeedResultData) => {
    setPlayerFeed(feed);
    setIsPlayerOpen(true);
  }, []);

  const handleEdit = useCallback((feed: CallVideoFeedResultData) => {
    setEditingFeed(feed);
    setIsFormOpen(true);
  }, []);

  const handleCopyUrl = useCallback(
    async (feed: CallVideoFeedResultData) => {
      await Clipboard.setStringAsync(feed.Url);
      showToast('success', t('video_feeds.url_copied'));
    },
    [showToast, t]
  );

  const handleDelete = useCallback(
    (feed: CallVideoFeedResultData) => {
      Alert.alert(t('video_feeds.delete_confirm_title'), t('video_feeds.delete_confirm_message'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('video_feeds.delete_feed'),
          style: 'destructive',
          onPress: async () => {
            const success = await deleteFeedAction(feed.CallVideoFeedId, callId);
            if (success) {
              showToast('success', t('video_feeds.delete_success'));
            } else {
              showToast('error', t('video_feeds.delete_error'));
            }
          },
        },
      ]);
    },
    [deleteFeedAction, callId, showToast, t]
  );

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingFeed(undefined);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setIsPlayerOpen(false);
    setPlayerFeed(null);
  }, []);

  const renderFeedCard = useCallback(
    ({ item }: { item: CallVideoFeedResultData }) => <VideoFeedCard feed={item} onWatch={handleWatch} onEdit={handleEdit} onDelete={handleDelete} onCopyUrl={handleCopyUrl} />,
    [handleWatch, handleEdit, handleDelete, handleCopyUrl]
  );

  const keyExtractor = useCallback((item: CallVideoFeedResultData) => item.CallVideoFeedId, []);

  if (isLoadingFeeds && feeds.length === 0) {
    return (
      <Box className="p-4">
        <Loading />
      </Box>
    );
  }

  return (
    <VStack className="p-4" space="md">
      <Button variant="solid" size="md" onPress={handleAddFeed}>
        <ButtonIcon as={PlusIcon} className="text-white" />
        <ButtonText className="text-white">{t('video_feeds.add_feed')}</ButtonText>
      </Button>

      {feeds.length === 0 ? (
        <Text className="text-center text-gray-500">{t('video_feeds.no_feeds')}</Text>
      ) : (
        <FlatList data={feeds} renderItem={renderFeedCard} keyExtractor={keyExtractor} scrollEnabled={false} removeClippedSubviews={true} maxToRenderPerBatch={10} />
      )}

      <VideoFeedFormSheet isOpen={isFormOpen} onClose={handleCloseForm} callId={callId} existingFeed={editingFeed} />

      <VideoPlayerModal isOpen={isPlayerOpen} onClose={handleClosePlayer} feed={playerFeed} onCopyUrl={handleCopyUrl} />
    </VStack>
  );
};
