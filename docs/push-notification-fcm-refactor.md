# Push Notification Service - Firebase Cloud Messaging Refactor

## Overview

The push notification service has been completely refactored to use Firebase Cloud Messaging (FCM) and Notifee exclusively, removing the dependency on Expo Notifications. This provides better native support, more reliable notification delivery, and enhanced features for both iOS and Android platforms.

## Key Changes

### 1. **Package Dependencies**

#### Removed
- `expo-notifications` - No longer used for notification handling

#### Now Using
- `@react-native-firebase/messaging` - Primary package for push notifications
- `@notifee/react-native` - For advanced Android notification channels and iOS notification management

### 2. **Service Refactoring**

#### Notification Channel Management (Android)
- Migrated from `Notifications.setNotificationChannelAsync()` to `notifee.createChannel()`
- Improved channel properties with better Android 13+ support
- Maintains all 32 notification channels (standard + custom call tones)

#### Permission Handling
- **iOS**: Uses `messaging().requestPermission()` with support for:
  - Standard notifications (alert, badge, sound)
  - **Critical Alerts** - Emergency notifications that bypass Do Not Disturb
  - Provisional authorization
  
- **Android**: Uses both FCM and Notifee permission systems
  - FCM for push token management
  - Notifee for notification channel permissions

#### Message Handling

The service now handles three types of notifications:

1. **Foreground Messages**: 
   - Handled via `messaging().onMessage()`
   - Shows notification modal when app is open
   - Processes eventCode for navigation

2. **Background Messages**:
   - Handled via `messaging().setBackgroundMessageHandler()`
   - Processes data payloads when app is in background
   - System displays notifications automatically if payload includes notification object

3. **Notification Taps**:
   - `messaging().onNotificationOpenedApp()` - App in background
   - `messaging().getInitialNotification()` - App was killed
   - Both trigger modal display for eventCode-based navigation

### 3. **Token Management**

- FCM tokens obtained via `messaging().getToken()`
- Automatic token refresh handled by Firebase SDK
- Token registration with backend continues to work seamlessly
- Platform detection (iOS=1, Android=2) maintained

### 4. **Lifecycle Management**

#### Initialization
```typescript
await pushNotificationService.initialize();
```
- Sets up Android notification channels
- Registers background message handler
- Establishes foreground message listener
- Sets up notification tap handlers

#### Cleanup
```typescript
pushNotificationService.cleanup();
```
- Unsubscribes from all FCM listeners
- Cleans up resources properly
- Safe to call multiple times

### 5. **Event-Driven Architecture**

The service maintains integration with the `usePushNotificationModalStore` for handling notification events:

```typescript
// Notification data structure
{
  eventCode: string,  // Required for modal display
  title?: string,
  body?: string,
  data: Record<string, unknown>
}
```

Event codes trigger different app behaviors:
- `C:*` - Call notifications
- `M:*` - Message notifications  
- `T:*` - Chat notifications
- `G:*` - Group notifications

## Integration Points

### No Breaking Changes

The public API remains unchanged:

```typescript
// Hook usage (unchanged)
const { pushToken } = usePushNotifications();

// Manual registration (unchanged)
const token = await pushNotificationService.registerForPushNotifications(
  unitId, 
  departmentCode
);

// Get current token (unchanged)
const token = pushNotificationService.getPushToken();
```

### Store Integration

The service continues to work with existing stores:
- `usePushNotificationModalStore` - For displaying notification modals
- `useCoreStore` - For active unit tracking
- `securityStore` - For department rights

## Platform-Specific Features

### iOS
- Critical alert support for emergency notifications
- Proper authorization status handling
- Support for provisional authorization
- Badge and sound management

### Android
- Rich notification channels with custom sounds
- Vibration patterns per channel
- High importance for emergency calls
- LED light colors and lockscreen visibility
- Android 13+ notification permission support

## Testing

Comprehensive test coverage includes:

1. **Notification Handling Tests**
   - Call notifications with eventCode
   - Message notifications
   - Chat and group notifications
   - Edge cases (empty eventCode, missing data, non-string eventCode)

2. **Listener Management Tests**
   - Initialization verification
   - Cleanup verification
   - Multiple cleanup calls
   - Cleanup without initialization

3. **Registration Tests**
   - Successful registration
   - Permission request flow
   - Permission denial handling
   - Token retrieval

4. **Android Channel Tests**
   - Verifies all 32 channels are created
   - Platform-specific behavior

All tests passing: **1421 tests passed**

## Migration Notes

### For Developers

No code changes required in components using the push notification service. The refactor is fully backward compatible.

### For Deployment

1. Ensure Firebase configuration files are present:
   - `google-services.json` (Android)
   - `GoogleService-Info.plist` (iOS)

2. Verify native dependencies are installed:
   ```bash
   cd ios && pod install
   cd android && ./gradlew clean
   ```

3. Test push notifications on both platforms in:
   - Foreground state
   - Background state
   - Killed/terminated state

## Benefits

1. **Reliability**: FCM is the native push notification service for both platforms
2. **Features**: Access to platform-specific features (critical alerts, rich notifications)
3. **Performance**: Better battery optimization and delivery guarantees
4. **Maintenance**: Aligned with platform best practices and future updates
5. **Debugging**: Better logging and error handling with Firebase console integration

## Future Enhancements

Potential improvements enabled by this refactor:

- Rich notifications with images and actions
- Notification grouping and bundling
- Custom notification layouts (Android)
- Notification scheduling with Notifee
- Enhanced analytics via Firebase Analytics integration
- A/B testing for notification content

## References

- [Firebase Cloud Messaging Documentation](https://rnfirebase.io/messaging/usage)
- [Notifee Documentation](https://notifee.app/react-native/docs/overview)
- [iOS Critical Alerts](https://developer.apple.com/documentation/usernotifications/asking_permission_to_use_notifications#3544375)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
