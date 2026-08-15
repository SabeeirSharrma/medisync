# apps/api/Dockerfile
# Multi-stage build for Fastify API

# Build stage
FROM oven/bun:1.1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY apps/api/ ./apps/api/
COPY packages/shared/src ./packages/shared/src/

# Build shared package
WORKDIR /app/packages/shared
RUN bun run build

# Build API
WORKDIR /app/apps/api
RUN bun run build

# Production stage
FROM oven/bun:1.1-slim AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts

# Install production dependencies
WORKDIR /app/apps/api
RUN bun install --production --frozen-lockfile

# Create non-root user
RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 --ingroup bunjs appuser

# Change ownership
RUN chown -R appuser:bunjs /app

USER appuser

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "dist/index.js"]