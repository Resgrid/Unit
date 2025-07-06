import { useAppLifecycle } from '@/hooks/use-app-lifecycle';
import { useAuthStore } from '@/lib/auth';
import { logger } from '@/lib/logging';
import { bluetoothAudioService } from '@/services/bluetooth-audio.service';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { useRolesStore } from '@/stores/roles/store';
import { securityStore } from '@/stores/security/store';

// Mock all store dependencies
jest.mock('@/hooks/use-app-lifecycle');
jest.mock('@/lib/auth');
jest.mock('@/lib/logging');
jest.mock('@/services/bluetooth-audio.service');
jest.mock('@/stores/app/core-store');
jest.mock('@/stores/calls/store');
jest.mock('@/stores/roles/store');
jest.mock('@/stores/security/store');

const mockUseAppLifecycle = useAppLifecycle as jest.MockedFunction<typeof useAppLifecycle>;
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockBluetoothAudioService = bluetoothAudioService as jest.Mocked<typeof bluetoothAudioService>;

// Mock store implementations
const mockCoreStore = {
  init: jest.fn(),
  fetchConfig: jest.fn(),
  getState: jest.fn(),
};

const mockCallsStore = {
  init: jest.fn(),
  fetchCalls: jest.fn(),
  getState: jest.fn(),
};

const mockRolesStore = {
  init: jest.fn(),
  fetchRoles: jest.fn(),
  getState: jest.fn(),
};

const mockSecurityStore = {
  getRights: jest.fn(),
  getState: jest.fn(),
};

// Direct initialization function that mimics the TabLayout logic
const createInitializationLogic = () => {
  const hasInitialized = { current: false };
  const isInitializing = { current: false };
  const lastSignedInStatus = { current: null as string | null };

  const initializeApp = async () => {
    const { status } = useAuthStore();
    const { isActive, appState } = useAppLifecycle();

    if (isInitializing.current) {
      logger.info({
        message: 'App initialization already in progress, skipping',
      });
      return;
    }

    if (status !== 'signedIn') {
      logger.info({
        message: 'User not signed in, skipping initialization',
        context: { status },
      });
      return;
    }

    isInitializing.current = true;
    logger.info({
      message: 'Starting app initialization',
      context: {
        hasInitialized: hasInitialized.current,
        appState,
        isActive,
      },
    });

    try {
      await useCoreStore.getState().init();
      await useRolesStore.getState().init();
      await useCallsStore.getState().init();
      await securityStore.getState().getRights();
      await useCoreStore.getState().fetchConfig();
      await bluetoothAudioService.initialize();

      hasInitialized.current = true;
      logger.info({
        message: 'App initialization completed successfully',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to initialize app',
        context: { error },
      });
      hasInitialized.current = false;
    } finally {
      isInitializing.current = false;
    }
  };

  const shouldInitialize = () => {
    const { status } = useAuthStore();
    const { isActive, appState } = useAppLifecycle();

    return status === 'signedIn' &&
      !hasInitialized.current &&
      !isInitializing.current &&
      (
        lastSignedInStatus.current !== 'signedIn' ||
        (isActive && appState === 'active')
      );
  };

  const triggerInitialization = async () => {
    if (shouldInitialize()) {
      const { status } = useAuthStore();
      const { isActive, appState } = useAppLifecycle();

      logger.info({
        message: 'Triggering app initialization',
        context: {
          statusChanged: lastSignedInStatus.current !== status,
          becameActive: isActive && appState === 'active',
        },
      });

      await initializeApp();
    }

    lastSignedInStatus.current = useAuthStore().status;
  };

  return {
    initializeApp,
    triggerInitialization,
    shouldInitialize,
    hasInitialized,
    isInitializing,
    lastSignedInStatus,
  };
};

describe('App Initialization Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseAppLifecycle.mockReturnValue({
      appState: 'active',
      isActive: true,
      isBackground: false,
      lastActiveTimestamp: Date.now(),
    });

    mockUseAuthStore.mockReturnValue({
      status: 'signedIn',
    });

    // Setup store mocks
    mockCoreStore.getState.mockReturnValue({
      init: mockCoreStore.init,
      fetchConfig: mockCoreStore.fetchConfig,
    });

    mockCallsStore.getState.mockReturnValue({
      init: mockCallsStore.init,
      fetchCalls: mockCallsStore.fetchCalls,
    });

    mockRolesStore.getState.mockReturnValue({
      init: mockRolesStore.init,
      fetchRoles: mockRolesStore.fetchRoles,
    });

    mockSecurityStore.getState.mockReturnValue({
      getRights: mockSecurityStore.getRights,
    });

    (useCoreStore as unknown as jest.Mock).mockImplementation(() => mockCoreStore.getState());
    (useCallsStore as unknown as jest.Mock).mockImplementation(() => mockCallsStore.getState());
    (useRolesStore as unknown as jest.Mock).mockImplementation(() => mockRolesStore.getState());
    (securityStore as unknown as jest.Mock).mockImplementation(() => mockSecurityStore.getState());

    mockBluetoothAudioService.initialize.mockResolvedValue(undefined);
  });

  describe('Single Initialization', () => {
    it('should initialize exactly once when called multiple times', async () => {
      const logic = createInitializationLogic();

      // Trigger initialization multiple times
      await logic.triggerInitialization();
      await logic.triggerInitialization();
      await logic.triggerInitialization();

      // Wait for all promises to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify each store method was called exactly once
      expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      expect(mockRolesStore.init).toHaveBeenCalledTimes(1);
      expect(mockCallsStore.init).toHaveBeenCalledTimes(1);
      expect(mockSecurityStore.getRights).toHaveBeenCalledTimes(1);
      expect(mockCoreStore.fetchConfig).toHaveBeenCalledTimes(1);
      expect(mockBluetoothAudioService.initialize).toHaveBeenCalledTimes(1);

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'App initialization completed successfully',
      });
    });

    it('should not initialize when user is not signed in', async () => {
      mockUseAuthStore.mockReturnValue({ status: 'signedOut' });

      const logic = createInitializationLogic();
      await logic.triggerInitialization();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'User not signed in, skipping initialization',
        context: { status: 'signedOut' },
      });

      expect(mockCoreStore.init).not.toHaveBeenCalled();
      expect(mockRolesStore.init).not.toHaveBeenCalled();
      expect(mockCallsStore.init).not.toHaveBeenCalled();
      expect(mockSecurityStore.getRights).not.toHaveBeenCalled();
      expect(mockCoreStore.fetchConfig).not.toHaveBeenCalled();
      expect(mockBluetoothAudioService.initialize).not.toHaveBeenCalled();
    });

    it('should prevent concurrent initialization attempts', async () => {
      // Make initialization slow
      let resolveInit: () => void;
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      mockCoreStore.init.mockReturnValue(initPromise);

      const logic = createInitializationLogic();

      // Start first initialization
      const promise1 = logic.triggerInitialization();

      // Try to start second initialization while first is in progress
      const promise2 = logic.triggerInitialization();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'App initialization already in progress, skipping',
      });

      // Complete the initialization
      resolveInit!();

      await Promise.all([promise1, promise2]);

      // Verify only one initialization call was made
      expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
    });

    it('should allow retry after initialization failure', async () => {
      const error = new Error('Initialization failed');
      mockCoreStore.init.mockRejectedValueOnce(error);
      mockCoreStore.init.mockResolvedValueOnce(undefined);

      const logic = createInitializationLogic();

      // First attempt should fail
      await logic.triggerInitialization();

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to initialize app',
        context: { error },
      });

      // Second attempt should succeed
      await logic.triggerInitialization();

      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'App initialization completed successfully',
      });

      expect(mockCoreStore.init).toHaveBeenCalledTimes(2);
    });
  });

  describe('Initialization Conditions', () => {
    it('should initialize only when user becomes signed in', async () => {
      // Start signed out
      mockUseAuthStore.mockReturnValue({ status: 'signedOut' });

      const logic = createInitializationLogic();
      await logic.triggerInitialization();

      // Should not initialize
      expect(mockCoreStore.init).not.toHaveBeenCalled();

      // User signs in
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });

      await logic.triggerInitialization();

      // Should initialize
      expect(mockCoreStore.init).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith({
        message: 'App initialization completed successfully',
      });
    });

    it('should not re-initialize when already initialized', async () => {
      const logic = createInitializationLogic();

      // First initialization
      await logic.triggerInitialization();
      expect(mockCoreStore.init).toHaveBeenCalledTimes(1);

      // Clear mocks to track new calls
      jest.clearAllMocks();

      // Setup mocks again
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });
      mockUseAppLifecycle.mockReturnValue({
        appState: 'active',
        isActive: true,
        isBackground: false,
        lastActiveTimestamp: Date.now() + 1000,
      });

      // Try to initialize again
      await logic.triggerInitialization();

      // Should not initialize again
      expect(mockCoreStore.init).not.toHaveBeenCalled();
    });

    it('should check initialization conditions correctly', () => {
      const logic = createInitializationLogic();

      // User signed in, not initialized yet
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });
      expect(logic.shouldInitialize()).toBe(true);

      // User signed out
      mockUseAuthStore.mockReturnValue({ status: 'signedOut' });
      expect(logic.shouldInitialize()).toBe(false);

      // User signed in but already initialized
      mockUseAuthStore.mockReturnValue({ status: 'signedIn' });
      logic.hasInitialized.current = true;
      expect(logic.shouldInitialize()).toBe(false);

      // User signed in, not initialized, but initializing
      logic.hasInitialized.current = false;
      logic.isInitializing.current = true;
      expect(logic.shouldInitialize()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle store initialization errors gracefully', async () => {
      const error = new Error('Store init failed');
      mockCoreStore.init.mockRejectedValue(error);

      const logic = createInitializationLogic();
      await logic.triggerInitialization();

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to initialize app',
        context: { error },
      });

      // Should reset initialization state for retry
      expect(logic.hasInitialized.current).toBe(false);
      expect(logic.isInitializing.current).toBe(false);
    });

    it('should handle bluetooth service initialization errors gracefully', async () => {
      const error = new Error('Bluetooth init failed');
      mockBluetoothAudioService.initialize.mockRejectedValue(error);

      const logic = createInitializationLogic();
      await logic.triggerInitialization();

      expect(mockLogger.error).toHaveBeenCalledWith({
        message: 'Failed to initialize app',
        context: { error },
      });
    });
  });
}); 