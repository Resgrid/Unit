# Quick Build Reference

## Manual Build Trigger

Go to: **Actions** → **React Native CI/CD** → **Run workflow**

### Build Type Options

| Build Type | Description | Platform |
|------------|-------------|----------|
| `dev` | Development Android APK | Android |
| `prod-apk` | Production Android APK | Android |
| `prod-aab` | Production Android AAB (for Play Store) | Android |
| `ios-dev` | Development iOS IPA | iOS |
| `ios-adhoc` | Ad-Hoc iOS IPA (for testing) | iOS |
| `ios-prod` | Production iOS IPA (for App Store) | iOS |
| `all` | All build types above | Both |

**Note**: Web, Docker, and Electron builds run automatically on push to main/master.

## Automatic Builds

Triggered on push to `main` or `master` branch:

1. ✅ **Tests** run first (lint, type-check, unit tests)
2. ✅ **Mobile Builds** (Android & iOS)
   - Development, Production APK/AAB/IPA
   - Uploaded to Firebase App Distribution
   - APK added to GitHub Release
3. ✅ **Web Build** 
   - Static export for hosting
   - Artifact uploaded to GitHub Actions
4. ✅ **Docker Build**
   - Multi-architecture (amd64, arm64)
   - Published to GitHub Container Registry
   - Published to Docker Hub (if configured)
5. ✅ **Electron Builds**
   - Windows: .exe, .msi
   - macOS: .dmg, .zip (Universal)
   - Linux: .AppImage, .deb, .rpm
   - All added to GitHub Release

## Skip CI

Add `[skip ci]` to commit message to skip all builds:

```bash
git commit -m "docs: update README [skip ci]"
```

## Build Artifacts

### GitHub Actions Artifacts (7-day retention)
- `app-builds-android` - Android APK/AAB files
- `app-builds-ios` - iOS IPA files
- `web-build` - Web dist folder
- `electron-windows` - Windows installers
- `electron-macos` - macOS packages
- `electron-linux` - Linux packages

### GitHub Container Registry
```bash
docker pull ghcr.io/resgrid/unit:latest
docker pull ghcr.io/resgrid/unit:7.{build-number}
```

### Docker Hub (optional)
```bash
docker pull {username}/resgrid-unit:latest
```

### GitHub Releases
Each release includes:
- Android APK
- All Electron builds (Windows, macOS, Linux)
- Release notes from PR

### Firebase App Distribution
- Android: Production APK → testers group
- iOS: Ad-Hoc IPA → testers group

## Version Numbering

Format: `7.{github.run_number}`

Example: `7.123` where 123 is the GitHub Actions run number

Updated in:
- package.json (`version` and `versionCode`)
- Docker image tags
- GitHub Release tag
- Electron app version

## Environment Configuration

### Mobile & Web Builds
Use UNIT_* secrets from GitHub Secrets during build time.

### Docker Deployment
Set UNIT_* variables at container runtime:

```bash
docker run \
  -e UNIT_BASE_API_URL="https://api.resgrid.com" \
  -e UNIT_APP_KEY="your-key" \
  -e UNIT_MAPBOX_PUBKEY="your-key" \
  ghcr.io/resgrid/unit:latest
```

See [docker/README.md](../docker/README.md) for complete Docker deployment guide.

## Required Secrets

### Already Configured (for mobile)
- EXPO_TOKEN, FIREBASE_TOKEN
- UNIT_* environment variables
- Apple/Google signing credentials

### Optional (for Docker Hub)
- DOCKER_USERNAME
- DOCKER_PASSWORD

If not set, Docker images will only be pushed to GitHub Container Registry.

## Troubleshooting

### Build Failed
1. Check GitHub Actions logs
2. Look for error in specific build step
3. Verify all required secrets are set

### Docker Image Not Found
- Check GitHub Container Registry permissions
- Verify image was pushed: `docker pull ghcr.io/resgrid/unit:latest`

### Electron Build Issues
- Ensure platform-specific dependencies installed
- Check `electron-builder.config.js` for configuration

### Missing Release
- Only created on Android build completion
- Updated by Electron Linux build
- Check build logs for errors

## Local Testing

### Test Web Build
```bash
yarn web:build
# Output in dist/
```

### Test Docker Build
```bash
docker build -t resgrid-unit:test .
docker run -p 8080:80 \
  -e UNIT_BASE_API_URL="https://api.resgrid.com" \
  resgrid-unit:test
# Access at http://localhost:8080
```

### Test Electron Build
```bash
# macOS
yarn electron:build:mac

# Windows (on Windows)
yarn electron:build:win

# Linux
yarn electron:build:linux
```

## Performance Tips

- Builds run in parallel where possible
- Caching enabled for yarn, EAS, and Docker
- Multi-stage Docker builds for smaller images
- Artifacts automatically cleaned up after 7 days

## Getting Help

- Workflow file: [.github/workflows/react-native-cicd.yml](../.github/workflows/react-native-cicd.yml)
- Full docs: [docs/cicd-build-system.md](cicd-build-system.md)
- Docker guide: [docker/README.md](../docker/README.md)
