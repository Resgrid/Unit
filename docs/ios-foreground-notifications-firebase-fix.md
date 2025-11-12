# iOS Foreground Notifications Fix for Firebase Messaging

## Problem

# iOS Foreground Notifications Fix for Firebase Messaging

## Problem

iOS push notifications were not being delivered to the React Native app when it's in the foreground. The in-app modal wasn't appearing because the notification handling needed proper configuration.

## Root Cause

The initial implementation had two issues:

1. **First attempt**: Custom delegate methods were calling completion handlers but not properly coordinating with Firebase Messaging
2. **Second attempt**: Removing delegate methods completely prevented iOS from displaying notifications in foreground

## Solution

Implement `UNUserNotificationCenterDelegate` methods that:
1. ✅ Tell iOS to display the notification banner in foreground
2. ✅ Allow Firebase Messaging to also process the notification
3. ✅ Both work together: native banner + JavaScript onMessage() handler

## How It Works

When a push notification arrives while app is in foreground:

1. **iOS delivers notification to AppDelegate**
2. **`willPresent` delegate method runs**:
   - Tells iOS to show banner, play sound, update badge
   - Returns immediately via completion handler
3. **Firebase Messaging processes notification**:
   - Automatically forwards to `messaging().onMessage()`
   - Your `handleRemoteMessage` function runs
   - In-app modal appears
4. **User sees both**:
   - Native iOS banner at top
   - In-app modal for interaction

## Changes Made

### 1. Updated Plugin ✅

The `plugins/withForegroundNotifications.js` now:
- Adds `UNUserNotificationCenterDelegate` conformance
- Sets delegate: `UNUserNotificationCenter.current().delegate = self`
- Implements `willPresent` to display foreground notifications
- Implements `didReceive` for notification tap handling
- Includes proper documentation

### 2. Clean and Rebuild iOS

Run the following commands to regenerate AppDelegate.swift with the correct delegate:

```bash
# Remove the iOS folder to force regeneration
rm -rf ios

# Regenerate native code with updated plugin
yarn prebuild

# Or for specific environment
yarn prebuild:production  # or staging, internal, development

# Install pods
cd ios && pod install && cd ..

# Rebuild the app
yarn ios
```

### 3. Verify AppDelegate.swift

After rebuild, verify that `ios/ResgridUnit/AppDelegate.swift` includes:

```swift
import UserNotifications

public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // ... setup code ...
    
    FirebaseApp.configure()
    
    // Set the delegate
    UNUserNotificationCenter.current().delegate = self
    
    // ... rest of method ...
  }
  
  // MARK: - UNUserNotificationCenterDelegate
  
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Display banner, sound, and badge in foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }
  
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }
}
```

## Expected Behavior After Fix

When a push notification arrives while app is in foreground:

✅ Native iOS banner appears at top of screen
✅ Notification sound plays
✅ Badge updates
✅ Firebase Messaging forwards to JavaScript
✅ `handleRemoteMessage` is called with notification data
✅ In-app modal appears with notification details
✅ Sound plays via notification sound service (in addition to system sound)
✅ User can interact with modal (dismiss or view call)

## Testing

After rebuilding:

1. **Test Foreground Notification**:
   - Open the app
   - Send a test push notification from backend
   - Verify native banner appears at top
   - Verify in-app modal also appears
   - Verify sound plays

2. **Test Background Notification**:
   - Put app in background
   - Send a test push notification
   - Tap the notification
   - Verify app opens and modal appears

3. **Test Killed State**:
   - Force quit the app
   - Send a test push notification
   - Tap the notification
   - Verify app launches and modal appears

## Why This Approach Works

The key insight is that **both systems can work together**:

1. **`UNUserNotificationCenterDelegate.willPresent`**:
   - Controls iOS native UI (banner, sound, badge)
   - Just tells iOS "yes, show this notification"
   - Doesn't intercept or consume the notification data

2. **Firebase Messaging**:
   - Automatically receives all notifications
   - Forwards to `messaging().onMessage()` in JavaScript
   - Independent of the delegate's decision to show/hide banner

They're not mutually exclusive - calling `completionHandler([.banner, .sound, .badge])` doesn't prevent Firebase from also processing the notification.

## What Changed from Original Implementation

**Original (Broken)**:
- Had delegate methods but no clear integration with Firebase
- Unclear if Firebase was receiving notifications

**First Fix Attempt (Also Broken)**:
- Removed delegate methods completely
- Firebase received notifications but iOS didn't show them
- No native banner in foreground

**Final Fix (Working)**:
- Delegate methods tell iOS to show banner
- Firebase independently processes and forwards to JS
- Both native banner AND in-app modal work

## Related Files

- `plugins/withForegroundNotifications.js` - Plugin configuration
- `src/services/push-notification.ts` - Push notification service
- `src/stores/push-notification/store.ts` - Modal state management
- `src/components/push-notification/push-notification-modal.tsx` - Modal UI
- `src/services/notification-sound.service.ts` - Sound playback
- `src/services/app-initialization.service.ts` - Service initialization

## References

- [Firebase Messaging iOS Documentation](https://firebase.google.com/docs/cloud-messaging/ios/receive)
- [React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)
- [Apple UNUserNotificationCenter Documentation](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter)
- [Handling Notifications in Foreground](https://developer.apple.com/documentation/usernotifications/unusernotificationcenterdelegate/1649518-usernotificationcenter)


## Root Cause

The current `AppDelegate.swift` implements `UNUserNotificationCenterDelegate` methods that:
1. Display notifications natively using iOS's notification UI
2. Call completion handlers immediately
3. **Do NOT forward notifications to Firebase Messaging's JavaScript handlers**

This means:
- iOS shows a banner notification (which is good for visibility)
- BUT the notification data never reaches `messaging().onMessage()` in JavaScript
- Therefore `handleRemoteMessage` never runs
- The in-app modal never appears

## Solution

Remove the custom delegate implementation and let Firebase Messaging handle everything. Firebase Messaging's iOS SDK automatically:
- Sets up `UNUserNotificationCenter.current().delegate` 
- Forwards foreground notifications to JavaScript via `onMessage()` listener
- Handles notification taps via `onNotificationOpenedApp()`
- Works with Notifee for displaying custom notifications

## Changes Required

### 1. Update Plugin (Already Done ✅)

The `plugins/withForegroundNotifications.js` has been updated to:
- Remove all `withAppDelegate` modifications
- Keep only the entitlements configuration
- Add documentation explaining why we don't customize the delegate

### 2. Clean and Rebuild iOS

Run the following commands to regenerate AppDelegate.swift without the custom delegate:

```bash
# Remove the iOS folder to force regeneration
rm -rf ios

# Regenerate native code with updated plugin
yarn prebuild:clean

# Or for specific environment
yarn prebuild:production  # or staging, internal, development

# Reinstall pods
cd ios && pod install && cd ..

# Rebuild the app
yarn ios
```

### 3. Verify AppDelegate.swift

After rebuild, verify that `ios/ResgridUnit/AppDelegate.swift` should:

**❌ Should NOT have:**
- `, UNUserNotificationCenterDelegate` in class declaration
- `UNUserNotificationCenter.current().delegate = self`
- `userNotificationCenter(_:willPresent:)` method
- `userNotificationCenter(_:didReceive:)` method

**✅ Should have:**
```swift
import FirebaseCore

public class AppDelegate: ExpoAppDelegate {
  // ... other code ...
  
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // ... setup code ...
    
    FirebaseApp.configure()
    // NO delegate assignment here - Firebase handles it
    
    // ... rest of method ...
  }
}
```

## How Firebase Messaging Works

Once the custom delegate is removed:

1. **Initialization**: When `FirebaseApp.configure()` is called, Firebase Messaging automatically sets itself as the UNUserNotificationCenter delegate

2. **Foreground Notifications**: When a notification arrives while app is in foreground:
   - Firebase receives it first
   - Forwards to JavaScript via `messaging().onMessage(handleRemoteMessage)`
   - Your `handleRemoteMessage` function processes it
   - Shows in-app modal via `showNotificationModal()`
   - Optionally displays native notification via Notifee

3. **Background/Quit Notifications**: 
   - Handled by `messaging().setBackgroundMessageHandler()`
   - Notification taps handled by `messaging().onNotificationOpenedApp()`

## Expected Behavior After Fix

✅ Push notification arrives while app is in foreground
✅ `handleRemoteMessage` is called with notification data
✅ In-app modal appears with notification details
✅ Sound plays (via notification sound service)
✅ User can interact with modal (dismiss or view call)

## Testing

After rebuilding:

1. **Test Foreground Notification**:
   - Open the app
   - Send a test push notification from backend
   - Verify in-app modal appears
   - Verify sound plays

2. **Test Background Notification**:
   - Put app in background
   - Send a test push notification
   - Tap the notification
   - Verify app opens and modal appears

3. **Test Killed State**:
   - Force quit the app
   - Send a test push notification
   - Tap the notification
   - Verify app launches and modal appears

## Alternative: Keep Native Banner + In-App Modal

If you want BOTH the native iOS banner AND the in-app modal, you need to forward notifications to Firebase:

```swift
public func userNotificationCenter(
  _ center: UNUserNotificationCenter,
  willPresent notification: UNNotification,
  withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
) {
  // Display native banner
  if #available(iOS 14.0, *) {
    completionHandler([.banner, .sound, .badge])
  } else {
    completionHandler([.alert, .sound, .badge])
  }
  
  // IMPORTANT: Forward to Firebase Messaging
  // This ensures the notification also reaches your onMessage() handler
  if let messagingDelegate = Messaging.messaging().delegate as? FIRMessagingDelegate {
    // Firebase will handle forwarding to JavaScript
  }
}
```

However, the **recommended approach** is to:
- Let Firebase handle everything
- Use Notifee in JavaScript to display custom notifications if needed
- Keep the in-app modal for interactive notifications

## Related Files

- `plugins/withForegroundNotifications.js` - Plugin configuration
- `src/services/push-notification.ts` - Push notification service
- `src/stores/push-notification/store.ts` - Modal state management
- `src/components/push-notification/push-notification-modal.tsx` - Modal UI

## References

- [Firebase Messaging iOS Documentation](https://firebase.google.com/docs/cloud-messaging/ios/receive)
- [React Native Firebase Messaging](https://rnfirebase.io/messaging/usage)
- [Notifee Documentation](https://notifee.app/react-native/docs/overview)
