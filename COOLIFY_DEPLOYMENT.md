# Coolify Production Deployment Guide

This guide describes how to deploy Genetius to Coolify with persistent SQLite storage.

## Prerequisites

- Coolify instance running
- Genetius repository cloned in Coolify
- Persistent volume configured

## Persistent Volume Setup

**Volume Configuration:**
- **Name:** `genetius-data` (or your custom name)
- **Source Path:** `/var/lib/coolify/genetius/data`
- **Destination Path:** `/app/data`

This ensures the database file persists across container restarts.

## Environment Variables

Set these environment variables in Coolify:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
ADMIN_USER=admin
ADMIN_PASSWORD=secure_password_here

# Database Configuration (Production)
ASTRO_DATABASE_FILE=/app/data/local.db
ASTRO_DB_REMOTE_URL=file:local.db
ASTRO_DB_APP_TOKEN=unused

# Node Version
NIXPACKS_NODE_VERSION=24
```

## Build Configuration

**Build Command:**
```bash
ASTRO_DATABASE_FILE=/app/data/local.db bun run build
```

**Start Command:**
```bash
bun run start
```

**Output Directory:** `dist`

## Initial Data Setup

On first deployment, the database will be empty. You have two options:

### Option 1: Seed with sample data

Run the seed script locally and upload `local.db` to Coolify:

```bash
# Locally
bunx astro db execute db/seed.ts

# Then upload local.db to /app/data/local.db in Coolify
```

### Option 2: Import from Turso (Migration)

If migrating from Turso:

```bash
# 1. Export from Turso
turso db shell genetius --location aws-eu-west-1 ".dump" > turso_dump.sql

# 2. Import to local SQLite
sqlite3 local.db < turso_dump.sql

# 3. Upload local.db to /app/data/local.db in Coolify
```

## Database Migration Path

The application expects the database at `/app/data/local.db`. The file will be automatically created if it doesn't exist.

**Backup Strategy:**
- Coolify's persistent volume survives container restarts
- Regular backups should be scheduled via Coolify's backup feature
- Manual backup: `sqlite3 /app/data/local.db ".backup backup.db"`

## Troubleshooting

### Database not found
- Ensure the persistent volume is mounted to `/app/data`
- Check file permissions on `/app/data/local.db`

### Build fails with database errors
- Verify `ASTRO_DATABASE_FILE` is set in build environment
- Ensure the path `/app/data` is writable during build

### Database lost after restart
- Check that persistent volume is properly configured
- Verify volume is not being recreated on redeploy

## Performance Considerations

- SQLite is efficient for read-heavy workloads (Genetius's primary use case)
- No network latency (local file access)
- No row-read costs (unlike Turso)
- Automatic WAL mode for concurrent reads/writes

## Scaling

For high-traffic deployments:
- Consider enabling SQLite's WAL mode explicitly: `PRAGMA journal_mode=WAL;`
- Monitor database size and vacuum periodically
- The persistent volume can handle multiple GBs of data

## Security

- `local.db` contains sensitive data (user credentials, API keys indirectly)
- Ensure the persistent volume has appropriate file permissions
- Regular backups stored in secure location
- Never commit `local.db` to git repository
