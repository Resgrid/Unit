/**
 * Exercises the real CallImagesModal. Everything mocked here is a dependency of the
 * component (stores, expo modules, the child full-screen modal, native plumbing); the
 * component under test is imported and rendered for real.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/stores/calls/detail-store', () => ({
  useCallDetailStore: (selector: any) => (selector ? selector(mockDetailState) : mockDetailState),
}));

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: (selector: any) => (selector ? selector(mockLocationState) : mockLocationState),
}));

jest.mock('@/lib', () => ({
  useAuthStore: { getState: () => ({ userId: mockUserId }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: (selector: any) => (selector ? selector(mockToastState) : mockToastState),
}));

jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  CameraType: { back: 'back', front: 'front' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { PNG: 'png', JPEG: 'jpeg' },
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

// expo-image sets no testID of its own; key the stub off the production `recyclingKey`
// (the gallery sets it per item) so a specific rendered image can be addressed.
jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: any) => React.createElement(View, { testID: props.recyclingKey ? `expo-image-${props.recyclingKey}` : 'expo-image', ...props }),
  };
});

jest.mock('react-native-keyboard-controller', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { KeyboardStickyView: ({ children, ...props }: any) => React.createElement(View, props, children) };
});

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const icon = React.forwardRef((props: Record<string, unknown>, ref: unknown) => React.createElement(View, { ...props, ref }));
  return new Proxy({}, { get: () => icon });
});

// Stub for the child modal (covered by full-screen-image-modal.test.tsx) that surfaces
// what this component hands it.
jest.mock('../full-screen-image-modal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ isOpen, onClose, imageSource, imageName }: any) =>
      isOpen ? React.createElement(View, { testID: 'full-screen-modal', imageSource, imageName }, React.createElement(Pressable, { testID: 'full-screen-close', onPress: onClose })) : null,
  };
});

import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { logger } from '@/lib/logging';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';

import CallImagesModal from '../call-images-modal';

const mockFetchCallImages = jest.fn();
const mockUploadCallImage = jest.fn();
const mockClearImages = jest.fn();
const mockTrackEvent = jest.fn();
let mockUserId: string | null = 'user-42';

const buildImage = (overrides: Partial<CallFileResultData>): CallFileResultData =>
  ({
    Id: 'img-1',
    CallId: 'call-1',
    Type: 2,
    Name: 'Image One',
    Size: 100,
    Url: '',
    Data: '',
    UserId: 'user-42',
    Timestamp: '2024-05-01 08:00',
    Mime: 'image/png',
    FileName: 'one.png',
    ...overrides,
  }) as CallFileResultData;

const base64Image = buildImage({ Id: 'img-1', Name: 'Front of structure', Data: 'AAAABBBB', Mime: 'image/jpeg', Timestamp: '2024-05-01 08:00' });
const urlImage = buildImage({ Id: 'img-2', Name: 'Side alpha', Url: '  https://example.com/side-a.png  ', Timestamp: '2024-05-01 08:05' });
const blankImage = buildImage({ Id: 'img-3', Name: 'Nothing at all', Data: '   ', Url: '  ' });

// One object that is mutated in place — never reassigned — so the selector mock stays live.
const mockDetailState = {
  callImages: [base64Image, urlImage] as CallFileResultData[] | null,
  isLoadingImages: false,
  errorImages: null as string | null,
  fetchCallImages: mockFetchCallImages,
  uploadCallImage: mockUploadCallImage,
  clearImages: mockClearImages,
};

const mockLocationState = {
  latitude: 40.1 as number | null,
  longitude: -75.2 as number | null,
};

const mockShowToast = jest.fn();
const mockToastState = { showToast: mockShowToast };

const setDetailState = (updates: Partial<typeof mockDetailState>) => Object.assign(mockDetailState, updates);

const defaultProps = { isOpen: true, onClose: jest.fn(), callId: 'call-1' };

const mockedPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.Mock;
const mockReadAsStringAsync = readAsStringAsync as jest.Mock;
const mockAlert = jest.fn();

/** Walks from the "Add" chooser to a picked-image preview ready to upload. */
const pickImageFromLibrary = async (screen: ReturnType<typeof render>, asset: { uri: string; fileName?: string } = { uri: 'file:///tmp/original.jpg', fileName: 'original.jpg' }) => {
  mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
  mockedPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] } as never);

  fireEvent.press(screen.getByText('callImages.add'));
  fireEvent.press(screen.getByText('callImages.select_from_gallery'));

  await waitFor(() => expect(screen.getByTestId('image-note-input')).toBeTruthy());
};

describe('CallImagesModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDetailState({
      callImages: [base64Image, urlImage],
      isLoadingImages: false,
      errorImages: null,
    });
    mockLocationState.latitude = 40.1;
    mockLocationState.longitude = -75.2;
    mockUserId = 'user-42';
    mockUploadCallImage.mockResolvedValue(undefined);
    mockManipulateAsync.mockResolvedValue({ uri: 'file:///tmp/manipulated.png', width: 1024, height: 768 });
    mockReadAsStringAsync.mockResolvedValue('BASE64PAYLOAD');
    (global as unknown as { alert: jest.Mock }).alert = mockAlert;
  });

  describe('opening and closing', () => {
    it('renders nothing and fetches nothing while closed', () => {
      const { queryByText, unmount } = render(<CallImagesModal {...defaultProps} isOpen={false} />);

      expect(queryByText('callImages.title')).toBeNull();
      expect(mockFetchCallImages).not.toHaveBeenCalled();

      unmount();
    });

    it('fetches the images for the call it was opened with', () => {
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(mockFetchCallImages).toHaveBeenCalledWith('call-1');
      expect(getByText('callImages.title')).toBeTruthy();

      unmount();
    });

    it('refetches when it is pointed at a different call', () => {
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} />);

      rerender(<CallImagesModal {...defaultProps} callId="call-9" />);

      expect(mockFetchCallImages).toHaveBeenCalledWith('call-9');

      unmount();
    });

    it('drops the loaded images from the store when it closes', () => {
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} />);

      mockClearImages.mockClear();
      rerender(<CallImagesModal {...defaultProps} isOpen={false} />);

      expect(mockClearImages).toHaveBeenCalled();

      unmount();
    });

    it('closes when the close button is pressed', () => {
      const onClose = jest.fn();
      const { getByTestId, unmount } = render(<CallImagesModal {...defaultProps} onClose={onClose} />);

      fireEvent.press(getByTestId('close-button'));

      expect(onClose).toHaveBeenCalledTimes(1);

      unmount();
    });
  });

  describe('gallery', () => {
    it('shows the first image with its name and timestamp', () => {
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('Front of structure')).toBeTruthy();
      expect(getByText('2024-05-01 08:00')).toBeTruthy();

      unmount();
    });

    it('builds a data URI from the stored payload using the image mime type', () => {
      const { getByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByTestId('expo-image-img-1').props.source).toEqual({ uri: 'data:image/jpeg;base64,AAAABBBB' });

      unmount();
    });

    it('falls back to the remote URL, trimmed, when there is no payload', () => {
      const { getByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByTestId('next-button'));

      expect(getByTestId('expo-image-img-2').props.source).toEqual({ uri: 'https://example.com/side-a.png' });

      unmount();
    });

    it('ignores images that carry neither a payload nor a URL', () => {
      setDetailState({ callImages: [base64Image, blankImage, urlImage] });
      const { getByText, queryByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('1 / 2')).toBeTruthy();
      expect(queryByText('Nothing at all')).toBeNull();

      unmount();
    });

    it('pages forward and back through the images', () => {
      const { getByTestId, getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('1 / 2')).toBeTruthy();

      fireEvent.press(getByTestId('next-button'));
      expect(getByText('Side alpha')).toBeTruthy();
      expect(getByText('2 / 2')).toBeTruthy();

      fireEvent.press(getByTestId('previous-button'));
      expect(getByText('Front of structure')).toBeTruthy();
      expect(getByText('1 / 2')).toBeTruthy();

      unmount();
    });

    it('stops at the last image instead of paging off the end', () => {
      const { getByTestId, getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByTestId('next-button'));
      fireEvent.press(getByTestId('next-button'));

      expect(getByText('2 / 2')).toBeTruthy();
      expect(getByText('Side alpha')).toBeTruthy();

      unmount();
    });

    it('stops at the first image instead of paging before the start', () => {
      const { getByTestId, getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByTestId('previous-button'));

      expect(getByText('1 / 2')).toBeTruthy();

      unmount();
    });

    it('hides the pager when there is only one image', () => {
      setDetailState({ callImages: [base64Image] });
      const { queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(queryByTestId('next-button')).toBeNull();
      expect(queryByTestId('previous-button')).toBeNull();

      unmount();
    });

    it('swaps in a placeholder when an image fails to decode', () => {
      const { getByTestId, getByText, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent(getByTestId('expo-image-img-1'), 'error');

      expect(getByText('callImages.failed_to_load')).toBeTruthy();
      expect(queryByTestId('expo-image-img-1')).toBeNull();
      // The placeholder is not tappable, so a broken image cannot be opened full screen.
      expect(queryByTestId('image-img-1-touchable')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Call image failed to load' }));

      unmount();
    });
  });

  describe('empty, loading and error states', () => {
    it('shows the zero state when the call has no images', () => {
      setDetailState({ callImages: [] });
      const { getByText, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('callImages.no_images')).toBeTruthy();
      expect(getByText('callImages.no_images_description')).toBeTruthy();
      expect(queryByTestId('next-button')).toBeNull();

      unmount();
    });

    it('shows the zero state when every image is unusable', () => {
      setDetailState({ callImages: [blankImage] });
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('callImages.no_images')).toBeTruthy();

      unmount();
    });

    it('shows a loading state instead of the gallery while images are being fetched', () => {
      setDetailState({ callImages: null, isLoadingImages: true });
      const { getByText, queryByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('callImages.loading')).toBeTruthy();
      expect(queryByText('callImages.add')).toBeNull();

      unmount();
    });

    it('surfaces the store error message', () => {
      setDetailState({ callImages: [], errorImages: 'Network unreachable' });
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(getByText('callImages.error')).toBeTruthy();
      expect(getByText('Network unreachable')).toBeTruthy();

      unmount();
    });
  });

  describe('full screen viewer', () => {
    it('opens the viewer with the resolved source and name of the tapped image', () => {
      const { getByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByTestId('image-img-1-touchable'));

      const viewer = getByTestId('full-screen-modal');
      expect(viewer.props.imageSource).toEqual({ uri: 'data:image/jpeg;base64,AAAABBBB' });
      expect(viewer.props.imageName).toBe('Front of structure');

      unmount();
    });

    it('keeps the viewer closed until an image is tapped', () => {
      const { queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(queryByTestId('full-screen-modal')).toBeNull();

      unmount();
    });

    it('closes the viewer again', () => {
      const { getByTestId, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByTestId('image-img-1-touchable'));
      fireEvent.press(getByTestId('full-screen-close'));

      expect(queryByTestId('full-screen-modal')).toBeNull();

      unmount();
    });
  });

  describe('choosing an image', () => {
    it('offers the gallery and camera options behind the add button', () => {
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));

      expect(getByText('callImages.add_new')).toBeTruthy();
      expect(getByText('callImages.select_from_gallery')).toBeTruthy();
      expect(getByText('callImages.take_photo')).toBeTruthy();

      unmount();
    });

    it('offers no note or upload until an image has been chosen', () => {
      const { getByText, getByTestId, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));

      expect(getByTestId('cancel-add-button')).toBeTruthy();
      expect(queryByTestId('image-note-input')).toBeNull();
      expect(queryByTestId('upload-button')).toBeNull();

      unmount();
    });

    it('asks for media library permission on iOS and shows the preview once granted', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);

      expect(mockedPicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
      expect(mockedPicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 }));
      expect(screen.getByTestId('expo-image').props.source).toEqual({ uri: 'file:///tmp/original.jpg' });

      screen.unmount();
    });

    it('tells the user and opens no picker when library permission is denied', async () => {
      mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
      const { getByText, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.select_from_gallery'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'common.permission_denied'));
      // Feedback goes through the app's toast, never a bare alert().
      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockedPicker.launchImageLibraryAsync).not.toHaveBeenCalled();
      expect(queryByTestId('image-note-input')).toBeNull();

      unmount();
    });

    it('stays on the chooser when the user cancels the picker', async () => {
      mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
      const { getByText, queryByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.select_from_gallery'));

      await waitFor(() => expect(mockedPicker.launchImageLibraryAsync).toHaveBeenCalled());
      expect(queryByTestId('image-note-input')).toBeNull();
      expect(getByText('callImages.select_from_gallery')).toBeTruthy();

      unmount();
    });

    it('reports a failing picker to the user and to the log', async () => {
      mockedPicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedPicker.launchImageLibraryAsync.mockRejectedValue(new Error('picker exploded'));
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.select_from_gallery'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'callImages.error_selecting_image'));
      expect(mockAlert).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error selecting image from library' }));

      unmount();
    });

    it('asks for camera permission and opens the back camera', async () => {
      mockedPicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/shot.jpg' }] } as never);
      const { getByText, getByTestId, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.take_photo'));

      await waitFor(() => expect(getByTestId('image-note-input')).toBeTruthy());
      expect(mockedPicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(mockedPicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], quality: 0.8, cameraType: 'back' }));

      unmount();
    });

    it('tells the user and opens no camera when camera permission is denied', async () => {
      mockedPicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.take_photo'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'common.permission_denied'));
      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockedPicker.launchCameraAsync).not.toHaveBeenCalled();

      unmount();
    });

    it('reports a failing camera to the user and to the log', async () => {
      mockedPicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedPicker.launchCameraAsync.mockRejectedValue(new Error('camera exploded'));
      const { getByText, unmount } = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(getByText('callImages.add'));
      fireEvent.press(getByText('callImages.take_photo'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'callImages.error_capturing_image'));
      expect(mockAlert).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error capturing image from camera' }));

      unmount();
    });

    it('abandons the picked image when the user cancels', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('cancel-add-button'));

      expect(screen.queryByTestId('image-note-input')).toBeNull();
      expect(screen.getByText('Front of structure')).toBeTruthy();

      screen.unmount();
    });
  });

  describe('uploading', () => {
    it('resizes to 1024px wide and compresses to PNG before uploading', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockManipulateAsync).toHaveBeenCalled());
      expect(mockManipulateAsync).toHaveBeenCalledWith('file:///tmp/original.jpg', [{ resize: { width: 1024 } }], { compress: 0.8, format: 'png' });

      screen.unmount();
    });

    it('uploads the base64 of the resized file, not of the original', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockReadAsStringAsync).toHaveBeenCalled());
      expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/manipulated.png', { encoding: 'base64' });

      screen.unmount();
    });

    it('sends the note, the file name, the user and the current position', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.changeText(screen.getByTestId('image-note-input'), 'Rear entry blocked');
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalledWith('call-1', 'user-42', 'Rear entry blocked', 'original.jpg', 40.1, -75.2, 'BASE64PAYLOAD'));

      screen.unmount();
    });

    it('uploads with an empty note when the user typed none', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalledWith('call-1', 'user-42', '', 'original.jpg', 40.1, -75.2, 'BASE64PAYLOAD'));

      screen.unmount();
    });

    it('generates a name for a library image that has none', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen, { uri: 'file:///tmp/no-name.jpg' });
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalled());
      expect(mockUploadCallImage.mock.calls[0][3]).toMatch(/^image_\d+\.png$/);

      screen.unmount();
    });

    it('names camera captures after the moment they were taken', async () => {
      mockedPicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
      mockedPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tmp/shot.jpg' }] } as never);
      const screen = render(<CallImagesModal {...defaultProps} />);

      fireEvent.press(screen.getByText('callImages.add'));
      fireEvent.press(screen.getByText('callImages.take_photo'));
      await waitFor(() => expect(screen.getByTestId('upload-button')).toBeTruthy());
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalled());
      expect(mockUploadCallImage.mock.calls[0][3]).toMatch(/^camera_\d+\.png$/);

      screen.unmount();
    });

    it('uploads without coordinates when the device has no fix', async () => {
      mockLocationState.latitude = null;
      mockLocationState.longitude = null;
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalledWith('call-1', 'user-42', '', 'original.jpg', null, null, 'BASE64PAYLOAD'));

      screen.unmount();
    });

    it('returns to the gallery with a clean form after a successful upload', async () => {
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.changeText(screen.getByTestId('image-note-input'), 'Rear entry blocked');
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(screen.queryByTestId('image-note-input')).toBeNull());
      expect(screen.getByText('Front of structure')).toBeTruthy();

      // The next add starts from the chooser, not from the previous selection.
      fireEvent.press(screen.getByText('callImages.add'));
      expect(screen.getByText('callImages.select_from_gallery')).toBeTruthy();

      screen.unmount();
    });

    it('tells the user when the upload fails, and keeps the form and the typed note', async () => {
      mockUploadCallImage.mockRejectedValue(new Error('upload rejected'));
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.changeText(screen.getByTestId('image-note-input'), 'Rear entry blocked');
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'callImages.upload_error'));
      expect(mockAlert).not.toHaveBeenCalled();
      // The form is still there once the failed attempt settles, note and all.
      expect(screen.getByText('callImages.upload')).toBeTruthy();
      expect(screen.getByTestId('image-note-input').props.value).toBe('Rear entry blocked');
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error uploading call image', context: expect.objectContaining({ callId: 'call-1' }) }));

      screen.unmount();
    });

    it('refuses to upload with no signed in user, and says why', async () => {
      mockUserId = null;
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'callImages.not_signed_in'));
      expect(mockUploadCallImage).not.toHaveBeenCalled();
      expect(mockManipulateAsync).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cannot upload call image without a signed in user' }));
      // The picked image is kept so the user can retry after signing in.
      expect(screen.getByTestId('image-note-input')).toBeTruthy();

      screen.unmount();
    });

    it('re-enables the upload button after a failure so the user can retry', async () => {
      mockUploadCallImage.mockRejectedValueOnce(new Error('upload rejected'));
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(logger.error).toHaveBeenCalled());
      expect(screen.getByText('callImages.upload')).toBeTruthy();

      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(mockUploadCallImage).toHaveBeenCalledTimes(2));

      screen.unmount();
    });

    it('never uploads when the resize step fails', async () => {
      mockManipulateAsync.mockRejectedValue(new Error('manipulation failed'));
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'Error uploading call image' })));
      expect(mockUploadCallImage).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('error', 'callImages.upload_error');

      screen.unmount();
    });

    it('shows the uploading label while the upload is in flight', async () => {
      let resolveUpload: () => void = () => undefined;
      mockUploadCallImage.mockImplementation(() => new Promise<void>((resolve) => (resolveUpload = resolve)));
      const screen = render(<CallImagesModal {...defaultProps} />);

      await pickImageFromLibrary(screen);
      fireEvent.press(screen.getByTestId('upload-button'));

      await waitFor(() => expect(screen.getByText('common.uploading')).toBeTruthy());

      resolveUpload();
      await waitFor(() => expect(screen.queryByTestId('image-note-input')).toBeNull());

      screen.unmount();
    });
  });

  describe('analytics', () => {
    it('reports the modal opening with what it is showing', () => {
      const { unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(mockTrackEvent).toHaveBeenCalledWith('call_images_modal_opened', {
        callId: 'call-1',
        hasExistingImages: true,
        imagesCount: 2,
        isLoadingImages: false,
        hasError: false,
      });

      unmount();
    });

    it('reports nothing while the modal is closed', () => {
      const { unmount } = render(<CallImagesModal {...defaultProps} isOpen={false} />);

      expect(mockTrackEvent).not.toHaveBeenCalled();

      unmount();
    });

    it('reports an empty gallery as such', () => {
      setDetailState({ callImages: [] });
      const { unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(mockTrackEvent).toHaveBeenCalledWith('call_images_modal_opened', expect.objectContaining({ hasExistingImages: false, imagesCount: 0 }));

      unmount();
    });

    it('reports the error state', () => {
      setDetailState({ callImages: [], errorImages: 'Network unreachable' });
      const { unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(mockTrackEvent).toHaveBeenCalledWith('call_images_modal_opened', expect.objectContaining({ hasError: true }));

      unmount();
    });

    it('reports once per opening, not once per render', () => {
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} isOpen={false} />);

      rerender(<CallImagesModal {...defaultProps} isOpen={true} />);
      rerender(<CallImagesModal {...defaultProps} isOpen={true} />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('does not report again as the images finish loading', () => {
      setDetailState({ callImages: null, isLoadingImages: true });
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);

      // Images land: the store data changes under a re-rendering parent. A new onClose
      // identity stands in for that parent render, since the component is memoized.
      setDetailState({ callImages: [base64Image, urlImage], isLoadingImages: false });
      rerender(<CallImagesModal {...defaultProps} onClose={jest.fn()} />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);

      unmount();
    });

    it('reports again once the modal is closed and reopened', () => {
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} />);

      rerender(<CallImagesModal {...defaultProps} isOpen={false} />);
      rerender(<CallImagesModal {...defaultProps} isOpen={true} />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(2);

      unmount();
    });

    it('reports again when it is pointed at a different call', () => {
      const { rerender, unmount } = render(<CallImagesModal {...defaultProps} />);

      rerender(<CallImagesModal {...defaultProps} callId="call-9" />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(2);
      expect(mockTrackEvent).toHaveBeenLastCalledWith('call_images_modal_opened', expect.objectContaining({ callId: 'call-9' }));

      unmount();
    });
  });
});
