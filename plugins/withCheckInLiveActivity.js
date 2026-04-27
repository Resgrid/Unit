const { withDangerousMod, withInfoPlist, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

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

      // Write native bridge files to the main app directory
      const appName = config.modRequest.projectName || 'ResgridUnit';
      const appDir = path.join(projectRoot, 'ios', appName);
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }

      fs.writeFileSync(path.join(appDir, 'CheckInTimerActivityManager.swift'), ACTIVITY_MANAGER_SWIFT);
      fs.writeFileSync(path.join(appDir, 'CheckInTimerActivityBridge.m'), BRIDGE_OBJC);

      return config;
    },
  ]);

  // Step 4: Add Widget Extension target to Xcode project
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;

    // Add Widget Extension target with ActivityKit framework
    // Note: This is a simplified version. Full widget extension target creation
    // may require additional PBX configuration depending on the Xcode project structure.
    // The withDangerousMod above creates the files; the Xcode target may need
    // manual setup or a more complete config plugin for production builds.

    return config;
  });

  return config;
};

module.exports = withCheckInLiveActivity;
