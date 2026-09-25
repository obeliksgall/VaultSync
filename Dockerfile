# Production Multi-Stage Dockerfile for SyncVault
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

# Runtime container
FROM node:22-alpine

# Install rsync, rclone, tzdata, ca-certificates, bash
RUN apk add --no-cache \
    rsync \
    rclone \
    bash \
    ca-certificates \
    tzdata \
    openssh-client

WORKDIR /app

# Copy production artifacts
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY --from=builder /app/dist ./dist

# Create storage mounts and symlink for standard rclone location
RUN mkdir -p /data /data/logs /data/backups /source /destination /root/.config/rclone \
    && ln -sf /data/rclone.conf /root/.config/rclone/rclone.conf

VOLUME ["/data", "/source", "/destination"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
ENV RCLONE_CONFIG=/data/rclone.conf
ENV RCLONE_CONFIG_PATH=/data/rclone.conf

EXPOSE 3000

# Graceful stop with SIGTERM
STOPSIGNAL SIGTERM

CMD ["npm", "start"]
