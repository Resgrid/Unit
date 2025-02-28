import React, { useState, useRef, useEffect } from 'react';
import { FlatList, Image, Dimensions, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon, PlusIcon, XIcon } from 'lucide-react-native';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { Loading } from '@/components/ui/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '../ui/box';
import { HStack } from '../ui/hstack';
import { VStack } from '../ui/vstack';
import { Input, InputField } from '../ui/input';
import { Button, ButtonText, ButtonIcon } from '../ui/button';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '../ui/actionsheet';
import { Text } from '../ui/text';

interface CallImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

interface CallImage {
  id: string;
  url: string;
  name: string;
  timestamp: string;
}

const { width } = Dimensions.get('window');

const CallImagesModal: React.FC<CallImagesModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageName, setNewImageName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  const { callImages, isLoadingImages, errorImages, fetchCallImages, uploadCallImage } = useCallDetailStore();

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallImages(callId);
    }
  }, [isOpen, callId, fetchCallImages]);

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
      await uploadCallImage(callId, selectedImage, newImageName || t('call_images.default_name'));
      setSelectedImage(null);
      setNewImageName('');
      setIsAddingImage(false);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const renderImageItem = ({ item, index }: { item: CallImage; index: number }) => (
    <Box className="w-full items-center justify-center">
      <Image
        source={{ uri: item.url }}
        className="w-full h-64 rounded-lg"
        resizeMode="contain"
      />
      <Text className="mt-2 text-center font-medium">{item.name}</Text>
      <Text className="text-xs text-gray-500">{item.timestamp}</Text>
    </Box>
  );

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const renderPagination = () => {
    if (!callImages || callImages.length <= 1) return null;
    
    return (
      <HStack className="justify-center mt-2 space-x-1">
        {callImages.map((_, index) => (
          <Box
            key={index}
            className={`h-2 w-2 rounded-full ${
              index === activeIndex ? 'bg-primary' : 'bg-gray-300'
            }`}
          />
        ))}
      </HStack>
    );
  };

  const renderContent = () => {
    if (isLoadingImages) {
      return <Loading />;
    }

    if (errorImages) {
      return (
        <ZeroState
          heading={t('call_images.error')}
          description={errorImages}
          isError={true}
        />
      );
    }

    if (isAddingImage) {
      return (
        <VStack className="p-4 space-y-4">
          <HStack className="justify-between items-center">
            <Text className="text-lg font-bold">{t('call_images.add_new')}</Text>
            <TouchableOpacity onPress={() => {
              setIsAddingImage(false);
              setSelectedImage(null);
              setNewImageName('');
            }}>
              <XIcon size={24} />
            </TouchableOpacity>
          </HStack>
          
          {selectedImage ? (
            <Box className="items-center">
              <Image
                source={{ uri: selectedImage }}
                className="w-full h-64 rounded-lg"
                resizeMode="contain"
              />
              <Input className="mt-4 w-full">
                <InputField
                  placeholder={t('call_images.image_name')}
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
                  {isUploading ? t('common.uploading') : t('call_images.upload')}
                </ButtonText>
              </Button>
            </Box>
          ) : (
            <VStack className="space-y-4">
              <ActionsheetItem onPress={handleImageSelect}>
                <HStack className="items-center space-x-2">
                  <PlusIcon size={20} />
                  <ActionsheetItemText>{t('call_images.select_from_gallery')}</ActionsheetItemText>
                </HStack>
              </ActionsheetItem>
              <ActionsheetItem onPress={handleCameraCapture}>
                <HStack className="items-center space-x-2">
                  <CameraIcon size={20} />
                  <ActionsheetItemText>{t('call_images.take_photo')}</ActionsheetItemText>
                </HStack>
              </ActionsheetItem>
            </VStack>
          )}
        </VStack>
      );
    }

    if (!callImages || callImages.length === 0) {
      return (
        <ZeroState
          heading={t('call_images.no_images')}
          description={t('call_images.no_images_description')}
        />
      );
    }

    return (
      <VStack className="p-4 space-y-4">
        <FlatList
          ref={flatListRef}
          data={callImages}
          renderItem={renderImageItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          snapToInterval={width}
          decelerationRate="fast"
          className="w-full"
        />
        {renderPagination()}
      </VStack>
    );
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[40]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white rounded-t-3xl">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        
        <Box className="w-full p-4">
          <HStack className="justify-between items-center mb-4">
            <Text className="text-xl font-bold">
              {t('call_images.title')}
            </Text>
            {!isAddingImage && (
              <Button
                size="sm"
                variant="outline"
                onPress={() => setIsAddingImage(true)}
              >
                <ButtonIcon as={PlusIcon} />
                <ButtonText>{t('call_images.add')}</ButtonText>
              </Button>
            )}
          </HStack>
          
          <View className="min-h-[300px]">
            {renderContent()}
          </View>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default CallImagesModal; 