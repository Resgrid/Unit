const { withDangerousMod, withInfoPlist, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Resolves the iOS app target name so bridge files land in the correct folder.
 *
 * Resolution order:
 *   1. config.modRequest.projectName  (set by Expo during prebuild — preferred)
 *   2. Parse ios/<project>.xcodeproj/project.pbxproj and find the PBXNativeTarget
 *      whose productType is "com.apple.product-type.application"
 *
 * Throws an explicit error if neither source yields a name, so the developer is
 * informed immediately instead of files being silently written to the wrong path.
 *
 * @param {object} config  - Expo config object inside withDangerousMod callback
 * @param {string} projectRoot - absolute path to the project root
 * @returns {string} iOS app target / folder name
 */
function resolveIosAppName(config, projectRoot) {
  // 1. Trust Expo's own projectName first (present during `expo prebuild`)
  if (config.modRequest.projectName) {
    return config.modRequest.projectName;
  }

  // 2. Derive the name by parsing project.pbxproj
  const iosDir = path.join(projectRoot, 'ios');
  if (fs.existsSync(iosDir)) {
    let pbxprojPath = null;
    try {
      const entries = fs.readdirSync(iosDir);
      const xcodeprojDir = entries.find((e) => e.endsWith('.xcodeproj'));
      if (xcodeprojDir) {
        pbxprojPath = path.join(iosDir, xcodeprojDir, 'project.pbxproj');
      }
    } catch (_) {
      // iosDir not readable — fall through to throw below
    }

    if (pbxprojPath && fs.existsSync(pbxprojPath)) {
      const pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
      // Within a PBXNativeTarget block the fields appear in this order:
      //   name = TargetName;
      //   productName = TargetName;
      //   productReference = <hash> /* TargetName.app */;
      //   productType = "com.apple.product-type.application";
      // The `s` (dotAll) flag lets the pattern span newlines.
      const match = pbxContent.match(
        /name\s*=\s*([^\s;]+)\s*;\s*productName\s*=\s*[^;]+;\s*productReference\s*=\s*[^;]+;\s*productType\s*=\s*"com\.apple\.product-type\.application"/s
      );
      if (match) {
        return match[1].trim();
      }
    }
  }

  throw new Error(
    '[withCheckInLiveActivity] Cannot determine the iOS app target name.\n' +
      '  • config.modRequest.projectName is not set\n' +
      '  • No PBXNativeTarget with productType=com.apple.product-type.application\n' +
      '    was found in ios/*.xcodeproj/project.pbxproj\n' +
      'Ensure the iOS project has been initialised via `npx expo prebuild` before\n' +
      'running this plugin, or set the `name` field in your app.config.'
  );
}

/**
 * CheckInTimerAttributes.swift — ActivityKit attributes for the check-in timer Live Activity
 */
const ATTRIBUTES_SWIFT = `import ActivityKit
import Foundation

struct CheckInTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedMinutes: Int
        var status: String
        var lastCheckIn: String
    }

    var callName: String
    var callNumber: String
    var timerName: String
    var durationMinutes: Int
}
`;

/**
 * CheckInTimerLiveActivity.swift — SwiftUI views for lock screen and Dynamic Island
 */
const LIVE_ACTIVITY_SWIFT = `import ActivityKit
import SwiftUI
import WidgetKit

struct CheckInTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CheckInTimerAttributes.self) { context in
            // Lock screen / banner UI
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\\(context.attributes.callName) #\\(context.attributes.callNumber)")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(context.attributes.timerName)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\\(context.state.elapsedMinutes)/\\(context.attributes.durationMinutes) min")
                        .font(.title3)
                        .bold()
                        .foregroundColor(statusColor(context.state.status))
                    Text(context.state.status)
                        .font(.caption)
                        .foregroundColor(statusColor(context.state.status))
                }
            }
            .padding()
            .background(Color.black)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.attributes.timerName)
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\\(context.state.elapsedMinutes)m")
                        .font(.title3)
                        .foregroundColor(statusColor(context.state.status))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(value: Double(context.state.elapsedMinutes), total: Double(context.attributes.durationMinutes))
                        .tint(statusColor(context.state.status))
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundColor(statusColor(context.state.status))
            } compactTrailing: {
                Text("\\(context.state.elapsedMinutes)m")
                    .foregroundColor(statusColor(context.state.status))
            } minimal: {
                Image(systemName: "timer")
                    .foregroundColor(statusColor(context.state.status))
            }
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "Ok": return .green
        case "Warning": return .yellow
        case "Overdue": return .red
        default: return .gray
        }
    }
}
`;

/**
 * CheckInTimerWidgetBundle.swift — Widget extension entry point
 */
const WIDGET_BUNDLE_SWIFT = `import SwiftUI
import WidgetKit

@main
struct CheckInTimerWidgetBundle: WidgetBundle {
    var body: some Widget {
        CheckInTimerLiveActivity()
    }
}
`;

/**
 * CheckInTimerActivityManager.swift — Native bridge for managing Live Activities from RN
 */
const ACTIVITY_MANAGER_SWIFT = `import ActivityKit
import Foundation
import React

@objc(CheckInTimerActivityManager)
class CheckInTimerActivityManager: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc
    func startActivity(_ callName: String, callNumber: String, timerName: String, durationMinutes: Int,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            let attributes = CheckInTimerAttributes(
                callName: callName, callNumber: callNumber,
                timerName: timerName, durationMinutes: durationMinutes)
            let state = CheckInTimerAttributes.ContentState(
                elapsedMinutes: 0, status: "Ok", lastCheckIn: "")
            do {
                let _ = try Activity.request(attributes: attributes, contentState: state)
                resolve(true)
            } catch {
                reject("LIVE_ACTIVITY_ERROR", error.localizedDescription, error)
            }
        } else {
            resolve(false)
        }
    }

    @objc
    func updateActivity(_ elapsedMinutes: Int, status: String,
                         resolver resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            Task {
                let state = CheckInTimerAttributes.ContentState(
                    elapsedMinutes: elapsedMinutes, status: status, lastCheckIn: "")
                for activity in Activity<CheckInTimerAttributes>.activities {
                    await activity.update(using: state)
                }
                resolve(true)
            }
        } else {
            resolve(false)
        }
    }

    @objc
    func endActivity(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.1, *) {
            Task {
                for activity in Activity<CheckInTimerAttributes>.activities {
                    await activity.end(dismissalPolicy: .immediate)
                }
                resolve(true)
            }
        } else {
            resolve(false)
        }
    }
}
`;

/**
 * CheckInTimerActivityBridge.m — ObjC bridge
 */
const BRIDGE_OBJC = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CheckInTimerActivityManager, NSObject)

RCT_EXTERN_METHOD(startActivity:(NSString *)callName
                  callNumber:(NSString *)callNumber
                  timerName:(NSString *)timerName
                  durationMinutes:(int)durationMinutes
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateActivity:(int)elapsedMinutes
                  status:(NSString *)status
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActivity:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
`;

/**
 * Info.plist for the CheckInTimerWidget extension target.
 * Required by Xcode; bundle metadata is resolved at build time via build settings.
 */
const WIDGET_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>CheckInTimerWidget</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
`;

const withCheckInLiveActivity = (config) => {
  // Step 1: Add NSSupportsLiveActivities to Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });

  // Step 2: Add live activity entitlement
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.developer.live-activity'] = true;
    return config;
  });

  // Step 3: Write Swift Widget Extension files and native bridge
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // Write Widget Extension files
      const widgetDir = path.join(projectRoot, 'ios', 'CheckInTimerWidget');
      if (!fs.existsSync(widgetDir)) {
        fs.mkdirSync(widgetDir, { recursive: true });
      }

      fs.writeFileSync(path.join(widgetDir, 'CheckInTimerAttributes.swift'), ATTRIBUTES_SWIFT);
      fs.writeFileSync(path.join(widgetDir, 'CheckInTimerLiveActivity.swift'), LIVE_ACTIVITY_SWIFT);
      fs.writeFileSync(path.join(widgetDir, 'CheckInTimerWidgetBundle.swift'), WIDGET_BUNDLE_SWIFT);
      fs.writeFileSync(path.join(widgetDir, 'Info.plist'), WIDGET_INFO_PLIST);

      // Write native bridge files to the main app directory.
      // resolveIosAppName throws explicitly if the target cannot be determined,
      // preventing files from being written to a wrong/hardcoded path.
      const appName = resolveIosAppName(config, projectRoot);
      const appDir = path.join(projectRoot, 'ios', appName);
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }

      fs.writeFileSync(path.join(appDir, 'CheckInTimerActivityManager.swift'), ACTIVITY_MANAGER_SWIFT);
      fs.writeFileSync(path.join(appDir, 'CheckInTimerActivityBridge.m'), BRIDGE_OBJC);

      return config;
    },
  ]);

  // Step 4: Add Widget Extension target to Xcode project and wire all required
  // build phases, source files, and frameworks so Live Activities actually build.
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const appBundleId = config.ios?.bundleIdentifier;

    if (!appBundleId) {
      throw new Error(
        '[withCheckInLiveActivity] config.ios.bundleIdentifier is required ' +
          'to derive the widget extension bundle identifier.'
      );
    }

    const WIDGET_NAME = 'CheckInTimerWidget';
    const widgetBundleId = `${appBundleId}.${WIDGET_NAME}`;

    // Idempotent: skip if the target was already added in a previous prebuild run.
    // addTarget stores names with surrounding quotes in the comment key, so check both forms.
    if (project.pbxTargetByName(WIDGET_NAME) || project.pbxTargetByName(`"${WIDGET_NAME}"`)) {
      return config;
    }

    // 1. Create the PBXNativeTarget.
    //    addTarget('app_extension') also:
    //      - adds an "Embed App Extensions" CopyFiles phase to the main target
    //      - adds a PBXTargetDependency from main app → widget
    //      - creates Debug/Release XCBuildConfigurations with basic defaults
    const widgetTarget = project.addTarget(WIDGET_NAME, 'app_extension', WIDGET_NAME, widgetBundleId);

    // 2. Add the three build phases the widget target needs.
    //    These must be added before files/frameworks are wired, because the
    //    addSourceFile / addFramework helpers find phases by scanning the
    //    target's buildPhases array.
    project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', widgetTarget.uuid);
    project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', widgetTarget.uuid);
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', widgetTarget.uuid);

    // 3. Create a PBX group for the widget folder and attach it to the project's
    //    main group so the files appear in the Xcode file navigator.
    const { uuid: widgetGroupUuid } = project.addPbxGroup([], WIDGET_NAME, WIDGET_NAME);
    const { firstProject } = project.getFirstProject();
    const mainGroup = project.getPBXGroupByKey(firstProject.mainGroup);
    if (mainGroup && !mainGroup.children.find((c) => c.comment === WIDGET_NAME)) {
      mainGroup.children.push({ value: widgetGroupUuid, comment: WIDGET_NAME });
    }

    // 4. Add Swift source files to the widget group and to the widget's Sources phase.
    //    Passing the group key as the third argument to addSourceFile ensures the
    //    file reference lands in the right PBX group; opt.target routes the build
    //    file to the widget's PBXSourcesBuildPhase rather than the main app's.
    const SWIFT_SOURCES = [
      'CheckInTimerAttributes.swift',
      'CheckInTimerLiveActivity.swift',
      'CheckInTimerWidgetBundle.swift',
    ];
    for (const filename of SWIFT_SOURCES) {
      project.addSourceFile(
        `${WIDGET_NAME}/${filename}`,
        { target: widgetTarget.uuid },
        widgetGroupUuid
      );
    }

    // 5. Link WidgetKit and ActivityKit into the widget's Frameworks phase.
    //    opt.target directs addToPbxFrameworksBuildPhase to use the widget's
    //    PBXFrameworksBuildPhase (added above) instead of the main app's.
    project.addFramework('WidgetKit.framework', { target: widgetTarget.uuid });
    project.addFramework('ActivityKit.framework', { target: widgetTarget.uuid });

    // 6. Patch build settings on both Debug and Release configurations so the
    //    widget compiles as a Swift 5 app-extension targeting iOS 16.1+.
    const targetSection = project.pbxNativeTargetSection();
    const buildConfigListId = targetSection[widgetTarget.uuid].buildConfigurationList;
    const buildConfigList = project.pbxXCConfigurationList()[buildConfigListId];
    if (buildConfigList) {
      for (const { value: configUuid } of buildConfigList.buildConfigurations) {
        const buildConfig = project.pbxXCBuildConfigurationSection()[configUuid];
        if (buildConfig) {
          Object.assign(buildConfig.buildSettings, {
            // Override the default addTarget placeholder (TargetName-Info.plist)
            INFOPLIST_FILE: `"${WIDGET_NAME}/Info.plist"`,
            SWIFT_VERSION: '"5.0"',
            TARGETED_DEVICE_FAMILY: '"1,2"',
            // ActivityKit requires iOS 16.1 or later
            IPHONEOS_DEPLOYMENT_TARGET: '16.1',
            SKIP_INSTALL: 'YES',
            CODE_SIGN_STYLE: 'Automatic',
            MARKETING_VERSION: '"1.0"',
            CURRENT_PROJECT_VERSION: '1',
          });
        }
      }
    }

    return config;
  });

  return config;
};

module.exports = withCheckInLiveActivity;
