import { Buffer } from 'buffer';
// @ts-ignore - callkeep service might not be resolvable in all contexts without barrel file updates
import { Alert, DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import BleManager, { type BleManagerDidUpdateValueForCharacteristicEvent, BleScanCallbackType, BleScanMatchMode, BleScanMode, type BleState, type Peripheral, type PeripheralInfo } from 'react-native-ble-manager';

import { logger } from '@/lib/logging';
import { audioService } from '@/services/audio.service';
import { callKeepService } from '@/services/callkeep.service';
import { type AudioButtonEvent, type BluetoothAudioDevice, type Device, State, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
// Lazy getters to avoid circular dependencies with livekit-store and useLiveKitCallStore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLiveKitCallStore = (): any => {
  // Using import() for lazy loading to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/features/livekit-call/store/useLiveKitCallStore').useLiveKitCallStore;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLiveKitStore = (): any => {
  // Using import() for lazy loading to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/stores/app/livekit-store').useLiveKitStore;
};

// Standard Bluetooth UUIDs for audio services
const AUDIO_SERVICE_UUID = '0000110A-0000-1000-8000-00805F9B34FB'; // Advanced Audio Distribution Profile
const A2DP_SOURCE_UUID = '0000110A-0000-1000-8000-00805F9B34FB';
const HFP_SERVICE_UUID = '0000111E-0000-1000-8000-00805F9B34FB'; // Hands-Free Profile
const HSP_SERVICE_UUID = '00001108-0000-1000-8000-00805F9B34FB'; // Headset Profile

const AINA_HEADSET = 'D11C8116-A913-434D-A79D-97AE94A529B3';
const AINA_HEADSET_SERVICE = '127FACE1-CB21-11E5-93D0-0002A5D5C51B';
const AINA_HEADSET_SVC_PROP = '127FBEEF-CB21-11E5-93D0-0002A5D5C51B';

const B01INRICO_HEADSET = '2BD21C44-0198-4B92-9110-D622D53D8E37';
//const B01INRICO_HEADSET_SERVICE = '6666';
const B01INRICO_HEADSET_SERVICE = '00006666-0000-1000-8000-00805F9B34FB';
//const B01INRICO_HEADSET_SERVICE_CHAR = '8888';
const B01INRICO_HEADSET_SERVICE_CHAR = '00008888-0000-1000-8000-00805F9B34FB';

const HYS_HEADSET = '3CD31C55-A914-435E-B80E-98AF95B630C4';
const HYS_HEADSET_SERVICE = '0000FFE0-0000-1000-8000-00805F9B34FB';
//const HYS_HEADSET_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
//const HYS_HEADSET_SERVICE_CHAR = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
const HYS_HEADSET_SERVICE_CHAR = '00002902-0000-1000-8000-00805F9B34FB';

// Common button control characteristic UUIDs (varies by manufacturer)
const BUTTON_CONTROL_UUIDS = [
  '0000FE59-0000-1000-8000-00805F9B34FB', // Common button control
  '0000180F-0000-1000-8000-00805F9B34FB', // Battery Service (often includes button data)
  '00001812-0000-1000-8000-00805F9B34FB', // Human Interface Device Service
];

class BluetoothAudioService {
  private static instance: BluetoothAudioService;
  private connectedDevice: Device | null = null;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private hasAttemptedPreferredDeviceConnection: boolean = false;
  private eventListeners: { remove: () => void }[] = [];
  private readonly isWeb = Platform.OS === 'web';
  private monitoringStartedAt: number | null = null;
  private monitoringWatchdogInterval: ReturnType<typeof setInterval> | null = null;
  private readPollingInterval: ReturnType<typeof setInterval> | null = null;
  private isReadPollingInFlight: boolean = false;
  private monitoredReadCharacteristics: { serviceUuid: string; characteristicUuid: string; lastHexValue: string | null }[] = [];
  private mediaButtonEventListener: { remove: () => void } | null = null;
  private mediaButtonListeningActive: boolean = false;
  private pttPressActive: boolean = false;
  private pttReleaseFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private micApplyRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryMicEnabled: boolean | null = null;
  private pendingMicEnabled: boolean | null = null;
  private isApplyingMicState: boolean = false;

  static getInstance(): BluetoothAudioService {
    if (!BluetoothAudioService.instance) {
      BluetoothAudioService.instance = new BluetoothAudioService();
    }
    return BluetoothAudioService.instance;
  }

  /**
   * Initialize the Bluetooth service and attempt to connect to the preferred device
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // BLE is not available on web — skip initialization entirely
    if (Platform.OS === 'web') {
      logger.info({
        message: 'Bluetooth Audio Service not available on web, skipping initialization',
      });
      this.isInitialized = true;
      return;
    }

    try {
      // Initialize BLE Manager
      await BleManager.start({ showAlert: false });
      this.setupEventListeners();

      this.isInitialized = true;

      // Check if we have permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        logger.warn({
          message: 'Bluetooth permissions not granted, skipping initialization',
        });
        return;
      }

      // Check Bluetooth state
      const state = await this.checkBluetoothState();
      if (state !== State.PoweredOn) {
        logger.info({
          message: 'Bluetooth not powered on, skipping initialization',
          context: { state },
        });
        return;
      }

      // Attempt to connect to preferred device
      await this.attemptPreferredDeviceConnection();
    } catch (error) {
      logger.error({
        message: 'Failed to initialize Bluetooth Audio Service',
        context: { error },
      });
    }
  }

  /**
   * Attempt to connect to a preferred device from storage.
   * This method can only be called once per service instance.
   */
  private async attemptPreferredDeviceConnection(): Promise<void> {
    // Prevent multiple calls to this method
    if (this.hasAttemptedPreferredDeviceConnection) {
      logger.debug({
        message: 'Preferred device connection already attempted, skipping',
      });
      return;
    }

    this.hasAttemptedPreferredDeviceConnection = true;

    try {
      // Load preferred device from storage
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getItem } = require('@/lib/storage');
      const preferredDevice: { id: string; name: string } | null = getItem('preferredBluetoothDevice');

      if (preferredDevice) {
        logger.info({
          message: 'Found preferred Bluetooth device, attempting to connect',
          context: { deviceId: preferredDevice.id, deviceName: preferredDevice.name },
        });

        // Set the preferred device in the store
        useBluetoothAudioStore.getState().setPreferredDevice(preferredDevice);

        if (preferredDevice.id === 'system-audio') {
          logger.info({
            message: 'Preferred device is System Audio, ensuring no specialized device is connected',
          });
          // We are already in system audio mode by default if no device is connected
          return;
        }

        // Try to connect directly to the preferred device
        try {
          await this.connectToDevice(preferredDevice.id);
          logger.info({
            message: 'Successfully connected to preferred Bluetooth device',
            context: { deviceId: preferredDevice.id },
          });
        } catch (error) {
          logger.warn({
            message: 'Failed to connect to preferred Bluetooth device, will scan for it',
            context: { deviceId: preferredDevice.id, error },
          });

          // If direct connection fails, start scanning to find the device
          this.startScanning(5000); // 5 second scan
        }
      } else {
        logger.info({
          message: 'No preferred Bluetooth device found',
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to attempt preferred device connection',
        context: { error },
      });
    }
  }

  private addEventListener(listener: { remove: () => void }): void {
    if (!this.eventListeners.includes(listener)) {
      this.eventListeners.push(listener);
    }
  }

  private removeEventListener(listener: { remove: () => void } | null): void {
    if (!listener) {
      return;
    }

    this.eventListeners = this.eventListeners.filter((registeredListener) => registeredListener !== listener);
  }

  private setupEventListeners(): void {
    // Bluetooth state change listener
    const stateListener = BleManager.onDidUpdateState(this.handleBluetoothStateChange.bind(this));
    this.addEventListener(stateListener);

    // Device disconnection listener
    const disconnectListener = BleManager.onDisconnectPeripheral(this.handleDeviceDisconnected.bind(this));
    this.addEventListener(disconnectListener);

    // Device discovered listener
    const discoverListener = BleManager.onDiscoverPeripheral(this.handleDeviceDiscovered.bind(this));
    this.addEventListener(discoverListener);

    // Characteristic value update listener
    const valueUpdateListener = BleManager.onDidUpdateValueForCharacteristic(this.handleCharacteristicValueUpdate.bind(this));
    this.addEventListener(valueUpdateListener);

    // Stop scan listener
    const stopScanListener = BleManager.onStopScan(this.handleScanStopped.bind(this));
    this.addEventListener(stopScanListener);
  }

  private handleBluetoothStateChange(args: { state: BleState }): void {
    const state = this.mapBleStateToState(args.state);

    logger.info({
      message: 'Bluetooth state changed',
      context: { state },
    });

    useBluetoothAudioStore.getState().setBluetoothState(state);

    if (state === State.PoweredOff || state === State.Unauthorized) {
      this.handleBluetoothDisabled();
    } else if (state === State.PoweredOn && this.isInitialized && !this.hasAttemptedPreferredDeviceConnection) {
      // If Bluetooth is turned back on, try to reconnect to preferred device
      this.attemptReconnectToPreferredDevice();
    }
  }

  private mapBleStateToState(bleState: BleState): State {
    switch (bleState) {
      case 'on':
        return State.PoweredOn;
      case 'off':
        return State.PoweredOff;
      case 'turning_on':
        return State.Resetting;
      case 'turning_off':
        return State.Resetting;
      default:
        return State.Unknown;
    }
  }

  private handleDeviceDiscovered(device: Peripheral): void {
    if (!device || !device.id || !device.advertising || !device.advertising.isConnectable) {
      return;
    }

    // Define RSSI threshold for strong signals (typical range: -100 to -20 dBm)
    const STRONG_RSSI_THRESHOLD = -95; // Relaxed threshold to improve discovery

    // Check RSSI signal strength - only proceed with strong signals
    if (!device.rssi || device.rssi < STRONG_RSSI_THRESHOLD) {
      logger.debug({
        message: 'Device ignored due to weak RSSI',
        context: { deviceId: device.id, rssi: device.rssi, threshold: STRONG_RSSI_THRESHOLD },
      });
      return;
    }

    // Log discovered device for debugging
    logger.debug({
      message: 'Device discovered during scan with strong RSSI',
      context: {
        deviceId: device.id,
        deviceName: device.name,
        rssi: device.rssi,
        advertising: device.advertising,
      },
    });

    // Check if this is an audio device
    if (this.isAudioDevice(device)) {
      this.handleDeviceFound(device);
    }
  }

  private handleCharacteristicValueUpdate(data: BleManagerDidUpdateValueForCharacteristicEvent): void {
    // Convert the value array to a base64 string to match the old API
    const value = Buffer.from(data.value).toString('base64');

    if (this.connectedDevice && data.peripheral !== this.connectedDevice.id) {
      return;
    }

    // Handle button events based on service and characteristic UUIDs
    this.handleButtonEventFromCharacteristic(data.peripheral, data.service, data.characteristic, value);
  }

  private handleScanStopped(): void {
    useBluetoothAudioStore.getState().setIsScanning(false);
    logger.info({
      message: 'Bluetooth scan stopped',
    });
  }

  private handleButtonEventFromCharacteristic(peripheralId: string, serviceUuid: string, characteristicUuid: string, value: string): void {
    // Route to appropriate handler based on service/characteristic
    if (this.areUuidsEqual(serviceUuid, AINA_HEADSET_SERVICE) && this.areUuidsEqual(characteristicUuid, AINA_HEADSET_SVC_PROP)) {
      this.handleAinaButtonEvent(value);
    } else if (this.areUuidsEqual(serviceUuid, B01INRICO_HEADSET_SERVICE) && this.areUuidsEqual(characteristicUuid, B01INRICO_HEADSET_SERVICE_CHAR)) {
      this.handleB01InricoButtonEvent(value);
    } else if (this.areUuidsEqual(serviceUuid, HYS_HEADSET_SERVICE) && this.areUuidsEqual(characteristicUuid, HYS_HEADSET_SERVICE_CHAR)) {
      this.handleHYSButtonEvent(value);
    } else if (BUTTON_CONTROL_UUIDS.some((uuid) => this.areUuidsEqual(characteristicUuid, uuid))) {
      this.handleGenericButtonEvent(value);
    } else if (this.connectedDevice && this.connectedDevice.id === peripheralId && this.getDeviceType(this.connectedDevice) === 'specialized' && this.isLikelyButtonCharacteristic(serviceUuid, characteristicUuid)) {
      this.handleGenericButtonEvent(value);
    } else if (this.connectedDevice && this.connectedDevice.id === peripheralId && this.getDeviceType(this.connectedDevice) === 'specialized') {
      logger.debug({
        message: 'Ignoring characteristic update for specialized device (not identified as button control)',
        context: {
          peripheralId,
          serviceUuid,
          characteristicUuid,
        },
      });
    }
  }

  private async attemptReconnectToPreferredDevice(): Promise<void> {
    logger.info({
      message: 'Bluetooth turned on, attempting preferred device connection',
    });

    // Reset the flag to allow reconnection attempt
    this.hasAttemptedPreferredDeviceConnection = false;

    // Attempt preferred device connection
    await this.attemptPreferredDeviceConnection();
  }

  private handleBluetoothDisabled(): void {
    this.stopScanning();
    this.disconnectDevice();
    useBluetoothAudioStore.getState().clearDevices();
  }

  async requestPermissions(): Promise<boolean> {
    if (this.isWeb) return true;
    if (Platform.OS === 'android') {
      try {
        const permissions = [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT, PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

        const results = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(results).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);

        logger.info({
          message: 'Bluetooth permissions requested',
          context: { results, allGranted },
        });

        return allGranted;
      } catch (error) {
        logger.error({
          message: 'Failed to request Bluetooth permissions',
          context: { error },
        });
        return false;
      }
    }
    return true; // iOS permissions are handled via Info.plist
  }

  async checkBluetoothState(): Promise<State> {
    if (this.isWeb) return State.PoweredOff;
    try {
      const bleState = await BleManager.checkState();
      return this.mapBleStateToState(bleState);
    } catch (error) {
      logger.error({
        message: 'Failed to check Bluetooth state',
        context: { error },
      });
      return State.Unknown;
    }
  }

  async startScanning(durationMs: number = 10000): Promise<void> {
    if (this.isWeb) return;
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted');
    }

    const state = await this.checkBluetoothState();
    if (state !== State.PoweredOn) {
      throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
    }

    if (useBluetoothAudioStore.getState().isScanning) {
      logger.warn({ message: 'Scan already in progress, ignoring request', context: { durationMs } });
      return;
    }

    useBluetoothAudioStore.getState().setIsScanning(true);
    useBluetoothAudioStore.getState().clearDevices();

    logger.info({
      message: 'Starting Bluetooth audio device scan',
      context: { durationMs },
    });

    try {
      // Start scanning for all devices - filtering will be done in the discovery handler
      await BleManager.scan([], durationMs / 1000, false, {
        matchMode: BleScanMatchMode.Sticky,
        scanMode: BleScanMode.LowLatency,
        callbackType: BleScanCallbackType.AllMatches,
      });

      // Set timeout to update UI when scan completes
      this.scanTimeout = setTimeout(() => {
        this.handleScanStopped();

        logger.info({
          message: 'Bluetooth scan completed',
          context: {
            durationMs,
            devicesFound: useBluetoothAudioStore.getState().availableDevices.length,
          },
        });
      }, durationMs);
    } catch (error) {
      logger.error({
        message: 'Failed to start Bluetooth scan',
        context: { error },
      });
      useBluetoothAudioStore.getState().setIsScanning(false);
      throw error;
    }
  }

  /**
   * Debug method to scan for ALL devices with detailed logging
   * Use this for troubleshooting device discovery issues
   */
  async startDebugScanning(durationMs: number = 15000): Promise<void> {
    if (this.isWeb) return;
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted');
    }

    const state = await this.checkBluetoothState();
    if (state !== State.PoweredOn) {
      throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
    }

    // Stop any existing scan first
    await this.stopScanning();

    useBluetoothAudioStore.getState().setIsScanning(true);
    useBluetoothAudioStore.getState().clearDevices();

    logger.info({
      message: 'Starting DEBUG Bluetooth device scan (all devices)',
      context: { durationMs },
    });

    try {
      // Start scanning for all devices with detailed logging
      await BleManager.scan([], durationMs / 1000, true); // Allow duplicates for debugging

      // Set timeout to update UI when scan completes
      this.scanTimeout = setTimeout(() => {
        this.handleScanStopped();

        logger.info({
          message: 'DEBUG: Bluetooth scan completed',
          context: {
            durationMs,
            totalDevicesFound: useBluetoothAudioStore.getState().availableDevices.length,
          },
        });
      }, durationMs);
    } catch (error) {
      logger.error({
        message: 'Failed to start DEBUG Bluetooth scan',
        context: { error },
      });
      useBluetoothAudioStore.getState().setIsScanning(false);
      throw error;
    }
  }

  private isAudioDevice(device: Device): boolean {
    const name = device.name?.toLowerCase() || '';
    const audioKeywords = ['speaker', 'headset', 'earbuds', 'headphone', 'audio', 'mic', 'sound', 'wireless', 'bluetooth', 'bt', 'aina', 'inrico', 'hys', 'b01', 'ptt'];

    // Check if device name contains audio-related keywords
    const hasAudioKeyword = audioKeywords.some((keyword) => name.includes(keyword));

    // Check if device has audio service UUIDs - use advertising data
    const advertisingData = device.advertising;
    const hasAudioService =
      advertisingData?.serviceUUIDs?.some((uuid: string) => {
        const upperUuid = uuid.toUpperCase();
        return [AUDIO_SERVICE_UUID, HFP_SERVICE_UUID, HSP_SERVICE_UUID, AINA_HEADSET_SERVICE, B01INRICO_HEADSET_SERVICE, HYS_HEADSET_SERVICE].includes(upperUuid);
      }) || false;

    // Check manufacturer data for known audio device manufacturers
    const hasAudioManufacturerData = advertisingData?.manufacturerData ? this.hasAudioManufacturerData(advertisingData.manufacturerData) : false;

    // Check service data for audio device indicators
    const hasAudioServiceData = advertisingData?.serviceData ? this.hasAudioServiceData(advertisingData.serviceData) : false;

    // Log device details for debugging
    logger.debug({
      message: 'Evaluating device for audio capability',
      context: {
        deviceId: device.id,
        deviceName: device.name,
        hasAudioKeyword,
        hasAudioService,
        hasAudioManufacturerData,
        hasAudioServiceData,
        serviceUUIDs: advertisingData?.serviceUUIDs,
        manufacturerData: advertisingData?.manufacturerData,
        serviceData: advertisingData?.serviceData,
      },
    });

    return hasAudioKeyword || hasAudioService || hasAudioManufacturerData || hasAudioServiceData;
  }

  private hasAudioManufacturerData(manufacturerData: string | { [key: string]: string } | Record<string, any>): boolean {
    // Known audio device manufacturer IDs (check manufacturer data for audio device indicators)
    // This is a simplified check - you'd need to implement device-specific logic

    if (typeof manufacturerData === 'string') {
      // Simple string check for audio-related manufacturer data
      return manufacturerData.toLowerCase().includes('audio') || manufacturerData.toLowerCase().includes('headset') || manufacturerData.toLowerCase().includes('speaker');
    }

    const audioManufacturerIds = [
      '0x004C', // Apple
      '0x001D', // Qualcomm
      '0x000F', // Broadcom
      '0x0087', // Mediatek
      '0x02E5', // Realtek
    ];

    return Object.keys(manufacturerData).some((key) => audioManufacturerIds.includes(key) || audioManufacturerIds.includes(`0x${key}`));
  }

  private hasAudioServiceData(serviceData: string | { [key: string]: string } | Record<string, any>): boolean {
    try {
      // Service data contains information about the device's capabilities
      // Audio devices often advertise their capabilities in service data

      if (typeof serviceData === 'string') {
        // Try to decode hex string service data
        const decodedData = this.decodeServiceDataString(serviceData);
        return this.analyzeServiceDataForAudio(decodedData);
      }

      if (typeof serviceData === 'object' && serviceData !== null) {
        // Service data is an object with service UUIDs as keys and data as values
        return Object.entries(serviceData).some(([serviceUuid, data]) => {
          if (typeof data !== 'string') {
            return false; // Skip non-string data
          }

          const upperServiceUuid = serviceUuid.toUpperCase();

          // Check if the service UUID itself indicates audio capability
          const isAudioServiceUuid = [
            AUDIO_SERVICE_UUID,
            HFP_SERVICE_UUID,
            HSP_SERVICE_UUID,
            AINA_HEADSET_SERVICE,
            B01INRICO_HEADSET_SERVICE,
            HYS_HEADSET_SERVICE,
            '0000FE59-0000-1000-8000-00805F9B34FB', // Common audio service
            '0000180F-0000-1000-8000-00805F9B34FB', // Battery service (often used by audio devices)
          ].some((uuid) => uuid.toUpperCase() === upperServiceUuid);

          if (isAudioServiceUuid) {
            logger.debug({
              message: 'Found audio service UUID in service data',
              context: {
                serviceUuid: upperServiceUuid,
                data: data,
              },
            });
            return true;
          }

          // Analyze the service data content for audio indicators
          if (typeof data === 'string') {
            const decodedData = this.decodeServiceDataString(data);
            return this.analyzeServiceDataForAudio(decodedData);
          }

          return false;
        });
      }

      return false;
    } catch (error) {
      logger.debug({
        message: 'Error analyzing service data for audio capability',
        context: { error, serviceData },
      });
      return false;
    }
  }

  private getDeviceType(device: Device): 'specialized' | 'system' {
    const advertisingData = device.advertising;
    const serviceUUIDs = advertisingData?.serviceUUIDs || [];

    // Check for specialized PTT service UUIDs
    const isSpecialized = serviceUUIDs.some((uuid: string) => {
      return [AINA_HEADSET_SERVICE, B01INRICO_HEADSET_SERVICE, HYS_HEADSET_SERVICE].some((specialized) => this.areUuidsEqual(uuid, specialized));
    });

    if (isSpecialized) {
      return 'specialized';
    }

    // Check by name for known specialized devices if UUID check fails
    const name = device.name?.toLowerCase() || '';
    if (name.includes('aina') || name.includes('inrico') || name.includes('hys')) {
      return 'specialized';
    }

    return 'system';
  }

  private decodeServiceDataString(data: string): Buffer {
    try {
      // Service data can be in various formats: hex string, base64, etc.
      // Try hex first (most common for BLE advertising data)
      if (/^[0-9A-Fa-f]+$/.test(data)) {
        return Buffer.from(data, 'hex');
      }

      // Try base64
      try {
        return Buffer.from(data, 'base64');
      } catch {
        // Fall back to treating as raw string
        return Buffer.from(data, 'utf8');
      }
    } catch (error) {
      logger.debug({
        message: 'Failed to decode service data string',
        context: { error, data },
      });
      return Buffer.alloc(0);
    }
  }

  private analyzeServiceDataForAudio(data: Buffer): boolean {
    if (!data || data.length === 0) {
      return false;
    }

    try {
      // Convert to hex string for pattern matching
      const hexData = data.toString('hex').toLowerCase();

      // Look for common audio device indicators in service data
      const audioPatterns = [
        // Common audio capability flags (these are example patterns)
        '0001', // Audio sink capability
        '0002', // Audio source capability
        '0004', // Headset capability
        '0008', // Hands-free capability
        '1108', // HSP service class
        '110a', // A2DP sink service class
        '110b', // A2DP source service class
        '111e', // HFP service class
        '1203', // Audio/Video Remote Control Profile
        // Known manufacturer-specific patterns
        'aina', // AINA device identifier
        'inrico', // Inrico device identifier
        'hys', // HYS device identifier
      ];

      const hasAudioPattern = audioPatterns.some((pattern) => hexData.includes(pattern));

      // Check for specific byte patterns that indicate audio capabilities
      const hasAudioCapabilityBytes = this.checkAudioCapabilityBytes(data);

      // Check for device class indicators (if present in service data)
      const hasAudioDeviceClass = this.checkAudioDeviceClass(data);

      logger.debug({
        message: 'Service data audio analysis',
        context: {
          hexData,
          hasAudioPattern,
          hasAudioCapabilityBytes,
          hasAudioDeviceClass,
          dataLength: data.length,
        },
      });

      return hasAudioPattern || hasAudioCapabilityBytes || hasAudioDeviceClass;
    } catch (error) {
      logger.debug({
        message: 'Error in service data audio analysis',
        context: { error },
      });
      return false;
    }
  }

  private checkAudioCapabilityBytes(data: Buffer): boolean {
    // Check for common audio capability indicators in binary data
    if (data.length < 2) return false;

    try {
      // Check for Bluetooth device class indicators (if embedded in service data)
      // Major device class for Audio/Video devices is 0x04
      // Minor device classes include: 0x01 (headset), 0x02 (hands-free), 0x04 (microphone), 0x05 (speaker), etc.

      for (let i = 0; i < data.length - 1; i++) {
        const byte1 = data[i];
        const byte2 = data[i + 1];

        // Check for audio device class patterns
        if ((byte1 & 0x1f) === 0x04) {
          // Major class: Audio/Video
          const minorClass = (byte2 >> 2) & 0x3f;
          if ([0x01, 0x02, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a].includes(minorClass)) {
            logger.debug({
              message: 'Found audio device class in service data',
              context: {
                majorClass: byte1 & 0x1f,
                minorClass,
                position: i,
              },
            });
            return true;
          }
        }

        // Check for HID service class (some audio devices also support HID)
        if (byte1 === 0x05 && byte2 === 0x80) {
          // HID pointing device
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug({
        message: 'Error checking audio capability bytes',
        context: { error },
      });
      return false;
    }
  }

  private checkAudioDeviceClass(data: Buffer): boolean {
    // Look for Bluetooth Device Class (CoD) patterns that indicate audio devices
    if (data.length < 3) return false;

    try {
      // Device class is typically 3 bytes: service classes (2 bytes) + device class (1 byte)
      for (let i = 0; i <= data.length - 3; i++) {
        const cod = (data[i + 2] << 16) | (data[i + 1] << 8) | data[i];

        // Extract major and minor device class
        const majorDeviceClass = (cod >> 8) & 0x1f;
        const minorDeviceClass = (cod >> 2) & 0x3f;

        // Major device class 0x04 = Audio/Video devices
        if (majorDeviceClass === 0x04) {
          logger.debug({
            message: 'Found audio/video device class in service data',
            context: {
              cod: cod.toString(16),
              majorClass: majorDeviceClass,
              minorClass: minorDeviceClass,
              position: i,
            },
          });
          return true;
        }

        // Check service class bits for audio services
        // Service class bits are in bits 13-23 of the 24-bit CoD
        const serviceClasses = (cod >> 13) & 0x7ff;
        const hasAudioService = (serviceClasses & 0x200) !== 0; // Audio bit (bit 21 -> bit 8 in service class)
        const hasRenderingService = (serviceClasses & 0x40) !== 0; // Rendering bit (bit 18 -> bit 5 in service class)

        if (hasAudioService || hasRenderingService) {
          logger.debug({
            message: 'Found audio service class bits in service data',
            context: {
              cod: cod.toString(16),
              hasAudioService,
              hasRenderingService,
              position: i,
            },
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.debug({
        message: 'Error checking audio device class',
        context: { error },
      });
      return false;
    }
  }

  private handleDeviceFound(device: Device): void {
    const audioDevice: BluetoothAudioDevice = {
      id: device.id,
      name: device.name || null,
      rssi: device.rssi || undefined,
      isConnected: false,
      hasAudioCapability: true,
      supportsMicrophoneControl: this.supportsMicrophoneControl(device),
      device,
      type: this.getDeviceType(device),
    };

    logger.info({
      message: 'Audio device found',
      context: {
        deviceId: device.id,
        deviceName: device.name,
        rssi: device.rssi,
        supportsMicControl: audioDevice.supportsMicrophoneControl,
      },
    });

    useBluetoothAudioStore.getState().addDevice(audioDevice);

    // Check if this is the preferred device and auto-connect
    this.checkAndAutoConnectPreferredDevice(audioDevice);
  }

  private async checkAndAutoConnectPreferredDevice(device: BluetoothAudioDevice): Promise<void> {
    const { preferredDevice, connectedDevice } = useBluetoothAudioStore.getState();

    // Only auto-connect if:
    // 1. This is the preferred device
    // 2. No device is currently connected
    // 3. We're not already in the process of connecting
    if (preferredDevice?.id === device.id && !connectedDevice && !this.connectionTimeout) {
      try {
        logger.info({
          message: 'Auto-connecting to preferred Bluetooth device',
          context: { deviceId: device.id, deviceName: device.name },
        });

        await this.connectToDevice(device.id);
      } catch (error) {
        logger.warn({
          message: 'Failed to auto-connect to preferred Bluetooth device',
          context: { deviceId: device.id, error },
        });
      }
    }
  }

  private supportsMicrophoneControl(device: Device): boolean {
    // Check if device likely supports microphone control based on service UUIDs
    const advertisingData = device.advertising;
    const serviceUUIDs = advertisingData?.serviceUUIDs || [];
    return serviceUUIDs.some((uuid: string) => [HFP_SERVICE_UUID, HSP_SERVICE_UUID].includes(uuid.toUpperCase()));
  }

  async stopScanning(): Promise<void> {
    if (this.isWeb) return;
    try {
      await BleManager.stopScan();
    } catch (error) {
      logger.debug({
        message: 'Error stopping scan',
        context: { error },
      });
    }

    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    useBluetoothAudioStore.getState().setIsScanning(false);

    logger.info({
      message: 'Bluetooth scan stopped',
    });
  }

  async connectToDevice(deviceId: string): Promise<void> {
    if (this.isWeb) return;
    try {
      useBluetoothAudioStore.getState().clearConnectionError();
      useBluetoothAudioStore.getState().setIsConnecting(true);

      // Ensure scanning is stopped before connecting
      // Connecting while scanning often fails on Android
      await this.stopScanning();

      // Small delay to allow radio to switch modes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Connect to the device
      logger.info({
        message: 'Attempting to connect to device via BleManager',
        context: { deviceId },
      });
      await BleManager.connect(deviceId);

      logger.info({
        message: 'Connected to Bluetooth audio device',
        context: { deviceId },
      });

      // Get the connected peripheral info
      const connectedPeripherals = await BleManager.getConnectedPeripherals();
      const device = connectedPeripherals.find((p) => p.id === deviceId);

      if (!device) {
        throw new Error('Device not found after connection');
      }

      // Discover services and characteristics
      logger.info({
        message: 'Retrieving services which triggers discovery',
        context: { deviceId },
      });
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      logger.info({
        message: 'Services retrieved successfully',
        context: {
          deviceId,
          serviceCount: peripheralInfo.services?.length,
          services: peripheralInfo.services?.map((s: any) => s.uuid),
        },
      });

      this.connectedDevice = device;
      useBluetoothAudioStore.getState().setConnectedDevice({
        id: device.id,
        name: device.name || null,
        rssi: device.rssi || undefined,
        isConnected: true,
        hasAudioCapability: true,
        supportsMicrophoneControl: this.supportsMicrophoneControl(device),
        device,
        type: this.getDeviceType(device),
      });

      // Special handling for specialized PTT devices to prevent mute loops
      if (this.getDeviceType(device) === 'specialized') {
        callKeepService.removeMuteListener();
        logger.info({
          message: 'Specialized PTT device connected - CallKeep mute listener removed',
          context: { deviceId },
        });
      } else {
        // Ensure listener is active for system devices
        callKeepService.restoreMuteListener();
      }

      // Set up button event monitoring with peripheral info
      await this.setupButtonEventMonitoring(device, peripheralInfo);

      // Start media-button fallback monitoring for Android headsets/earbuds/PTT devices
      this.startMediaButtonFallbackMonitoring();

      // Integrate with LiveKit audio routing
      await this.setupLiveKitAudioRouting(device);

      // Play connected device sound
      await audioService.playConnectedDeviceSound();

      useBluetoothAudioStore.getState().setIsConnecting(false);
    } catch (error) {
      // Extract meaningful error message
      let errorMessage = 'Unknown connection error';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object' && error !== null) {
        // Try to find a message property or basic string representation
        if ('message' in error && typeof (error as any).message === 'string') {
          errorMessage = (error as any).message;
        } else {
          try {
            errorMessage = JSON.stringify(error);
          } catch {
            errorMessage = String(error);
          }
        }
      }

      logger.error({
        message: 'Failed to connect to Bluetooth audio device',
        context: { deviceId, error, errorMessage },
      });

      useBluetoothAudioStore.getState().setIsConnecting(false);
      useBluetoothAudioStore.getState().setConnectionError(errorMessage);
      throw error;
    }
  }

  async connectToSystemAudio(): Promise<void> {
    if (this.isWeb) return;
    try {
      logger.info({ message: 'Switching to System Audio' });

      // Disconnect any currently connected specialized device
      if (this.connectedDevice) {
        try {
          await BleManager.disconnect(this.connectedDevice.id);
        } catch (error) {
          logger.warn({ message: 'Error disconnecting device for System Audio switch', context: { error } });
        }
        this.connectedDevice = null;
        useBluetoothAudioStore.getState().setConnectedDevice(null);
      }

      // Ensure system audio state
      callKeepService.restoreMuteListener();

      // Revert LiveKit audio routing explicitly to be safe
      this.revertLiveKitAudioRouting();

      // Update preferred device
      const systemAudioDevice = { id: 'system-audio', name: 'System Audio' };
      useBluetoothAudioStore.getState().setPreferredDevice(systemAudioDevice);

      // Save to storage (implied by previous code loading it from storage, but we need to save it too?
      // usage of usePreferredBluetoothDevice hook elsewhere handles saving,
      // but here we are in service. The UI calls logic that saves it eventually
      // or we should do it here if we want persistence.)
      // The service reads from storage using require('@/lib/storage'), so we should probably save it too if we want it to persist.
      // However, the UI calls setPreferredDevice from the hook which likely saves it.
      // We will let the UI handle the persistence call or add it here if needed.
      // For now, updating the store is enough for the session.
    } catch (error) {
      logger.error({ message: 'Failed to switch to System Audio', context: { error } });
      throw error;
    }
  }

  private handleDeviceDisconnected(args: { peripheral: string }): void {
    logger.info({
      message: '[DISCONNECT EVENT] Bluetooth audio device disconnected',
      context: {
        deviceId: args.peripheral,
      },
    });

    // Only handle if this is our connected device
    if (this.connectedDevice && this.connectedDevice.id === args.peripheral) {
      this.connectedDevice = null;

      useBluetoothAudioStore.getState().setConnectedDevice(null);
      useBluetoothAudioStore.getState().clearConnectionError();

      // Revert LiveKit audio routing to default
      this.revertLiveKitAudioRouting();

      // Restore CallKeep mute listener when device disconnects
      callKeepService.restoreMuteListener();
    }
  }

  private async setupButtonEventMonitoring(device: Device, peripheralInfo: PeripheralInfo): Promise<void> {
    try {
      useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(false);
      this.monitoringStartedAt = Date.now();

      // Start notifications for known button control characteristics
      await this.startNotificationsForButtonControls(device.id, peripheralInfo);

      this.startMonitoringWatchdog(device.id);
    } catch (error) {
      logger.warn({
        message: 'Could not set up button event monitoring',
        context: { deviceId: device.id, error },
      });
      useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(false);
      this.stopMonitoringWatchdog();
    }
  }

  private startMediaButtonFallbackMonitoring(): void {
    if (Platform.OS !== 'android') {
      return;
    }

    this.stopMediaButtonFallbackMonitoring();

    const module = (NativeModules as { MediaButtonModule?: { startListening?: () => void } }).MediaButtonModule;

    if (module?.startListening) {
      try {
        module.startListening();
        this.mediaButtonListeningActive = true;
      } catch (error) {
        logger.debug({
          message: 'Failed to start Android media-button fallback monitoring',
          context: { error },
        });
      }
    }

    this.mediaButtonEventListener = DeviceEventEmitter.addListener('onMediaButtonEvent', this.handleMediaButtonFallbackEvent.bind(this));
    this.addEventListener(this.mediaButtonEventListener);
  }

  private stopMediaButtonFallbackMonitoring(): void {
    if (this.mediaButtonEventListener) {
      this.removeEventListener(this.mediaButtonEventListener);
      this.mediaButtonEventListener.remove();
      this.mediaButtonEventListener = null;
    }

    if (Platform.OS !== 'android') {
      this.mediaButtonListeningActive = false;
      return;
    }

    if (!this.mediaButtonListeningActive) {
      return;
    }

    const module = (NativeModules as { MediaButtonModule?: { stopListening?: () => void } }).MediaButtonModule;
    if (module?.stopListening) {
      try {
        module.stopListening();
      } catch (error) {
        logger.debug({
          message: 'Failed to stop Android media-button fallback monitoring',
          context: { error },
        });
      }
    }

    this.mediaButtonListeningActive = false;
  }

  private handleMediaButtonFallbackEvent(event: { keyCode?: number; action?: string; timestamp?: number }): void {
    const { mediaButtonPTTSettings } = useBluetoothAudioStore.getState();
    if (!mediaButtonPTTSettings.enabled || !mediaButtonPTTSettings.usePlayPauseForPTT) {
      return;
    }

    const keyCode = event?.keyCode;
    const action = (event?.action || '').toUpperCase();

    // KEYCODE_HEADSETHOOK=79, KEYCODE_MEDIA_PLAY_PAUSE=85, KEYCODE_MEDIA_PLAY=126, KEYCODE_MEDIA_PAUSE=127
    const isPttCapableKey = keyCode === 79 || keyCode === 85 || keyCode === 126 || keyCode === 127;
    if (!isPttCapableKey) {
      return;
    }

    if (mediaButtonPTTSettings.pttMode === 'push_to_talk') {
      if (action === 'ACTION_DOWN') {
        this.processButtonEvent(
          {
            type: 'press',
            button: 'ptt_start',
            timestamp: Date.now(),
          },
          'media'
        );
      } else if (action === 'ACTION_UP') {
        this.processButtonEvent(
          {
            type: 'press',
            button: 'ptt_stop',
            timestamp: Date.now(),
          },
          'media'
        );
      }

      return;
    }

    if (action === 'ACTION_DOWN') {
      this.processButtonEvent({
        type: 'press',
        button: 'mute',
        timestamp: Date.now(),
      });
    }
  }

  private startMonitoringWatchdog(deviceId: string): void {
    this.stopMonitoringWatchdog();

    const watchdogRecoveryThresholdMs = 12000;

    this.monitoringWatchdogInterval = setInterval(() => {
      if (!this.connectedDevice || this.connectedDevice.id !== deviceId) {
        this.stopMonitoringWatchdog();
        return;
      }

      const monitoring = useBluetoothAudioStore.getState().isHeadsetButtonMonitoring;
      if (!monitoring) {
        this.stopMonitoringWatchdog();
        return;
      }

      if (!this.monitoringStartedAt) {
        return;
      }

      const monitoringDurationMs = Date.now() - this.monitoringStartedAt;
      if (monitoringDurationMs < watchdogRecoveryThresholdMs) {
        return;
      }

      this.monitoringStartedAt = Date.now();
      this.ensurePttInputMonitoring('watchdog');
    }, 4000);
  }

  public ensurePttInputMonitoring(_reason: string): void {
    if (!this.connectedDevice) {
      return;
    }

    this.startMediaButtonFallbackMonitoring();
    this.startMonitoringWatchdog(this.connectedDevice.id);
  }

  private stopMonitoringWatchdog(): void {
    if (this.monitoringWatchdogInterval) {
      clearInterval(this.monitoringWatchdogInterval);
      this.monitoringWatchdogInterval = null;
    }
  }

  /**
   * Check if a service and characteristic exist on the peripheral
   */
  private hasCharacteristic(peripheralInfo: PeripheralInfo, serviceUuid: string, characteristicUuid: string): boolean {
    if (!peripheralInfo?.services) {
      return false;
    }

    if (!peripheralInfo.characteristics) {
      return false;
    }

    const characteristicFound = peripheralInfo.characteristics.some((c: any) => this.areUuidsEqual(c.service, serviceUuid) && this.areUuidsEqual(c.characteristic, characteristicUuid));

    logger.debug({
      message: '[DEBUG_MATCH] Checking characteristic',
      context: {
        lookingForService: serviceUuid,
        lookingForChar: characteristicUuid,
        characteristicFound,
      },
    });

    return characteristicFound;
  }

  /**
   * Compare two UUIDs handling 16-bit and 128-bit formats
   */
  private areUuidsEqual(uuid1: string, uuid2: string): boolean {
    if (!uuid1 || !uuid2) return false;

    const u1 = uuid1.replace(/-/g, '').toUpperCase();
    const u2 = uuid2.replace(/-/g, '').toUpperCase();

    // If lengths match, just compare
    if (u1.length === u2.length) {
      return u1 === u2;
    }

    // Handle 16-bit vs 128-bit comparison
    // 16-bit UUIDs are often returned as 4 characters, while 128-bit are 32 chars
    // Standard base UUID: 0000xxxx-0000-1000-8000-00805F9B34FB

    const longUuid = u1.length > u2.length ? u1 : u2;
    const shortUuid = u1.length > u2.length ? u2 : u1;

    // If short UUID is 4 chars (16-bit), check if it matches the 128-bit pattern
    if (shortUuid.length === 4 && longUuid.length === 32) {
      // Construct expected 128-bit UUID from 16-bit UUID
      const expectedLong = `0000${shortUuid}00001000800000805F9B34FB`;
      return longUuid === expectedLong;
    }

    return false;
  }

  private async startNotificationsForButtonControls(deviceId: string, peripheralInfo: PeripheralInfo): Promise<void> {
    const successfullySubscribed = new Set<string>();
    this.monitoredReadCharacteristics = [];
    const isSpecializedDevice = Boolean(this.connectedDevice && this.connectedDevice.id === deviceId && this.getDeviceType(this.connectedDevice) === 'specialized');

    // Try to start notifications for known button control service/characteristic combinations
    const buttonControlConfigs = [
      { service: AINA_HEADSET_SERVICE, characteristic: AINA_HEADSET_SVC_PROP },
      { service: B01INRICO_HEADSET_SERVICE, characteristic: B01INRICO_HEADSET_SERVICE_CHAR },
      { service: HYS_HEADSET_SERVICE, characteristic: HYS_HEADSET_SERVICE_CHAR },
    ];

    logger.debug({
      message: 'Iterating button control configs',
      context: { configCount: buttonControlConfigs.length },
    });

    for (const config of buttonControlConfigs) {
      try {
        // Check if the characteristic exists before trying to start notifications
        if (!this.hasCharacteristic(peripheralInfo, config.service, config.characteristic)) {
          logger.debug({
            message: 'Characteristic not available on device, skipping',
            context: {
              deviceId,
              service: config.service,
              characteristic: config.characteristic,
            },
          });
          continue;
        }

        await BleManager.startNotification(deviceId, config.service, config.characteristic);
        successfullySubscribed.add(`${config.service.toUpperCase()}::${config.characteristic.toUpperCase()}`);
        this.registerReadPollingCharacteristic(config.service, config.characteristic);
        logger.info({
          message: 'Started notifications for button control',
          context: {
            deviceId,
            service: config.service,
            characteristic: config.characteristic,
          },
        });
      } catch (error) {
        logger.warn({
          // Changed to warn to make it more visible
          message: 'Failed to start notifications for characteristic',
          context: {
            deviceId,
            service: config.service,
            characteristic: config.characteristic,
            error,
          },
        });
      }
    }

    if (peripheralInfo?.characteristics?.length) {
      for (const characteristic of peripheralInfo.characteristics) {
        const serviceUuid = characteristic?.service;
        const characteristicUuid = characteristic?.characteristic;

        if (!serviceUuid || !characteristicUuid) {
          continue;
        }

        const pairKey = `${String(serviceUuid).toUpperCase()}::${String(characteristicUuid).toUpperCase()}`;
        const shouldSubscribe = isSpecializedDevice ? true : this.isLikelyButtonCharacteristic(serviceUuid, characteristicUuid) || this.hasNotificationOrReadCapability(characteristic?.properties);

        if (!shouldSubscribe || successfullySubscribed.has(pairKey)) {
          continue;
        }

        try {
          await BleManager.startNotification(deviceId, serviceUuid, characteristicUuid);
          successfullySubscribed.add(pairKey);

          if (isSpecializedDevice || this.hasReadCapability(characteristic?.properties)) {
            this.registerReadPollingCharacteristic(serviceUuid, characteristicUuid);
          }

          logger.info({
            message: 'Started fallback notification subscription for characteristic',
            context: {
              deviceId,
              serviceUuid,
              characteristicUuid,
              properties: characteristic?.properties,
            },
          });
        } catch (error) {
          logger.debug({
            message: 'Fallback notification subscription failed for characteristic',
            context: {
              deviceId,
              serviceUuid,
              characteristicUuid,
              error,
            },
          });
        }
      }
    }

    if (isSpecializedDevice && peripheralInfo?.characteristics?.length) {
      for (const characteristic of peripheralInfo.characteristics) {
        const serviceUuid = characteristic?.service;
        const characteristicUuid = characteristic?.characteristic;

        if (!serviceUuid || !characteristicUuid) {
          continue;
        }

        const pairKey = `${String(serviceUuid).toUpperCase()}::${String(characteristicUuid).toUpperCase()}`;
        if (!successfullySubscribed.has(pairKey)) {
          continue;
        }

        this.registerReadPollingCharacteristic(serviceUuid, characteristicUuid);
      }
    }

    if (successfullySubscribed.size > 0) {
      useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(true);
      this.startReadPollingFallback(deviceId);
    } else {
      useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(false);
    }
  }

  private registerReadPollingCharacteristic(serviceUuid: string, characteristicUuid: string): void {
    const exists = this.monitoredReadCharacteristics.some((entry) => this.areUuidsEqual(entry.serviceUuid, serviceUuid) && this.areUuidsEqual(entry.characteristicUuid, characteristicUuid));

    if (exists) {
      return;
    }

    this.monitoredReadCharacteristics.push({
      serviceUuid,
      characteristicUuid,
      lastHexValue: null,
    });
  }

  private startReadPollingFallback(deviceId: string): void {
    this.stopReadPollingFallback();

    if (this.monitoredReadCharacteristics.length === 0) {
      return;
    }

    this.readPollingInterval = setInterval(() => {
      if (!this.connectedDevice || this.connectedDevice.id !== deviceId) {
        this.stopReadPollingFallback();
        return;
      }

      const monitoring = useBluetoothAudioStore.getState().isHeadsetButtonMonitoring;
      if (!monitoring) {
        this.stopReadPollingFallback();
        return;
      }

      if (this.isReadPollingInFlight) {
        return;
      }

      this.isReadPollingInFlight = true;
      void this.pollReadCharacteristics(deviceId).finally(() => {
        this.isReadPollingInFlight = false;
      });
    }, 700);
  }

  private async pollReadCharacteristics(deviceId: string): Promise<void> {
    for (const entry of this.monitoredReadCharacteristics) {
      try {
        const readValue = await BleManager.read(deviceId, entry.serviceUuid, entry.characteristicUuid);
        const nextHexValue = Buffer.from(readValue).toString('hex');

        if (!nextHexValue || nextHexValue.length === 0) {
          continue;
        }

        if (entry.lastHexValue === null) {
          entry.lastHexValue = nextHexValue;
          continue;
        }

        if (entry.lastHexValue === nextHexValue) {
          continue;
        }

        entry.lastHexValue = nextHexValue;

        const valueBase64 = Buffer.from(readValue).toString('base64');
        this.handleButtonEventFromCharacteristic(deviceId, entry.serviceUuid, entry.characteristicUuid, valueBase64);
      } catch (error) {
        logger.debug({
          message: 'Read polling failed for characteristic',
          context: {
            deviceId,
            serviceUuid: entry.serviceUuid,
            characteristicUuid: entry.characteristicUuid,
            error,
          },
        });
      }
    }
  }

  private stopReadPollingFallback(): void {
    if (this.readPollingInterval) {
      clearInterval(this.readPollingInterval);
      this.readPollingInterval = null;
    }

    this.isReadPollingInFlight = false;
  }

  private hasReadCapability(properties: unknown): boolean {
    if (!properties) {
      return false;
    }

    if (Array.isArray(properties)) {
      return properties.some((property) => String(property).toLowerCase().includes('read'));
    }

    if (typeof properties === 'object') {
      const entries = Object.entries(properties as Record<string, unknown>);
      return entries.some(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        const normalizedValue = String(value).toLowerCase();
        const indicatesRead = normalizedKey.includes('read') || normalizedValue.includes('read');

        if (!indicatesRead) {
          return false;
        }

        return value === true || value === 1 || normalizedValue === normalizedKey || normalizedValue === 'true' || normalizedValue === '1';
      });
    }

    return false;
  }

  private hasNotificationOrReadCapability(properties: unknown): boolean {
    if (!properties) {
      return false;
    }

    if (Array.isArray(properties)) {
      return properties.some((property) => {
        const normalized = String(property).toLowerCase();
        return normalized.includes('notify') || normalized.includes('indicate') || normalized.includes('read');
      });
    }

    if (typeof properties === 'object') {
      const entries = Object.entries(properties as Record<string, unknown>);
      return entries.some(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        const normalizedValue = String(value).toLowerCase();
        const hasCapabilityToken =
          normalizedKey.includes('notify') ||
          normalizedKey.includes('indicate') ||
          normalizedKey.includes('read') ||
          normalizedValue.includes('notify') ||
          normalizedValue.includes('indicate') ||
          normalizedValue.includes('read');

        if (!hasCapabilityToken) {
          return false;
        }

        return value === true || value === 1 || normalizedValue === normalizedKey || normalizedValue === 'true' || normalizedValue === '1';
      });
    }

    return false;
  }

  private isLikelyButtonCharacteristic(serviceUuid: string, characteristicUuid: string): boolean {
    const normalizedService = serviceUuid.replace(/-/g, '').toUpperCase();
    const normalizedCharacteristic = characteristicUuid.replace(/-/g, '').toUpperCase();

    const knownServiceMatch = [AINA_HEADSET_SERVICE, B01INRICO_HEADSET_SERVICE, HYS_HEADSET_SERVICE].some((uuid) => this.areUuidsEqual(serviceUuid, uuid));
    const knownCharacteristicMatch = [AINA_HEADSET_SVC_PROP, B01INRICO_HEADSET_SERVICE_CHAR, HYS_HEADSET_SERVICE_CHAR, ...BUTTON_CONTROL_UUIDS].some((uuid) => this.areUuidsEqual(characteristicUuid, uuid));

    if (knownServiceMatch || knownCharacteristicMatch) {
      return true;
    }

    const heuristicFragments = ['2A4D', '2A4E', '2A4B', 'FFE0', 'FFE1', 'FFE2', '8888', 'BEEF', 'FE59'];
    return heuristicFragments.some((fragment) => normalizedService.includes(fragment) || normalizedCharacteristic.includes(fragment));
  }

  // Remove all the old button monitoring methods as they're replaced by the event-based approach
  // Button events are now handled in handleCharacteristicValueUpdate method

  private handleAinaButtonEvent(data: string): void {
    try {
      const buffer = Buffer.from(data, 'base64');
      logger.info({
        message: 'AINA button data received',
        context: {
          dataLength: buffer.length,
          rawData: buffer.toString('hex'),
        },
      });

      // AINA-specific button parsing
      const buttonEvent = this.parseAinaButtonData(buffer);
      if (buttonEvent) {
        this.processButtonEvent(buttonEvent);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to handle AINA button event',
        context: { error },
      });
    }
  }

  private handleB01InricoButtonEvent(data: string): void {
    try {
      const buffer = Buffer.from(data, 'base64');
      logger.info({
        message: 'B01 Inrico button data received',
        context: {
          dataLength: buffer.length,
          rawData: buffer.toString('hex'),
        },
      });

      // B01 Inrico-specific button parsing
      const buttonEvent = this.parseB01InricoButtonData(buffer);
      if (buttonEvent) {
        this.processButtonEvent(buttonEvent);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to handle B01 Inrico button event',
        context: { error },
      });
    }
  }

  private handleHYSButtonEvent(data: string): void {
    try {
      const buffer = Buffer.from(data, 'base64');
      logger.info({
        message: 'HYS button data received',
        context: {
          dataLength: buffer.length,
          rawData: buffer.toString('hex'),
        },
      });

      // HYS-specific button parsing
      const buttonEvent = this.parseHYSButtonData(buffer);
      if (buttonEvent) {
        this.processButtonEvent(buttonEvent);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to handle HYS button event',
        context: { error },
      });
    }
  }

  private handleGenericButtonEvent(data: string): void {
    try {
      const buffer = Buffer.from(data, 'base64');
      logger.info({
        message: 'Generic button data received',
        context: {
          dataLength: buffer.length,
          rawData: buffer.toString('hex'),
        },
      });

      // Generic button parsing
      const buttonEvent = this.parseGenericButtonData(buffer);
      if (buttonEvent) {
        this.processButtonEvent(buttonEvent);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to handle generic button event',
        context: { error },
      });
    }
  }

  private parseAinaButtonData(buffer: Buffer): AudioButtonEvent | null {
    if (buffer.length === 0) return null;

    // AINA-specific parsing logic
    const byte = buffer[0];

    let buttonType: AudioButtonEvent['button'] = 'unknown';
    let eventType: AudioButtonEvent['type'] = 'press';

    // AINA button mapping (adjust based on actual AINA protocol)
    switch (byte) {
      case 0x00:
        buttonType = 'ptt_stop';
        break;
      case 0x01:
        buttonType = 'ptt_start';
        break;
      case 0x02:
        buttonType = 'mute';
        break;
      case 0x03:
        buttonType = 'volume_up';
        break;
      case 0x04:
        buttonType = 'volume_down';
        break;
    }

    // Check for long press (adjust based on AINA protocol)
    if (buffer.length > 1 && buffer[1] === 0xff) {
      eventType = 'long_press';
    }

    return {
      type: eventType,
      button: buttonType,
      timestamp: Date.now(),
    };
  }

  private parseB01InricoButtonData(buffer: Buffer): AudioButtonEvent | null {
    if (buffer.length === 0) return null;

    const rawHex = buffer.toString('hex');

    // B01 Inrico-specific parsing logic
    const byte = buffer[0];
    const byte2 = buffer[5] || 0; // Fallback to 0 if not present

    let buttonType: AudioButtonEvent['button'] = 'unknown';
    let eventType: AudioButtonEvent['type'] = 'press';

    // Updated B01 Inrico button mapping based on common protocols
    // Note: These mappings may need adjustment based on actual device protocol
    switch (byte) {
      case 0x00:
        buttonType = 'ptt_stop';
        break;
      case 0x01:
        buttonType = 'ptt_start';
        break;
      case 0x02:
        buttonType = 'mute';
        break;
      case 0x03:
        buttonType = 'volume_up';
        break;
      case 0x04:
        buttonType = 'volume_down';
        break;
      case 0x05:
        buttonType = 'unknown'; // Emergency or special button
        break;
      // Original mappings as fallback
      case 0x10:
        buttonType = 'ptt_start';
        break;
      case 0x11:
        buttonType = 'ptt_stop';
        break;
      case 0x20:
        buttonType = 'mute';
        break;
      case 0x30:
        buttonType = 'volume_up';
        break;
      case 0x40:
        buttonType = 'volume_down';
        break;
      case 43:
        if (byte2 === 80) {
          buttonType = 'ptt_start';
        } else if (byte2 === 82) {
          buttonType = 'ptt_stop';
        }
        break;
      default:
        logger.warn({
          message: 'Unknown B01 Inrico button code received',
          context: {
            byte: `0x${byte.toString(16).padStart(2, '0')}`,
            decimal: byte,
            binary: `0b${byte.toString(2).padStart(8, '0')}`,
            rawBuffer: rawHex,
          },
        });
        buttonType = 'unknown';
    }

    // Check for long press patterns
    if (buffer.length > 1) {
      const secondByte = buffer[1];
      if (secondByte === 0x01 || secondByte === 0xff) {
        eventType = 'long_press';
      } else if (secondByte === 0x02) {
        eventType = 'double_press';
      }
    }

    // Alternative long press detection using bit masking
    if ((byte & 0x80) === 0x80) {
      eventType = 'long_press';
      // Remove the long press bit to get the actual button code
      const actualButtonByte = byte & 0x7f;
      logger.info({
        message: 'B01 Inrico long press detected via bit mask',
        context: {
          originalByte: `0x${byte.toString(16).padStart(2, '0')}`,
          actualButtonByte: `0x${actualButtonByte.toString(16).padStart(2, '0')}`,
        },
      });

      // Re-check button mapping with the actual button byte (without long press flag)
      switch (actualButtonByte) {
        case 0x00:
          // Ignore 0x80 (Long press on 0x00). This is often sent while holding PTT
          // and should NOT be interpreted as a STOP command.
          buttonType = 'unknown';
          break;
        case 0x01:
          buttonType = 'ptt_start';
          break;
        case 0x02:
          buttonType = 'mute';
          break;
        case 0x03:
          buttonType = 'volume_up';
          break;
        case 0x04:
          buttonType = 'volume_down';
          break;
        case 0x05:
          buttonType = 'unknown'; // Emergency or special button
          break;
        // Original mappings as fallback for the masked byte
        case 0x10:
          buttonType = 'ptt_start';
          break;
        case 0x11:
          buttonType = 'ptt_stop';
          break;
        case 0x20:
          buttonType = 'mute';
          break;
        case 0x30:
          buttonType = 'volume_up';
          break;
        case 0x40:
          buttonType = 'volume_down';
          break;
      }
    }

    const result = {
      type: eventType,
      button: buttonType,
      timestamp: Date.now(),
    };

    logger.info({
      message: 'B01 Inrico button event parsed',
      context: {
        rawData: rawHex,
        parsedEvent: result,
        isKnownButton: buttonType !== 'unknown',
      },
    });

    return result;
  }

  private parseHYSButtonData(buffer: Buffer): AudioButtonEvent | null {
    if (buffer.length === 0) return null;

    // HYS-specific parsing logic
    const byte = buffer[0];

    let buttonType: AudioButtonEvent['button'] = 'unknown';
    let eventType: AudioButtonEvent['type'] = 'press';

    // HYS button mapping (adjust based on actual HYS protocol)
    switch (byte) {
      case 0x01:
        buttonType = 'ptt_start';
        break;
      case 0x00:
        buttonType = 'ptt_stop';
        break;
      case 0x02:
        buttonType = 'mute';
        break;
      case 0x03:
        buttonType = 'volume_up';
        break;
      case 0x04:
        buttonType = 'volume_down';
        break;
      case 0x05:
        buttonType = 'unknown'; // Emergency button - using unknown as placeholder
        break;
    }

    // Check for long press (adjust based on HYS protocol)
    if (buffer.length > 1 && buffer[1] === 0x01) {
      eventType = 'long_press';
    } else if (buffer.length > 1 && buffer[1] === 0x02) {
      eventType = 'double_press';
    }

    return {
      type: eventType,
      button: buttonType,
      timestamp: Date.now(),
    };
  }

  private parseGenericButtonData(buffer: Buffer): AudioButtonEvent | null {
    // This is a simplified parser - real implementation would depend on device specs
    if (buffer.length === 0) return null;

    const byte = buffer[0];

    // Example parsing logic (varies by manufacturer)
    let buttonType: AudioButtonEvent['button'] = 'unknown';
    let eventType: AudioButtonEvent['type'] = 'press';

    switch (byte & 0x0f) {
      case 0x00:
        buttonType = 'ptt_start';
        break;
      case 0x01:
        buttonType = 'ptt_stop';
        break;
      case 0x02:
        buttonType = 'volume_up';
        break;
      case 0x03:
        buttonType = 'volume_down';
        break;
      case 0x04:
        buttonType = 'mute';
        break;
    }

    if (byte & 0x80) {
      eventType = 'long_press';
    } else if (byte & 0x40) {
      eventType = 'double_press';
    }

    return {
      type: eventType,
      button: buttonType,
      timestamp: Date.now(),
    };
  }

  private processButtonEvent(buttonEvent: AudioButtonEvent, source: 'ble' | 'media' = 'ble'): void {
    logger.info({
      message: 'Button event processed',
      context: { buttonEvent },
    });

    useBluetoothAudioStore.getState().addButtonEvent(buttonEvent);

    // Handle mute/unmute events
    if (buttonEvent.button === 'mute') {
      this.handleMuteToggle();
      return;
    }

    if (buttonEvent.button === 'ptt_start') {
      if (this.pttPressActive) {
        if (source === 'media') {
          this.schedulePttReleaseFallback();
        }
        return;
      }

      this.pttPressActive = true;
      if (source === 'media') {
        this.schedulePttReleaseFallback();
      } else {
        this.clearPttReleaseFallback();
      }

      // Proactively lock CallKeep events to prevent HFP interactions/spam
      // when we are explicitly handling PTT via SPP/GATT
      callKeepService.ignoreMuteEvents(1000);
      this.requestMicrophoneState(true);
      return;
    }

    if (buttonEvent.button === 'ptt_stop') {
      if (!this.pttPressActive) {
        return;
      }

      this.pttPressActive = false;
      this.clearPttReleaseFallback();

      // Keep locked for a bit after release to handle trailing events
      callKeepService.ignoreMuteEvents(1000);
      this.requestMicrophoneState(false);
      return;
    }

    // Handle volume events
    if (buttonEvent.button === 'volume_up' || buttonEvent.button === 'volume_down') {
      this.handleVolumeChange(buttonEvent.button);
    }
  }

  private async handleVolumeChange(direction: 'volume_up' | 'volume_down'): Promise<void> {
    logger.info({
      message: 'Volume change requested via Bluetooth button',
      context: { direction },
    });

    useBluetoothAudioStore.getState().setLastButtonAction({
      action: direction,
      timestamp: Date.now(),
    });

    // Add volume control logic here if needed
    // This would typically involve native audio controls
  }

  private handleButtonEvent(data: string): void {
    // Keep the original method for backward compatibility
    this.handleGenericButtonEvent(data);
  }

  private async handleMuteToggle(): Promise<void> {
    try {
      const featureLiveKitState = getLiveKitCallStore().getState();
      const featureRoom = featureLiveKitState.roomInstance;
      const featureLocalParticipant = featureRoom?.localParticipant ?? featureLiveKitState.localParticipant;

      if (featureLiveKitState.isConnected && featureRoom && featureLocalParticipant) {
        const nextMicEnabled = !featureLocalParticipant.isMicrophoneEnabled;
        await featureLiveKitState.actions.setMicrophoneEnabled(nextMicEnabled);

        const updatedState = getLiveKitCallStore().getState();
        const updatedParticipant = updatedState.roomInstance?.localParticipant ?? updatedState.localParticipant;

        if (updatedParticipant && updatedParticipant.isMicrophoneEnabled === nextMicEnabled) {
          return;
        }

        logger.warn({
          message: 'Feature store microphone toggle did not apply, falling back to legacy store',
          context: {
            nextMicEnabled,
            hasUpdatedParticipant: Boolean(updatedParticipant),
          },
        });
      }

      await getLiveKitStore().getState().toggleMicrophone();
    } catch (error) {
      logger.error({
        message: 'Failed to toggle microphone via Bluetooth button',
        context: { error },
      });
    }
  }

  private schedulePttReleaseFallback(): void {
    this.clearPttReleaseFallback();

    this.pttReleaseFallbackTimeout = setTimeout(() => {
      if (!this.pttPressActive) {
        return;
      }

      this.pttPressActive = false;
      callKeepService.ignoreMuteEvents(1000);
      this.requestMicrophoneState(false);
    }, 1400);
  }

  private clearPttReleaseFallback(): void {
    if (this.pttReleaseFallbackTimeout) {
      clearTimeout(this.pttReleaseFallbackTimeout);
      this.pttReleaseFallbackTimeout = null;
    }
  }

  private scheduleMicApplyRetry(enabled: boolean): void {
    this.retryMicEnabled = enabled;

    if (this.micApplyRetryTimeout) {
      return;
    }

    this.micApplyRetryTimeout = setTimeout(() => {
      this.micApplyRetryTimeout = null;

      const pendingEnabled = this.retryMicEnabled;
      this.retryMicEnabled = null;
      if (pendingEnabled === null) {
        return;
      }

      this.pendingMicEnabled = pendingEnabled;
      this.requestMicrophoneState(pendingEnabled);
    }, 160);
  }

  private clearMicApplyRetry(): void {
    if (this.micApplyRetryTimeout) {
      clearTimeout(this.micApplyRetryTimeout);
      this.micApplyRetryTimeout = null;
    }

    this.retryMicEnabled = null;
  }

  private requestMicrophoneState(enabled: boolean): void {
    this.pendingMicEnabled = enabled;

    if (this.isApplyingMicState) {
      return;
    }

    this.isApplyingMicState = true;

    void (async () => {
      try {
        while (this.pendingMicEnabled !== null) {
          const targetEnabled = this.pendingMicEnabled;
          this.pendingMicEnabled = null;
          await this.applyMicrophoneEnabled(targetEnabled);
        }
      } finally {
        this.isApplyingMicState = false;

        if (this.pendingMicEnabled !== null) {
          this.requestMicrophoneState(this.pendingMicEnabled);
        }
      }
    })();
  }

  private async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    await this.applyMicrophoneEnabled(enabled);
  }

  private async applyMicrophoneEnabled(enabled: boolean): Promise<void> {
    try {
      const featureLiveKitState = getLiveKitCallStore().getState();
      const featureRoom = featureLiveKitState.roomInstance;
      const legacyLiveKitState = getLiveKitStore().getState();
      const hasFeatureRoom = Boolean(featureLiveKitState.isConnected && featureRoom?.localParticipant);
      const hasLegacyRoom = Boolean(legacyLiveKitState.currentRoom?.localParticipant);
      const stillConnecting = featureLiveKitState.isConnecting || legacyLiveKitState.isConnecting;

      if (!hasFeatureRoom && !hasLegacyRoom && stillConnecting) {
        this.scheduleMicApplyRetry(enabled);
        return;
      }

      this.clearMicApplyRetry();

      if (featureLiveKitState.isConnected && featureRoom?.localParticipant) {
        const currentFeatureMicEnabled = featureRoom.localParticipant.isMicrophoneEnabled;
        if (currentFeatureMicEnabled === enabled) {
          return;
        }

        await featureLiveKitState.actions.setMicrophoneEnabled(enabled);

        const updatedState = getLiveKitCallStore().getState();
        const updatedParticipant = updatedState.roomInstance?.localParticipant ?? updatedState.localParticipant;

        if (updatedParticipant && updatedParticipant.isMicrophoneEnabled === enabled) {
          return;
        }

        logger.warn({
          message: 'Feature store setMicrophoneEnabled did not apply, falling back to legacy store',
          context: {
            enabled,
            hasUpdatedParticipant: Boolean(updatedParticipant),
          },
        });
      }

      await getLiveKitStore().getState().setMicrophoneEnabled(enabled);
    } catch (error) {
      logger.error({
        message: 'Failed to set microphone via Bluetooth PTT button',
        context: { error, enabled },
      });
    }
  }

  private async setupLiveKitAudioRouting(device: Device): Promise<void> {
    try {
      // Note: Audio routing in React Native/LiveKit typically requires native modules
      // This is a placeholder for the integration logic

      logger.info({
        message: 'Setting up LiveKit audio routing to Bluetooth device',
        context: { deviceId: device.id, deviceName: device.name },
      });

      const bluetoothStore = useBluetoothAudioStore.getState();
      const deviceName = device.name || 'Bluetooth Device';

      // Add Bluetooth device to available audio devices
      const bluetoothAudioDevice = {
        id: device.id,
        name: deviceName,
        type: 'bluetooth' as const,
        isAvailable: true,
      };

      // Update available audio devices list
      const currentDevices = bluetoothStore.availableAudioDevices.filter((d) => d.type !== 'bluetooth');
      bluetoothStore.setAvailableAudioDevices([...currentDevices, bluetoothAudioDevice]);

      // If device supports microphone, set it as selected microphone
      if (this.supportsMicrophoneControl(device)) {
        bluetoothStore.setSelectedMicrophone(bluetoothAudioDevice);
      }

      // Set as selected speaker
      bluetoothStore.setSelectedSpeaker(bluetoothAudioDevice);

      // In a real implementation, you would:
      // 1. Use native modules to route audio to the Bluetooth device
      // 2. Configure LiveKit's audio context to use the Bluetooth device as input/output
      // 3. Set audio session category and options appropriately

      bluetoothStore.setAudioRoutingActive(true);

      // Notify LiveKit store about audio device change
      // This would trigger any necessary audio context updates
    } catch (error) {
      logger.error({
        message: 'Failed to setup LiveKit audio routing',
        context: { error },
      });
      throw error;
    }
  }

  private revertLiveKitAudioRouting(): void {
    try {
      logger.info({
        message: 'Reverting LiveKit audio routing to default',
      });

      const bluetoothStore = useBluetoothAudioStore.getState();

      // Remove Bluetooth devices from available audio devices
      const nonBluetoothDevices = bluetoothStore.availableAudioDevices.filter((d) => d.type !== 'bluetooth');
      bluetoothStore.setAvailableAudioDevices(nonBluetoothDevices);

      // Revert to default audio devices
      const defaultMic = nonBluetoothDevices.find((d) => d.type === 'microphone' || d.id.toLowerCase().includes('mic')) || nonBluetoothDevices.find((d) => d.type === 'default');

      const defaultSpeaker = nonBluetoothDevices.find((d) => d.type === 'speaker' || d.id.toLowerCase().includes('speaker')) || nonBluetoothDevices.find((d) => d.type === 'default');

      if (defaultMic) {
        bluetoothStore.setSelectedMicrophone(defaultMic);
      }
      if (defaultSpeaker) {
        bluetoothStore.setSelectedSpeaker(defaultSpeaker);
      }

      // Revert audio routing to default (phone speaker/microphone)
      bluetoothStore.setAudioRoutingActive(false);
      bluetoothStore.setIsHeadsetButtonMonitoring(false);
      this.pttPressActive = false;
      this.clearPttReleaseFallback();
      this.clearMicApplyRetry();
      this.retryMicEnabled = null;
      this.pendingMicEnabled = null;
      this.stopMonitoringWatchdog();
      this.stopReadPollingFallback();
      this.stopMediaButtonFallbackMonitoring();
    } catch (error) {
      logger.error({
        message: 'Failed to revert LiveKit audio routing',
        context: { error },
      });
    }
  }

  async disconnectDevice(): Promise<void> {
    if (this.isWeb) return;
    useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(false);
    this.pttPressActive = false;
    this.clearPttReleaseFallback();
    this.clearMicApplyRetry();
    this.retryMicEnabled = null;
    this.pendingMicEnabled = null;
    this.stopMonitoringWatchdog();
    this.stopReadPollingFallback();
    this.stopMediaButtonFallbackMonitoring();
    if (this.connectedDevice && this.connectedDevice.id) {
      const deviceId = this.connectedDevice.id;
      try {
        await BleManager.disconnect(deviceId);
        logger.info({
          message: 'Bluetooth audio device disconnected manually',
          context: { deviceId },
        });
      } catch (error) {
        logger.error({
          message: 'Error disconnecting Bluetooth audio device',
          context: { error },
        });
      }

      this.handleDeviceDisconnected({ peripheral: deviceId });
    }
  }

  async getConnectedDevice(): Promise<BluetoothAudioDevice | null> {
    return useBluetoothAudioStore.getState().connectedDevice;
  }

  async isDeviceConnected(deviceId: string): Promise<boolean> {
    if (this.isWeb) return false;
    try {
      const connectedPeripherals = await BleManager.getConnectedPeripherals();
      return connectedPeripherals.some((p) => p.id === deviceId);
    } catch {
      return false;
    }
  }

  /**
   * Debug method to test B01 Inrico button mappings
   * Use this method to manually test button codes and determine the correct mapping
   */
  public testB01InricoButtonMapping(hexString: string): AudioButtonEvent | null {
    try {
      // Convert hex string to buffer (e.g., "01" -> Buffer([0x01]))
      const cleanHex = hexString.replace(/[^0-9A-Fa-f]/g, '');
      const buffer = Buffer.from(cleanHex, 'hex');

      logger.info({
        message: 'Testing B01 Inrico button mapping',
        context: {
          inputHex: hexString,
          cleanHex,
          buffer: Array.from(buffer).map((b) => `0x${b.toString(16).padStart(2, '0')}`),
        },
      });

      const result = this.parseB01InricoButtonData(buffer);

      logger.info({
        message: 'B01 Inrico button mapping test result',
        context: {
          inputHex: hexString,
          parsedResult: result,
        },
      });

      return result;
    } catch (error) {
      logger.error({
        message: 'Error testing B01 Inrico button mapping',
        context: { hexString, error },
      });
      return null;
    }
  }

  destroy(): void {
    this.stopScanning();
    this.disconnectDevice();
    useBluetoothAudioStore.getState().setIsHeadsetButtonMonitoring(false);
    this.clearPttReleaseFallback();
    this.clearMicApplyRetry();
    this.retryMicEnabled = null;
    this.pendingMicEnabled = null;
    this.stopMonitoringWatchdog();
    this.stopReadPollingFallback();
    this.stopMediaButtonFallbackMonitoring();

    // Remove all event listeners
    this.eventListeners.forEach((listener) => {
      listener.remove();
    });
    this.eventListeners = [];

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Reset initialization flags
    this.isInitialized = false;
    this.isInitialized = false;
    this.hasAttemptedPreferredDeviceConnection = false;
  }

  /**
   * Fully reset the Bluetooth service state.
   * Clears connections, scanning, and preferred device tracking.
   */
  async reset(): Promise<void> {
    if (this.isWeb) return;
    logger.info({
      message: 'Resetting Bluetooth Audio Service state',
    });

    try {
      await this.stopScanning();
      await this.disconnectDevice();

      this.connectedDevice = null;
      this.hasAttemptedPreferredDeviceConnection = false;

      // Revert LiveKit audio routing
      this.revertLiveKitAudioRouting();

      const store = useBluetoothAudioStore.getState();
      store.clearDevices();
      store.setConnectedDevice(null);
      store.setPreferredDevice(null);
      store.clearConnectionError();
      store.setIsConnecting(false);
      store.setIsScanning(false);
      store.setIsHeadsetButtonMonitoring(false);
      this.clearPttReleaseFallback();
      this.clearMicApplyRetry();
      this.retryMicEnabled = null;
      this.pendingMicEnabled = null;
      this.stopMonitoringWatchdog();
      this.stopReadPollingFallback();
      this.stopMediaButtonFallbackMonitoring();
    } catch (error) {
      logger.error({
        message: 'Error resetting Bluetooth Audio Service',
        context: { error },
      });
    }
  }
}

export const bluetoothAudioService = BluetoothAudioService.getInstance();
