# CI/CD Build System Extensions

This document describes the extensions made to the GitHub Actions CI/CD workflow to support web, Docker, and Electron builds.

## Overview

The build system now supports:
- ✅ Mobile builds (Android & iOS) - existing
- ✅ Web builds
- ✅ Docker builds (multi-architecture)
- ✅ Electron builds (Windows, macOS, Linux)

## Build Jobs

### 1. Mobile Builds (`build-mobile`)

**Platforms**: Android, iOS  
**Runners**: ubuntu-latest (Android), macos-15 (iOS)  
**Outputs**:
- Android: APK (dev/prod) and AAB (prod)
- iOS: IPA (dev/adhoc/prod)

**Distribution**:
- Firebase App Distribution
- GitHub Releases

### 2. Web Build (`build-web`)

**Platform**: Web  
**Runner**: ubuntu-latest  
**Build Command**: `yarn web:build`  
**Output**: `dist/` directory

**Artifacts**: Uploaded to GitHub Actions artifacts

### 3. Docker Build (`build-docker`)

**Platform**: Linux (multi-arch)  
**Runner**: ubuntu-latest  
**Architectures**: linux/amd64, linux/arm64

**Key Features**:
- ✅ No hardcoded UNIT_ environment variables
- ✅ All configuration via runtime environment variables
- ✅ Multi-architecture support
- ✅ Automated tagging (version, latest, SHA)

**Registries**:
- GitHub Container Registry (ghcr.io) - always enabled
- Docker Hub - optional (if credentials configured)

**Tags Generated**:
- `7.{build_number}` - version tag
- `latest` - latest build
- `{branch}-{sha}` - git reference

**Environment Variables** (set at runtime):
All UNIT_* variables are configured via Docker environment variables at container startup, not baked into the image.

### 4. Electron Builds (`build-electron`)

**Platforms**: Windows, macOS, Linux  
**Runners**: 
- windows-latest (Windows)
- macos-15 (macOS)
- ubuntu-latest (Linux)

**Build Commands**:
- Windows: `yarn electron:build:win`
- macOS: `yarn electron:build:mac`
- Linux: `yarn electron:build:linux`

**Outputs**:
- Windows: .exe, .msi (NSIS installer)
- macOS: .dmg, .zip (x64 and arm64)
- Linux: .AppImage, .deb, .rpm

**Artifacts**: All builds uploaded to GitHub Actions artifacts and GitHub Releases

## Build Matrix

```yaml
build-mobile:
  matrix:
    platform: [android, ios]

build-electron:
  matrix:
    os: [windows-latest, macos-15, ubuntu-latest]
```

## Environment Variables

### Build-Time Variables (for mobile/web/electron)
All UNIT_* secrets are used during build for mobile platforms.

### Runtime Variables (for Docker only)
Docker images do NOT contain UNIT_* variables. These must be set when running containers:

```bash
docker run -e UNIT_BASE_API_URL="..." -e UNIT_APP_KEY="..." ...
```

See [docker/README.md](../docker/README.md) for complete Docker deployment guide.

## Secrets Required

### Existing Secrets (for mobile builds)
- EXPO_TOKEN
- FIREBASE_TOKEN
- FIREBASE_ANDROID_APP_ID
- FIREBASE_IOS_APP_ID
- All UNIT_* secrets
- Apple/Google signing credentials

### New Secrets (for Docker registry)
- `DOCKER_USERNAME` (optional) - Docker Hub username
- `DOCKER_PASSWORD` (optional) - Docker Hub password
- `GITHUB_TOKEN` (automatic) - GitHub Container Registry

### No Additional Secrets Needed
- Web builds: use existing secrets
- Electron builds: use existing configuration

## Workflow Triggers

All jobs run on:
- Push to `main` or `master` branch
- Manual workflow dispatch

Skip with: `[skip ci]` in commit message

## Artifact Retention

All artifacts are retained for **7 days**.

## Release Strategy

### GitHub Releases
- **Mobile**: Created by Android build with APK
- **Electron**: Updated by Linux build with all Electron artifacts
- **Tag**: `7.{github.run_number}`
- **Release Notes**: Extracted from PR body or recent commits

### Container Registries
- **GitHub Container Registry**: Always published
- **Docker Hub**: Published if credentials configured

### Firebase App Distribution
- **Android**: Production APK
- **iOS**: Ad-hoc IPA

## Cache Strategy

1. **Yarn Cache**: Shared across all jobs
2. **EAS Build Cache**: For mobile builds
3. **Docker Build Cache**: GitHub Actions cache for multi-arch builds

## Build Optimization

- Node.js 24 with legacy OpenSSL provider
- Increased memory: `--max_old_space_size=4096`
- Frozen lockfile: `--frozen-lockfile`
- Multi-stage Docker builds
- Parallel matrix jobs

## Platform-Specific Notes

### Docker
- Uses nginx to serve static files
- Runtime environment variable injection via `docker-entrypoint.sh`
- Health checks supported
- Suitable for Kubernetes deployment

### Electron
- Separate builds for each platform
- macOS: Universal binaries (x64 + arm64)
- Windows: NSIS installer with customization
- Linux: Multiple formats (AppImage, deb, rpm)

### Web
- Static export via Expo
- Can be deployed to any static hosting
- Same build used as base for Docker image

## Build Flow

```
test (all platforms)
  ├─→ build-mobile (android, ios)
  ├─→ build-web
  │     └─→ build-docker
  └─→ build-electron (windows, macos, linux)
```

## Monitoring and Debugging

### View Logs
- GitHub Actions UI: Real-time build logs
- Docker logs: `docker logs <container>`
- Electron: Check build output in `electron-dist/`

### Common Issues
1. **Docker build fails**: Check Dockerfile and build context
2. **Electron build fails**: Ensure all dependencies installed
3. **Missing artifacts**: Check job conditions and file paths

## Future Enhancements

Potential improvements:
- [ ] Code signing for Electron apps
- [ ] Auto-update mechanism for Electron
- [ ] Deploy web build to CDN
- [ ] E2E testing in Docker container
- [ ] Performance benchmarking
- [ ] Security scanning (Snyk, Trivy)

## Testing Locally

### Web
```bash
yarn web:build
```

### Docker
```bash
docker build -t resgrid-unit:test .
docker run -p 8080:80 -e UNIT_BASE_API_URL="..." resgrid-unit:test
```

### Electron
```bash
yarn electron:build:mac    # macOS
yarn electron:build:win    # Windows
yarn electron:build:linux  # Linux
```

## Additional Documentation

- Docker deployment: [docker/README.md](../docker/README.md)
- Electron configuration: [electron-builder.config.js](../electron-builder.config.js)
- Workflow file: [.github/workflows/react-native-cicd.yml](../.github/workflows/react-native-cicd.yml)
