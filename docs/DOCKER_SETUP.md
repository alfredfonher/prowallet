# 🐳 Docker Setup Guide for ProWallet

## Critical: Always Use Environment File

The project requires environment variables to be injected at runtime via `.env.docker` file.

### ✅ Correct Command (Always Use This)

```bash
docker-compose up --env-file .env.docker
```

### ❌ WRONG - These Will Fail

```bash
docker-compose up                           # DATABASE_URL will be empty - MIGRATIONS WILL FAIL
docker-compose up -f docker-compose.yaml    # Same issue
```

## Setup Steps

### 1. Create `.env.docker` from template

```bash
cp .env.docker.example .env.docker
```

### 2. Fill in your production secrets

Edit `.env.docker` and update:

- `DATABASE_URL` - PostgreSQL connection string
- `SOLANA_RPC_URL` - Your Helius API key endpoint
- `HELIUS_API_KEY` - Your Helius RPC API key
- `TREASURY_PRIVATE_KEY` - Your Solana wallet private key
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `NEXT_PUBLIC_API_URL` - Where frontend can reach your API

### 3. Build and run with env-file

```bash
docker-compose up --env-file .env.docker
```

### 4. Expected startup logs

You should see:

```
prowallet-postgres | ready to accept connections
prowallet-redis    | Ready to accept connections
prowallet-api      | ✅ Migrations completed. Starting application...
prowallet-api      | [INFO] Server running on http://0.0.0.0:3001
prowallet-web      | [INFO] Web server running on http://0.0.0.0:3000
```

## Troubleshooting

### Error: `DATABASE_URL resolved to an empty string`

**Cause**: Missing `--env-file .env.docker` flag

**Solution**: Always run with `--env-file .env.docker`

### Error: `HELIUS_API_KEY is not defined`

**Cause**: Missing environment variables in `.env.docker`

**Solution**: Fill in all required variables in `.env.docker`

### Error: `Connection refused for postgres`

**Cause**: Services not healthy yet

**Solution**: Wait for healthchecks to pass (check `docker-compose logs`)

## Environment Variables Required

### Database (REQUIRED)

- `DATABASE_URL` - PostgreSQL connection string

### Solana Network (REQUIRED)

- `SOLANA_NETWORK` - mainnet-beta, testnet, or devnet
- `SOLANA_RPC_URL` - RPC endpoint (e.g., Helius)
- `FALLBACK_SOLANA_RPC_URL` - Fallback RPC endpoint

### Helius API (REQUIRED)

- `HELIUS_API_KEY` - Your Helius API key
- `HELIUS_PARSE_TRANSACTION_URL` - Parse transaction endpoint
- `HELIUS_PARSE_HISTORY_URL` - Parse history endpoint

### Wallet & Auth (REQUIRED)

- `TREASURY_PRIVATE_KEY` - Solana wallet private key (base58)
- `TREASURY_PUBLIC_KEY` - Solana wallet public key
- `JWT_SECRET` - JWT signing secret

### Frontend (REQUIRED)

- `NEXT_PUBLIC_API_URL` - Backend API URL for frontend
- `NEXT_PUBLIC_SOLANA_NETWORK` - Solana network for frontend
- `NEXT_PUBLIC_SOLANA_RPC_URL` - RPC endpoint for frontend
- `NEXT_PUBLIC_HELIUS_API_KEY` - Helius key for frontend
- `NEXT_PUBLIC_PROWALLET_PROGRAM_ID` - Program ID
- `NEXT_PUBLIC_TOKEN_MINT` - Token mint address

### CORS (REQUIRED)

- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

## Security Notes

⚠️ **NEVER commit `.env.docker` to git** - it contains production secrets!

The `.gitignore` already excludes it, so you're safe if you follow this rule.

For production:

1. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Pass secrets at runtime using `--env-file` or environment variables
3. NEVER hardcode secrets in Dockerfile or docker-compose.yaml

## Production Deployment

For production environments:

1. Create `.env.docker` with real production values
2. Secure the `.env.docker` file (restrict file permissions, use secrets manager)
3. Run: `docker-compose up --env-file .env.docker`
4. Verify all services are healthy: `docker-compose logs -f`
5. Check health endpoints:
   - API: `curl http://localhost:3001/api/v1/health`
   - Web: Visit `http://localhost:3006`

## Volume Management

Persistent volumes for:

- `postgres_data` - PostgreSQL database files
- `redis_data` - Redis persistence files
- `./logs` - Application logs

To reset volumes:

```bash
docker-compose down -v  # ⚠️ WARNING: Deletes all data!
```

## Common Commands

```bash
# Start services
docker-compose up --env-file .env.docker

# Start in background
docker-compose up -d --env-file .env.docker

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres

# Stop services
docker-compose down

# Rebuild images
docker-compose build --no-cache

# Execute command in container
docker-compose exec api npm test
docker-compose exec api npm run build
```
