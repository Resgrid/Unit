const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin that patches the Podfile and source files for Xcode 26+
 * compatibility with use_frameworks! :linkage => :static (required by
 * @react-native-firebase).
 *
 * Fixes five classes of errors:
 * 1. "include of non-modular header inside framework module" — sets
 *    CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES for all pods.
 * 2. "declaration of 'X' must be imported from module 'Y' before it is required"
 *    — adds use_modular_headers! so #import statements resolve correctly across
 *    framework module boundaries.
 * 3. "RCTPromiseRejectBlock must be imported from module 'RNFBApp.RNFBAppModule'"
 *    — patches RNFBMessaging source files to import RNFBAppModule explicitly.
 * 4. "unknown type name 'RCT_EXTERN'" / "duplicate declaration of method
 *    'RCT_CONCAT'" in RNFBMessagingModule.m (RCT_EXPORT_MODULE fails to expand)
 *    — sets $RNFirebaseAsStaticFramework = true so the @react-native-firebase
 *    pods build as static frameworks, letting React's macro headers resolve
 *    inside the Firebase module.
 * 5. "call to consteval function 'fmt::basic_format_string<...>' is not a
 *    constant expression" when compiling the fmt pod (v11.0.2) from source.
 *    Building React Native from source (ios.buildReactNativeFromSource) compiles
 *    fmt, which fails under Xcode 26's stricter consteval evaluation. Sets
 *    FMT_USE_CONSTEVAL=0 for all pods so FMT_CONSTEVAL becomes a no-op.
 */
const withWebRTCFrameworkFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // 0. Set $RNFirebaseAsStaticFramework = true at global scope (before any
      //    target) so the @react-native-firebase pods build as static frameworks.
      //    Without this, under use_frameworks! :linkage => :static the React
      //    macro headers (RCT_EXTERN, RCT_CONCAT) don't resolve inside the
      //    Firebase module and RCT_EXPORT_MODULE() fails to compile.
      if (!contents.includes('$RNFirebaseAsStaticFramework')) {
        const fbAnchor = 'prepare_react_native_project!';
        const fbAnchorIdx = contents.indexOf(fbAnchor);
        if (fbAnchorIdx === -1) {
          throw new Error(
            '[withWebRTCFrameworkFix] Could not find prepare_react_native_project! in Podfile — ' +
              'cannot place $RNFirebaseAsStaticFramework at global scope.'
          );
        }
        const fbEndOfLine = contents.indexOf('\n', fbAnchorIdx);
        const fbInsertAt = fbEndOfLine === -1 ? contents.length : fbEndOfLine + 1;
        contents =
          contents.slice(0, fbInsertAt) +
          '\n$RNFirebaseAsStaticFramework = true\n' +
          contents.slice(fbInsertAt);
      }

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
      // Use a sentinel comment unique to this plugin as the idempotency marker.
      // We must NOT key off CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES:
      // @config-plugins/react-native-webrtc runs earlier and injects a
      // livekit-only block containing that exact string, which would make this
      // whole block (including FMT_USE_CONSTEVAL=0) get skipped.
      const marker = '# @withWebRTCFrameworkFix:post-install';
      if (!contents.includes(marker)) {
        const hook = `
    ${marker}
    # Fix non-modular header includes for Xcode 26+ for ALL pods (the webrtc
    # plugin only covers livekit_react_native_webrtc). Pods like
    # @react-native-firebase import React Native headers inside their framework
    # modules, which Xcode 26 treats as an error
    # (-Werror,-Wnon-modular-include-in-framework-module).
    #
    # Also disable fmt's consteval format-string checking. Building React Native
    # from source compiles the bundled fmt (11.0.2), which fails under Xcode 26's
    # Clang with "call to consteval function ... is not a constant expression".
    # FMT_USE_CONSTEVAL=0 makes FMT_CONSTEVAL a no-op so fmt compiles.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'

        definitions = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        definitions = [definitions] unless definitions.is_a?(Array)
        definitions << 'FMT_USE_CONSTEVAL=0' unless definitions.include?('FMT_USE_CONSTEVAL=0')
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = definitions
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
          // Insert after the last #import line, or at the start if none exist.
          const lastImportIdx = appDelegate.lastIndexOf('#import');
          let insertAt;
          if (lastImportIdx === -1) {
            insertAt = 0;
          } else {
            const endOfLine = appDelegate.indexOf('\n', lastImportIdx);
            insertAt = endOfLine === -1 ? appDelegate.length : endOfLine + 1;
          }
          // Guard against merging into the previous line when the insertion point
          // is not preceded by a newline (e.g. the file's last line is an #import
          // with no trailing newline, so endOfLine === -1 and insertAt === length).
          const needsLeadingNewline = insertAt > 0 && appDelegate[insertAt - 1] !== '\n';
          appDelegate =
            appDelegate.slice(0, insertAt) +
            (needsLeadingNewline ? '\n' : '') +
            rnfbImport +
            '\n' +
            appDelegate.slice(insertAt);
          fs.writeFileSync(appDelegatePath, appDelegate);
        }
      }

      return config;
    },
  ]);
};

module.exports = withWebRTCFrameworkFix;
