# apps/web/Dockerfile
# Multi-stage build for Next.js web

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
COPY apps/web/ ./apps/web/
COPY packages/shared/src ./packages/shared/src/

# Build shared package
WORKDIR /app/packages/shared
RUN bun run build

# Build web
WORKDIR /app/apps/web
RUN bun run build

# Production stage
FROM oven/bun:1.1-slim AS runner

WORKDIR /app

# Install dumb-init
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Install production dependencies
WORKDIR /app/apps/web
RUN bun install --production --frozen-lockfile

# Create non-root user
RUN addgroup --system --gid 1001 bunjs && \
    adduser --system --uid 1001 --ingroup bunjs appuser

# Change ownership
RUN chown -R appuser:bunjs /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "apps/web/server.js"]