# AirPods/Bluetooth Earbuds PTT Support

This document describes the implementation of Push-to-Talk (PTT) support for AirPods and other standard Bluetooth earbuds in the Resgrid Unit app.

## Overview

The implementation adds support for using media button presses from AirPods, Galaxy Buds, and other Bluetooth earbuds to control the microphone mute/unmute state during LiveKit voice calls.

## Architecture

### Components

1. **MediaButtonService** (`src/services/media-button.service.ts`)
   - Singleton service that manages media button event listeners
   - Handles double-tap detection
   - Provides PTT toggle/push-to-talk modes
   - Integrates with LiveKit for microphone control

2. **Native Modules**
   - **iOS**: `MediaButtonModule.swift` - Uses `MPRemoteCommandCenter` to capture media control events
   - **Android**: `MediaButtonModule.kt` - Uses `MediaSession` to capture media button events

3. **Store Updates** (`src/stores/app/bluetooth-audio-store.ts`)
   - Added `MediaButtonPTTSettings` interface
   - Added settings management actions

4. **LiveKit Integration** (`src/stores/app/livekit-store.ts`)
   - Initializes media button service when connecting to a room
   - Cleans up service when disconnecting

## How It Works

### iOS (AirPods)

1. When a LiveKit room is connected, the `MediaButtonModule` sets up `MPRemoteCommandCenter` listeners
2. Play/Pause button presses on AirPods trigger the `togglePlayPauseCommand`
3. The event is sent to JavaScript via `NativeEventEmitter`
4. `MediaButtonService` processes the event and toggles the microphone state

### Android (Bluetooth Earbuds)

1. When a LiveKit room is connected, the `MediaButtonModule` creates a `MediaSession`
2. Button presses are captured via the `MediaSession.Callback`
3. The event is sent to JavaScript via `DeviceEventManagerModule`
4. `MediaButtonService` processes the event and toggles the microphone state

## PTT Modes

### Toggle Mode (Default)
- Single press toggles between muted and unmuted states
- Best for hands-free operation

### Push-to-Talk Mode
- Press and hold to unmute
- Release to mute
- Better for traditional radio-style communication

## Settings

The `MediaButtonPTTSettings` interface provides the following configuration:

```typescript
interface MediaButtonPTTSettings {
  enabled: boolean;               // Enable/disable media button PTT
  pttMode: 'toggle' | 'push_to_talk';
  usePlayPauseForPTT: boolean;    // Use play/pause button for PTT
  doubleTapAction: 'none' | 'toggle_mute';
  doubleTapTimeoutMs: number;     // Default: 400ms
}
```

## Usage

### Enabling/Disabling
```typescript
import { useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';

// Enable media button PTT
useBluetoothAudioStore.getState().setMediaButtonPTTEnabled(true);

// Update settings
useBluetoothAudioStore.getState().setMediaButtonPTTSettings({
  pttMode: 'push_to_talk',
  doubleTapAction: 'toggle_mute',
});
```

### Manual Control (Advanced)
```typescript
import { mediaButtonService } from '@/services/media-button.service';

// Enable microphone
await mediaButtonService.enableMicrophone();

// Disable microphone
await mediaButtonService.disableMicrophone();

// Update settings
mediaButtonService.updateSettings({
  pttMode: 'toggle',
});
```

## Audio Feedback

The service provides audio feedback for PTT actions:
- `playStartTransmittingSound()` - Played when microphone is enabled
- `playStopTransmittingSound()` - Played when microphone is disabled

## Supported Devices

### Tested
- Apple AirPods (all generations)
- Apple AirPods Pro
- Apple AirPods Max

### Expected to Work
- Samsung Galaxy Buds
- Sony WF/WH series
- Jabra Elite series
- Any Bluetooth earbuds with media control buttons

## Limitations

1. **Background Mode**: iOS requires CallKeep to be active for background audio support
2. **Button Mapping**: Some earbuds may have non-standard button mappings
3. **Double-Tap Detection**: Natural double-tap gestures on AirPods may conflict with the double-tap PTT action

## Troubleshooting

### Media buttons not working

1. Ensure Bluetooth is connected and the earbuds are the active audio device
2. Check that `mediaButtonPTTSettings.enabled` is `true`
3. On iOS, ensure the app has audio session properly configured
4. On Android, check that no other app is capturing media button events

### Delays in response

- Adjust `doubleTapTimeoutMs` to a lower value if not using double-tap feature
- Set `doubleTapAction` to `'none'` for immediate response

## Files Modified/Created

### New Files
- `src/services/media-button.service.ts` - Main service
- `src/services/__tests__/media-button.service.test.ts` - Tests
- `ios/ResgridUnit/MediaButtonModule.swift` - iOS native module
- `ios/ResgridUnit/MediaButtonModule.m` - iOS bridge
- `android/app/src/main/java/com/resgrid/unit/development/MediaButtonModule.kt` - Android native module
- `android/app/src/main/java/com/resgrid/unit/development/MediaButtonPackage.kt` - Android package
- `plugins/withMediaButtonModule.js` - Expo config plugin
- `docs/airpods-ptt-support.md` - This documentation

### Modified Files
- `src/stores/app/bluetooth-audio-store.ts` - Added media button settings
- `src/stores/app/livekit-store.ts` - Integration with room connection/disconnection
- `ios/ResgridUnit/ResgridUnit-Bridging-Header.h` - Added React Native imports
- `android/app/src/main/java/com/resgrid/unit/development/MainApplication.kt` - Registered package
- `app.config.ts` - Added config plugin
