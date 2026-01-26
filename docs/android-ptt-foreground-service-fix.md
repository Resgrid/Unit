# Android PTT Foreground Service Type Fix

## Issue
When attempting to join a PTT (Push-to-Talk) call on Android, the app crashed with a `SecurityException`:

```
java.lang.SecurityException: Starting FGS with type microphone callerApp=ProcessRecord{...} targetSDK=35 requires permissions: all of the permissions allOf=true [android.permission.FOREGROUND_SERVICE_MICROPHONE] any of the permissions allOf=false [android.permission.RECORD_AUDIO, ...]
```

## Root Cause
Starting with Android 14 (API 34), and strictly enforced in Android 15 (SDK 35), foreground services must explicitly declare their service type when started. The app's `AndroidManifest.xml` correctly declared:
- `android.permission.FOREGROUND_SERVICE_MICROPHONE` permission
- The `ForegroundService` with `android:foregroundServiceType="microphone|mediaPlayback|connectedDevice"`
- `android.permission.RECORD_AUDIO` permission

However, when displaying the notification to start the foreground service, the notification configuration did not specify the `foregroundServiceTypes` parameter.

## Solution
Added the `foregroundServiceTypes` parameter to the Notifee notification configuration when starting the PTT call foreground service.

### Changes Made

#### 1. Updated livekit-store.ts imports
Added `AndroidForegroundServiceType` to the Notifee imports:

```typescript
import notifee, { AndroidForegroundServiceType, AndroidImportance } from '@notifee/react-native';
```

#### 2. Updated Notification Configuration
Modified the foreground service notification to include the service type:

```typescript
await notifee.displayNotification({
  title: 'Active PTT Call',
  body: 'There is an active PTT call in progress.',
  android: {
    channelId: 'notif',
    asForegroundService: true,
    foregroundServiceTypes: [AndroidForegroundServiceType.MICROPHONE],
    smallIcon: 'ic_launcher',
  },
});
```

## Files Modified
- `src/stores/app/livekit-store.ts`

## Testing
To verify the fix:
1. Rebuild the Android app (`yarn prebuild --clean` then build)
2. Join a PTT call
3. Verify the foreground service notification appears
4. Ensure no crash occurs when joining the call

## References
- [Android Foreground Services Documentation](https://developer.android.com/develop/background-work/services/foreground-services)
- [Notifee Android Foreground Service Types](https://notifee.app/react-native/docs/android/foreground-service)
- Android 14+ requires explicit foreground service type declarations
