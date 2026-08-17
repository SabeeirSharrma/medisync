FROM oven/bun:1.3 AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/

RUN bun install

COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/api/ ./apps/api/

WORKDIR /app/packages/shared
RUN bun run build

WORKDIR /app/apps/api
RUN bun run build

FROM oven/bun:1.3-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts

RUN bun install --production

RUN groupadd --system --gid 1001 bunjs && \
    useradd --system --uid 1001 --gid bunjs appuser

RUN chown -R appuser:bunjs /app

USER appuser

WORKDIR /app/apps/api
EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "run", "dist/index.js"]