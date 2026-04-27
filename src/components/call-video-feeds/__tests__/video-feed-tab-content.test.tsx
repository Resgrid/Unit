import React from 'react';
import { render } from '@testing-library/react-native';

import { useCallVideoFeedStore } from '@/stores/call-video-feeds/store';

import { VideoFeedTabContent } from '../video-feed-tab-content';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('lucide-react-native', () => ({
  CopyIcon: () => null,
  EditIcon: () => null,
  PlayIcon: () => null,
  PlusIcon: () => null,
  TrashIcon: () => null,
  XIcon: () => null,
}));

jest.mock('@/components/common/loading', () => ({
  Loading: () => {
    const { Text } = require('react-native');
    return <Text>Loading...</Text>;
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} {...props}>
        {children}
      </TouchableOpacity>
    );
  },
  ButtonText: ({ children }: any) => {
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
  ButtonIcon: () => null,
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: () => jest.fn(),
}));

jest.mock('../video-feed-form-sheet', () => ({
  VideoFeedFormSheet: () => null,
}));

jest.mock('../video-player-modal', () => ({
  VideoPlayerModal: () => null,
}));

jest.mock('@/stores/call-video-feeds/store');

const mockUseCallVideoFeedStore = useCallVideoFeedStore as unknown as jest.Mock;

describe('VideoFeedTabContent', () => {
  const mockFetchFeeds = jest.fn();
  const mockDeleteFeed = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state', () => {
    mockUseCallVideoFeedStore.mockImplementation((selector: any) => {
      const state = {
        feeds: [],
        isLoadingFeeds: true,
        fetchFeeds: mockFetchFeeds,
        deleteFeed: mockDeleteFeed,
      };
      return selector(state);
    });

    const { getByText } = render(<VideoFeedTabContent callId={1} />);
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('should render zero state when no feeds', () => {
    mockUseCallVideoFeedStore.mockImplementation((selector: any) => {
      const state = {
        feeds: [],
        isLoadingFeeds: false,
        fetchFeeds: mockFetchFeeds,
        deleteFeed: mockDeleteFeed,
      };
      return selector(state);
    });

    const { getByText } = render(<VideoFeedTabContent callId={1} />);
    expect(getByText('video_feeds.no_feeds')).toBeTruthy();
  });

  it('should render add feed button', () => {
    mockUseCallVideoFeedStore.mockImplementation((selector: any) => {
      const state = {
        feeds: [],
        isLoadingFeeds: false,
        fetchFeeds: mockFetchFeeds,
        deleteFeed: mockDeleteFeed,
      };
      return selector(state);
    });

    const { getByText } = render(<VideoFeedTabContent callId={1} />);
    expect(getByText('video_feeds.add_feed')).toBeTruthy();
  });

  it('should render feed cards when feeds exist', () => {
    const mockFeeds = [
      {
        CallVideoFeedId: 'feed-1',
        CallId: '1',
        Name: 'Drone Camera',
        Url: 'https://example.com/stream.m3u8',
        FeedType: 0,
        FeedFormat: 1,
        Description: '',
        Status: 0,
        Latitude: '',
        Longitude: '',
        AddedByUserId: '',
        AddedOnFormatted: '',
        AddedOnUtc: '',
        SortOrder: 1,
        FullName: '',
      },
    ];

    mockUseCallVideoFeedStore.mockImplementation((selector: any) => {
      const state = {
        feeds: mockFeeds,
        isLoadingFeeds: false,
        fetchFeeds: mockFetchFeeds,
        deleteFeed: mockDeleteFeed,
      };
      return selector(state);
    });

    const { getByText } = render(<VideoFeedTabContent callId={1} />);
    expect(getByText('Drone Camera')).toBeTruthy();
  });

  it('should call fetchFeeds on mount', () => {
    mockUseCallVideoFeedStore.mockImplementation((selector: any) => {
      const state = {
        feeds: [],
        isLoadingFeeds: false,
        fetchFeeds: mockFetchFeeds,
        deleteFeed: mockDeleteFeed,
      };
      return selector(state);
    });

    render(<VideoFeedTabContent callId={42} />);
    expect(mockFetchFeeds).toHaveBeenCalledWith(42);
  });
});
