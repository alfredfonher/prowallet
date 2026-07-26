# REST Tests - Troubleshooting Guide

Guía completa para resolver problemas comunes al testear la API.

## 🔴 Errores Comunes y Soluciones

### Error 1: Connection Refused (ECONNREFUSED)

**Síntoma:**

```
Error: connect ECONNREFUSED 127.0.0.1:3001
```

**Causas Posibles:**

1. API no está corriendo
2. Puerto incorrecto en @api
3. API está en diferente máquina
4. Firewall bloqueando conexión

**Soluciones:**

```bash
# Verificar si API está corriendo
curl http://localhost:3001/api/v1/health

# Si estás probando con Docker Compose desde tu host
curl http://localhost:3005/api/v1/health

# Si no funciona, iniciar API
docker compose ps api

# Si no está corriendo:
docker compose up api

# Si puerto está ocupado:
lsof -i :3001

# Cambiar URL en 00-variables.rest según el entorno
# @api = http://localhost:3001/api/v1
# @api = http://localhost:3005/api/v1
```

---

### Error 2: 401 Unauthorized

**Síntoma:**

```
Status: 401
Message: Unauthorized
```

**Causas Posibles:**

1. Token expirado
2. Token inválido
3. Token no incluido en header
4. Token formato incorrecto

**Soluciones:**

```rest
# 1. Verificar que token está en variable
GET {{@api}}/auth/me
Authorization: Bearer {{@accessToken}}

# Si error 401, obtener nuevo token:
POST {{@api}}/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}

# Copiar accessToken de respuesta a 00-variables.rest
# @accessToken = nuevo_token_aqui
```

**Formato correcto:**

```rest
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  # ✅ Correcto
Authorization: eyJhbGciOiJIUzI1NiIs...         # ❌ Falta "Bearer"
Authorization: {{@accessToken}}                 # ❌ Sin "Bearer"
```

---

### Error 3: 404 Not Found

**Síntoma:**

```
Status: 404
Message: Cannot POST /api/v1/nonexistent
```

**Causas Posibles:**

1. Ruta incorrecta
2. Typo en nombre del endpoint
3. Endpoint no existe
4. Versión de API diferente

**Soluciones:**

```bash
# Verificar endpoint existe
GET {{@api}}/admin/metadata/endpoints

# Verificar ruta exacta (case-sensitive)
# ❌ GET /purchase/status           (falta :id)
# ✅ GET /purchase/status/tx_12345  (correcto)

# Verificar versión de API
GET {{@api}}/health

# Listar rutas disponibles
curl {{@api}}/admin/metadata/endpoints
```

---

### Error 4: 400 Bad Request

**Síntoma:**

```
Status: 400
Message: Bad Request
Details: Missing required fields
```

**Causas Posibles:**

1. Falta campo requerido
2. Tipo de dato incorrecto
3. Formato de JSON inválido
4. Valores fuera de rango

**Soluciones:**

```rest
# ❌ Falta campo requerido
POST {{@api}}/purchase/initiate
Content-Type: application/json
{
  "walletAddress": "4Nd1m1Q5WJGj5CqPKYrZL2g4X2Y8Z3A4B5C6D7E8"
  # Falta: paymentMethodId, solAmount
}

# ✅ Todos los campos requeridos
POST {{@api}}/purchase/initiate
Content-Type: application/json
{
  "walletAddress": "4Nd1m1Q5WJGj5CqPKYrZL2g4X2Y8Z3A4B5C6D7E8",
  "paymentMethodId": "solana",
  "solAmount": 0.5,
  "slippageTolerance": 0.05
}
```

**Tipos comunes:**

```json
// ❌ String en lugar de número
{ "amount": "100" }

// ✅ Tipo correcto
{ "amount": 100 }

// ❌ Boolean como string
{ "enabled": "true" }

// ✅ Boolean correcto
{ "enabled": true }
```

---

### Error 5: 500 Internal Server Error

**Síntoma:**

```
Status: 500
Message: Internal Server Error
```

**Causas Posibles:**

1. Error en la API
2. Excepción no controlada
3. Problema con base de datos
4. Problema con Redis
5. Problema con Solana RPC

**Soluciones:**

```bash
# 1. Verificar logs de la API
docker compose logs api

# 2. Ver si es error persistente
curl {{@api}}/health

# 3. Si health checks fallan:
curl {{@api}}/health/db       # PostgreSQL
curl {{@api}}/health/redis    # Redis
curl {{@api}}/health/solana   # Solana RPC

# 4. Reiniciar API
docker compose restart api

# 5. Ver logs en tiempo real
docker compose logs -f api
```

---

### Error 6: 429 Too Many Requests

**Síntoma:**

```
Status: 429
Message: Too Many Requests
X-RateLimit-Reset: 1704110400
```

**Causas Posibles:**

1. Alcanzado límite de rate limiting
2. Ejecutar demasiadas requests rápido
3. Límite de usuarios alcanzado

**Soluciones:**

```bash
# Esperar 15 minutos (ventana de rate limiting)
# Ver Dockerfile: RATE_LIMIT_WINDOW_MS=900000

# Ver límites actuales
docker compose exec api env | grep RATE_LIMIT

# Cambiar límites en .env
RATE_LIMIT_MAX_REQUESTS=2000       # Aumentar de 1000
PURCHASE_RATE_LIMIT_MAX=200        # Aumentar de 100
```

---

### Error 7: Network Timeout

**Síntoma:**

```
Error: Request timeout (after Xms)
```

**Causas Posibles:**

1. Servidor lento
2. Red lenta
3. Timeout muy corto
4. Servidor no responde

**Soluciones:**

```rest
# Aumentar timeout en REST Client (VS Code settings):
# "rest-client.timeoutinmilliseconds": 30000  // 30 segundos

# O especificar en archivo .rest:
GET {{@api}}/health
Connection: Upgrade
Upgrade: websocket

# Probar con comando directo
curl --max-time 10 {{@api}}/health

# Ver si es problema de red
ping servicioshilda.orioncaribe.com
```

---

### Error 8: 403 Forbidden

**Síntoma:**

```
Status: 403
Message: Forbidden
```

**Causas Posibles:**

1. Usuario no es admin
2. Permisos insuficientes
3. IP bloqueada
4. Endpoint requiere autorización especial

**Soluciones:**

```rest
# Verificar si eres admin
GET {{@api}}/auth/me
Authorization: Bearer {{@accessToken}}

# Usar endpoint sin restricciones
# ❌ GET /admin/stats            (requiere admin)
# ✅ GET /health                 (público)

# Usar credenciales de admin
@adminToken = admin_token_here
GET {{@api}}/admin/stats
Authorization: Bearer {{@adminToken}}
```

---

### Error 9: Invalid JSON

**Síntoma:**

```
Error: JSON.parse error
Or: Unexpected token < in JSON
```

**Causas Posibles:**

1. JSON malformado
2. Respuesta no es JSON
3. Caracteres especiales sin escape
4. Comillas sin escape

**Soluciones:**

```rest
# ❌ JSON Inválido
{
  "name": "John Doe",
  "email": "john@example.com"  # Falta cierre de llave
}

# ✅ JSON Válido
{
  "name": "John Doe",
  "email": "john@example.com"
}

# ❌ Caracteres especiales sin escape
{
  "message": "Hello "World""
}

# ✅ Caracteres escapados
{
  "message": "Hello \"World\""
}

# ❌ Comillas simples
{
  'name': 'value'
}

# ✅ Comillas dobles
{
  "name": "value"
}
```

---

### Error 10: Variable No Encontrada

**Síntoma:**

```
Error: Undefined variable: @myVar
```

**Causas Posibles:**

1. Variable no definida en 00-variables.rest
2. Typo en nombre de variable
3. Variable en diferente archivo
4. Variable comentada

**Soluciones:**

```rest
# 1. Verificar variable existe en 00-variables.rest
# @api = https://servicioshilda.orioncaribe.com/api/v1

# 2. Verificar ortografía exacta (case-sensitive)
# ❌ {{@API}}        (mayúsculas)
# ✅ {{@api}}        (minúsculas)

# 3. Variables importadas desde otro archivo
# Si variables están en 00-variables.rest, deben funcionar
# en todos los demás archivos

# 4. Variables comentadas no funcionan
# ❌ # @myVar = value
# ✅ @myVar = value

# 5. Usar variable inline como fallback
GET https://servicioshilda.orioncaribe.com/api/v1/health
```

---

## 🟡 Advertencias Comunes

### Advertencia 1: Token Expirado Próximamente

```rest
# Síntoma: Algunos requests funcionan, otros dan 401

# Solución:
# Obtener nuevo token periódicamente
POST {{@api}}/auth/login
Content-Type: application/json

{
  "username": "{{@username}}",
  "password": "{{@password}}"
}

# Guardar nuevo token
@accessToken = <response: body $.accessToken>
```

### Advertencia 2: Wallet No Tiene SOL

```rest
# Síntoma: Error en transacciones

# Verificar balance
POST {{@api}}/solana/rpc
Content-Type: application/json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["{{@testWallet}}"]
}

# Si balance es bajo:
# - En devnet: usar faucet (https://solfaucet.com)
# - En mainnet: depositar SOL real desde exchange
```

### Advertencia 3: CORS Error

```
Access to XMLHttpRequest blocked by CORS policy
```

**Esto significa:**

- Error en FRONTEND, no en REST Client
- Check ALLOWED_ORIGINS en Dockerfile

**Solución:**

```dockerfile
ENV ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3005,...
```

---

## ✅ Verificación Rápida de Salud

Script para verificar que todo está funcionando:

```rest
### Health Check Completo

# 1. API básica
GET {{@api}}/health

###

# 2. Base de datos
GET {{@api}}/health/db

###

# 3. Redis
GET {{@api}}/health/redis

###

# 4. Solana
GET {{@api}}/health/solana

###

# 5. Full check
GET {{@api}}/health/full

###

# 6. Autenticación
GET {{@api}}/auth/me
Authorization: Bearer {{@accessToken}}

###

# 7. Datos públicos
GET {{@api}}/exchange/solPriceCached

###

# Si todo devuelve 200 OK: ✅ Sistema funcionando correctamente
```

---

## 📊 Performance Debugging

### Identificar Requests Lentos

```rest
# REST Client muestra tiempo de respuesta
# Busca en Response:
# < HTTP/1.1 200 OK
# ...
# Response time: 2500ms  ← Muy lento (> 1000ms)
```

### Queries Lentas en BD

```bash
# Habilitar query logging en PostgreSQL
docker exec prowallet-postgres psql -U postgres -d prowallet -c \
  "ALTER SYSTEM SET log_min_duration_statement = 1000;"

# Reiniciar
docker restart prowallet-postgres

# Ver logs
docker logs prowallet-postgres | grep "duration"
```

---

## 🔍 Debug de Variables

### Ver Variables Expandidas

VS Code REST Client:

1. Presiona `Ctrl+Shift+P`
2. Busca "REST Client: Show Request Body"
3. Muestra request final con variables expandidas

### Crear Variable de Debug

```rest
@debug = true

GET {{@api}}/health
X-Debug: {{@debug}}

# Verification:
# Debería mostrar en headers: X-Debug: true
```

---

## 🔗 Recursos de Ayuda

1. **REST Client Docs**: https://github.com/Huachao/vscode-restclient
2. **HTTP Status Codes**: https://httpwg.org/specs/rfc7231.html
3. **Solana RPC Docs**: https://docs.solana.com/api/http
4. **JSON Validator**: https://jsonlint.com
5. **URL Encoder**: https://www.urlencode.org

---

## 🚀 Última Opción: Debug Mode

```bash
# Activar debug completo
RUST_LOG=debug docker compose up api

# Ver todos los logs
docker compose logs -f api

# O para toda la aplicación
docker compose logs -f

# Capturar requests/responses
docker compose exec api tcpdump -i any -n port 3001
```

---

**Si aún no funciona:**

1. Verifica que tienes la última versión de la API
2. Comprueba configuración en .env y Dockerfile
3. Revisa documentación en `/documentation`
4. Contacta al equipo de desarrollo

**Última actualización**: Diciembre 2024
