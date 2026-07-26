# 🔧 CORS & URL Configuration Guide - PRODUCTION

## 📍 CURRENT SETUP

### Backend

- **URL**: `https://servicioshilda.orioncaribe.com/`
- **API Endpoints**: `https://servicioshilda.orioncaribe.com/api/v1/`

### Frontend

- **URL**: `https://exchange.gapstation.net/`

---

## 🔴 ISSUES FOUND

### 1. **CORS Configuration (Backend)**

**File**: `apps/api/src/app.ts` lines 84-99

Current allowed origins:

```typescript
"https://exchange.gapstation.net",
"https://servicioshilda.orioncaribe.com",
```

**PROBLEM**: URLs have trailing slashes in `.env.example` but CORS comparison is strict

### 2. **Frontend Environment Detection**

**File**: `apps/web/lib/config/environment.ts` lines 45-59

Current logic:

```typescript
const isLocalHost =
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname.startsWith("192.168.") ||
  hostname.startsWith("10.");
```

**PROBLEM**: `exchange.gapstation.net` doesn't match local hostnames, so it defaults to production ✓ (actually OK)

### 3. **API URL Hardcoding**

**File**: `apps/web/lib/api-client.ts` line 11

Default fallback:

```typescript
"https://servicioshilda.orioncaribe.com/api/v1";
```

**PROBLEM**: This is hardcoded, should use env variable

---

## ✅ SOLUTIONS

### STEP 1: Fix CORS (Backend)

Update `apps/api/src/app.ts` to handle CORS correctly:

```typescript
const allowedOrigins =
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((url) => url.trim().replace(/\/$/, "")) // Remove trailing slashes
    .filter(Boolean).length > 0
    ? (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((url) => url.trim().replace(/\/$/, ""))
        .filter(Boolean)
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "https://exchange.gapstation.net",
        "https://servicioshilda.orioncaribe.com",
      ];
```

### STEP 2: Update Frontend Environment Detection

Add explicit environment detection for production URLs:

```typescript
function getEnvironmentType(): EnvironmentType {
  // ✅ Opción 1: Variable explícita
  const envVar = process.env.NEXT_PUBLIC_ENVIRONMENT;
  if (envVar === "local" || envVar === "production") {
    return envVar;
  }

  // ✅ Opción 2: Hostname detection
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Production domains
    if (hostname === "exchange.gapstation.net") {
      return "production";
    }

    // Local domains
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.");

    if (isLocalHost) {
      return "local";
    }
  }

  return "production"; // Safe default
}
```

### STEP 3: Ensure Backend ALLOWED_ORIGINS is Set

**For Docker production** (`docker-compose.yaml`):

```yaml
environment:
  - ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com,http://localhost:3000
  - NODE_ENV=production
```

**For .env file** (backup):

```env
ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com,http://localhost:3000
```

---

## 🧪 TESTING CORS

### Test from Browser Console

```javascript
// Should NOT get CORS error
fetch("https://servicioshilda.orioncaribe.com/api/v1/health", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
})
  .then((r) => r.json())
  .then((d) => console.log("✅ CORS OK", d))
  .catch((e) => console.error("❌ CORS ERROR", e));
```

### Test with curl

```bash
curl -i -X OPTIONS https://servicioshilda.orioncaribe.com/api/v1/health \
  -H "Origin: https://exchange.gapstation.net" \
  -H "Access-Control-Request-Method: GET"
```

Expected response headers:

```
Access-Control-Allow-Origin: https://exchange.gapstation.net
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 📦 CONFIGURATION FILES NEEDED

### Frontend `.env.production`

```env
# API Configuration
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL_CLOUD=https://servicioshilda.orioncaribe.com/api/v1
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

### Backend `.env.production` or Docker env vars

```env
NODE_ENV=production
API_PREFIX=/api
API_VERSION=v1
ALLOWED_ORIGINS=https://exchange.gapstation.net,https://servicioshilda.orioncaribe.com
```

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] CORS origins are set WITHOUT trailing slashes
- [ ] `NEXT_PUBLIC_ENVIRONMENT=production` in frontend build
- [ ] `NODE_ENV=production` in backend
- [ ] `ALLOWED_ORIGINS` includes both frontend and backend URLs
- [ ] Test CORS from browser developer tools
- [ ] Test API call: `fetch('https://servicioshilda.orioncaribe.com/api/v1/health')`
- [ ] Verify hostname detection works for `exchange.gapstation.net`

---

## 🔗 RELATED URLS

| Component    | URL                                                  | Purpose              |
| ------------ | ---------------------------------------------------- | -------------------- |
| Frontend     | https://exchange.gapstation.net                      | User interface       |
| Backend API  | https://servicioshilda.orioncaribe.com/api/v1        | API endpoints        |
| Health Check | https://servicioshilda.orioncaribe.com/api/v1/health | Verify backend is up |
| Swagger Docs | https://servicioshilda.orioncaribe.com/api/docs      | API documentation    |
