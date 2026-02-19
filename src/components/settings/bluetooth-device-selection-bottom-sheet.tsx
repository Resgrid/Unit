import { BluetoothIcon, RefreshCwIcon, WifiIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, useWindowDimensions } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { usePreferredBluetoothDevice } from '@/lib/hooks/use-preferred-bluetooth-device';
import { logger } from '@/lib/logging';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { type BluetoothAudioDevice, State, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';

import { CustomBottomSheet } from '../ui/bottom-sheet';

interface BluetoothDeviceSelectionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothDeviceSelectionBottomSheet({ isOpen, onClose }: BluetoothDeviceSelectionBottomSheetProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { preferredDevice, setPreferredDevice } = usePreferredBluetoothDevice();
  const availableDevices = useBluetoothAudioStore((s) => s.availableDevices);
  const isScanning = useBluetoothAudioStore((s) => s.isScanning);
  const bluetoothState = useBluetoothAudioStore((s) => s.bluetoothState);
  const connectedDevice = useBluetoothAudioStore((s) => s.connectedDevice);
  const connectionError = useBluetoothAudioStore((s) => s.connectionError);
  const [hasScanned, setHasScanned] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const preferredDeviceDisplayName = preferredDevice?.id === 'system-audio' ? t('bluetooth.system_audio') : preferredDevice?.name;

  const startScan = React.useCallback(async () => {
    try {
      setHasScanned(true);
      await bluetoothAudioService.startScanning(10000); // 10 second scan
    } catch (error) {
      setHasScanned(false); // Reset scan state on error
      logger.error({
        message: 'Failed to start Bluetooth scan',
        context: { error },
      });

      Alert.alert(t('bluetooth.scan_error_title'), error instanceof Error ? error.message : t('bluetooth.scan_error_message'), [{ text: t('common.ok') }]);
    }
  }, [t]);

  // Start scanning when sheet opens
  useEffect(() => {
    if (isOpen && !hasScanned) {
      startScan();
    }
  }, [isOpen, hasScanned, startScan]);

  const handleDeviceSelect = React.useCallback(
    async (device: BluetoothAudioDevice) => {
      try {
        // Disconnect from any currently connected device first?
        // The service connectToDevice usually handles this or we do it here.
        // Previous code did disconnect manually.
        /*
        if (connectedDevice) {
           ... disconnect ...
        }
        */
        // User wants "When attempting to connect... display loading".
        // User wants "If error... don't save device".

        // 1. Set connecting state
        // We can resolve this by using local state for the specific device being connected to,
        // or rely on store's global isConnecting.
        // Let's use the store's setIsConnecting to be consistent if the UI uses it.
        useBluetoothAudioStore.getState().setIsConnecting(true);
        setConnectingDeviceId(device.id);

        // 2. Clear existing preferred temporarily? Or just wait?
        // User said "don't save the save device, only do that when connection is successful".
        // So we shouldn't touch preferredDevice yet.

        logger.info({
          message: 'Attempting to connect to Bluetooth device',
          context: { deviceId: device.id, deviceName: device.name },
        });

        // 3. Connect
        await bluetoothAudioService.connectToDevice(device.id);

        // 4. Success handling
        logger.info({
          message: 'Successfully connected to new Bluetooth device',
          context: { deviceId: device.id },
        });

        // Set as preferred only on success
        const selectedDevice = {
          id: device.id,
          name: device.name || t('bluetooth.unknown_device'),
        };
        await setPreferredDevice(selectedDevice);

        // Sound is handled by service or we can ensure it here:
        // await audioService.playConnectedToAudioRoomSound(); // If service doesn't do it.
        // Checking previous logs, service seems to play "connectedDevice".

        onClose();
      } catch (error) {
        logger.warn({
          message: 'Failed to connect to device',
          context: { error, deviceId: device.id },
        });

        // 5. Error handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        showMessage({
          message: t('bluetooth.connection_error_title') || 'Connection Failed',
          description: errorMessage === 'Device disconnected' ? t('bluetooth.device_disconnected') : errorMessage || t('bluetooth.connection_error_message') || 'Could not connect to device',
          type: 'danger',
          duration: 4000,
        });
        // Keep sheet open (don't call onClose)
      } finally {
        useBluetoothAudioStore.getState().setIsConnecting(false);
        setConnectingDeviceId(null);
      }
    },
    [setPreferredDevice, onClose, t]
  );

  const handleClearSelection = React.useCallback(async () => {
    try {
      await bluetoothAudioService.reset();
      await setPreferredDevice(null);
      onClose();
    } catch (error) {
      logger.error({
        message: 'Failed to clear preferred Bluetooth device',
        context: { error },
      });
    }
  }, [setPreferredDevice, onClose]);

  const stopScan = React.useCallback(() => {
    bluetoothAudioService.stopScanning();
  }, []);

  // Stop scanning when component unmounts or dialog closes
  useEffect(() => {
    if (!isOpen && isScanning) {
      stopScan();
    }
  }, [isOpen, isScanning, stopScan]);

  const renderDeviceItem = useCallback(
    ({ item }: { item: BluetoothAudioDevice }) => {
      const isSelected = preferredDevice?.id === item.id;
      const isConnected = connectedDevice?.id === item.id;
      const isConnectingToThisDevice = connectingDeviceId === item.id;

      return (
        <Pressable
          onPress={() => handleDeviceSelect(item)}
          disabled={!!connectingDeviceId}
          className={`mb-2 rounded-lg border p-4 ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'} ${!!connectingDeviceId ? 'opacity-70' : ''}`}
        >
          <HStack className="items-center justify-between">
            <VStack className="flex-1">
              <HStack className="items-center">
                <BluetoothIcon size={16} className="mr-2 text-primary-600" />
                <Text className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-900 dark:text-neutral-100'}`}>{item.name || t('bluetooth.unknown_device')}</Text>
                {isConnected && <WifiIcon size={14} className="ml-2 text-green-600" />}
              </HStack>
              <HStack className="mt-1 items-center">
                {item.rssi && <Text className="text-xs text-neutral-600 dark:text-neutral-400">RSSI: {item.rssi}dBm</Text>}
                {item.supportsMicrophoneControl && <Text className="ml-2 text-xs text-blue-600 dark:text-blue-400">{t('bluetooth.supports_mic_control')}</Text>}
                {item.hasAudioCapability && <Text className="ml-2 text-xs text-green-600 dark:text-green-400">{t('bluetooth.audio_capable')}</Text>}
              </HStack>
            </VStack>
            {isConnectingToThisDevice ? (
              <Spinner size="small" className="text-primary-600" color="#2563EB" />
            ) : isSelected ? (
              <VStack className="items-end">
                <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">{t('bluetooth.selected')}</Text>
                {isConnected && <Text className="text-xs text-green-600 dark:text-green-400">{t('bluetooth.connected')}</Text>}
              </VStack>
            ) : null}
          </HStack>
        </Pressable>
      );
    },
    [preferredDevice, connectedDevice, handleDeviceSelect, t, connectingDeviceId]
  );

  const renderEmptyState = useCallback(() => {
    if (isScanning) {
      return (
        <VStack className="items-center py-8">
          <Spinner size="large" />
          <Text className="mt-4 text-center text-neutral-600 dark:text-neutral-400">{t('bluetooth.scanning')}</Text>
        </VStack>
      );
    }

    return (
      <VStack className="items-center py-8">
        <BluetoothIcon size={48} className="text-neutral-400" />
        <Text className="mt-4 text-center text-neutral-600 dark:text-neutral-400">{hasScanned ? t('bluetooth.no_devices_found') : t('bluetooth.tap_scan_to_find_devices')}</Text>
        <Button onPress={startScan} className="mt-4" variant="outline">
          <ButtonIcon as={RefreshCwIcon} />
          <ButtonText>{t('bluetooth.scan_again')}</ButtonText>
        </Button>
      </VStack>
    );
  }, [isScanning, hasScanned, startScan, t]);

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]} minHeight="min-h-0">
      <VStack className="flex-1 p-4">
        <Heading className="mb-4 text-lg">{t('bluetooth.select_device')}</Heading>

        {/* Current Selection */}
        {preferredDevice && (
          <Box className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
            <HStack className="items-center justify-between">
              <VStack>
                <Text className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{t('bluetooth.current_selection')}</Text>
                <Text className="text-sm text-neutral-600 dark:text-neutral-400">{preferredDeviceDisplayName}</Text>
              </VStack>
              <Button onPress={handleClearSelection} size={isLandscape ? 'sm' : 'xs'} variant="outline">
                <ButtonText className={isLandscape ? '' : 'text-2xs'}>{t('bluetooth.clear')}</ButtonText>
              </Button>
            </HStack>
          </Box>
        )}

        {/* System Audio Option */}
        <Box className="mb-4">
          <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">{t('bluetooth.audio_output')}</Text>
          <Pressable
            onPress={async () => {
              try {
                useBluetoothAudioStore.getState().setIsConnecting(true);
                // We use a dummy ID for loading state tracking if needed, or just rely on global loading
                setConnectingDeviceId('system-audio');

                await bluetoothAudioService.connectToSystemAudio();

                // Update preferred device manually here to ensure UI reflects it immediately
                // preventing race conditions with store updates
                await setPreferredDevice({ id: 'system-audio', name: t('bluetooth.system_audio') });

                onClose();
              } catch (error) {
                logger.error({ message: 'Failed to select System Audio', context: { error } });
                showMessage({
                  message: t('bluetooth.connection_error_title') || 'Selection Failed',
                  description: t('bluetooth.system_audio_error') || 'Could not switch to System Audio',
                  type: 'danger',
                });
              } finally {
                useBluetoothAudioStore.getState().setIsConnecting(false);
                setConnectingDeviceId(null);
              }
            }}
            disabled={!!connectingDeviceId}
            className={`rounded-lg border p-4 ${preferredDevice?.id === 'system-audio' ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'} ${!!connectingDeviceId ? 'opacity-70' : ''}`}
          >
            <HStack className="items-center justify-between">
              <HStack className="items-center">
                <BluetoothIcon size={16} className="mr-2 text-primary-600" />
                <VStack>
                  <Text className={`font-medium ${preferredDevice?.id === 'system-audio' ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-900 dark:text-neutral-100'}`}>{t('bluetooth.system_audio')}</Text>
                  <Text className="text-xs text-neutral-500">{t('bluetooth.system_audio_description')}</Text>
                </VStack>
              </HStack>
              {preferredDevice?.id === 'system-audio' && (
                <VStack className="items-end">
                  <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">{t('bluetooth.selected')}</Text>
                </VStack>
              )}
            </HStack>
          </Pressable>
        </Box>

        {/* Scan Button */}
        <HStack className="mb-4 w-full items-center justify-between">
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">{t('bluetooth.available_devices')}</Text>
          <Button onPress={startScan} disabled={isScanning} size={isLandscape ? 'sm' : 'xs'} variant="outline">
            <ButtonIcon as={RefreshCwIcon} />
            <ButtonText className={isLandscape ? '' : 'text-2xs'}>{isScanning ? t('bluetooth.scanning') : t('bluetooth.scan')}</ButtonText>
          </Button>
        </HStack>

        {/* Device List */}
        <Box className="flex-1">
          <FlatList
            data={availableDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            estimatedItemSize={60}
            extraData={connectingDeviceId}
          />
        </Box>

        {/* Bluetooth State Info */}
        {bluetoothState !== State.PoweredOn && (
          <Box className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900">
            <Text className="text-sm text-yellow-800 dark:text-yellow-200">
              {bluetoothState === State.PoweredOff ? t('bluetooth.poweredOff') : bluetoothState === State.Unauthorized ? t('bluetooth.unauthorized') : t('bluetooth.bluetooth_not_ready', { state: bluetoothState })}
            </Text>
          </Box>
        )}

        {/* Connection Error Display */}
        {connectionError && (
          <Box className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900">
            <Text className="text-sm text-red-800 dark:text-red-200">{connectionError}</Text>
          </Box>
        )}
      </VStack>
    </CustomBottomSheet>
  );
}
