const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Adds UNUserNotificationCenterDelegate to AppDelegate to handle foreground notifications
 * and adds necessary entitlements for push notifications
 */
const withForegroundNotifications = (config) => {
  // Add push notification entitlements
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;

    // Add APS environment for push notifications
    entitlements['aps-environment'] = 'production';

    // Add critical alerts and time-sensitive notifications for production/internal builds
    const env = process.env.APP_ENV || config.extra?.APP_ENV;
    if (env === 'production' || env === 'internal') {
      entitlements['com.apple.developer.usernotifications.critical-alerts'] = true;
      entitlements['com.apple.developer.usernotifications.time-sensitive'] = true;
    }

    return config;
  });

  // Add AppDelegate modifications
  return withAppDelegate(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Add UserNotifications import if not present
    if (!contents.includes('import UserNotifications')) {
      contents = contents.replace(/import ReactAppDependencyProvider/, 'import ReactAppDependencyProvider\nimport UserNotifications');
    }

    // Add UNUserNotificationCenterDelegate to class declaration
    if (!contents.includes('UNUserNotificationCenterDelegate')) {
      contents = contents.replace(/public class AppDelegate: ExpoAppDelegate \{/, 'public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {');
    }

    // Set the delegate in didFinishLaunchingWithOptions
    if (!contents.includes('UNUserNotificationCenter.current().delegate = self')) {
      // Find the position after FirebaseApp.configure()
      const firebaseConfigPattern = /FirebaseApp\.configure\(\)\n\/\/ @generated end @react-native-firebase\/app-didFinishLaunchingWithOptions/;

      contents = contents.replace(
        firebaseConfigPattern,
        `FirebaseApp.configure()
// @generated end @react-native-firebase/app-didFinishLaunchingWithOptions
    
    // Set the UNUserNotificationCenter delegate to handle foreground notifications
    UNUserNotificationCenter.current().delegate = self`
      );
    }

    // Add the userNotificationCenter delegate method before the Linking API section
    if (!contents.includes('userNotificationCenter(_ center: UNUserNotificationCenter')) {
      const linkingApiPattern = /(\s+)(\/\/ Linking API)/;

      const delegateMethod = `
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
    // When using Notifee (v7+), it will handle notification taps automatically
    // This method still needs to be implemented to receive the notification response
    // The response will be handled by Notifee's onBackgroundEvent/onForegroundEvent
    completionHandler()
  }

$1$2`;

      contents = contents.replace(linkingApiPattern, delegateMethod);
    }

    modResults.contents = contents;
    return config;
  });
};

module.exports = withForegroundNotifications;
