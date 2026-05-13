const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches the Podfile and source files for Xcode 26+
 * compatibility with use_frameworks! :linkage => :static (required by
 * @react-native-firebase).
 *
 * Fixes three classes of errors:
 * 1. "include of non-modular header inside framework module" — sets
 *    CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES for all pods.
 * 2. "declaration of 'X' must be imported from module 'Y' before it is required"
 *    — adds use_modular_headers! so #import statements resolve correctly across
 *    framework module boundaries.
 * 3. "RCTPromiseRejectBlock must be imported from module 'RNFBApp.RNFBAppModule'"
 *    — patches RNFBMessaging source files to import RNFBAppModule explicitly.
 */
const withWebRTCFrameworkFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // 1. Add use_modular_headers! after use_frameworks! if not already present.
      if (!contents.includes('use_modular_headers!')) {
        const useFrameworksPattern = /use_frameworks!.*\n/g;
        const allMatches = [...contents.matchAll(useFrameworksPattern)];
        if (allMatches.length > 0) {
          const lastMatch = allMatches[allMatches.length - 1];
          const lastIdx = lastMatch.index + lastMatch[0].length;
          contents =
            contents.slice(0, lastIdx) + 'use_modular_headers!\n' + contents.slice(lastIdx);
        }
      }

      // 2. Add CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES to post_install.
      const marker = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';
      if (!contents.includes(marker)) {
        const hook = `
    # Fix non-modular header includes for Xcode 26+
    # Pods like livekit-react-native-webrtc and @react-native-firebase import
    # React Native headers inside their framework modules, which Xcode 26
    # treats as an error (-Werror,-Wnon-modular-include-in-framework-module).
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

        const anchor = 'react_native_post_install(';
        const anchorIdx = contents.lastIndexOf(anchor);
        if (anchorIdx === -1) {
          throw new Error('[withWebRTCFrameworkFix] Could not find react_native_post_install in Podfile');
        }

        let depth = 0;
        let insertAfter = anchorIdx;
        for (let i = anchorIdx; i < contents.length; i++) {
          if (contents[i] === '(') depth++;
          if (contents[i] === ')') {
            depth--;
            if (depth === 0) {
              insertAfter = i + 1;
              break;
            }
          }
        }

        if (insertAfter === anchorIdx || depth !== 0) {
          throw new Error(
            '[withWebRTCFrameworkFix] Unclosed parenthesis in react_native_post_install call — ' +
              'could not locate closing ")". Aborting to avoid corrupting the Podfile.'
          );
        }

        contents = contents.slice(0, insertAfter) + hook + contents.slice(insertAfter);
      }

      fs.writeFileSync(podfilePath, contents);

      // 3. Patch RNFBMessaging source files to import RNFBAppModule explicitly.
      //    With use_frameworks! :linkage => :static on Xcode 26, the module
      //    system requires RNFBMessaging to import RNFBAppModule to access
      //    RCTPromiseRejectBlock and RCTPromiseResolveBlock.
      const projectRoot = config.modRequest.projectRoot;
      const appDelegatePath = path.join(
        projectRoot,
        'node_modules/@react-native-firebase/messaging/ios/RNFBMessaging/RNFBMessaging+AppDelegate.h'
      );

      if (fs.existsSync(appDelegatePath)) {
        let appDelegate = fs.readFileSync(appDelegatePath, 'utf-8');
        const rnfbImport = '#import <RNFBApp/RNFBAppModule.h>';
        if (!appDelegate.includes(rnfbImport)) {
          // Insert after the last #import line.
          const lastImportIdx = appDelegate.lastIndexOf('#import');
          const endOfLine = appDelegate.indexOf('\n', lastImportIdx);
          appDelegate =
            appDelegate.slice(0, endOfLine + 1) +
            rnfbImport +
            '\n' +
            appDelegate.slice(endOfLine + 1);
          fs.writeFileSync(appDelegatePath, appDelegate);
        }
      }

      return config;
    },
  ]);
};

module.exports = withWebRTCFrameworkFix;
