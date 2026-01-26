# Docker Deployment Guide

This guide explains how to deploy the Resgrid Unit application using Docker.

## Quick Start

### Using Docker Hub or GitHub Container Registry

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/resgrid/unit:latest

# Or pull from Docker Hub (if configured)
docker pull <dockerhub-username>/resgrid-unit:latest

# Run the container
docker run -d \
  -p 8080:80 \
  -e UNIT_BASE_API_URL="https://api.example.com" \
  -e UNIT_APP_KEY="your-app-key" \
  --name resgrid-unit \
  ghcr.io/resgrid/unit:latest
```

### Building Locally

```bash
# Build the Docker image
docker build -t resgrid-unit:latest .

# Run the container
docker run -d \
  -p 8080:80 \
  -e UNIT_BASE_API_URL="https://api.example.com" \
  --name resgrid-unit \
  resgrid-unit:latest
```

## Environment Variables

All configuration is done via environment variables at runtime. The Docker image does **not** contain any hardcoded secrets or API keys.

### Required Variables

- `UNIT_BASE_API_URL` - Base URL for the API (e.g., `https://api.resgrid.com`)

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Application environment |
| `UNIT_NAME` | `Resgrid Unit` | Application name |
| `UNIT_SCHEME` | `ResgridUnit` | URL scheme |
| `UNIT_VERSION` | `0.0.1` | Application version |
| `UNIT_API_VERSION` | `v4` | API version |
| `UNIT_RESGRID_API_URL` | `/api/v4` | Resgrid API URL path |
| `UNIT_CHANNEL_HUB_NAME` | `eventingHub` | SignalR channel hub name |
| `UNIT_REALTIME_GEO_HUB_NAME` | `geolocationHub` | SignalR geolocation hub name |
| `UNIT_LOGGING_KEY` | `""` | Logging service key |
| `UNIT_APP_KEY` | `""` | Application key |
| `UNIT_MAPBOX_PUBKEY` | `""` | Mapbox public key |
| `UNIT_SENTRY_DSN` | `""` | Sentry DSN for error tracking |
| `UNIT_COUNTLY_APP_KEY` | `""` | Countly app key for analytics |
| `UNIT_COUNTLY_SERVER_URL` | `""` | Countly server URL |

## Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  resgrid-unit:
    image: ghcr.io/resgrid/unit:latest
    ports:
      - "8080:80"
    environment:
      - APP_ENV=production
      - UNIT_NAME=Resgrid Unit
      - UNIT_SCHEME=ResgridUnit
      - UNIT_VERSION=7.1
      - UNIT_BASE_API_URL=https://api.resgrid.com
      - UNIT_API_VERSION=v4
      - UNIT_RESGRID_API_URL=/api/v4
      - UNIT_CHANNEL_HUB_NAME=eventingHub
      - UNIT_REALTIME_GEO_HUB_NAME=geolocationHub
      - UNIT_LOGGING_KEY=${UNIT_LOGGING_KEY}
      - UNIT_APP_KEY=${UNIT_APP_KEY}
      - UNIT_MAPBOX_PUBKEY=${UNIT_MAPBOX_PUBKEY}
      - UNIT_SENTRY_DSN=${UNIT_SENTRY_DSN}
      - UNIT_COUNTLY_APP_KEY=${UNIT_COUNTLY_APP_KEY}
      - UNIT_COUNTLY_SERVER_URL=${UNIT_COUNTLY_SERVER_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Then run:

```bash
docker-compose up -d
```

## Using Environment Files

Create a `.env` file (never commit this to version control):

```env
UNIT_BASE_API_URL=https://api.resgrid.com
UNIT_APP_KEY=your-secret-app-key
UNIT_LOGGING_KEY=your-logging-key
UNIT_MAPBOX_PUBKEY=your-mapbox-public-key
UNIT_SENTRY_DSN=your-sentry-dsn
UNIT_COUNTLY_APP_KEY=your-countly-app-key
UNIT_COUNTLY_SERVER_URL=https://countly.example.com
```

Run with the environment file:

```bash
docker run -d \
  -p 8080:80 \
  --env-file .env \
  --name resgrid-unit \
  ghcr.io/resgrid/unit:latest
```

## Kubernetes Deployment

Create a `deployment.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: resgrid-unit-config
data:
  UNIT_BASE_API_URL: "https://api.resgrid.com"
  UNIT_API_VERSION: "v4"
  UNIT_NAME: "Resgrid Unit"

---
apiVersion: v1
kind: Secret
metadata:
  name: resgrid-unit-secrets
type: Opaque
stringData:
  UNIT_APP_KEY: "your-secret-app-key"
  UNIT_LOGGING_KEY: "your-logging-key"
  UNIT_MAPBOX_PUBKEY: "your-mapbox-public-key"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resgrid-unit
spec:
  replicas: 3
  selector:
    matchLabels:
      app: resgrid-unit
  template:
    metadata:
      labels:
        app: resgrid-unit
    spec:
      containers:
      - name: resgrid-unit
        image: ghcr.io/resgrid/unit:latest
        ports:
        - containerPort: 80
        envFrom:
        - configMapRef:
            name: resgrid-unit-config
        - secretRef:
            name: resgrid-unit-secrets
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: resgrid-unit
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: resgrid-unit
```

Deploy:

```bash
kubectl apply -f deployment.yaml
```

## How It Works

The Docker image uses a two-stage build:

1. **Build Stage**: Compiles the web application without any environment variables
2. **Runtime Stage**: Uses nginx to serve the application

At container startup, the `docker-entrypoint.sh` script:
1. Generates an `env-config.js` file with all environment variables
2. Injects the script tag into `index.html`
3. Starts nginx

This approach allows the same Docker image to be used across multiple environments (dev, staging, production) by simply changing environment variables.

## Security Best Practices

1. **Never commit secrets**: Keep sensitive environment variables in secure storage (e.g., Kubernetes Secrets, AWS Secrets Manager)
2. **Use read-only containers**: Run containers in read-only mode where possible
3. **Scan for vulnerabilities**: Regularly scan the Docker image for security issues
4. **Use non-root user**: The nginx base image already uses a non-root user
5. **Limit resources**: Set appropriate CPU and memory limits

## Troubleshooting

### View container logs

```bash
docker logs resgrid-unit
```

### Verify environment variables are injected

```bash
docker exec resgrid-unit cat /usr/share/nginx/html/env-config.js
```

### Access container shell

```bash
docker exec -it resgrid-unit sh
```

### Check nginx configuration

```bash
docker exec resgrid-unit cat /etc/nginx/nginx.conf
```

## Multi-Architecture Support

The CI/CD pipeline builds images for both `linux/amd64` and `linux/arm64` architectures, ensuring compatibility with:
- x86-64 servers
- ARM-based servers (AWS Graviton, Raspberry Pi, etc.)
- Apple Silicon (M1/M2) development machines

## Updating the Application

To update to a new version:

```bash
# Pull the latest image
docker pull ghcr.io/resgrid/unit:latest

# Stop and remove the old container
docker stop resgrid-unit
docker rm resgrid-unit

# Start a new container with the updated image
docker run -d \
  -p 8080:80 \
  --env-file .env \
  --name resgrid-unit \
  ghcr.io/resgrid/unit:latest
```

Or with Docker Compose:

```bash
docker-compose pull
docker-compose up -d
```
