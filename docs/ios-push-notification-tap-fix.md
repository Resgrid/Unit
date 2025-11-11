# iOS Push Notification Tap Modal Fix

## Problem

When users tapped on push notifications on iOS, the in-app notification modal was not launching. The notification would be dismissed, but the modal that should show the notification details (with options like "View Call") was not appearing.

## Root Cause Analysis

The issue was a combination of **timing problems** and **notification handling conflicts**:

### Issue 1: Notifee vs Firebase Messaging Conflict

According to [React Native Firebase documentation](https://rnfirebase.io/messaging/usage):
> **Note: If you use @notifee/react-native, since v7.0.0, `onNotificationOpenedApp` and `getInitialNotification` will no longer trigger as notifee will handle the event.**

The app uses Notifee v9.1.8, which means:
- Notifee intercepts notification tap events **for notifications displayed by Notifee**
- However, when iOS displays notifications **natively via AppDelegate** (as configured), Notifee doesn't track these
- This creates a gap where neither Firebase Messaging nor Notifee properly handle the tap

### Issue 2: Timing Problem

Even when handlers fire, the notification tap handlers were executing before the React component tree was fully mounted:

1. **On iOS**, when a notification is tapped, the native handlers fire immediately
2. The Firebase handlers (`onNotificationOpenedApp` and `getInitialNotification`) execute
3. These handlers try to show the modal before the `<PushNotificationModal />` component is rendered
4. Result: Modal state updates but nothing appears

## Solution

### 1. Added Delays to Notification Tap Handlers

Added appropriate delays to ensure the React component tree is fully mounted before attempting to show the modal:

#### `onNotificationOpenedApp` Handler (Background → Foreground)
```typescript
messaging().onNotificationOpenedApp((remoteMessage) => {
  // Extract notification data...
  
  // Use a small delay (300ms) to ensure app is fully initialized
  setTimeout(() => {
    if (eventCode && typeof eventCode === 'string') {
      usePushNotificationModalStore.getState().showNotificationModal(notificationData);
    }
  }, 300);
});
```

#### `getInitialNotification` Handler (Killed State → Launched)
```typescript
// Use a longer delay (1000ms + 500ms) to ensure React tree is fully mounted
setTimeout(() => {
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        // Extract notification data...
        
        // Additional delay to ensure app is fully loaded
        setTimeout(() => {
          if (eventCode && typeof eventCode === 'string') {
            usePushNotificationModalStore.getState().showNotificationModal(notificationData);
          }
        }, 500);
      }
    });
}, 1000);
```

### 2. Enhanced Logging

Added detailed logging to help debug notification tap issues:

```typescript
logger.info({
  message: 'Notification opened app (from background)',
  context: {
    data: remoteMessage.data,
    notification: remoteMessage.notification,
  },
});

logger.info({
  message: 'Showing notification modal from tap (background)',
  context: { eventCode, title },
});
```

This makes it easier to trace notification taps through the logs and verify that the handlers are firing correctly.

### 3. Notifee Event Handlers

The Notifee event handlers (`onForegroundEvent` and `onBackgroundEvent`) were also updated with better logging, though they primarily handle notifications displayed BY Notifee, not the native iOS system notifications.

## How It Works Now

### Notification Flow on iOS

1. **Push notification arrives** → Firebase Messaging receives it
2. **iOS displays notification** → Native system shows banner (via AppDelegate)
3. **User taps notification**:
   - If **app is in background**: `onNotificationOpenedApp` fires
   - If **app was killed**: `getInitialNotification` returns the notification
4. **Handler waits** → Appropriate delay (300ms or 1500ms total) ensures app is ready
5. **Modal appears** → `showNotificationModal()` is called and the modal displays

### Timing Breakdown

- **Background → Foreground**: 300ms delay
  - App is already running, just needs brief moment to restore state
  
- **Killed → Launched**: 1500ms total delay (1000ms + 500ms)
  - App needs time to fully initialize React, render component tree, mount providers, etc.
  - Longer delay ensures everything is ready

## Testing Scenarios

### Test 1: Background Tap
1. Have app running in background
2. Receive push notification
3. Tap notification banner
4. **Expected**: App comes to foreground, modal appears after ~300ms

### Test 2: Killed State Tap
1. Kill the app completely (swipe away from multitasking)
2. Receive push notification
3. Tap notification in notification center
4. **Expected**: App launches, modal appears after ~1.5 seconds

### Test 3: Foreground Notification
1. Have app in foreground
2. Receive push notification
3. Notification banner appears (via native iOS system)
4. Tap banner
5. **Expected**: Modal appears immediately or after ~300ms

## Important Notes

### Why Different Delays?

- **Background→Foreground (300ms)**: The app is already running with React tree mounted, just needs brief moment for state restoration
  
- **Killed→Launched (1500ms)**: The app needs time for:
  - Native code initialization
  - React Native bridge setup
  - Component tree mounting
  - Provider initialization (SafeAreaProvider, GestureHandler, etc.)
  - Store hydration

### Delays Are Conservative

The delays are intentionally conservative (longer than strictly necessary) to ensure reliability across different device speeds and conditions. A slightly longer delay is better than a modal that never appears.

### Alternative Approaches Considered

1. **State-based approach**: Check if React tree is mounted before showing modal
   - Rejected: Would require complex lifecycle tracking
   
2. **Event-based approach**: Wait for specific app initialization event
   - Rejected: Would require significant refactoring of initialization flow
   
3. **Queue-based approach**: Queue notification taps until ready
   - Rejected: Overly complex for this use case

The setTimeout approach is simple, reliable, and works across all scenarios.

## Logs to Monitor

When debugging notification tap issues, look for these log messages:

```
✓ "Notification opened app (from background)" - Handler fired
✓ "Showing notification modal from tap (background)" - About to show modal
✓ "Showing push notification modal" - Store received request
✓ Modal should now be visible
```

If you see the first two logs but not the last two, there may be an issue with the store or component tree.

## Related Files

- `/src/services/push-notification.ts` - Push notification service with tap handlers
- `/src/components/push-notification/push-notification-modal.tsx` - Modal component
- `/src/stores/push-notification/store.ts` - Zustand store for modal state
- `/src/app/_layout.tsx` - Root layout where PushNotificationModal is rendered

## References

- [iOS Push Notification Fix Documentation](./ios-foreground-notifications-fix.md)
- [Push Notification FCM Refactor](./push-notification-fcm-refactor.md)
