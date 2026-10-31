# Production Multi-Stage Dockerfile for SyncVault
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npm run build

# Runtime container
FROM node:22-alpine

# Copy pinned official rclone binary from official multi-arch image
COPY --from=rclone/rclone:1.68.2 /usr/local/bin/rclone /usr/local/bin/rclone

# Install rsync, tzdata, ca-certificates, bash, openssh-client, python3, and tini
RUN apk add --no-cache \
    rsync \
    bash \
    ca-certificates \
    tzdata \
    openssh-client \
    python3 \
    tini

WORKDIR /app

# Copy production artifacts
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts

# Create storage mounts
RUN mkdir -p /data /data/logs /data/backups /source /destination

VOLUME ["/data", "/source", "/destination"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV RCLONE_CONFIG=/data/rclone.conf
ENV RCLONE_CONFIG_PATH=/data/rclone.conf

EXPOSE 3000

# Container healthcheck: static /api/health to prevent event loop blocking, 127.0.0.1 for IPv4 reliability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1

# Graceful stop with SIGTERM
STOPSIGNAL SIGTERM

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.cjs"]


