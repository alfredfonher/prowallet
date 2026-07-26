# Docker Hardcoding Summary

## 🎯 What We Did

We replaced **ALL environment variable substitutions** (`${VARIABLE}`) in `docker-compose.yaml` with **hardcoded values** extracted from the Dockerfiles. This eliminates the need for external `.env.docker` files and makes Docker setup straightforward.

## 📋 Changes Made

### 1. **docker-compose.yaml** - Complete Hardcoding

#### PostgreSQL Service

- `POSTGRES_DB`: `prowallet` (was: `${POSTGRES_DB:-prowallet}`)
- `POSTGRES_USER`: `postgres` (was: `${POSTGRES_USER:-postgres}`)
- `POSTGRES_PASSWORD`: `prowallet_secure_password_123` (was: `${POSTGRES_PASSWORD:-change_me_in_production}`)

#### Web Service (Next.js Frontend)

All `NEXT_PUBLIC_*` variables now hardcoded:

- `NODE_ENV`: `production`
- `NEXT_TELEMETRY_DISABLED`: `1`
- `PORT`: `3000`
- `NEXT_PUBLIC_ENVIRONMENT`: `production`
- `NEXT_PUBLIC_SOLANA_NETWORK`: `mainnet-beta`
- `NEXT_PUBLIC_SOLANA_RPC_URL`: `https://mainnet.helius-rpc.com/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`
- `NEXT_PUBLIC_FALLBACK_SOLANA_RPC_URL`: `https://api.rpcpool.com`
- `NEXT_PUBLIC_PROWALLET_PROGRAM_ID`: `7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem`
- `NEXT_PUBLIC_HELIUS_API_KEY`: `97cdbcf5-714f-4e61-b355-93368a279e34`
- `NEXT_PUBLIC_HELIUS_PARSE_TRANSACTION_URL`: `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`
- `NEXT_PUBLIC_HELIUS_PARSE_HISTORY_URL`: `https://api-mainnet.helius-rpc.com/v0/addresses/{address}/transactions/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`
- `NEXT_PUBLIC_TOKEN_MINT`: `D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3`
- `NEXT_PUBLIC_TOKEN_NAME`: `ProWallet`
- `NEXT_PUBLIC_TOKEN_SYMBOL`: `GAPC`
- `NEXT_PUBLIC_API_URL`: `https://servicioshilda.orioncaribe.com/api/v1`

#### API Service (Backend/Express)

All variables now hardcoded from Dockerfile defaults:

**Server Config:**

- `NODE_ENV`: `production`
- `PORT`: `3001`
- `DATABASE_URL`: `postgresql://postgres:prowallet_secure_password_123@postgres:5432/prowallet`

**Solana Configuration:**

- `SOLANA_NETWORK`: `mainnet-beta`
- `SOLANA_RPC_URL`: `https://mainnet.helius-rpc.com/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`
- `FALLBACK_SOLANA_RPC_URL`: `https://api.rpcpool.com`

**Helius API:**

- `HELIUS_API_KEY`: `97cdbcf5-714f-4e61-b355-93368a279e34`
- `HELIUS_PARSE_TRANSACTION_URL`: `https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`
- `HELIUS_PARSE_HISTORY_URL`: `https://api-mainnet.helius-rpc.com/v0/addresses/{address}/transactions/?api-key=97cdbcf5-714f-4e61-b355-93368a279e34`

**Token Configuration:**

- `TOKEN_MINT`: `D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3`
- `TOKEN_NAME`: `ProWallet`
- `TOKEN_SYMBOL`: `GAPC`
- `TOKEN_DECIMALS`: `9`
- `MAX_SUPPLY`: `1000000000`
- `BASE_TOKEN_PRICE`: `0.01`
- `TOKEN_MINT_ADDRESS`: `D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3`

**Bonding Curve & Pricing:**

- `BONDING_CURVE_MULTIPLIER`: `1.5`
- `PRICING_MODE`: `bonding`

**Wallets & Authorities:**

- `PROVIDER_PUBLIC_KEY`: `EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH`
- `PROVIDER_ATA`: `DuVzGwE9waTmPHjsto3brPbFZaqMjW5AnDQEA1mK1ZZN`
- `COMPANY_WALLET`: `EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH`
- `COMMISSION_WALLET`: `EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH`
- `AUTHORITY_WALLET`: `EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH`
- `TOKEN_ACCOUNT`: `DuVzGwE9waTmPHjsto3brPbFZaqMjW5AnDQEA1mK1ZZN`
- `TREASURY_WALLET`: `EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH`

**Keypair Paths:**

- `PROVIDER_WALLET`: `/app/apps/api/idl/prowallet.json`
- `KEYPAIR_PATH`: `/app/apps/api/idl/prowallet.json`
- `AUTHORITY_KEYPAIR_PATH`: `/app/apps/api/idl/prowallet.json`
- `PROGRAM_KEYPAIR`: `/app/apps/api/idl/prowallet_contract.json`

**Program Configuration:**

- `PROWALLET_PROGRAM_ID`: `7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem`
- `PROGRAM_ID`: `7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem`
- `PROWALLET_IDL`: `/app/apps/api/idl/prowallet_contract.json`
- `IDL_PROWALLET_CONTRACT`: `/app/apps/api/idl/prowallet_contract.json`
- `IDL_PROWALLET_DEVNET`: `/app/apps/api/idl/prowallet_contract.devnet.json`

**JWT Authentication:**

- `JWT_SECRET`: `9f3c1a8e6b2d4f709c8a5e1d3b7f2a4c`

**API Configuration:**

- `API_VERSION`: `v1`
- `API_PREFIX`: `/api`
- `ALLOWED_ORIGINS`: `https://exchange.gapstation.net,http://localhost:3000,http://localhost:3001,http://localhost:5173`

**Rate Limiting:**

- `RATE_LIMIT_WINDOW_MS`: `900000`
- `RATE_LIMIT_MAX_REQUESTS`: `900000`
- `PURCHASE_RATE_LIMIT_MAX`: `900000`
- `PURCHASE_RATE_LIMIT_WINDOW_MS`: `900000`

**Purchase Limits:**

- `MIN_PURCHASE_AMOUNT`: `0.000000001`
- `MAX_PURCHASE_AMOUNT`: `10000`

**Exchange & Pricing:**

- `EXCHANGE_PROVIDER_URL`: `https://api.coingecko.com/api/v3/coins/markets`
- `EXCHANGE_IDS`: `bitcoin,ethereum,solana,cardano,polkadot,chainlink,uniswap,litecoin,ripple,polygon`
- `EXCHANGE_VS_CURRENCIES`: `usd,eur,gbp`
- `EXCHANGE_TIMEOUT_MS`: `7000`
- `EXCHANGE_MAX_RETRIES`: `3`

**Feature Flags:**

- `TEST_MODE_FREE_TOKEN`: `false`
- `MOCK_TOKEN_INFO`: `false`
- `ALLOW_OFFCHAIN_LINK`: `true`
- `WHITELIST_ENABLED`: `true`
- `SKIP_MINT_ON_CONFIRM`: `false`

**Logging:**

- `LOG_LEVEL`: `info`

**Redis:**

- `REDIS_URL`: `redis://redis:6379`

### 2. **Cleanup**

- **Deleted**: `.env.docker` file (no longer needed)
- **Deleted**: `docker-setup.sh` helper script (was only for env variable injection, now unnecessary)

## 🚀 How to Use Docker Now

### Before (with .env.docker):

```bash
# Required external file + docker compose commands
cat > .env.docker << EOF
HELIUS_API_KEY=...
JWT_SECRET=...
...
EOF
docker compose --env-file .env.docker up
```

### After (completely hardcoded):

```bash
# Just one command - everything is in docker-compose.yaml
docker compose up
```

## ⚠️ Important Notes

1. **No more external configuration needed** - All env vars are in `docker-compose.yaml`
2. **Ports remain unchanged**:
   - Frontend: `3006:3000` (host:container)
   - API: `3005:3001` (host:container)
   - PostgreSQL: Internal only (no external port)
   - Redis: Internal only (no external port)
3. **All variables are PRODUCTION values** from the Dockerfiles
4. **The Helius API key shown is a real key** - If compromised, regenerate from Helius dashboard
5. **The JWT_SECRET is NOT production-grade** - Generate a stronger one if needed
6. **Database password is hardcoded** - It's only used internally in the Docker network (not exposed)

## 🔧 If You Need to Change Values Later

Edit `docker-compose.yaml` directly in the API service's `environment` section. No need to manage external files.

## ✅ Verification

Confirm no variable substitutions exist:

```bash
grep -r '\${' docker-compose.yaml
# Should return nothing (no matches)
```

## 📝 Git Commit

```
refactor: hardcode all environment variables into docker-compose.yaml

- Remove all ${VARIABLE} substitutions from docker-compose.yaml
- All env vars now explicitly defined from Dockerfile defaults (web, api)
- Database credentials hardcoded (prowallet_secure_password_123)
- Helius API keys and Solana RPC endpoints hardcoded
- JWT_SECRET hardcoded (9f3c1a8e6b2d4f709c8a5e1d3b7f2a4c)
- All wallet addresses, token configs, and API settings hardcoded
- Eliminates need for .env.docker file (removed from project)
- Delete docker-setup.sh helper script (no longer needed)
- Simplifies Docker setup: 'docker compose up' now works without external config
```

---

**Status**: ✅ COMPLETE - Docker is now 100% self-contained with hardcoded values.
