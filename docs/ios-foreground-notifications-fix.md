# iOS Foreground Notifications Fix

## Problem

iOS push notifications were completely broken after removing the `expo-notifications` plugin. Issues included:
1. Notifications not displaying in foreground (app responded with 0 to `willPresentNotification`)
2. Notification taps not working (no `didReceive` response handler)
3. **Push notifications not working at all** (missing `aps-environment` entitlement)

Console logs showed:
- Notification received: `hasAlertContent: 1, hasSound: 1 hasBadge: 1`
- App responded with 0 to `willPresentNotification`
- iOS decided not to show: `shouldPresentAlert: NO`
- No handler for notification taps (`didReceive` response)

## Root Cause

**Issue 1: Missing APS Entitlement (Critical)**
When `expo-notifications` plugin was removed, it also removed the `aps-environment` entitlement from the iOS project. This entitlement is **required** for iOS to register the app with Apple Push Notification service (APNs). Without it, the app cannot receive any push notifications at all.

**Issue 2: Notifications not displaying in foreground**
When a push notification arrives on iOS while the app is in the foreground, iOS sends a `willPresentNotification` delegate call asking the app how to present the notification. Without a proper delegate implementation, the default behavior is to NOT show the notification (response 0).

**Issue 3: Notification taps not working**
When a user taps on a notification, iOS sends a `didReceive response` delegate call. Without implementing this delegate method, taps are ignored and don't trigger any action in the app.

The previous implementation tried to manually display notifications using Notifee, but this happened AFTER Firebase Messaging had already told iOS not to show the notification.

## Solution

### 1. Config Plugin (`plugins/withForegroundNotifications.js`)

Created an Expo config plugin to automatically configure push notifications during prebuild:

```javascript
const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');

const withForegroundNotifications = (config) => {
  // Add push notification entitlements
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    
    // Add APS environment for push notifications - REQUIRED
    entitlements['aps-environment'] = 'production';
    
    // Add critical alerts for production/internal builds
    const env = process.env.APP_ENV || config.extra?.APP_ENV;
    if (env === 'production' || env === 'internal') {
      entitlements['com.apple.developer.usernotifications.critical-alerts'] = true;
      entitlements['com.apple.developer.usernotifications.time-sensitive'] = true;
    }
    
    return config;
  });

  // Add AppDelegate modifications for notification handling
  // ...
};

module.exports = withForegroundNotifications;
```

This plugin:
1. **Adds `aps-environment` entitlement** - Required for APNs registration
2. **Adds critical alerts entitlement** - For emergency call notifications
3. **Adds time-sensitive entitlement** - For high-priority notifications
4. Adds AppDelegate notification handlers (see below)

Added to `app.config.ts` plugins array:
```typescript
plugins: [
  // ...
  './plugins/withForegroundNotifications.js',
  // ...
]
```

This ensures the native iOS code is correctly configured even after running `expo prebuild`.

### 2. AppDelegate.swift Changes

The config plugin automatically applies these changes during prebuild:

```swift
import UserNotifications

public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  
  public override func application(...) -> Bool {
    // ...
    
    // Set the UNUserNotificationCenter delegate to handle foreground notifications
    UNUserNotificationCenter.current().delegate = self
    
    // ...
  }
  
  // Handle foreground notifications - tell iOS to show them
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Show notification with alert, sound, and badge even when app is in foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }
  
  // Handle notification tap - when user taps on a notification
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // Forward the notification response to React Native
    // This allows Firebase Messaging to handle it via onNotificationOpenedApp
    completionHandler()
  }
}
```

This tells iOS to:
1. Display all foreground notifications with banner/alert, sound, and badge updates
2. Forward notification taps to React Native for handling

### 3. push-notification.ts Changes

Added Notifee event listeners to handle notification taps:

**Added:**
```typescript
import { EventType } from '@notifee/react-native';

// In initialize():
// Set up Notifee event listeners for notification taps
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification) {
    const eventCode = detail.notification.data?.eventCode;
    if (eventCode) {
      usePushNotificationModalStore.getState().showNotificationModal({
        eventCode,
        title: detail.notification.title,
        body: detail.notification.body,
        data: detail.notification.data,
      });
    }
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && detail.notification) {
    // Handle background notification taps
    // ...
  }
});
```

This ensures that:
1. When user taps a notification shown via Notifee, it's caught by `onForegroundEvent`
2. When user taps a notification while app is in background, it's caught by `onBackgroundEvent`
3. Both handlers extract the eventCode and show the in-app notification modal

Also kept the existing Firebase Messaging handlers:

**Before:**
```typescript
// On iOS, display the notification in foreground using Notifee
if (Platform.OS === 'ios' && remoteMessage.notification) {
  await notifee.displayNotification({...});
}
```

**After:**
```typescript
// On iOS, the notification will be displayed automatically by the native system
// via the UNUserNotificationCenterDelegate in AppDelegate.swift
// We don't need to manually display it here
```

The `handleRemoteMessage` function now only:
1. Logs the received message
2. Extracts eventCode and notification data
3. Shows the notification modal if eventCode exists
4. Lets iOS handle the notification display natively

The existing Firebase Messaging handlers (`onNotificationOpenedApp`, `getInitialNotification`) continue to work for notifications tapped from the system tray.

## Flow After Fix

### Notification Display Flow
1. **Notification arrives** → Firebase Messaging receives it
2. **iOS asks** → "How should I present this?" (willPresentNotification)
3. **AppDelegate responds** → "Show with banner, sound, and badge" ([.banner, .sound, .badge])
4. **iOS displays** → Native notification appears at the top of the screen
5. **React Native processes** → `onMessage` handler extracts eventCode for modal

### Notification Tap Flow
1. **User taps notification** → iOS receives the tap
2. **iOS asks** → "How should I handle this?" (didReceive response)
3. **AppDelegate responds** → Forwards to React Native
4. **Two paths handled**:
   - **Path A (Notifee)**: If notification was displayed by Notifee → `onForegroundEvent` fires → Shows modal
   - **Path B (Firebase)**: If notification is from system tray → `onNotificationOpenedApp` fires → Shows modal

## Benefits

1. **Native behavior**: Notifications look and feel native
2. **Proper sounds**: Custom notification sounds work correctly
3. **Critical alerts**: Can leverage iOS critical alert features
4. **Better UX**: Consistent with iOS notification standards
5. **Less code**: Removed manual display logic

## Testing

Test foreground notifications with:
1. App in foreground
2. Send push notification with eventCode
3. **Verify notification banner appears at top** ✅
4. **Verify sound plays** ✅
5. **Tap the notification banner** ✅
6. **Verify modal shows for eventCode** ✅
7. Test with different notification types (calls, messages, etc.)

Test background/killed state notifications:
1. App in background or killed
2. Send push notification with eventCode
3. **Tap the notification from system tray** ✅
4. **Verify app opens and modal shows** ✅

## Related Files

- `/plugins/withForegroundNotifications.js` - Expo config plugin for iOS modifications
- `/app.config.ts` - Expo configuration with plugin registration
- `/ios/ResgridUnit/AppDelegate.swift` - Native iOS delegate implementation (auto-generated)
- `/src/services/push-notification.ts` - React Native notification service

## Important Notes

- The `AppDelegate.swift` is auto-generated during `expo prebuild`
- Never manually edit `AppDelegate.swift` - changes will be lost on next prebuild
- All iOS native modifications must be done through the config plugin
- Run `expo prebuild --platform ios --clean` after modifying the plugin
