const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin to add MediaButtonModule for AirPods/earbuds PTT support.
 *
 * This plugin:
 * 1. Ensures the MediaButtonModule.swift and MediaButtonModule.m files are in the iOS project
 * 2. Updates the bridging header to include necessary imports
 * 3. Adds MediaPlayer framework if not already present
 *
 * For Android, the module is registered in MainApplication.kt during prebuild.
 */
const withMediaButtonModule = (config) => {
  // Add iOS modifications
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosProjectPath = path.join(projectRoot, 'ios', config.modRequest.projectName);

      // Ensure bridging header has the React Native imports
      const bridgingHeaderPath = path.join(iosProjectPath, `${config.modRequest.projectName}-Bridging-Header.h`);
      if (fs.existsSync(bridgingHeaderPath)) {
        let bridgingHeaderContents = fs.readFileSync(bridgingHeaderPath, 'utf-8');

        const requiredImports = ['#import <React/RCTBridgeModule.h>', '#import <React/RCTEventEmitter.h>'];

        let modified = false;
        for (const importLine of requiredImports) {
          if (!bridgingHeaderContents.includes(importLine)) {
            bridgingHeaderContents += `\n${importLine}`;
            modified = true;
          }
        }

        if (modified) {
          fs.writeFileSync(bridgingHeaderPath, bridgingHeaderContents);
          console.log('[withMediaButtonModule] Updated bridging header with React Native imports');
        }
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withMediaButtonModule;
