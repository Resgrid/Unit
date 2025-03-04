import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  CameraIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  FlatList,
  Image,
  TouchableOpacity,
  View,
} from 'react-native';

import ZeroState from '@/components/common/zero-state';
import { Loading } from '@/components/ui/loading';
import { useAuthStore } from '@/lib';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '../ui/actionsheet';
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

const CallImagesModal: React.FC<CallImagesModalProps> = ({
  isOpen,
  onClose,
  callId,
}) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageName, setNewImageName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    callImages,
    isLoadingImages,
    errorImages,
    fetchCallImages,
    uploadCallImage,
  } = useCallDetailStore();

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallImages(callId);
    }
  }, [isOpen, callId, fetchCallImages]);

  const handleImageSelect = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      const base64Image = await FileSystem.readAsStringAsync(selectedImage, {
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

  const renderImageItem = ({
    item,
  }: {
    item: CallFileResultData;
    index: number;
  }) => {
    if (!item || !item.Url) return null;

    return (
      <Box className="w-full items-center justify-center px-4">
        <Image
          source={{ uri: item.Url }}
          className="h-64 w-full rounded-lg"
          resizeMode="contain"
        />
        <Text className="mt-2 text-center font-medium">{item.Name || ''}</Text>
        <Text className="text-xs text-gray-500">{item.Timestamp || ''}</Text>
      </Box>
    );
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const renderPagination = () => {
    if (!callImages || callImages.length <= 1) return null;

    return (
      <HStack className="mt-4 items-center justify-between px-4">
        <TouchableOpacity
          onPress={() =>
            flatListRef.current?.scrollToIndex({
              index: activeIndex - 1,
              animated: true,
            })
          }
          disabled={activeIndex === 0}
          className={`rounded-full bg-white/80 p-2 ${activeIndex === 0 ? 'opacity-50' : ''}`}
        >
          <ChevronLeftIcon size={24} color="#000" />
        </TouchableOpacity>

        <HStack className="items-center space-x-2 rounded-full bg-white/80 px-4 py-2">
          {callImages.map((_, index) => (
            <Box
              key={index}
              className={`mx-1 size-2.5 rounded-full ${
                index === activeIndex ? 'bg-primary' : 'bg-gray-400'
              }`}
            />
          ))}
        </HStack>

        <TouchableOpacity
          onPress={() =>
            flatListRef.current?.scrollToIndex({
              index: activeIndex + 1,
              animated: true,
            })
          }
          disabled={activeIndex === callImages.length - 1}
          className={`rounded-full bg-white/80 p-2 ${activeIndex === callImages.length - 1 ? 'opacity-50' : ''}`}
        >
          <ChevronRightIcon size={24} color="#000" />
        </TouchableOpacity>
      </HStack>
    );
  };

  const renderAddImageContent = () => (
    <VStack className="space-y-4 p-4">
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
        <Box className="items-center">
          <Image
            source={{ uri: selectedImage }}
            className="h-64 w-full rounded-lg"
            resizeMode="contain"
          />
          <Input className="mt-4 w-full">
            <InputField
              placeholder={t('callImages.image_name')}
              value={newImageName}
              onChangeText={setNewImageName}
            />
          </Input>
          <Button
            className="mt-4 w-full"
            onPress={handleUploadImage}
            isDisabled={isUploading}
          >
            <ButtonText>
              {isUploading ? t('common.uploading') : t('callImages.upload')}
            </ButtonText>
          </Button>
        </Box>
      ) : (
        <VStack className="space-y-4">
          <ActionsheetItem onPress={handleImageSelect}>
            <HStack className="items-center space-x-2">
              <PlusIcon size={20} />
              <ActionsheetItemText>
                {t('callImages.select_from_gallery')}
              </ActionsheetItemText>
            </HStack>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleCameraCapture}>
            <HStack className="items-center space-x-2">
              <CameraIcon size={20} />
              <ActionsheetItemText>
                {t('callImages.take_photo')}
              </ActionsheetItemText>
            </HStack>
          </ActionsheetItem>
        </VStack>
      )}
    </VStack>
  );

  const renderImageGallery = () => {
    if (!callImages?.length) return null;

    return (
      <VStack className="space-y-4 p-4">
        <Box className="relative">
          <FlatList
            ref={flatListRef}
            data={callImages.filter((item) => item && item.Url)}
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
                <Text className="text-center text-gray-500">
                  {t('callImages.no_images')}
                </Text>
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
      return (
        <ZeroState
          heading={t('callImages.error')}
          description={errorImages}
          isError={true}
        />
      );
    }

    if (isAddingImage) {
      return renderAddImageContent();
    }

    if (!callImages || callImages.length === 0) {
      return (
        <ZeroState
          icon={ImageIcon}
          heading={t('callImages.no_images')}
          description={t('callImages.no_images_description')}
        />
      );
    }

    return renderImageGallery();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[67]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="rounded-t-3xl bg-white">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <Box className="w-full p-4">
          <HStack className="mb-4 items-center justify-between">
            <Text className="text-xl font-bold">{t('callImages.title')}</Text>
            {!isAddingImage && !isLoadingImages && (
              <Button
                size="sm"
                variant="outline"
                onPress={() => setIsAddingImage(true)}
              >
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
