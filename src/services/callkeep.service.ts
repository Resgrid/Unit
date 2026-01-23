import { Platform } from 'react-native';

import { callKeepService as androidCallKeepService } from './callkeep.service.android';
import { callKeepService as iosCallKeepService } from './callkeep.service.ios';

// Export the appropriate platform-specific implementation
export const callKeepService = Platform.OS === 'ios' ? iosCallKeepService : androidCallKeepService;

// Re-export types from iOS (they're the same in both)
export type { CallKeepConfig } from './callkeep.service.ios';
export { CallKeepService } from './callkeep.service.ios';
