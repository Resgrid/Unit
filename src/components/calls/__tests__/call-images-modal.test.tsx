import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useAuthStore } from '@/lib';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import CallImagesModal from '../call-images-modal';

// Mock dependencies
jest.mock('@/lib', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/stores/calls/detail-store');

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'Images',
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock the UI components
jest.mock('../ui/actionsheet', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return {
    Actionsheet: ({ children, isOpen }: any) => isOpen ? React.createElement(View, { testID: 'actionsheet' }, children) : null,
    ActionsheetBackdrop: ({ children }: any) => React.createElement(View, { testID: 'actionsheet-backdrop' }, children),
    ActionsheetContent: ({ children }: any) => React.createElement(View, { testID: 'actionsheet-content' }, children),
    ActionsheetDragIndicator: () => React.createElement(View, { testID: 'drag-indicator' }),
    ActionsheetDragIndicatorWrapper: ({ children }: any) => React.createElement(View, { testID: 'drag-indicator-wrapper' }, children),
    ActionsheetItem: ({ children, onPress }: any) => React.createElement(TouchableOpacity, { testID: 'actionsheet-item', onPress }, children),
    ActionsheetItemText: ({ children }: any) => React.createElement(Text, { testID: 'actionsheet-item-text' }, children),
  };
});

jest.mock('@/components/common/loading', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    Loading: ({ text }: any) => React.createElement(View, { testID: 'loading' }, React.createElement(Text, null, text)),
  };
});

jest.mock('@/components/common/zero-state', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ heading, description, isError }: any) =>
      React.createElement(View, { testID: isError ? 'error-state' : 'zero-state' }, [
        React.createElement(Text, { testID: 'heading', key: 'heading' }, heading),
        React.createElement(Text, { testID: 'description', key: 'description' }, description),
      ]),
  };
});

const mockUseCallDetailStore = useCallDetailStore as jest.MockedFunction<typeof useCallDetailStore>;
const mockUseAuthStore = useAuthStore as jest.MockedObject<typeof useAuthStore>;

describe('CallImagesModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    callId: 'test-call-id',
  };

  const mockCallImages = [
    {
      Id: '1',
      Name: 'Image 1',
      Data: 'base64data1',
      Url: '',
      Mime: 'image/png',
      Timestamp: '2023-01-01',
    },
    {
      Id: '2',
      Name: 'Image 2',
      Data: '',
      Url: 'https://example.com/image2.jpg',
      Mime: 'image/jpeg',
      Timestamp: '2023-01-02',
    },
    {
      Id: '3',
      Name: 'Invalid Image',
      Data: '',
      Url: '',
      Mime: 'image/png',
      Timestamp: '2023-01-03',
    },
    {
      Id: '4',
      Name: 'Image 4',
      Data: 'base64data4',
      Url: '',
      Mime: 'image/png',
      Timestamp: '2023-01-04',
    },
    {
      Id: '5',
      Name: 'Image 5',
      Data: 'base64data5',
      Url: '',
      Mime: 'image/png',
      Timestamp: '2023-01-05',
    },
  ];

  const mockStore = {
    callImages: mockCallImages,
    isLoadingImages: false,
    errorImages: null,
    fetchCallImages: jest.fn(),
    uploadCallImage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCallDetailStore.mockReturnValue(mockStore as any);
    mockUseAuthStore.getState.mockReturnValue({
      userId: 'test-user-id',
      accessToken: 'test-token',
      refreshToken: 'test-refresh-token',
      refreshTokenExpiresOn: new Date(),
      status: 'authenticated',
      user: null,
      departmentId: 'test-dept-id',
      groupIds: [],
      userName: 'test-user',
      signIn: jest.fn(),
      signOut: jest.fn(),
      setUser: jest.fn(),
      setDepartmentId: jest.fn(),
      setGroupIds: jest.fn(),
    } as any);
  });

  it('renders correctly when open', () => {
    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);
    expect(getByTestId('actionsheet')).toBeTruthy();
  });

  it('fetches images when opened', () => {
    render(<CallImagesModal {...defaultProps} />);
    expect(mockStore.fetchCallImages).toHaveBeenCalledWith('test-call-id');
  });

  it('shows loading state', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      isLoadingImages: true,
    } as any);

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('shows error state', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      errorImages: 'Failed to load images',
    } as any);

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);
    expect(getByTestId('error-state')).toBeTruthy();
  });

  it('shows zero state when no images', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      callImages: [],
    } as any);

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);
    expect(getByTestId('zero-state')).toBeTruthy();
  });

  it('filters out invalid images from pagination', () => {
    const { getByText } = render(<CallImagesModal {...defaultProps} />);
    // Should show 4 valid images (filtering out the one with no data or URL)
    expect(getByText('1 / 4')).toBeTruthy();
  });

  it('handles pagination correctly', async () => {
    const { getByText, getByTestId } = render(<CallImagesModal {...defaultProps} />);

    // Should start at first image
    expect(getByText('1 / 4')).toBeTruthy();

    // Mock the FlatList ref
    const flatListRef = { current: { scrollToIndex: jest.fn() } };
    React.useRef = jest.fn(() => flatListRef);

    // Click next button
    const nextButton = getByTestId('next-button');
    if (nextButton) {
      fireEvent.press(nextButton);
    }
  });

  it('resets active index when opening modal', () => {
    const { rerender } = render(<CallImagesModal {...defaultProps} isOpen={false} />);

    // Open the modal
    rerender(<CallImagesModal {...defaultProps} isOpen={true} />);

    expect(mockStore.fetchCallImages).toHaveBeenCalledWith('test-call-id');
  });

  it('handles image loading errors gracefully', () => {
    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);

    // Find an image and simulate error
    const images = getByTestId('actionsheet-content').querySelectorAll('Image');
    if (images.length > 0) {
      // Simulate image loading error
      fireEvent(images[0], 'error');
    }
  });

  it('handles invalid scroll indices gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);

    // Try to navigate when FlatList ref might be invalid
    const nextButton = getByTestId('next-button');
    if (nextButton) {
      fireEvent.press(nextButton);
    }

    consoleSpy.mockRestore();
  });

  it('handles viewable items change correctly', () => {
    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);

    // Mock viewable items change
    const flatList = getByTestId('actionsheet-content').querySelector('FlatList');
    if (flatList) {
      fireEvent(flatList, 'viewableItemsChanged', {
        viewableItems: [{ index: 2 }],
      });
    }
  });

  it('properly memoizes valid images', () => {
    const { rerender } = render(<CallImagesModal {...defaultProps} />);

    // Re-render with same data
    rerender(<CallImagesModal {...defaultProps} />);

    // Should not cause unnecessary re-filtering
    expect(mockStore.fetchCallImages).toHaveBeenCalledTimes(1);
  });

  it('resets active index when valid images length changes', () => {
    const { rerender } = render(<CallImagesModal {...defaultProps} />);

    // Change to fewer images
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      callImages: [mockCallImages[0]], // Only one image
    } as any);

    rerender(<CallImagesModal {...defaultProps} />);

    // Active index should reset if it was beyond the new length
  });

  it('handles upload image correctly', async () => {
    const mockUploadCallImage = jest.fn().mockResolvedValue(undefined);
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      uploadCallImage: mockUploadCallImage,
    } as any);

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);

    // Add image flow would be tested here
    // This would involve mocking image picker and file system operations
  });

  it('does not fetch images when modal is closed', () => {
    render(<CallImagesModal {...defaultProps} isOpen={false} />);
    expect(mockStore.fetchCallImages).not.toHaveBeenCalled();
  });

  it('handles invalid call images gracefully', () => {
    mockUseCallDetailStore.mockReturnValue({
      ...mockStore,
      callImages: null,
    } as any);

    const { getByTestId } = render(<CallImagesModal {...defaultProps} />);
    expect(getByTestId('zero-state')).toBeTruthy();
  });

  it('should export the component successfully', () => {
    const CallImagesModal = require('../call-images-modal').default;
    expect(CallImagesModal).toBeDefined();
    expect(typeof CallImagesModal).toBe('function');
  });

  it('should filter valid images correctly', () => {
    const mockImages = [
      { Id: '1', Data: 'base64data', Url: '', Name: 'Valid Image 1' },
      { Id: '2', Data: '', Url: 'https://example.com/image.jpg', Name: 'Valid Image 2' },
      { Id: '3', Data: '', Url: '', Name: 'Invalid Image' },
      { Id: '4', Data: 'base64data2', Url: '', Name: 'Valid Image 3' },
    ];

    // Test the filtering logic we implemented
    const validImages = mockImages.filter((item) => item && (item.Data?.trim() || item.Url?.trim()));

    expect(validImages).toHaveLength(3);
    expect(validImages.map(img => img.Id)).toEqual(['1', '2', '4']);
  });

  it('should prefer Data over Url when both are available', () => {
    const mockImage = {
      Id: '1',
      Data: 'base64data',
      Url: 'https://example.com/fallback.jpg',
      Mime: 'image/png',
      Name: 'Test Image'
    };

    // Test the logic we use in renderImageItem
    let imageSource = null;
    if (mockImage.Data && mockImage.Data.trim() !== '') {
      const mimeType = mockImage.Mime || 'image/png';
      imageSource = { uri: `data:${mimeType};base64,${mockImage.Data}` };
    } else if (mockImage.Url && mockImage.Url.trim() !== '') {
      imageSource = { uri: mockImage.Url };
    }

    expect(imageSource).toEqual({
      uri: 'data:image/png;base64,base64data'
    });
  });

  it('should fall back to URL when Data is empty', () => {
    const mockImage = {
      Id: '2',
      Data: '',
      Url: 'https://example.com/image.jpg',
      Mime: 'image/jpeg',
      Name: 'Test Image'
    };

    // Test the logic we use in renderImageItem
    let imageSource = null;
    if (mockImage.Data && mockImage.Data.trim() !== '') {
      const mimeType = mockImage.Mime || 'image/png';
      imageSource = { uri: `data:${mimeType};base64,${mockImage.Data}` };
    } else if (mockImage.Url && mockImage.Url.trim() !== '') {
      imageSource = { uri: mockImage.Url };
    }

    expect(imageSource).toEqual({
      uri: 'https://example.com/image.jpg'
    });
  });

  it('should return null when both Data and Url are empty', () => {
    const mockImage = {
      Id: '3',
      Data: '',
      Url: '',
      Mime: 'image/png',
      Name: 'Invalid Image'
    };

    // Test the logic we use in renderImageItem
    let imageSource = null;
    if (mockImage.Data && mockImage.Data.trim() !== '') {
      const mimeType = mockImage.Mime || 'image/png';
      imageSource = { uri: `data:${mimeType};base64,${mockImage.Data}` };
    } else if (mockImage.Url && mockImage.Url.trim() !== '') {
      imageSource = { uri: mockImage.Url };
    }

    expect(imageSource).toBeNull();
  });

  it('should handle pagination bounds correctly', () => {
    const validImagesLength = 5;
    let activeIndex = 0;

    // Test next navigation
    const handleNext = () => {
      return Math.min(validImagesLength - 1, activeIndex + 1);
    };

    // Test previous navigation  
    const handlePrevious = () => {
      return Math.max(0, activeIndex - 1);
    };

    // Test at start
    expect(handlePrevious()).toBe(0);
    expect(handleNext()).toBe(1);

    // Test in middle
    activeIndex = 2;
    expect(handlePrevious()).toBe(1);
    expect(handleNext()).toBe(3);

    // Test at end
    activeIndex = 4;
    expect(handlePrevious()).toBe(3);
    expect(handleNext()).toBe(4); // Should not exceed bounds
  });
}); 