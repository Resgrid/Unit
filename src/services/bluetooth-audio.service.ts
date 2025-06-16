import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, type Device, DeviceId, Service, State, type Subscription } from 'react-native-ble-plx';

import { logger } from '@/lib/logging';
import { type AudioButtonEvent, type BluetoothAudioDevice, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';

// Standard Bluetooth UUIDs for audio services
const AUDIO_SERVICE_UUID = '0000110A-0000-1000-8000-00805F9B34FB'; // Advanced Audio Distribution Profile
const A2DP_SOURCE_UUID = '0000110A-0000-1000-8000-00805F9B34FB';
const HFP_SERVICE_UUID = '0000111E-0000-1000-8000-00805F9B34FB'; // Hands-Free Profile
const HSP_SERVICE_UUID = '00001108-0000-1000-8000-00805F9B34FB'; // Headset Profile

const AINA_HEADSET = 'D11C8116-A913-434D-A79D-97AE94A529B3';
const AINA_HEADSET_SERVICE = '127FACE1-CB21-11E5-93D0-0002A5D5C51B';
const AINA_HEADSET_SVC_PROP = '127FBEEF-CB21-11E5-93D0-0002A5D5C51B';

const B01INRICO_HEADSET = '2BD21C44-0198-4B92-9110-D622D53D8E37';
const B01INRICO_HEADSET_SERVICE = '6666';
const B01INRICO_HEADSET_SERVICE_CHAR = '8888';

// Common button control characteristic UUIDs (varies by manufacturer)
const BUTTON_CONTROL_UUIDS = [
  '0000FE59-0000-1000-8000-00805F9B34FB', // Common button control
  '0000180F-0000-1000-8000-00805F9B34FB', // Battery Service (often includes button data)
  '00001812-0000-1000-8000-00805F9B34FB', // Human Interface Device Service
];

class BluetoothAudioService {
  private static instance: BluetoothAudioService;
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;
  private scanSubscription: Promise<void> | null = null;
  private buttonSubscription: Subscription | null = null;
  private connectionSubscription: Promise<void> | null = null;

  private constructor() {
    this.bleManager = new BleManager();
    this.setupBleStateListener();
  }

  static getInstance(): BluetoothAudioService {
    if (!BluetoothAudioService.instance) {
      BluetoothAudioService.instance = new BluetoothAudioService();
    }
    return BluetoothAudioService.instance;
  }

  private setupBleStateListener(): void {
    this.bleManager.onStateChange((state) => {
      logger.info({
        message: 'Bluetooth state changed',
        context: { state },
      });

      useBluetoothAudioStore.getState().setBluetoothState(state);

      if (state === State.PoweredOff || state === State.Unauthorized) {
        this.handleBluetoothDisabled();
      }
    }, true);
  }

  private handleBluetoothDisabled(): void {
    this.stopScanning();
    this.disconnectDevice();
    useBluetoothAudioStore.getState().clearDevices();
  }

  async requestPermissions(): Promise<boolean> {
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
    return await this.bleManager.state();
  }

  async startScanning(durationMs: number = 10000): Promise<void> {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth permissions not granted');
    }

    const state = await this.checkBluetoothState();
    if (state !== State.PoweredOn) {
      throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
    }

    useBluetoothAudioStore.getState().setIsScanning(true);
    useBluetoothAudioStore.getState().clearDevices();

    logger.info({
      message: 'Starting Bluetooth audio device scan',
      context: { durationMs },
    });

    this.scanSubscription = this.bleManager.startDeviceScan([AUDIO_SERVICE_UUID, HFP_SERVICE_UUID, HSP_SERVICE_UUID, AINA_HEADSET_SERVICE, B01INRICO_HEADSET_SERVICE], { allowDuplicates: false }, (error, device) => {
      if (error) {
        logger.error({
          message: 'BLE scan error',
          context: { error },
        });
        return;
      }

      if (device && this.isAudioDevice(device)) {
        this.handleDeviceFound(device);
        this.stopScanning();
      }
    });

    // Stop scanning after duration
    const timeoutId = setTimeout(() => {
      this.stopScanning();
    }, durationMs);

    // Store timeout reference for cleanup if needed
    (this.scanSubscription as any)._timeoutId = timeoutId;
  }

  private isAudioDevice(device: Device): boolean {
    const name = device.name?.toLowerCase() || '';
    const audioKeywords = ['speaker', 'headset', 'earbuds', 'headphone', 'audio', 'mic', 'sound'];

    // Check if device name contains audio-related keywords
    const hasAudioKeyword = audioKeywords.some((keyword) => name.includes(keyword));

    // Check if device has audio service UUIDs
    const hasAudioService = device.serviceUUIDs?.some((uuid) => [AUDIO_SERVICE_UUID, HFP_SERVICE_UUID, HSP_SERVICE_UUID, AINA_HEADSET_SERVICE, B01INRICO_HEADSET_SERVICE].includes(uuid.toUpperCase()));

    return hasAudioKeyword || hasAudioService || false;
  }

  private handleDeviceFound(device: Device): void {
    const audioDevice: BluetoothAudioDevice = {
      id: device.id,
      name: device.name,
      rssi: device.rssi || undefined,
      isConnected: false,
      hasAudioCapability: true,
      supportsMicrophoneControl: this.supportsMicrophoneControl(device),
      device,
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
    if (preferredDevice?.id === device.id && !connectedDevice && !this.connectionSubscription) {
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
    const serviceUUIDs = device.serviceUUIDs || [];
    return serviceUUIDs.some((uuid) => [HFP_SERVICE_UUID, HSP_SERVICE_UUID].includes(uuid.toUpperCase()));
  }

  stopScanning(): void {
    //if (this.scanSubscription) {
    //  this.scanSubscription.remove();
    //  this.scanSubscription = null;
    //}
    this.scanSubscription = null;
    useBluetoothAudioStore.getState().setIsScanning(false);

    logger.info({
      message: 'Bluetooth scan stopped',
    });
  }

  async connectToDevice(deviceId: string): Promise<void> {
    try {
      useBluetoothAudioStore.getState().setIsConnecting(true);

      const device = await this.bleManager.connectToDevice(deviceId);

      logger.info({
        message: 'Connected to Bluetooth audio device',
        context: { deviceId, deviceName: device.name },
      });

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      this.connectedDevice = device;
      useBluetoothAudioStore.getState().setConnectedDevice({
        id: device.id,
        name: device.name,
        rssi: device.rssi || undefined,
        isConnected: true,
        hasAudioCapability: true,
        supportsMicrophoneControl: this.supportsMicrophoneControl(device),
        device,
      });

      // Set up button event monitoring
      await this.setupButtonEventMonitoring(device);

      // Set up connection monitoring
      this.setupConnectionMonitoring(device);

      // Integrate with LiveKit audio routing
      await this.setupLiveKitAudioRouting(device);

      useBluetoothAudioStore.getState().setIsConnecting(false);
    } catch (error) {
      logger.error({
        message: 'Failed to connect to Bluetooth audio device',
        context: { deviceId, error },
      });

      useBluetoothAudioStore.getState().setIsConnecting(false);
      useBluetoothAudioStore.getState().setConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
      throw error;
    }
  }

  private setupConnectionMonitoring(device: Device): void {
    device.onDisconnected((error, disconnectedDevice) => {
      logger.info({
        message: 'Bluetooth audio device disconnected',
        context: {
          deviceId: disconnectedDevice?.id,
          deviceName: disconnectedDevice?.name,
          error: error?.message,
        },
      });

      this.handleDeviceDisconnected();
    });
  }

  private handleDeviceDisconnected(): void {
    this.connectedDevice = null;
    this.buttonSubscription = null;
    //if (this.buttonSubscription) {
    //  this.buttonSubscription.remove();
    //  this.buttonSubscription = null;
    //}

    useBluetoothAudioStore.getState().setConnectedDevice(null);
    useBluetoothAudioStore.getState().clearConnectionError();

    // Revert LiveKit audio routing to default
    this.revertLiveKitAudioRouting();
  }

  private async setupButtonEventMonitoring(device: Device): Promise<void> {
    try {
      const services = await device.services();

      for (const service of services) {
        for (const buttonUuid of BUTTON_CONTROL_UUIDS) {
          try {
            const characteristics = await service.characteristics();
            const buttonChar = characteristics.find((char) => char.uuid.toUpperCase() === buttonUuid.toUpperCase() && char.isNotifiable);

            if (buttonChar) {
              this.buttonSubscription = buttonChar.monitor((error, characteristic) => {
                if (error) {
                  logger.error({
                    message: 'Button monitoring error',
                    context: { error },
                  });
                  return;
                }

                if (characteristic?.value) {
                  this.handleButtonEvent(characteristic.value);
                }
              });

              logger.info({
                message: 'Button event monitoring established',
                context: { deviceId: device.id, characteristicUuid: buttonChar.uuid },
              });

              break;
            }
          } catch (charError) {
            // Continue trying other characteristics
            logger.debug({
              message: 'Failed to set up button monitoring for characteristic',
              context: { uuid: buttonUuid, error: charError },
            });
          }
        }

        if (this.buttonSubscription) break;
      }
    } catch (error) {
      logger.warn({
        message: 'Could not set up button event monitoring',
        context: { deviceId: device.id, error },
      });
    }
  }

  private handleButtonEvent(data: string): void {
    // Parse button data (implementation depends on device manufacturer)
    // This is a simplified implementation
    const buffer = Buffer.from(data, 'base64');
    const buttonEvent = this.parseButtonData(buffer);

    if (buttonEvent) {
      logger.info({
        message: 'Button event received',
        context: { buttonEvent },
      });

      useBluetoothAudioStore.getState().addButtonEvent(buttonEvent);

      // Handle mute/unmute events
      if (buttonEvent.button === 'mute' || buttonEvent.button === 'play_pause') {
        this.handleMuteToggle();
      }
    }
  }

  private parseButtonData(buffer: Buffer): AudioButtonEvent | null {
    // This is a simplified parser - real implementation would depend on device specs
    if (buffer.length === 0) return null;

    const byte = buffer[0];

    // Example parsing logic (varies by manufacturer)
    let buttonType: AudioButtonEvent['button'] = 'unknown';
    let eventType: AudioButtonEvent['type'] = 'press';

    switch (byte & 0x0f) {
      case 0x01:
        buttonType = 'play_pause';
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

  private async handleMuteToggle(): Promise<void> {
    const liveKitStore = useLiveKitStore.getState();
    if (liveKitStore.currentRoom) {
      const currentMuteState = !liveKitStore.currentRoom.localParticipant.isMicrophoneEnabled;

      try {
        await liveKitStore.currentRoom.localParticipant.setMicrophoneEnabled(currentMuteState);

        logger.info({
          message: 'Microphone toggled via Bluetooth button',
          context: { enabled: currentMuteState },
        });

        useBluetoothAudioStore.getState().setLastButtonAction({
          action: currentMuteState ? 'unmute' : 'mute',
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error({
          message: 'Failed to toggle microphone via Bluetooth button',
          context: { error },
        });
      }
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

      // In a real implementation, you would:
      // 1. Use native modules to route audio to the Bluetooth device
      // 2. Configure LiveKit's audio context to use the Bluetooth device as input/output
      // 3. Set audio session category and options appropriately

      useBluetoothAudioStore.getState().setAudioRoutingActive(true);

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

      // Revert audio routing to default (phone speaker/microphone)
      useBluetoothAudioStore.getState().setAudioRoutingActive(false);
    } catch (error) {
      logger.error({
        message: 'Failed to revert LiveKit audio routing',
        context: { error },
      });
    }
  }

  async disconnectDevice(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        logger.info({
          message: 'Bluetooth audio device disconnected manually',
          context: { deviceId: this.connectedDevice.id },
        });
      } catch (error) {
        logger.error({
          message: 'Error disconnecting Bluetooth audio device',
          context: { error },
        });
      }

      this.handleDeviceDisconnected();
    }
  }

  async getConnectedDevice(): Promise<BluetoothAudioDevice | null> {
    return useBluetoothAudioStore.getState().connectedDevice;
  }

  async isDeviceConnected(deviceId: string): Promise<boolean> {
    if (!this.connectedDevice || this.connectedDevice.id !== deviceId) {
      return false;
    }

    try {
      const isConnected = await this.connectedDevice.isConnected();
      return isConnected;
    } catch {
      return false;
    }
  }

  destroy(): void {
    this.stopScanning();
    this.disconnectDevice();
    //if (this.connectionSubscription) {
    //  this.connectionSubscription.remove();
    //}
    this.connectionSubscription = null;
    if (this.buttonSubscription) {
      this.buttonSubscription.remove();
    }
    this.bleManager.destroy();
  }
}

export const bluetoothAudioService = BluetoothAudioService.getInstance();
