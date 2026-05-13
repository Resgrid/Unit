const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches the Podfile for Xcode 26+ compatibility with
 * use_frameworks! :linkage => :static (required by @react-native-firebase).
 *
 * Fixes two classes of errors:
 * 1. "include of non-modular header inside framework module" — sets
 *    CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES for all pods.
 * 2. "declaration of 'X' must be imported from module 'Y' before it is required"
 *    — adds use_modular_headers! so #import statements resolve correctly across
 *    framework module boundaries.
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
      return config;
    },
  ]);
};

module.exports = withWebRTCFrameworkFix;
