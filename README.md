# MediSync

Patient-controlled electronic health records (EHR) system. Patients own their medical history and grant doctors access on a request/approval basis.

## Features

- **Patient-owned records** — prescriptions, lab results, checkups, surgeries, imaging
- **Request/approval access** — doctors request, patients approve with scope control
- **Emergency break-glass** — time-limited emergency access with audit trail
- **Guardian/proxy control** — shared access for minors, advance directives, incapacity
- **Deceased transfer** — legacy contact designation and estate claim review
- **Full audit log** — every access, grant, and override tracked
- **Export** — CSV and styled PDF (via Puppeteer)
- **Self-hostable** — Docker Compose, single command deployment

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Fastify |
| Frontend | Next.js (App Router), Tailwind CSS |
| Database | PostgreSQL 17 |
| Object Storage | MinIO (S3-compatible) |
| Mobile/Desktop | Flutter + WebView |
| Auth | Session cookies (httpOnly) |
| PDF Export | Puppeteer |

## Quick Start

```bash
git clone https://github.com/SabeeirSharrma/medisync.git && cd medisync
cp .env.example .env
docker compose up -d
```

- Web: http://localhost:3000
- API: http://localhost:3001
- MinIO Console: http://localhost:9001 (medisync/medisync_dev)

See [DEPLOY.md](DEPLOY.md) for production deployment and [docs/setup.md](docs/setup.md) for local development.

## Project Structure

```
medisync/
  apps/
    api/          # Fastify backend
      src/
        routes/   # API endpoints (auth, records, access-requests, etc.)
        lib/      # Auth, validation, audit, S3 helpers
        db/       # Drizzle ORM schema and migrations
    web/          # Next.js frontend
      src/
        app/      # Page routes (dashboard, records, access-requests, etc.)
        lib/      # API client, utilities
    flutter/      # Cross-platform mobile/desktop app
  packages/
    shared/       # Shared TypeScript types between API and web
  docs/           # Documentation
  scripts/        # Database init scripts
```

## Documentation

- [Architecture](docs/architecture.md) — data model, system design, access control
- [API Reference](docs/api.md) — endpoint documentation
- [Development Setup](docs/setup.md) — local development guide
- [Deployment](DEPLOY.md) — production deployment guide
- [Tunneling](docs/tunneling.md) — Cloudflare Tunnel, SSH, ngrok setup

## License

See [LICENSE](LICENSE) for details.
