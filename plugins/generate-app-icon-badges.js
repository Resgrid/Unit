const { mkdir, rm, stat } = require('node:fs/promises');
const path = require('node:path');

const Jimp = require('jimp');
const { addBadge } = require('app-icon-badge');

const MAX_IMAGE_READ_ATTEMPTS = 200;
const IMAGE_READ_RETRY_DELAY_MS = 25;

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForReadableImage = async (destinationPath) => {
  let previousSize = -1;

  for (let attempt = 0; attempt < MAX_IMAGE_READ_ATTEMPTS; attempt += 1) {
    try {
      const file = await stat(destinationPath);
      if (file.size > 0 && file.size === previousSize) {
        const image = await Jimp.read(destinationPath);
        if (image.bitmap.width > 0 && image.bitmap.height > 0) {
          return;
        }
      }
      previousSize = file.size;
    } catch {
      previousSize = -1;
    }

    await delay(IMAGE_READ_RETRY_DELAY_MS);
  }

  throw new Error(`Generated app icon is not a readable image: ${destinationPath}`);
};

const generateBadge = async ({ badges, destinationPath, isAdaptiveIcon, sourcePath }) => {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await rm(destinationPath, { force: true });
  await addBadge({
    badges,
    dstPath: destinationPath,
    icon: sourcePath,
    isAdaptiveIcon,
  });
  await waitForReadableImage(destinationPath);
};

const main = async () => {
  const payload = JSON.parse(process.argv[2] ?? '{}');
  if (!Array.isArray(payload.tasks)) {
    throw new Error('Expected an app icon badge task list');
  }

  for (const task of payload.tasks) {
    await generateBadge(task);
  }
};

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${path.basename(__filename)}: ${message}\n`);
  process.exitCode = 1;
});
