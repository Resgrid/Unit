import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FileIcon, ShareIcon, X, XIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Platform, TouchableOpacity, useWindowDimensions } from 'react-native';

import ZeroState from '@/components/common/zero-state';
import { useAuthStore } from '@/lib';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { Loading } from '../common/loading';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonText } from '../ui/button';
import { Heading } from '../ui/heading';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface CallFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const CallFilesModal: React.FC<CallFilesModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const [isUploading, setIsUploading] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  // Get data from stores
  const { profile } = useAuthStore();
  const { call, callFiles, isLoadingFiles, errorFiles, fetchCallFiles } = useCallDetailStore();

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallFiles(callId);
    }
  }, [isOpen, callId, fetchCallFiles]);

  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      setNewFileName(file.name);
      // Here you would handle the file upload logic
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert(t('common.error'), t('call_detail.files.select_error'));
    }
  };

  const handleUploadFile = async () => {
    if (!newFileName) {
      Alert.alert(t('common.error'), t('call_detail.files.name_required'));
      return;
    }

    setIsUploading(true);
    try {
      // This will need to be replaced with the actual upload function
      // await useCallDetailStore.getState().uploadCallFile(
      //   callId,
      //   profile?.sub || '',
      //   '',
      //   newFileName,
      //   null,
      //   null,
      //   fileData
      // );

      // Mock successful upload
      setTimeout(() => {
        setIsUploading(false);
        setIsAddingFile(false);
        setNewFileName('');
        fetchCallFiles(callId);
      }, 1500);
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsUploading(false);
      Alert.alert(t('common.error'), t('call_detail.files.upload_error'));
    }
  };

  const handleOpenFile = async (file: CallFileResultData) => {
    setIsDownloading({ ...isDownloading, [file.Id]: true });
    setDownloadProgress({ ...downloadProgress, [file.Id]: 0 });

    try {
      // Download the file
      const fileUri = `${FileSystem.cacheDirectory}${file.FileName}`;

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists) {
        // Download the file
        await FileSystem.downloadAsync(file.Url, fileUri);
      }

      // Open the file with the appropriate app
      if (Platform.OS === 'ios') {
        // On iOS, we'll use the share sheet which can also be used to open files
        await Sharing.shareAsync(fileUri);
      } else {
        // For Android, we'll use the file system's URL
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert(t('common.error'), t('call_detail.files.open_error'));
    } finally {
      setIsDownloading({ ...isDownloading, [file.Id]: false });
    }
  };

  const handleShareFile = async (file: CallFileResultData) => {
    setIsDownloading({ ...isDownloading, [file.Id]: true });
    setDownloadProgress({ ...downloadProgress, [file.Id]: 0 });

    try {
      // Download the file
      const fileUri = `${FileSystem.cacheDirectory}${file.FileName}`;

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists) {
        // Download the file
        await FileSystem.downloadAsync(file.Url, fileUri);
      }

      // Share the file
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert(t('common.error'), t('call_detail.files.share_error'));
    } finally {
      setIsDownloading({ ...isDownloading, [file.Id]: false });
    }
  };

  const renderFileItem = ({ item }: { item: CallFileResultData }) => {
    const isDownloadingFile = isDownloading[item.Id] || false;
    const progress = downloadProgress[item.Id] || 0;

    return (
      <Box className={`mb-2 rounded-lg p-3 ${Platform.OS === 'ios' ? 'bg-neutral-100 dark:bg-neutral-800' : 'bg-neutral-200 dark:bg-neutral-700'}`}>
        <HStack className="items-center justify-between">
          <HStack className="flex-1 items-center space-x-2">
            <FileIcon size={24} />
            <VStack className="flex-1">
              <Text className="font-medium" numberOfLines={1}>
                {item.Name}
              </Text>
              <Text className="text-xs text-gray-500">{item.FileName}</Text>
              <Text className="text-xs text-gray-500">
                {(item.Size / 1024).toFixed(0)} KB • {new Date(item.Timestamp).toLocaleString()}
              </Text>
            </VStack>
          </HStack>

          <HStack className="space-x-2">
            {isDownloadingFile ? (
              <Box className="size-8 items-center justify-center">
                <Text className="text-xs">{progress}%</Text>
              </Box>
            ) : (
              <>
                <TouchableOpacity onPress={() => handleOpenFile(item)} className="size-8 items-center justify-center rounded-full bg-primary-500">
                  <FileIcon size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleShareFile(item)} className="size-8 items-center justify-center rounded-full bg-primary-500">
                  <ShareIcon size={16} color="white" />
                </TouchableOpacity>
              </>
            )}
          </HStack>
        </HStack>
      </Box>
    );
  };

  const renderAddFileContent = () => (
    <Box className="p-4">
      <HStack className="mb-4 items-center justify-between">
        <Heading size="sm">{t('call_detail.files.add_file')}</Heading>
        <TouchableOpacity onPress={() => setIsAddingFile(false)}>
          <XIcon size={24} />
        </TouchableOpacity>
      </HStack>

      <VStack className="space-y-4">
        <Input>
          <InputField placeholder={t('call_detail.files.file_name')} value={newFileName} onChangeText={setNewFileName} />
        </Input>

        <Button onPress={handleFileSelect} variant="outline" className="mb-2">
          <ButtonText>{t('call_detail.files.select_file')}</ButtonText>
        </Button>

        <Button onPress={handleUploadFile} isDisabled={!newFileName || isUploading}>
          <ButtonText>{t('common.upload')}</ButtonText>
        </Button>
      </VStack>
    </Box>
  );

  const renderFilesList = () => {
    return (
      <>
        <Box className="w-full flex-row items-center justify-between border-b border-gray-200 px-4 pb-4 pt-2 dark:border-gray-700">
          <Heading size="lg">{t('call_detail.files.title')}</Heading>
          <Button variant="link" onPress={onClose} className="p-1">
            <X size={24} />
          </Button>
          {/* <Button size="sm" variant="outline" onPress={() => setIsAddingFile(true)} className="h-8">
            <ButtonIcon as={PlusIcon} />
            <ButtonText>{t('common.add')}</ButtonText>
          </Button> */}
        </Box>

        <Box className="w-full p-4">
          {isLoadingFiles ? (
            <Loading />
          ) : errorFiles ? (
            <ZeroState heading={t('call_detail.files.error')} description={errorFiles} isError={true} />
          ) : callFiles?.length === 0 ? (
            <ZeroState heading={t('call_detail.files.empty')} description={t('call_detail.files.empty_description')} icon={FileIcon} />
          ) : (
            <FlatList data={callFiles || []} renderItem={renderFileItem} keyExtractor={(item) => item.Id} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }} />
          )}
        </Box>
      </>
    );
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[66]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="rounded-t-3x bg-white dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {isAddingFile ? renderAddFileContent() : renderFilesList()}
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default CallFilesModal;
