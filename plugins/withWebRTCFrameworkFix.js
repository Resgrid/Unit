const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches the Podfile to allow non-modular header includes
 * inside the livekit_react_native_webrtc framework module.
 *
 * Fixes Xcode 26+ build error:
 *   include of non-modular header inside framework module
 *   'livekit_react_native_webrtc.WebRTCModule'
 *   [-Werror,-Wnon-modular-include-in-framework-module]
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
    # Fix non-modular header includes in livekit-react-native-webrtc for Xcode 26+
    installer.pods_project.targets.each do |target|
      if target.name == 'livekit_react_native_webrtc'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
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

      contents = contents.slice(0, insertAfter) + hook + contents.slice(insertAfter);
      fs.writeFileSync(podfilePath, contents);

      return config;
    },
  ]);
};

module.exports = withWebRTCFrameworkFix;
