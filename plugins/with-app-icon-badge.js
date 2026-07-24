const { execFileSync } = require('node:child_process');
const path = require('node:path');

const OUTPUT_DIRECTORY = '.expo/app-icon-badge';
const GENERATOR_SCRIPT = path.join(__dirname, 'generate-app-icon-badges.js');

const resolveProjectPath = (projectRoot, filePath) => path.resolve(projectRoot, filePath);

const createBadgeTask = ({ projectRoot, sourcePath, destinationPath, badges, isAdaptiveIcon = false }) => ({
  badges,
  destinationPath: resolveProjectPath(projectRoot, destinationPath),
  isAdaptiveIcon,
  sourcePath: resolveProjectPath(projectRoot, sourcePath),
});

const generateBadgedIcons = (projectRoot, tasks) => {
  // The upstream config plugin starts image writes without awaiting them. A child
  // process lets Expo block until every generated icon has been fully validated.
  execFileSync(process.execPath, [GENERATOR_SCRIPT, JSON.stringify({ tasks })], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
};

const withAppIconBadge = (config, options = {}) => {
  const { badges = [], enabled = true } = options;
  if (!enabled) {
    return config;
  }

  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const tasks = [];
  const iconSource = config.icon;
  const iosIconSource = config.ios?.icon;
  const adaptiveIconSource = config.android?.adaptiveIcon?.foregroundImage;

  if (typeof iconSource === 'string') {
    const destinationPath = `${OUTPUT_DIRECTORY}/icon.png`;
    tasks.push(createBadgeTask({ projectRoot, sourcePath: iconSource, destinationPath, badges }));
    config.icon = destinationPath;
  }

  if (typeof iosIconSource === 'string') {
    const destinationPath = iosIconSource === iconSource ? `${OUTPUT_DIRECTORY}/icon.png` : `${OUTPUT_DIRECTORY}/ios-icon.png`;
    if (iosIconSource !== iconSource) {
      tasks.push(createBadgeTask({ projectRoot, sourcePath: iosIconSource, destinationPath, badges }));
    }
    config.ios.icon = destinationPath;
  }

  if (typeof adaptiveIconSource === 'string') {
    const destinationPath = `${OUTPUT_DIRECTORY}/foreground-image.png`;
    tasks.push(createBadgeTask({ projectRoot, sourcePath: adaptiveIconSource, destinationPath, badges, isAdaptiveIcon: true }));
    config.android.adaptiveIcon.foregroundImage = destinationPath;
  }

  if (tasks.length > 0) {
    generateBadgedIcons(projectRoot, tasks);
  }

  return config;
};

module.exports = withAppIconBadge;
