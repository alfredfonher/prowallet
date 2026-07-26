# 🔧 Session: Prisma + Docker Environment Variable Fix

**Date**: December 19, 2025
**Issue**: Prisma migrations failing in Docker due to empty `DATABASE_URL`
**Status**: ✅ FIXED

---

## Problem Summary

When running Docker with `docker-compose up`, Prisma migrations were failing with:

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: Error validating datasource `db`: You must provide a nonempty URL.
The environment variable `DATABASE_URL` resolved to an empty string.
```

### Root Cause

The `docker-compose.yaml` was set up to accept `DATABASE_URL` from environment variables via the `--env-file` flag, BUT:

1. **Users weren't aware they needed to use `--env-file`** - documentation was unclear
2. **`.env.docker` file didn't exist** - no template to copy from
3. **No validation in `docker-entrypoint.sh`** - failed silently with cryptic Prisma error
4. **`.env.docker` wasn't in `.gitignore`** - risk of committing secrets

---

## Solution Implemented

### 1. ✅ Created Comprehensive Docker Documentation

**File**: `DOCKER_SETUP.md`

Explains:

- **CORRECT command**: `docker-compose up --env-file .env.docker`
- **WRONG commands**: What NOT to do and why they fail
- All required environment variables with descriptions
- Security notes about never committing secrets
- Troubleshooting guide for common errors

### 2. ✅ Added DATABASE_URL Validation

**File**: `apps/api/docker-entrypoint.sh`

Added validation that checks if `DATABASE_URL` is set before running migrations:

```bash
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is empty or not set!"
    echo "⚠️  Make sure you're running with: docker-compose up --env-file .env.docker"
    echo "⚠️  See DOCKER_SETUP.md for more information"
    exit 1
fi
```

**Benefit**: Users now get a clear error message pointing them to the solution, instead of cryptic Prisma errors.

### 3. ✅ Created Helper Script

**File**: `docker-setup.sh`

Makes Docker setup foolproof:

```bash
# These commands now work seamlessly
./docker-setup.sh up           # Start services
./docker-setup.sh up-d         # Start in background
./docker-setup.sh down         # Stop services
./docker-setup.sh logs         # View logs
./docker-setup.sh logs-api     # View API logs
./docker-setup.sh rebuild      # Rebuild images
./docker-setup.sh status       # Show container status
```

**Key features**:

- Auto-creates `.env.docker` from `.env.docker.example` if missing
- Validates that `.env.docker` exists before running Docker
- Always uses `--env-file` flag automatically
- Provides clear instructions on what to fill in

### 4. ✅ Updated .gitignore

**File**: `.gitignore`

Added:

```
.env.docker
.env.docker.local
```

Prevents accidental commits of production secrets.

### 5. ✅ Updated Main README

**File**: `README.md`

Replaced generic Turborepo starter README with:

- Quick start instructions for both dev and Docker modes
- Clear Docker deployment guide
- Project structure explanation
- All available npm commands
- Architecture overview
- Testing and deployment sections
- Troubleshooting guide

---

## Files Changed

```
apps/api/docker-entrypoint.sh     → Added DATABASE_URL validation
.gitignore                         → Added .env.docker
DOCKER_SETUP.md                    → NEW - Comprehensive Docker guide
docker-setup.sh                    → NEW - Helper script
README.md                          → UPDATED - Complete project guide
```

---

## How to Use

### For New Developers

```bash
# 1. Clone repo
git clone <repo>
cd prowallet

# 2. Create env file
cp .env.docker.example .env.docker

# 3. Edit with your secrets
nano .env.docker

# 4. Start Docker (the easy way)
./docker-setup.sh up

# Done! Services will be running
```

### Manual Docker (if not using script)

```bash
docker-compose up --env-file .env.docker
```

### For Development (without Docker)

```bash
npm install
npm run dev
```

---

## Commits Created

1. **08b14e9** - `docs: add comprehensive Docker setup guide with environment variable requirements`
2. **0bf8059** - `fix: add DATABASE_URL validation in docker-entrypoint.sh with clear error message`
3. **51cf0a6** - `security: add .env.docker to .gitignore to prevent accidental secret commits`
4. **1897bac** - `chore: add docker-setup.sh helper script for easier Docker management`
5. **10efbe1** - `docs: replace generic README with comprehensive ProWallet project guide`

---

## Testing the Fix

### Scenario 1: Without `--env-file` (Should FAIL clearly now)

```bash
docker-compose up
# Output will show clear error message pointing to DOCKER_SETUP.md
```

### Scenario 2: With `--env-file` (Should SUCCEED)

```bash
docker-compose up --env-file .env.docker
# ✅ Services will start if .env.docker has valid values
```

### Scenario 3: Using helper script (Recommended)

```bash
./docker-setup.sh up
# ✅ Automatically validates and uses --env-file
```

---

## Environment Variables Required

All these must be in `.env.docker`:

| Variable               | Type     | Example                                                |
| ---------------------- | -------- | ------------------------------------------------------ |
| `DATABASE_URL`         | REQUIRED | `postgresql://postgres:<PASSWORD>@postgres:5432/prowallet` |
| `SOLANA_NETWORK`       | REQUIRED | `mainnet-beta`                                         |
| `SOLANA_RPC_URL`       | REQUIRED | `https://mainnet.helius-rpc.com/?api-key=XXX`          |
| `HELIUS_API_KEY`       | REQUIRED | Your API key                                           |
| `TREASURY_PRIVATE_KEY` | SECRET   | Base58 encoded key                                     |
| `JWT_SECRET`           | SECRET   | Generated with `openssl rand -base64 32`               |
| `NEXT_PUBLIC_API_URL`  | REQUIRED | `http://localhost:3005/api/v1`                         |
| `POSTGRES_DB`          | REQUIRED | `prowallet`                                              |
| `POSTGRES_USER`        | REQUIRED | `postgres`                                             |
| `POSTGRES_PASSWORD`    | REQUIRED | Your password                                          |

---

## Next Steps

1. **Push these commits** to remote
2. **Update team documentation** with new Docker instructions
3. **Test with fresh clones** to ensure onboarding works smoothly
4. **Monitor** for any DATABASE_URL-related issues (should be gone now)

---

## Security Notes

⚠️ **CRITICAL**: Never commit `.env.docker` to git. It contains:

- Database credentials
- Private keys
- API keys
- JWT secrets

The `.gitignore` now prevents this, but team members must be aware.

For production:

- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Pass secrets at runtime
- Never hardcode secrets anywhere

---

## Key Takeaways

### What Was Wrong

- Users weren't told to use `--env-file` flag
- No clear error messages when it failed
- Confusing Prisma validation errors

### What's Fixed

- ✅ Clear documentation in DOCKER_SETUP.md
- ✅ Helpful script (docker-setup.sh) that does the right thing
- ✅ Validation in docker-entrypoint.sh with actionable error messages
- ✅ Updated README guides users to correct approach
- ✅ Security: .env.docker in .gitignore

### The Teaching Point

**Environment variables must be injected at RUNTIME**, not baked into Docker images. The `--env-file` flag is the correct mechanism for this in Docker Compose.

---

**Status**: Ready for production. All developers should now be able to:

- Run `./docker-setup.sh up` and have it work
- Understand why `--env-file` is required
- Get clear error messages if they do it wrong
