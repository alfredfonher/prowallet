# 🚀 QUICK START - Deploy to Linux Server

## Your Production URLs

- **API**: https://servicioshilda.orioncaribe.com/api/v1
- **Frontend**: https://exchange.gapstation.net

---

## STEP 1: On Your Local Machine

### Create production environment file:

```bash
# From project root
cp .env.docker.example .env.docker

# Edit with your production secrets:
cat > .env.docker << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@db-host:5432/prowallet

# Solana
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
HELIUS_API_KEY=YOUR_HELIUS_API_KEY

# Wallets
TREASURY_PRIVATE_KEY=YOUR_BASE58_PRIVATE_KEY
TREASURY_PUBLIC_KEY=EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH
JWT_SECRET=$(openssl rand -base64 32)

# Frontend URLs
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=https://servicioshilda.orioncaribe.com/api/v1
NEXT_PUBLIC_HELIUS_API_KEY=YOUR_HELIUS_API_KEY
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
NEXT_PUBLIC_PROWALLET_PROGRAM_ID=7sa2XazRU4R6DcsNLGMWcX4nabCzWwjj3Awfh1gxhtem

# CORS - Critical for frontend to reach API
ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com
EOF
```

### Copy to server:

```bash
scp .env.docker user@servicioshilda.orioncaribe.com:/tmp/.env.docker
```

---

## STEP 2: On Your Linux Server

### SSH to server:

```bash
ssh user@servicioshilda.orioncaribe.com
```

### Clone and setup:

```bash
# Create app directory
sudo mkdir -p /opt/prowallet
sudo chown $USER:$USER /opt/prowallet

# Clone repo
cd /opt/prowallet
git clone https://github.com/your-repo/prowallet.git .
git checkout main

# Move env file
mv /tmp/.env.docker ./.env.docker
chmod 600 .env.docker
```

### Build and start:

```bash
# Build Docker images
docker-compose build

# Start containers
docker-compose up -d --env-file .env.docker

# Watch logs
docker-compose logs -f
```

### Verify services:

```bash
# Check containers are running
docker-compose ps

# Test API
curl https://servicioshilda.orioncaribe.com/api/v1/health

# Test CORS headers
curl -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
     -H "Origin: https://exchange.gapstation.net" \
     -H "Access-Control-Request-Method: POST" \
     -v | grep Access-Control
```

---

## STEP 3: Setup Nginx Reverse Proxy

### Install Nginx and Certbot:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Create Nginx config:

```bash
sudo tee /etc/nginx/sites-available/prowallet > /dev/null << 'EOF'
upstream api_backend {
    server localhost:3005;
}

upstream web_frontend {
    server localhost:3006;
}

server {
    listen 80;
    server_name servicioshilda.orioncaribe.com exchange.gapstation.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name servicioshilda.orioncaribe.com;

    ssl_certificate /etc/letsencrypt/live/servicioshilda.orioncaribe.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/servicioshilda.orioncaribe.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;

    # CORS Headers
    add_header Access-Control-Allow-Origin "https://exchange.gapstation.net" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }

    location /api/v1 {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://api_backend;
    }
}

server {
    listen 443 ssl http2;
    server_name exchange.gapstation.net;

    ssl_certificate /etc/letsencrypt/live/exchange.gapstation.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exchange.gapstation.net/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://web_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

### Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/prowallet /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Get SSL certificates:

```bash
sudo certbot certonly --nginx \
    -d servicioshilda.orioncaribe.com \
    -d exchange.gapstation.net \
    --email your-email@example.com \
    --agree-tos
```

---

## STEP 4: Verify Everything Works

### API Health:

```bash
curl https://servicioshilda.orioncaribe.com/api/v1/health
```

### Frontend:

```bash
# Open in browser
https://exchange.gapstation.net
```

### CORS Preflight:

```bash
curl -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
     -H "Origin: https://exchange.gapstation.net" \
     -H "Access-Control-Request-Method: POST" \
     -v
```

Should return `204` with CORS headers.

---

## Common Issues

### ❌ CORS Blocked (Browser Error)

```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Fix:**

```bash
# Check .env.docker has correct ALLOWED_ORIGINS
grep ALLOWED_ORIGINS /opt/prowallet/.env.docker

# Restart API
docker-compose restart api

# Test CORS headers
curl -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/exchange/tokenInfo \
     -H "Origin: https://exchange.gapstation.net" \
     -H "Access-Control-Request-Method: POST" -v
```

### ❌ Unknown cluster: mainnet

```
Error: Unknown https cluster: mainnet
```

**Fix:**

```bash
# Edit .env.docker
sudo nano /opt/prowallet/.env.docker

# Change to:
SOLANA_NETWORK=mainnet-beta

# Restart
docker-compose restart api
```

### ❌ Database Connection Failed

**Fix:**

```bash
# Verify DATABASE_URL is set
grep DATABASE_URL /opt/prowallet/.env.docker

# Check connection
docker-compose logs api | grep -i database

# Run migrations
docker-compose exec api npm run prisma migrate deploy
```

### ❌ Containers Won't Start

**Fix:**

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose build --no-cache

# Start fresh
docker-compose down
docker-compose up -d --env-file .env.docker
```

---

## Monitoring

### Check containers:

```bash
docker-compose ps
```

### View logs (real-time):

```bash
docker-compose logs -f api
docker-compose logs -f web
```

### Check Nginx:

```bash
sudo tail -f /var/log/nginx/error.log
```

### Database health:

```bash
docker-compose exec api npm run db:status
```

---

## Updates

### Pull latest code:

```bash
cd /opt/prowallet
git pull origin main

docker-compose build
docker-compose up -d --env-file .env.docker
```

### Check migrations:

```bash
docker-compose exec api npm run prisma migrate status
docker-compose exec api npm run prisma migrate deploy
```

---

## Important Files

```
/opt/prowallet/
├── .env.docker              # ⚠️ SECRETS - DO NOT COMMIT
├── docker-compose.yaml      # Container configuration
├── apps/
│   ├── api/Dockerfile.api   # Backend image
│   └── web/Dockerfile.web   # Frontend image
└── DEPLOYMENT.md            # Full deployment guide
```

---

## Done! ✅

Your app is live at:

- **API**: https://servicioshilda.orioncaribe.com/api/v1
- **Frontend**: https://exchange.gapstation.net

**Next steps:**

- Monitor logs regularly
- Set up automated backups for database
- Rotate secrets monthly
- Monitor SSL certificate expiration
- Keep Docker images updated

---

**Questions?** Check DEPLOYMENT.md for detailed troubleshooting
