const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');

/**
 * Adds UNUserNotificationCenterDelegate to AppDelegate to handle foreground notifications
 * and adds necessary entitlements for push notifications.
 *
 * IMPORTANT: We implement the delegate methods to display notifications in foreground,
 * but we do NOT intercept the notification data. Firebase Messaging will still receive
 * the notifications and forward them to the onMessage() listener in JavaScript.
 *
 * The key is that we're only implementing willPresent (to show the banner) and
 * NOT preventing Firebase from doing its job of forwarding to JS.
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
    // This allows us to display notifications while Firebase Messaging also processes them
    UNUserNotificationCenter.current().delegate = self`
      );
    }

    // Add the userNotificationCenter delegate method before the Linking API section
    if (!contents.includes('userNotificationCenter(_ center: UNUserNotificationCenter')) {
      const linkingApiPattern = /(\s+)(\/\/ Linking API)/;

      const delegateMethod = `
  // MARK: - UNUserNotificationCenterDelegate
  
  // Handle foreground notifications - display them even when app is active
  // This method runs BEFORE Firebase Messaging processes the notification
  // Both this method AND Firebase's onMessage() will be called
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    // Display notification banner, play sound, and update badge
    // This shows the native iOS notification banner in foreground
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
    
    // NOTE: We do NOT need to manually forward to Firebase here.
    // Firebase Messaging automatically receives the notification and calls onMessage()
    // This method just controls whether iOS displays the native notification UI
  }
  
  // Handle notification tap - when user taps on a notification
  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // Firebase Messaging will handle this via onNotificationOpenedApp()
    // We just need to call the completion handler
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
