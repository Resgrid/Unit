import { Platform } from 'react-native';

import { callKeepService as androidCallKeepService } from './callkeep.service.android';
import { callKeepService as iosCallKeepService } from './callkeep.service.ios';
import { callKeepService as webCallKeepService } from './callkeep.service.web';

// Export the appropriate platform-specific implementation
export const callKeepService = Platform.OS === 'ios' ? iosCallKeepService : Platform.OS === 'web' ? webCallKeepService : androidCallKeepService;

// Re-export types from iOS (they're the same in both)
export type { CallKeepConfig } from './callkeep.service.ios';
export { CallKeepService } from './callkeep.service.ios';
