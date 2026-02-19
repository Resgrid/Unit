const { withDangerousMod, withXcodeProject, IOSConfig } = require('expo/config-plugins');
const { copyFileSync, existsSync, mkdirSync } = require('fs');
const { basename, resolve } = require('path');

const ERROR_MSG_PREFIX = 'An error occurred while configuring notification sounds. ';
const ANDROID_RES_PATH = 'android/app/src/main/res/';

// Define all the sound files that need to be copied
const soundFiles = [
  'assets/audio/notification.wav',
  'assets/audio/callclosed.wav',
  'assets/audio/callupdated.wav',
  'assets/audio/callemergency.wav',
  'assets/audio/callhigh.wav',
  'assets/audio/calllow.wav',
  'assets/audio/callmedium.wav',
  'assets/audio/newcall.wav',
  'assets/audio/newchat.wav',
  'assets/audio/newmessage.wav',
  'assets/audio/newshift.wav',
  'assets/audio/newtraining.wav',
  'assets/audio/personnelstaffingupdated.wav',
  'assets/audio/personnelstatusupdated.wav',
  'assets/audio/troublealert.wav',
  'assets/audio/unitnotice.wav',
  'assets/audio/unitstatusupdated.wav',
  'assets/audio/upcomingshift.wav',
  'assets/audio/upcomingtraining.wav',
  'assets/audio/custom/c1.wav',
  'assets/audio/custom/c2.wav',
  'assets/audio/custom/c3.wav',
  'assets/audio/custom/c4.wav',
  'assets/audio/custom/c5.wav',
  'assets/audio/custom/c6.wav',
  'assets/audio/custom/c7.wav',
  'assets/audio/custom/c8.wav',
  'assets/audio/custom/c9.wav',
  'assets/audio/custom/c10.wav',
  'assets/audio/custom/c11.wav',
  'assets/audio/custom/c12.wav',
  'assets/audio/custom/c13.wav',
  'assets/audio/custom/c14.wav',
  'assets/audio/custom/c15.wav',
  'assets/audio/custom/c16.wav',
  'assets/audio/custom/c17.wav',
  'assets/audio/custom/c18.wav',
  'assets/audio/custom/c19.wav',
  'assets/audio/custom/c20.wav',
  'assets/audio/custom/c21.wav',
  'assets/audio/custom/c22.wav',
  'assets/audio/custom/c23.wav',
  'assets/audio/custom/c24.wav',
  'assets/audio/custom/c25.wav',
];

/**
 * Save sound files to the Xcode project root and add them to the Xcode project.
 */
function setNotificationSoundsIOS(projectRoot, { sounds, project, projectName }) {
  if (!projectName) {
    throw new Error(ERROR_MSG_PREFIX + 'Unable to find iOS project name.');
  }

  if (!Array.isArray(sounds)) {
    throw new Error(ERROR_MSG_PREFIX + `Must provide an array of sound files in your app config, found ${typeof sounds}.`);
  }

  const sourceRoot = IOSConfig.Paths.getSourceRoot(projectRoot);

  for (const soundFileRelativePath of sounds) {
    const fileName = basename(soundFileRelativePath);
    const sourceFilepath = resolve(projectRoot, soundFileRelativePath);
    const destinationFilepath = resolve(sourceRoot, fileName);

    // Since it's possible that the filename is the same, but the
    // file itself is different, let's copy it regardless
    copyFileSync(sourceFilepath, destinationFilepath);

    if (!project.hasFile(`${projectName}/${fileName}`)) {
      project = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${projectName}/${fileName}`,
        groupName: projectName,
        isBuildFile: true,
        project,
      });
    }
  }

  return project;
}

/**
 * Save sound files to `<project-root>/android/app/src/main/res/raw`
 */
function setNotificationSoundsAndroid(projectRoot, sounds) {
  if (!Array.isArray(sounds)) {
    throw new Error(ERROR_MSG_PREFIX + `Must provide an array of sound files in your app config, found ${typeof sounds}.`);
  }

  for (const soundFileRelativePath of sounds) {
    writeNotificationSoundFile(soundFileRelativePath, projectRoot);
  }
}

/**
 * Copies the input file to the `<project-root>/android/app/src/main/res/raw`
 * directory if there isn't already an existing file under that name.
 */
function writeNotificationSoundFile(soundFileRelativePath, projectRoot) {
  const rawResourcesPath = resolve(projectRoot, ANDROID_RES_PATH, 'raw');
  const inputFilename = basename(soundFileRelativePath);

  if (inputFilename) {
    try {
      const sourceFilepath = resolve(projectRoot, soundFileRelativePath);
      const destinationFilepath = resolve(rawResourcesPath, inputFilename);

      if (!existsSync(rawResourcesPath)) {
        mkdirSync(rawResourcesPath, { recursive: true });
      }

      copyFileSync(sourceFilepath, destinationFilepath);
    } catch (e) {
      throw new Error(ERROR_MSG_PREFIX + 'Encountered an issue copying Android notification sounds: ' + e);
    }
  }
}

const withNotificationSoundsIOS = (config, { sounds }) => {
  return withXcodeProject(config, (config) => {
    config.modResults = setNotificationSoundsIOS(config.modRequest.projectRoot, {
      sounds,
      project: config.modResults,
      projectName: config.modRequest.projectName,
    });
    return config;
  });
};

const withNotificationSoundsAndroid = (config, { sounds }) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      setNotificationSoundsAndroid(config.modRequest.projectRoot, sounds);
      return config;
    },
  ]);
};

/**
 * Copies notification sound files to native iOS and Android projects
 */
const withNotificationSounds = (config) => {
  config = withNotificationSoundsIOS(config, { sounds: soundFiles });
  config = withNotificationSoundsAndroid(config, { sounds: soundFiles });
  return config;
};

module.exports = withNotificationSounds;
