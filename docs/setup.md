# Development Setup

## Prerequisites

- [Bun](https://bun.sh/) (runtime + package manager)
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js](https://nodejs.org/) 18+ (for Next.js)

## Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url> && cd medisync
bun install

# 2. Start infrastructure (Postgres + MinIO)
docker compose up -d postgres minio

# 3. Configure environment
cp .env.example .env
# Default .env values work with docker compose

# 4. Run migrations
bun run db:migrate

# 5. Start dev servers
bun run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- MinIO Console: http://localhost:9001 (medisync/medisync_dev)

## Available Scripts

From the root:

```bash
bun run dev          # Start API + Web in parallel
bun run dev:api      # Start API only
bun run dev:web      # Start Web only
bun run db:migrate   # Run database migrations
bun run db:generate  # Generate Drizzle migration files
bun run db:push      # Push schema changes directly
bun run build        # Build all packages
bun run typecheck    # Type-check all packages
```

## Project Layout

```
medisync/
  apps/
    api/              # Fastify backend (port 3001)
      src/
        routes/       # Route handlers
        lib/          # Auth, validation, audit, S3
        db/           # Schema, migrations, connection
      Dockerfile
    web/              # Next.js frontend (port 3000)
      src/
        app/          # Page routes
        lib/          # API client, utilities
      Dockerfile
    flutter/          # Mobile/desktop app
  packages/
    shared/           # Shared TypeScript types
  docs/               # Documentation
  scripts/            # DB init scripts
```

## Environment Variables

See `.env.example` for all options. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://medisync:medisync_dev@localhost:5432/medisync` | PostgreSQL connection string |
| `SESSION_SECRET` | `change-me-in-production` | Cookie signing secret |
| `COOKIE_SECURE` | `false` | Set `true` in production with HTTPS |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origin for CORS |
| `API_PORT` | `3001` | API server port |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `medisync` | MinIO access key |
| `S3_SECRET_KEY` | `medisync_dev` | MinIO secret key |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API URL for client-side requests |

## Database

### Schema

Drizzle ORM manages the schema at `apps/api/src/db/schema.ts`. Tables:

- `users`, `orgs`, `doctor_profile` — user management
- `sessions` — auth sessions
- `records` — medical records (metadata only)
- `access_requests` — doctor-patient access control
- `emergency_access` — break-glass access
- `guardian_link` — proxy control
- `incapacity_request` — incapacity approval chain
- `legacy_contact`, `estate_claim` — deceased transfer
- `audit_log` — audit trail

### Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (dev only)
bun run db:push
```

Migrations also run automatically on API startup.

### Reset (dev only)

```bash
docker compose down -v
docker compose up -d postgres minio
bun run db:migrate
```

## API Development

The API uses Fastify with these plugins:

- `@fastify/cookie` — session cookies
- `@fastify/cors` — CORS
- `@fastify/multipart` — file uploads
- `@fastify/sensible` — error helpers

### Adding a Route

1. Create `apps/api/src/routes/your-route.ts`
2. Export an async function that takes `FastifyInstance`
3. Register in `apps/api/src/app.ts`:

```typescript
import yourRoutes from "./routes/your-route.js";
await app.register(yourRoutes, { prefix: "/api" });
```

### Auth Middleware

```typescript
import { requireAuth } from "../middleware/auth.js";

app.get("/protected", { preHandler: requireAuth }, async (request, reply) => {
  const user = request.user!; // Guaranteed to exist after requireAuth
  return reply.send({ userId: user.id });
});
```

### Role-Based Access

```typescript
import { requireAuth, requireRole } from "../middleware/auth.js";

app.post("/doctor-only",
  { preHandler: [requireAuth, requireRole("doctor")] },
  async (request, reply) => { ... }
);
```

## Frontend Development

Next.js App Router with Tailwind CSS. Client-side rendering.

### Adding a Page

1. Create `apps/web/src/app/your-page/page.tsx`
2. Add `"use client"` if using hooks
3. Use `apiFetch` from `@/lib/api` for API calls

### API Client

```typescript
import { apiFetch } from "@/lib/api";

const data = await apiFetch<{ records: Record[] }>("/api/records?page=1");
```

## Testing

```bash
# API
cd apps/api && bun test

# Web
cd apps/web && bun test
```

## Troubleshooting

### Port already in use

```bash
lsof -i :3000  # or :3001
kill <PID>
```

### Database connection refused

```bash
docker compose ps postgres
docker compose logs postgres
```

### MinIO connection refused

```bash
docker compose ps minio
docker compose logs minio
# Verify credentials match .env
```

### Build errors

```bash
bun install
bun run typecheck
```
