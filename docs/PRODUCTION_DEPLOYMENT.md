# 🚀 PRODUCTION DEPLOYMENT GUIDE

## 📍 SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│         https://exchange.gapstation.net             │
│              (Frontend - Next.js)                   │
└────────────────┬────────────────────────────────────┘
                 │
                 │ HTTP/HTTPS
                 │ (CORS enabled)
                 ▼
┌──────────────────────────────────────────────────────┐
│   https://servicioshilda.orioncaribe.com/api/v1     │
│          (Backend - Express.js)                     │
└──────────────────────────────────────────────────────┘
                 │
                 │ Internal
                 ▼
         PostgreSQL Database
         Solana Blockchain RPC
```

---

## 🔧 CONFIGURATION CHECKLIST

### Frontend (Next.js)

- [ ] Build environment: `NODE_ENV=production`
- [ ] Environment detection: `NEXT_PUBLIC_ENVIRONMENT=production`
- [ ] API URL: `NEXT_PUBLIC_API_URL_CLOUD=https://servicioshilda.orioncaribe.com/api/v1`
- [ ] Domain: Running on `https://exchange.gapstation.net`
- [ ] No hardcoded `localhost` URLs in code

### Backend (Express.js)

- [ ] Environment: `NODE_ENV=production`
- [ ] API Prefix: `/api`
- [ ] API Version: `v1`
- [ ] CORS Origins: `https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com,http://localhost:3000`
- [ ] Database: PostgreSQL connection string
- [ ] Solana RPC: Helius or other reliable endpoint

### Database

- [ ] PostgreSQL running and accessible
- [ ] Migrations applied
- [ ] Backups configured

### SSL/TLS

- [ ] HTTPS enabled on both domains
- [ ] Valid certificates (Let's Encrypt)
- [ ] HSTS headers configured

---

## 📝 ENVIRONMENT FILES

### Create `.env` for Backend Production

```bash
# app/api/.env
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://prowalletuser:prowalletpass@postgres-host:5432/prowallet

# Solana
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
FALLBACK_SOLANA_RPC_URL=https://api.rpcpool.com

# API
API_PREFIX=/api
API_VERSION=v1

# CORS - CRITICAL: NO trailing slashes
ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com

# ProWallet Config
PROWALLET_PROGRAM_ID=7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem
TOKEN_MINT=D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3
TOKEN_NAME=ProWallet
TOKEN_SYMBOL=GAPC
```

### Create `.env.production` for Frontend

```bash
# apps/web/.env.production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL_CLOUD=https://servicioshilda.orioncaribe.com/api/v1
NEXT_PUBLIC_API_URL=https://servicioshilda.orioncaribe.com/api/v1
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_HELIUS_KEY
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_PROWALLET_PROGRAM_ID=7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem
NEXT_PUBLIC_TOKEN_MINT=D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3
NEXT_PUBLIC_TOKEN_NAME=ProWallet
NEXT_PUBLIC_TOKEN_SYMBOL=GAPC
NEXT_PUBLIC_TEST_MODE_FREE_TOKEN=false
```

---

## 🐳 DOCKER DEPLOYMENT

If using Docker Compose, update `docker-compose.yaml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: prowallet
      POSTGRES_USER: prowalletuser
      POSTGRES_PASSWORD: securepassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://prowalletuser:securepassword@postgres:5432/prowallet
      ALLOWED_ORIGINS: https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com
      SOLANA_RPC_URL: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
      PROWALLET_PROGRAM_ID: 7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem
    ports:
      - "3001:3001"
    depends_on:
      - postgres

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.web
      args:
        NEXT_PUBLIC_ENVIRONMENT: production
        NEXT_PUBLIC_API_URL_CLOUD: https://servicioshilda.orioncaribe.com/api/v1
        NEXT_PUBLIC_SOLANA_NETWORK: mainnet-beta
    environment:
      NEXT_PUBLIC_ENVIRONMENT: production
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 🧪 TESTING BEFORE DEPLOYMENT

### 1. Test CORS

```bash
# From frontend domain
curl -i -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/health \
  -H "Origin: https://exchange.gapstation.net" \
  -H "Access-Control-Request-Method: GET"

# Should return:
# Access-Control-Allow-Origin: https://exchange.gapstation.net
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
```

### 2. Test Backend Health

```bash
curl -s https://servicioshilda.orioncaribe.com/api/v1/health | jq .
```

Expected response:

```json
{
  "success": true,
  "message": "HTTP 200 - Correcto",
  "code": 200,
  "extra": {
    "status": "healthy",
    "version": "1.0.0"
  }
}
```

### 3. Test Frontend API Call

Open browser DevTools Console on `https://exchange.gapstation.net`:

```javascript
fetch("https://servicioshilda.orioncaribe.com/api/v1/health")
  .then((r) => r.json())
  .then((d) => console.log("✅ SUCCESS", d))
  .catch((e) => console.error("❌ ERROR", e));
```

### 4. Test User Flow

1. Go to `https://exchange.gapstation.net`
2. Register → Should work without CORS errors
3. Login → Should work without CORS errors
4. Link wallet → Should work without CORS errors
5. Make purchase → Should work without CORS errors

---

## 📊 MONITORING

### Check Logs

**Frontend (Next.js)**:

```bash
# In browser console
console.log(localStorage.getItem('auth_token'));
```

**Backend (Express)**:

```bash
# Docker logs
docker logs prowallet-api

# Look for:
# - "Connected to Solana"
# - "Database service initialized"
# - Any CORS errors
```

### Monitor CORS Issues

Enable debug logging in browser:

```javascript
// In console
localStorage.setItem("debug", "*");
window.location.reload();
```

---

## 🔐 SECURITY CHECKLIST

- [ ] HTTPS enabled on all URLs
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] CORS origins are explicitly whitelisted
- [ ] No hardcoded secrets in code
- [ ] Rate limiting enabled
- [ ] Helmet security headers configured
- [ ] SQL injection prevention (Prisma)
- [ ] CSRF protection enabled
- [ ] Password hashing (bcrypt)

---

## 📞 TROUBLESHOOTING

### CORS Errors

**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**:

1. Check `ALLOWED_ORIGINS` in backend `.env`
2. Remove trailing slashes from URLs
3. Verify frontend domain matches exactly

### 404 API Errors

**Error**: `https://servicioshilda.orioncaribe.com/api/v1/... 404 Not Found`

**Solution**:

1. Verify backend is running
2. Check `API_PREFIX` and `API_VERSION` are correct
3. Verify routes are registered in Express

### HTTPS Issues

**Error**: `Mixed Content: The page was loaded over HTTPS, but requested an insecure resource`

**Solution**:

1. Ensure both frontend and backend URLs use HTTPS
2. Update `.env` files to use `https://` not `http://`

---

## 🚀 DEPLOYMENT STEPS

### 1. Prepare Backend

```bash
cd apps/api
npm install
npm run build
# Create .env with production values
# Run migrations: npm run db:migrate
```

### 2. Prepare Frontend

```bash
cd apps/web
npm install
npm run build
# .env.production should be in place
```

### 3. Deploy with Docker Compose

```bash
docker-compose up -d
```

### 4. Verify Health

```bash
# Check API health
curl https://servicioshilda.orioncaribe.com/api/v1/health

# Check frontend loads
curl https://exchange.gapstation.net/
```

### 5. Monitor

```bash
docker-compose logs -f api
docker-compose logs -f postgres
```

---

## 📚 RELATED DOCUMENTATION

- [CORS Configuration](./CORS_PRODUCTION_CONFIG.md)
- [Wallet Linking Implementation](./WALLET_LINKING_IMPLEMENTATION.md)
- [API Documentation](https://servicioshilda.orioncaribe.com/api/docs)
