### STAGE 1: Build ###
FROM node:20-alpine AS build

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source files
COPY . .

# Build the web application without environment variables
# Environment variables will be injected at runtime via docker-entrypoint.sh
RUN yarn web:build

### STAGE 2: Run ###
FROM nginx:1.25-alpine

# Install sed for the entrypoint script
RUN apk add --no-cache sed

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built web app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Set default environment variables
ENV APP_ENV=production \
    UNIT_NAME="Resgrid Unit" \
    UNIT_SCHEME="ResgridUnit" \
    UNIT_VERSION="0.0.1" \
    UNIT_BASE_API_URL="https://api.resgrid.com" \
    UNIT_API_VERSION="v4" \
    UNIT_RESGRID_API_URL="/api/v4" \
    UNIT_CHANNEL_HUB_NAME="eventingHub" \
    UNIT_REALTIME_GEO_HUB_NAME="geolocationHub" \
    UNIT_LOGGING_KEY="" \
    UNIT_APP_KEY="" \
    UNIT_MAPBOX_PUBKEY="" \
    UNIT_SENTRY_DSN="" \
    UNIT_COUNTLY_APP_KEY="" \
    UNIT_COUNTLY_SERVER_URL=""

# Use entrypoint to inject environment variables at runtime
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]