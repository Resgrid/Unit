import { ResizeMode, Video } from 'expo-av';
import { CopyIcon, XIcon } from 'lucide-react-native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';

import { FeedFormat } from './feed-format-utils';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  feed: CallVideoFeedResultData | null;
  onCopyUrl: (feed: CallVideoFeedResultData) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onClose, feed, onCopyUrl }) => {
  const { t } = useTranslation();

  const handleCopy = useCallback(() => {
    if (feed) {
      onCopyUrl(feed);
    }
  }, [feed, onCopyUrl]);

  if (!feed) return null;

  const renderPlayer = () => {
    switch (feed.FeedFormat) {
      case FeedFormat.HLS:
      case FeedFormat.DASH:
        return <Video source={{ uri: feed.Url }} style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay />;

      case FeedFormat.YouTubeLive:
      case FeedFormat.Embed:
      case FeedFormat.MJPEG:
      case FeedFormat.Other:
        return <WebView source={{ uri: feed.Url }} style={styles.video} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled />;

      case FeedFormat.RTSP:
        return (
          <VStack space="md" className="items-center justify-center p-8">
            <Text className="text-center text-white">{t('video_feeds.rtsp_not_supported')}</Text>
            <Button variant="solid" onPress={handleCopy}>
              <ButtonIcon as={CopyIcon} className="text-white" />
              <ButtonText className="text-white">{t('video_feeds.copy_url')}</ButtonText>
            </Button>
          </VStack>
        );

      case FeedFormat.WebRTC:
        return (
          <VStack space="md" className="items-center justify-center p-8">
            <Text className="text-center text-white">{t('video_feeds.webrtc_not_supported')}</Text>
          </VStack>
        );

      default:
        return <WebView source={{ uri: feed.Url }} style={styles.video} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled />;
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Box className="flex-1 bg-black">
        {/* Header */}
        <Box className="flex-row items-center justify-between px-4 pb-2 pt-12">
          <Heading size="sm" className="flex-1 text-white">
            {feed.Name}
          </Heading>
          <Button variant="link" onPress={onClose}>
            <ButtonIcon as={XIcon} className="text-white" size="xl" />
          </Button>
        </Box>

        {/* Player */}
        <Box className="flex-1 items-center justify-center">{renderPlayer()}</Box>
      </Box>
    </Modal>
  );
};

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});
