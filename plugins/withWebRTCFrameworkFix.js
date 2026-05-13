const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches the Podfile to allow non-modular header includes
 * inside framework modules for all pod targets.
 *
 * Fixes Xcode 26+ build errors like:
 *   include of non-modular header inside framework module 'RNFBApp.RNFBAppModule'
 *   [-Werror,-Wnon-modular-include-in-framework-module]
 *
 * Several pods (livekit-react-native-webrtc, @react-native-firebase, etc.)
 * import React Native headers inside their framework modules, which Xcode 26
 * treats as an error. This relaxes that check for all pod targets.
 */
const withWebRTCFrameworkFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      const marker = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';
      if (contents.includes(marker)) {
        return config;
      }

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

      // Insert after the react_native_post_install call, which is the last
      // significant line inside the post_install block.
      const anchor = 'react_native_post_install(';
      const anchorIdx = contents.lastIndexOf(anchor);
      if (anchorIdx === -1) {
        throw new Error('[withWebRTCFrameworkFix] Could not find react_native_post_install in Podfile');
      }

      // Find the closing `)` of the react_native_post_install call (may span multiple lines).
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
      fs.writeFileSync(podfilePath, contents);

      return config;
    },
  ]);
};

module.exports = withWebRTCFrameworkFix;
