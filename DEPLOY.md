# MediSync Self-Host Deployment Guide

## Quick Start (Development)

```bash
# 1. Clone and setup
git clone https://github.com/SabeeirSharrma/medisync.git
cd medisync

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Start all services
docker compose up -d

# 4. Access the application
# Web: http://localhost:3000
# API: http://localhost:3001
# MinIO Console: http://localhost:9001 (medisync/medisync_dev)
```

## Production Deployment

### Prerequisites
- Docker Engine 24+ and Docker Compose v2
- Domain name with DNS pointing to your server
- SSL certificates (Let's Encrypt via Traefik, or bring your own)

### 1. Prepare Secrets
```bash
mkdir -p secrets

# Generate secure passwords
openssl rand -base64 32 > secrets/postgres_password.txt
openssl rand -base64 32 > secrets/minio_password.txt
openssl rand -base64 48 > secrets/session_secret.txt

# Set proper permissions
chmod 600 secrets/*.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your production values:
# - DOMAIN=your-domain.com
# - LETSENCRYPT_EMAIL=your-email@example.com
# - CORS_ORIGIN=https://your-domain.com
# - COOKIE_SECURE=true
# - NODE_ENV=production
```

### 3. Deploy with Traefik (Recommended)
```bash
# Start with reverse proxy and auto-HTTPS
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. Verify Deployment
```bash
# Check service health
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f web

# Test API
curl https://your-domain.com/api/health

# Test Web
curl https://your-domain.com
```

## Service Overview

| Service | Port | Description |
|---------|------|-------------|
| Web (Next.js) | 3000 | Frontend application |
| API (Fastify) | 3001 | Backend API |
| PostgreSQL | 5432 | Primary database |
| MinIO | 9000/9001 | Object storage (S3-compatible) |
| pgAdmin | 5050 | Database admin (tools profile) |
| Traefik | 80/443 | Reverse proxy & SSL (proxy profile) |

## Profiles

```bash
# Start with database admin tool
docker compose --profile tools up -d

# Start with backup service
docker compose --profile backup up -d

# Start with reverse proxy
docker compose --profile proxy up -d
```

## Database Migrations

Migrations run automatically on API startup. To run manually:

```bash
docker compose exec api bun run db:migrate
```

## Backup & Restore

### Automated Backup (with backup profile)
```bash
docker compose --profile backup up -d
# Backups stored in ./backupdata, kept for 30 days
```

### Manual Backup
```bash
# Create backup
docker compose exec postgres pg_dump -U medisync medisync > backup_$(date +%Y%m%d).sql

# Restore backup
docker compose exec -T postgres psql -U medisync medisync < backup_20240115.sql
```

## Updating

```bash
# Pull latest images
docker compose pull

# Rebuild custom images
docker compose build --no-cache

# Rolling update (zero-downtime with multiple replicas)
docker compose up -d --scale api=2 --scale web=2
```

## Scaling

For high availability, run multiple replicas behind Traefik:

```yaml
# In docker-compose.prod.yml
api:
  deploy:
    replicas: 3
web:
  deploy:
    replicas: 3
```

## Monitoring

### Health Checks
```bash
# API health
curl https://your-domain.com/api/health

# Database
docker compose exec postgres pg_isready -U medisync

# MinIO
curl http://localhost:9000/minio/health/live
```

### Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api --tail=100
```

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check postgres health
docker compose logs postgres
docker compose exec postgres pg_isready -U medisync
```

**API won't start**
```bash
docker compose logs api
# Check migrations
docker compose exec api bun run db:migrate
```

**MinIO connection failed**
```bash
docker compose logs minio
# Check credentials match between .env and docker-compose
```

### Reset Everything (Development Only)
```bash
docker compose down -v
rm -rf secrets/
docker compose up -d
```

## Security Checklist

- [ ] Change all default passwords in `.env`
- [ ] Use strong `SESSION_SECRET` (64+ chars)
- [ ] Enable `COOKIE_SECURE=true` in production
- [ ] Configure `CORS_ORIGIN` to your exact domain
- [ ] Enable Traefik with Let's Encrypt for HTTPS
- [ ] Restrict database port (5432) to internal network only
- [ ] Enable MinIO console authentication
- [ ] Regular backups with off-site storage
- [ ] Keep Docker images updated

## Support

- Check logs: `docker compose logs -f`
- Database issues: `docker compose exec postgres psql -U medisync -d medisync`
- API issues: `docker compose logs -f api`
- MinIO console: http://localhost:9001 (dev) or https://minio.your-domain.com (prod)