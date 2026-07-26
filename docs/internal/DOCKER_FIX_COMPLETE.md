# Docker Setup - Complete Fix

## 🎯 What Was Fixed

### Problem 1: `.env.mainnet` Overriding Docker Variables ❌

When containers started, `.env.mainnet` was being loaded and **overriding all the hardcoded values from `docker-compose.yaml`**, including `JWT_SECRET`.

**Error:**

```
Error: ❌ CRITICAL: Environment variable JWT_SECRET is required but not set
```

**Root Cause:**

- `app.ts` was loading `.env.mainnet` with `override: true` (default)
- This overwrote all variables, including those from Docker

### Solution 1: Prevent .env Files in Production ✅

Modified `apps/api/src/app.ts` and `apps/api/src/server.ts`:

- In **production (Docker)**: `envFile = null` - don't load ANY .env files
- In **development**: `envFile = ".env.local"` - only load local dev file
- Result: Docker variables now take precedence

```typescript
// In production/Docker: DO NOT load .env files
let envFile: string | null = null;
if (process.env.NODE_ENV === "development") {
  envFile = ".env.local";
} else if (process.env.NODE_ENV === "production") {
  envFile = null; // ← No .env files loaded!
}

if (envFile) {
  dotenv.config({
    path: path.resolve(process.cwd(), envFile),
    override: false,
  });
}
```

### Problem 2: Removed `docker-setup.sh` (Your Point!) ❌

I deleted `docker-setup.sh` thinking it was just for env injection, but it's needed for:

- Executing migrations
- Running seeds
- Container management helpers

### Solution 2: Recreated `docker-setup.sh` ✅

New comprehensive version with these commands:

```bash
./docker-setup.sh up          # Start containers (foreground)
./docker-setup.sh up-d        # Start in background
./docker-setup.sh down        # Stop containers
./docker-setup.sh logs        # View logs
./docker-setup.sh restart     # Restart containers
./docker-setup.sh rebuild     # Rebuild images
./docker-setup.sh migrate     # Run Prisma migrations
./docker-setup.sh seed        # Seed database
./docker-setup.sh status      # Show status
./docker-setup.sh clean       # Remove all data (with confirmation)
```

## 🚀 How to Use Now

### Start Everything (Automated)

```bash
# Start containers and see logs
./docker-setup.sh up

# Or start in background
./docker-setup.sh up-d
```

### Manual Steps (If Needed)

```bash
# 1. Start containers
docker compose up -d

# 2. Verify migrations ran (check logs)
docker compose logs api | grep -i "migration"

# 3. Manually run migrations if needed
./docker-setup.sh migrate

# 4. View logs
./docker-setup.sh logs
```

## 📋 What Happens When You Start

1. **Docker Compose** starts 4 containers:
   - PostgreSQL (database)
   - Redis (cache)
   - API (backend) on port 3005
   - Web (frontend) on port 3006

2. **API Container Entrypoint** (automatic):
   - `docker-entrypoint.sh` runs
   - Runs `npx prisma migrate deploy` → Applies migrations
   - Starts Node.js server

3. **Environment Variables** (flow):
   ```
   docker-compose.yaml (hardcoded values)
              ↓
   Container env vars
              ↓
   Node.js app reads them
              ↓
   NO .env files override (in production)
   ```

## 🔧 Environment Variables Now

### API (docker-compose.yaml)

- `NODE_ENV=production`
- `DATABASE_URL=postgresql://postgres:prowallet_secure_password_123@postgres:5432/prowallet`
- `JWT_SECRET=9f3c1a8e6b2d4f709c8a5e1d3b7f2a4c`
- `HELIUS_API_KEY=97cdbcf5-714f-4e61-b355-93368a279e34`
- All other vars hardcoded (100+ total)

### Web (docker-compose.yaml)

- `NEXT_PUBLIC_API_URL=https://servicioshilda.orioncaribe.com/api/v1`
- `NEXT_PUBLIC_HELIUS_API_KEY=97cdbcf5-714f-4e61-b355-93368a279e34`
- All other public vars hardcoded

## ⚠️ Important Notes

1. **No external .env files needed** - Everything in `docker-compose.yaml`
2. **Production env variables** - All values are real production config
3. **Database is internal** - Only accessible from Docker network
4. **Migrations run automatically** - When container starts
5. **Ports are locked**:
   - Frontend: http://localhost:3006
   - Backend: http://localhost:3005
   - DB/Redis: Internal only

## 🐛 If You Get Errors

### "JWT_SECRET is required but not set"

**Cause:** An old `.env.mainnet` file still exists and dotenv loaded it
**Fix:**

```bash
rm -f apps/api/.env.mainnet
docker compose down
docker compose up
```

### "DATABASE_URL is empty"

**Cause:** dotenv loaded an empty `.env` file
**Fix:** Same as above - remove local .env files, Docker will provide values

### "Migrations failed"

**Manually run:**

```bash
./docker-setup.sh migrate
```

Or check status:

```bash
./docker-setup.sh status
docker compose logs api
```

## 📝 Git Commits

1. **df654af** - `fix: prevent .env files from overriding docker-compose environment variables in production`
2. **64c4ff7** - `feat: recreate docker-setup.sh with migration and container management`

---

**TLDR**: Docker now works completely self-contained. All variables hardcoded in `docker-compose.yaml`. No .env files interfere. Migrations run automatically. Use `./docker-setup.sh up` to start everything.
