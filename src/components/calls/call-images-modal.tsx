import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon, XIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, FlatList, Platform, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Image } from '@/components/ui/image';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuthStore } from '@/lib';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonIcon, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface CallImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const { width } = Dimensions.get('window');

const CallImagesModal: React.FC<CallImagesModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageName, setNewImageName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  const { callImages, isLoadingImages, errorImages, fetchCallImages, uploadCallImage } = useCallDetailStore();

  // Filter valid images and memoize to prevent re-filtering on every render
  const validImages = useMemo(() => {
    if (!callImages) return [];
    return callImages.filter((item) => item && (item.Data?.trim() || item.Url?.trim()));
  }, [callImages]);

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallImages(callId);
      setActiveIndex(0); // Reset active index when opening
      setImageErrors(new Set()); // Reset image errors
    }
  }, [isOpen, callId, fetchCallImages]);

  // Track when call images modal is opened/rendered
  useEffect(() => {
    if (isOpen) {
      trackEvent('call_images_modal_opened', {
        callId: callId,
        hasExistingImages: validImages.length > 0,
        imagesCount: validImages.length,
        isLoadingImages: isLoadingImages,
        hasError: !!errorImages,
      });
    }
  }, [isOpen, trackEvent, callId, validImages.length, isLoadingImages, errorImages]);

  // Reset active index when valid images change
  useEffect(() => {
    if (activeIndex >= validImages.length && validImages.length > 0) {
      setActiveIndex(0);
    }
  }, [validImages.length, activeIndex]);

  const handleImageSelect = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert(t('common.permission_denied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCameraCapture = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      alert(t('common.permission_denied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleUploadImage = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      // Manipulate image to ensure PNG format and proper compression
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        selectedImage,
        [{ resize: { width: 1024 } }], // Resize to max width of 1024px while maintaining aspect ratio
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.PNG, // Ensure PNG format
        }
      );

      // Read the manipulated image as base64
      const base64Image = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await uploadCallImage(
        callId,
        useAuthStore.getState().userId!,
        '',
        newImageName || t('callImages.default_name'),
        null, //lat
        null, //lon
        base64Image
      );
      setSelectedImage(null);
      setNewImageName('');
      setIsAddingImage(false);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageError = (itemId: string, errorInfo?: any) => {
    console.log(`Image loading failed for ${itemId}:`, errorInfo);
    setImageErrors((prev) => new Set([...prev, itemId]));
  };

  // Helper function to test if URL is accessible
  const testImageUrl = async (url: string) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`URL ${url} accessibility test:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });
      return response.ok;
    } catch (error) {
      console.log(`URL ${url} fetch test failed:`, error);
      return false;
    }
  };

  const renderImageItem = ({ item, index }: { item: CallFileResultData; index: number }) => {
    if (!item) return null;

    // Use Data field if available (base64), otherwise fall back to Url
    let imageSource: { uri: string } | null = null;
    const hasError = imageErrors.has(item.Id);

    if (item.Data && item.Data.trim() !== '') {
      // Use Data as base64 image
      const mimeType = item.Mime || 'image/png'; // Default to png if no mime type
      imageSource = { uri: `data:${mimeType};base64,${item.Data}` };
    } else if (item.Url && item.Url.trim() !== '') {
      // Fall back to URL - add logging to debug URL issues
      console.log(`Loading image from URL: ${item.Url} for item ${item.Id}`);
      imageSource = { uri: item.Url };

      // Test URL accessibility (don't await, just for debugging)
      testImageUrl(item.Url);
    }

    if (!imageSource || hasError) {
      return (
        <Box className="w-full items-center justify-center px-4">
          <Box className="h-64 w-full items-center justify-center rounded-lg bg-gray-200">
            <ImageIcon size={48} color="#999" />
            <Text className="mt-2 text-gray-500">{t('callImages.failed_to_load')}</Text>
            {item.Url && (
              <Text className="mt-1 px-2 text-center text-xs text-gray-400" numberOfLines={2}>
                URL: {item.Url}
              </Text>
            )}
          </Box>
          <Text className="mt-2 text-center font-medium">{item.Name || ''}</Text>
          <Text className="text-xs text-gray-500">{item.Timestamp || ''}</Text>
        </Box>
      );
    }

    return (
      <Box className="w-full items-center justify-center px-4">
        <Image
          key={`${item.Id}-${index}`}
          source={imageSource}
          className="h-64 w-full rounded-lg"
          contentFit="contain"
          cachePolicy="memory-disk"
          onError={(error) => {
            console.log(`Full error details for ${item.Id}:`, error, 'URL:', item.Url);
            handleImageError(item.Id, error);
          }}
          onLoad={() => {
            console.log(`Image loaded successfully for ${item.Id}`);
            // Remove from error set if it loads successfully
            setImageErrors((prev) => {
              const newSet = new Set(prev);
              newSet.delete(item.Id);
              return newSet;
            });
          }}
          onLoadStart={() => {
            console.log(`Starting to load image for ${item.Id}:`, imageSource?.uri);
          }}
        />
        <Text className="mt-2 text-center font-medium">{item.Name || ''}</Text>
        <Text className="text-xs text-gray-500">{item.Timestamp || ''}</Text>
      </Box>
    );
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const handlePrevious = () => {
    const newIndex = Math.max(0, activeIndex - 1);
    setActiveIndex(newIndex);
    try {
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    } catch (error) {
      console.warn('Error scrolling to previous image:', error);
    }
  };

  const handleNext = () => {
    const newIndex = Math.min(validImages.length - 1, activeIndex + 1);
    setActiveIndex(newIndex);
    try {
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    } catch (error) {
      console.warn('Error scrolling to next image:', error);
    }
  };

  const renderPagination = () => {
    if (!validImages || validImages.length <= 1) return null;

    return (
      <HStack className="mt-4 items-center justify-between px-4">
        <TouchableOpacity testID="previous-button" onPress={handlePrevious} disabled={activeIndex === 0} className={`rounded-full bg-white/80 p-2 ${activeIndex === 0 ? 'opacity-50' : ''}`}>
          <ChevronLeftIcon size={24} color="#000" />
        </TouchableOpacity>

        <HStack className="items-center space-x-2 rounded-full bg-white/80 px-4 py-2 dark:bg-gray-800/80">
          <Text className="text-sm font-medium text-gray-800 dark:text-white">
            {activeIndex + 1} / {validImages.length}
          </Text>
        </HStack>

        <TouchableOpacity
          testID="next-button"
          onPress={handleNext}
          disabled={activeIndex === validImages.length - 1}
          className={`rounded-full bg-white/80 p-2 ${activeIndex === validImages.length - 1 ? 'opacity-50' : ''}`}
        >
          <ChevronRightIcon size={24} color="#000" />
        </TouchableOpacity>
      </HStack>
    );
  };

  const renderAddImageContent = () => (
    <VStack className="flex-1">
      {/* Scrollable content area */}
      <VStack className="flex-1 space-y-4 p-4">
        <HStack className="items-center justify-between">
          <Text className="text-lg font-bold">{t('callImages.add_new')}</Text>
          <TouchableOpacity
            onPress={() => {
              setIsAddingImage(false);
              setSelectedImage(null);
              setNewImageName('');
            }}
          >
            <XIcon size={24} />
          </TouchableOpacity>
        </HStack>

        {selectedImage ? (
          <Box className="flex-1 items-center justify-center">
            <Image source={{ uri: selectedImage }} className="h-64 w-full rounded-lg" contentFit="contain" />
          </Box>
        ) : (
          <VStack className="flex-1 justify-center space-y-4">
            <ActionsheetItem onPress={handleImageSelect}>
              <HStack className="items-center space-x-2">
                <PlusIcon size={20} />
                <ActionsheetItemText>{t('callImages.select_from_gallery')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
            <ActionsheetItem onPress={handleCameraCapture}>
              <HStack className="items-center space-x-2">
                <CameraIcon size={20} />
                <ActionsheetItemText>{t('callImages.take_photo')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
          </VStack>
        )}
      </VStack>

      {/* Fixed bottom section for input and save button */}
      {selectedImage && (
        <KeyboardAwareScrollView keyboardShouldPersistTaps={Platform.OS === 'android' ? 'handled' : 'always'} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <VStack className="max-h-30 space-y-2 border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
            <Input className="w-full" size="sm">
              <InputField placeholder={t('callImages.image_name')} value={newImageName} onChangeText={setNewImageName} testID="image-name-input" />
            </Input>
            <Button className="mt-2 w-full" size="sm" onPress={handleUploadImage} isDisabled={isUploading} testID="upload-button">
              <ButtonText>{isUploading ? t('common.uploading') : t('callImages.upload')}</ButtonText>
            </Button>
          </VStack>
        </KeyboardAwareScrollView>
      )}
    </VStack>
  );

  const renderImageGallery = () => {
    if (!validImages?.length) return null;

    return (
      <VStack className="space-y-4 p-4">
        <Box className="relative">
          <FlatList
            ref={flatListRef}
            data={validImages}
            renderItem={renderImageItem}
            keyExtractor={(item) => item?.Id || `image-${Math.random()}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            snapToInterval={width}
            decelerationRate="fast"
            className="w-full"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={3}
            removeClippedSubviews={true}
            initialScrollIndex={0}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            ListEmptyComponent={() => (
              <Box className="w-full items-center justify-center p-4">
                <Text className="text-center text-gray-500">{t('callImages.no_images')}</Text>
              </Box>
            )}
          />
        </Box>
        {renderPagination()}
      </VStack>
    );
  };

  const renderContent = () => {
    if (isLoadingImages) {
      return <Loading text={t('callImages.loading')} />;
    }

    if (errorImages) {
      return <ZeroState heading={t('callImages.error')} description={errorImages} isError={true} />;
    }

    if (isAddingImage) {
      return renderAddImageContent();
    }

    if (!validImages || validImages.length === 0) {
      return <ZeroState icon={ImageIcon} heading={t('callImages.no_images')} description={t('callImages.no_images_description')} />;
    }

    return renderImageGallery();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[67]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="rounded-t-3x bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Box className="w-full p-4">
          <HStack className="mb-4 items-center justify-between">
            <Text className="text-xl font-bold">{t('callImages.title')}</Text>
            {!isAddingImage && !isLoadingImages && (
              <Button size="sm" variant="outline" onPress={() => setIsAddingImage(true)}>
                <ButtonIcon as={PlusIcon} />
                <ButtonText>{t('callImages.add')}</ButtonText>
              </Button>
            )}
          </HStack>

          <View className="min-h-[300px]">{renderContent()}</View>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default CallImagesModal;
