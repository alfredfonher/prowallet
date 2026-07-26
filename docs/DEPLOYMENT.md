# 🚀 ProWallet Production Deployment Guide

## Prerequisites

- Docker & Docker Compose installed
- PostgreSQL database (separate server)
- Redis cache (separate server)
- Solana network access (RPC endpoint)
- Helius API key (for transaction parsing)
- SSL certificates (for HTTPS)

---

## Step 1: Prepare Environment File

**Create `.env.docker` from the example:**

```bash
cp .env.docker.example .env.docker
```

**Edit `.env.docker` and fill in your production values:**

```bash
# Critical secrets - NEVER commit to git!
DATABASE_URL=postgresql://user:<PASSWORD>@db.yourhost.com:5432/prowallet
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=<HELIUS_API_KEY>
TREASURY_PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_BASE58
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Frontend URLs
NEXT_PUBLIC_API_URL=https://servicioshilda.orioncaribe.com/api/v1
NEXT_PUBLIC_HELIUS_API_KEY=<HELIUS_API_KEY>

# CORS - Allow your frontend origins
ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com
```

**⚠️ SECURITY WARNINGS:**

- Add `.env.docker` to `.gitignore`
- Rotate `JWT_SECRET` periodically
- Use strong database passwords
- Never expose `TREASURY_PRIVATE_KEY` in logs

---

## Step 2: Database Setup

### Option A: External PostgreSQL Server

If using a managed database (AWS RDS, Digital Ocean, etc.):

```bash
# Set DATABASE_URL in .env.docker
DATABASE_URL=postgresql://user:<PASSWORD>@db.example.com:5432/prowallet
```

### Option B: Docker PostgreSQL (Development Only)

The `docker-compose.yaml` includes a PostgreSQL service. However, for production, use a managed database.

---

## Step 3: Build and Deploy

### Local Testing First

```bash
# Build images locally
docker-compose build

# Start containers with env file
docker-compose up --env-file .env.docker
```

**Verify services are running:**

```bash
# Check API health
curl https://servicioshilda.orioncaribe.com/api/v1/health

# Check frontend
curl https://exchange.gapstation.net/

# Check logs
docker-compose logs -f api
docker-compose logs -f web
```

### Production Deployment on Linux Server

**1. SSH into your server:**

```bash
ssh user@servicioshilda.orioncaribe.com
```

**2. Clone repository:**

```bash
git clone <repo-url> /opt/prowallet
cd /opt/prowallet
```

**3. Copy env file (from local machine or secure location):**

```bash
# Option 1: Copy from local dev machine (secure)
scp .env.docker user@servicioshilda.orioncaribe.com:/opt/prowallet/.env.docker

# Option 2: Create directly on server (more secure)
nano /opt/prowallet/.env.docker
# Paste your secrets
```

**4. Start containers:**

```bash
cd /opt/prowallet

# Pull latest changes
git pull origin main

# Build images
docker-compose build

# Start in background
docker-compose up -d --env-file .env.docker
```

**5. Verify deployment:**

```bash
# Check running containers
docker-compose ps

# Check API logs
docker-compose logs api

# Check web logs
docker-compose logs web

# Test API endpoint
curl https://servicioshilda.orioncaribe.com/api/v1/health

# Test CORS headers
curl -H "Origin: https://exchange.gapstation.net" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
     -v
```

---

## Step 4: Nginx Reverse Proxy Setup

The frontend and API need to be served over HTTPS. Use Nginx as reverse proxy:

**Create `/etc/nginx/sites-available/prowallet.conf`:**

```nginx
# API Backend
upstream api_backend {
    server localhost:3005;
}

# Web Frontend
upstream web_frontend {
    server localhost:3006;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name servicioshilda.orioncaribe.com exchange.gapstation.net;
    return 301 https://$server_name$request_uri;
}

# API Server (https://servicioshilda.orioncaribe.com/api/v1)
server {
    listen 443 ssl http2;
    server_name servicioshilda.orioncaribe.com;

    ssl_certificate /etc/letsencrypt/live/servicioshilda.orioncaribe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/servicioshilda.orioncaribe.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers for API
    add_header Access-Control-Allow-Origin "https://exchange.gapstation.net" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        return 204;
    }

    location /api/v1 {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback to API health
    location / {
        proxy_pass http://api_backend;
    }
}

# Web Frontend Server (https://exchange.gapstation.net)
server {
    listen 443 ssl http2;
    server_name exchange.gapstation.net;

    ssl_certificate /etc/letsencrypt/live/exchange.gapstation.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exchange.gapstation.net/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://web_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable the site:**

```bash
ln -s /etc/nginx/sites-available/prowallet.conf /etc/nginx/sites-enabled/

# Test Nginx config
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## Step 5: SSL Certificates with Certbot

```bash
# Install Certbot
apt-get install certbot python3-certbot-nginx

# Generate certificates
certbot certonly --nginx \
    -d servicioshilda.orioncaribe.com \
    -d exchange.gapstation.net \
    --email your-email@example.com \
    --agree-tos

# Auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

## Step 6: Monitoring & Logs

### Check Container Status

```bash
# Running containers
docker-compose ps

# Real-time logs
docker-compose logs -f

# Specific service logs
docker-compose logs -f api
docker-compose logs -f web

# Last 100 lines
docker-compose logs --tail 100 api
```

### Nginx Logs

```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

### Database Health

```bash
# Connect to PostgreSQL
PGPASSWORD=your_password psql -h db.host.com -U postgres -d prowallet

# Check migrations
\dt  # List tables
```

---

## Step 7: Troubleshooting

### Issue: CORS Blocked Errors

**Error:** `Access to fetch at 'https://servicioshilda.orioncaribe.com/api/v1/...' from origin 'https://exchange.gapstation.net' has been blocked by CORS policy`

**Solution:**

1. Verify `ALLOWED_ORIGINS` in `.env.docker`:

   ```bash
   ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com
   ```

2. Restart API container:

   ```bash
   docker-compose restart api
   ```

3. Test preflight request:
   ```bash
   curl -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
        -H "Origin: https://exchange.gapstation.net" \
        -H "Access-Control-Request-Method: POST" \
        -v
   ```

### Issue: Solana Network Error

**Error:** `Error: Unknown https cluster: mainnet`

**Solution:**

- Ensure `SOLANA_NETWORK` is set to one of: `mainnet-beta`, `testnet`, `devnet`
- Edit `.env.docker`:
  ```bash
  SOLANA_NETWORK=mainnet-beta
  ```
- Restart API: `docker-compose restart api`

### Issue: Database Connection Failed

**Error:** `DATABASE_URL resolved to an empty string`

**Solution:**

1. Verify `.env.docker` exists
2. Check Prisma migrations:
   ```bash
   docker-compose exec api npx prisma migrate deploy
   ```
3. Check database connection:
   ```bash
   docker-compose logs api | grep -i database
   ```

### Issue: Container Won't Start

**Solution:**

```bash
# Check logs
docker-compose logs api

# Rebuild images
docker-compose build --no-cache

# Restart
docker-compose up -d
```

---

## Step 8: Maintenance & Updates

### Updating Code

```bash
cd /opt/prowallet

# Pull latest changes
git pull origin main

# Rebuild if dependencies changed
docker-compose build

# Restart services
docker-compose up -d
```

### Database Migrations

```bash
# Check pending migrations
docker-compose exec api npx prisma migrate status

# Apply migrations
docker-compose exec api npx prisma migrate deploy
```

### Rotate Secrets

```bash
# Update .env.docker with new values
nano .env.docker

# Restart containers to apply
docker-compose restart
```

---

## Environment Variables Reference

| Variable                     | Required | Description                                    |
| ---------------------------- | -------- | ---------------------------------------------- |
| `DATABASE_URL`               | Yes      | PostgreSQL connection string                   |
| `SOLANA_NETWORK`             | Yes      | Must be `mainnet-beta`, `testnet`, or `devnet` |
| `SOLANA_RPC_URL`             | Yes      | Solana RPC endpoint                            |
| `HELIUS_API_KEY`             | Yes      | Helius API key for transaction parsing         |
| `TREASURY_PRIVATE_KEY`       | Yes      | Wallet private key (base58 format)             |
| `JWT_SECRET`                 | Yes      | Secret for JWT token signing                   |
| `ALLOWED_ORIGINS`            | No       | Comma-separated CORS allowed origins           |
| `NEXT_PUBLIC_API_URL`        | Yes      | Frontend API URL                               |
| `NEXT_PUBLIC_HELIUS_API_KEY` | Yes      | Frontend Helius key                            |
| `NEXT_PUBLIC_SOLANA_NETWORK` | No       | Frontend Solana network                        |

---

## Support & Debugging

**Check API Health:**

```bash
curl https://servicioshilda.orioncaribe.com/api/v1/health
```

**Check API Logs:**

```bash
docker-compose logs -f --tail 50 api
```

**Verify Nginx CORS Headers:**

```bash
curl -I -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
     -H "Origin: https://exchange.gapstation.net" \
     -H "Access-Control-Request-Method: POST"
```

**Test Database Connection:**

```bash
docker-compose exec api npm run db:push
```

---

## Checklist Before Going Live

- [ ] `.env.docker` is created and in `.gitignore`
- [ ] Database migration ran successfully
- [ ] SSL certificates are installed
- [ ] Nginx reverse proxy is configured
- [ ] CORS headers are correct
- [ ] API health check returns 200
- [ ] Frontend loads in browser
- [ ] Wallet connection works
- [ ] CORS preflight requests pass
- [ ] Solana network is mainnet-beta
- [ ] All secrets are rotated

---

**Last Updated:** December 19, 2025  
**Repository:** ProWallet Exchange
