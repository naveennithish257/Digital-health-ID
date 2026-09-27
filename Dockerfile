# ============================================================
# MEDVAULT DIGITAL HEALTH ID — PRODUCTION DOCKERFILE
# Multi-stage, minimal attack surface, non-root execution
# ============================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Install build dependencies for native modules if required
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Add curl for container health check
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create dedicated non-root user
USER node

# Copy dependencies and application code with proper ownership
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .

# Expose standard application port
EXPOSE 3000

# Container Healthcheck (Docker & Kubernetes compatible)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "server.js"]
