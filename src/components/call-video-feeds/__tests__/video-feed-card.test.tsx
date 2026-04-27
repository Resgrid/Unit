import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';

import { VideoFeedCard } from '../video-feed-card';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  CopyIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="copy-icon" />;
  },
  EditIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="edit-icon" />;
  },
  PlayIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="play-icon" />;
  },
  TrashIcon: (props: any) => {
    const { View } = require('react-native');
    return <View testID="trash-icon" />;
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
  ButtonIcon: ({ as: Icon, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props} />;
  },
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

const createMockFeed = (overrides: Partial<CallVideoFeedResultData> = {}): CallVideoFeedResultData => ({
  CallVideoFeedId: 'feed-1',
  CallId: '1',
  Name: 'Drone Camera 1',
  Url: 'https://example.com/stream.m3u8',
  FeedType: 0,
  FeedFormat: 1,
  Description: 'Test description',
  Status: 0,
  Latitude: '40.7128',
  Longitude: '-74.0060',
  AddedByUserId: 'user-1',
  AddedOnFormatted: '2026-04-15 10:00 AM',
  AddedOnUtc: '2026-04-15T10:00:00Z',
  SortOrder: 1,
  FullName: 'John Doe',
  ...overrides,
});

describe('VideoFeedCard', () => {
  const onWatch = jest.fn();
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  const onCopyUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render feed info', () => {
    const feed = createMockFeed();

    const { getByText } = render(<VideoFeedCard feed={feed} onWatch={onWatch} onEdit={onEdit} onDelete={onDelete} onCopyUrl={onCopyUrl} />);

    expect(getByText('Drone Camera 1')).toBeTruthy();
    expect(getByText('Test description')).toBeTruthy();
    expect(getByText('video_feeds.watch')).toBeTruthy();
  });

  it('should call onWatch when Watch button is pressed', () => {
    const feed = createMockFeed();

    const { getByText } = render(<VideoFeedCard feed={feed} onWatch={onWatch} onEdit={onEdit} onDelete={onDelete} onCopyUrl={onCopyUrl} />);

    fireEvent.press(getByText('video_feeds.watch'));
    expect(onWatch).toHaveBeenCalledWith(feed);
  });

  it('should display added by info', () => {
    const feed = createMockFeed();

    const { getByText } = render(<VideoFeedCard feed={feed} onWatch={onWatch} onEdit={onEdit} onDelete={onDelete} onCopyUrl={onCopyUrl} />);

    expect(getByText(/John Doe/)).toBeTruthy();
  });

  it('should render status badge', () => {
    const feed = createMockFeed({ Status: 0 });

    const { getByText } = render(<VideoFeedCard feed={feed} onWatch={onWatch} onEdit={onEdit} onDelete={onDelete} onCopyUrl={onCopyUrl} />);

    expect(getByText('video_feeds.status_active')).toBeTruthy();
  });
});
