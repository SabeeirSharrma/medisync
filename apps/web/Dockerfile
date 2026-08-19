FROM oven/bun:1.3 AS builder

WORKDIR /app

# Copy everything first — .dockerignore excludes node_modules, .next, dist
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install after all source is present — Bun resolves workspaces correctly
RUN bun install

# Build shared first
WORKDIR /app/packages/shared
RUN bun run build

# Build web
WORKDIR /app/apps/web
RUN bun run build

FROM oven/bun:1.3-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY apps/web/package.json ./apps/web/

RUN bun install --production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN groupadd --system --gid 1001 bunjs && \
    useradd --system --uid 1001 --gid bunjs appuser

RUN chown -R appuser:bunjs /app

USER appuser

WORKDIR /app/apps/web
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "server.js"]
