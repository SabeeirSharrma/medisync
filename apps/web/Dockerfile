FROM oven/bun:1.3 AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/

RUN bun install

COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY apps/web/ ./apps/web/

WORKDIR /app/packages/shared
RUN bun run build

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

# Next.js standalone output preserves the monorepo layout:
# .next/standalone/apps/web/server.js -> copy to container root so paths resolve
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