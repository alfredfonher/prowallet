# REST Client Configuration Guide

Configuración de entornos para testear la API ProWallet en diferentes ambientes.

## 🎯 Ambientes Disponibles

### Producción (Mainnet)

```
URL: https://servicioshilda.orioncaribe.com/api/v1
Network: Solana Mainnet-beta
Token: D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3 (Real)
Environment: production
```

### Desarrollo Local

```
URL: http://localhost:3001/api/v1
Network: Solana Devnet/Mainnet
Token: D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3 (same)
Environment: development
```

### Docker (Si corres localmente)

```
URL: http://localhost:3005/api/v1
Network: Solana (según config)
Token: Configurable
Environment: docker
```

## ⚙️ Cambiar Ambiente

### Opción 1: Editar `00-variables.rest`

```rest
# Comentar la que no uses

@api = https://servicioshilda.orioncaribe.com/api/v1    # Producción
# @api = http://localhost:3001/api/v1                    # Desarrollo
# @api = http://localhost:3005/api/v1                    # Docker Compose
```

### Opción 2: Variable de Entorno Global (VS Code)

En VS Code settings.json:

```json
{
  "rest-client.environmentVariables": {
    "$shared": {
      "api": "https://servicioshilda.orioncaribe.com/api/v1",
      "accessToken": "your-token-here"
    },
    "production": {
      "api": "https://servicioshilda.orioncaribe.com/api/v1"
    },
    "development": {
      "api": "http://localhost:3001/api/v1"
    },
    "docker": {
      "api": "http://localhost:3005/api/v1"
    }
  }
}
```

Luego en los archivos .rest:

```rest
@api = {{$dotenv API}}
```

### Opción 3: Usar .env file

Crear archivo `.env` en `/tests/rest/`:

```env
API_PROD=https://servicioshilda.orioncaribe.com/api/v1
API_DEV=http://localhost:3001/api/v1
API_DOCKER=http://localhost:3005/api/v1

ACCESS_TOKEN_PROD=token_prod_here
ACCESS_TOKEN_DEV=token_dev_here
ACCESS_TOKEN_DOCKER=token_docker_here
```

Cargar en .rest:

```rest
@api = {{$dotenv API_PROD}}
@accessToken = {{$dotenv ACCESS_TOKEN_PROD}}
```

## 🔑 Autenticación por Ambiente

### Producción

- **Token Real**: Usar token JWT obtentido por login en producción
- **Wallets**: Usar wallets reales con SOL en mainnet
- **Risk**: Alto - Transacciones con dinero real

### Desarrollo Local

- **Token Mock**: Generar token de prueba localmente
- **Wallets**: Usar wallets de prueba/devnet
- **Risk**: Bajo - Transacciones con SOL de prueba

### Docker

- **Token**: Usar token generado en contenedor
- **Wallets**: Según configuración en Dockerfile
- **Risk**: Medio - Depende de config

## 🧪 Plantillas de Configuración

### Template: Ambiente Completo

```rest
### ============================================================================
### CONFIGURACIÓN DE AMBIENTE
### ============================================================================

# Ambiente: CAMBIAR SEGÚN NECESARIO
@environment = production  # production, development, docker

### URLs por ambiente
@apiProd = https://servicioshilda.orioncaribe.com/api/v1
@apiDev = http://localhost:3001/api/v1
@apiDocker = http://localhost:3005/api/v1

### Seleccionar URL según ambiente
@api = {{@apiProd}}

### Tokens por ambiente
@tokenProd = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
@tokenDev = your_dev_token_here
@tokenDocker = your_docker_token_here

### Seleccionar token
@accessToken = {{@tokenProd}}

### Wallets por ambiente
@walletProd = EizJ7W8AbhUAPdSjdEjyKJDEmk7MSJnR6JfH2h2gitLH
@walletDev = 4Nd1m1Q5WJGj5CqPKYrZL2g4X2Y8Z3A4B5C6D7E8
@walletDocker = Your_Docker_Wallet

### Seleccionar wallet
@testWallet = {{@walletProd}}

### Configuración de red
@networkProd = mainnet-beta
@networkDev = devnet
@networkDocker = mainnet-beta

### Token mint (igual en todos los ambientes)
@tokenMint = D8TwbwGGmyucrxPB9uscait27caVgeqYHPpyN3XXjUX3

### ============================================================================
### REQUESTS
### ============================================================================

GET {{@api}}/health
```

## 🔄 Flujo de Testing Multi-Ambiente

### 1. Testear en Desarrollo Primero

```bash
# Cambiar a desarrollo en 00-variables.rest
@api = http://localhost:3001/api/v1

# Ejecutar: 12-quick-start.rest
# Ejecutar: 01-health.rest
# Ejecutar: 03-purchase.rest
```

### 2. Verificar en Docker

```bash
# Cambiar a Docker
@api = http://localhost:3005/api/v1

# Ejecutar: 01-health.rest
# Verificar logs: docker compose logs api
```

### 3. Validar en Producción

```bash
# Cambiar a producción
@api = https://servicioshilda.orioncaribe.com/api/v1

# Ejecutar SOLO lectura primero: 12-quick-start.rest
# Ejecutar: 01-health.rest
# Ejecutar: 05-prowallet.rest (sin mutaciones)
# Ejecutar: 03-purchase.rest (CUIDADO - dinero real)
```

## 🛡️ Mejores Prácticas

### 1. Separar Credenciales

```rest
# ❌ NUNCA hagas esto en git
@accessToken = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ Mejor: Variable de entorno
@accessToken = {{$processEnv TOKEN}}

# ✅ O: Archivo .env (gitignored)
@accessToken = {{$dotenv ACCESS_TOKEN}}
```

### 2. Documentar Cambios

```rest
###
### NOTA: Cambiar @api para ambiente diferente
### Producción: https://servicioshilda.orioncaribe.com/api/v1
### Desarrollo: http://localhost:3001/api/v1
### Docker Compose: http://localhost:3005/api/v1
###
```

### 3. Validar Ambiente Antes

```rest
# Siempre verificar health primero
GET {{@api}}/health

###

# Luego continuar con tests
GET {{@api}}/prowallet/contract-info
```

### 4. Usar Variables Dinámicas

```rest
# Reutilizar IDs de respuestas anteriores
@transactionId = <response: body $.transactionId>

# Ejecutar request posterior
GET {{@api}}/purchase/status/{{@transactionId}}
```

## 📋 Checklist Pre-Testing

### Antes de Producción

- [ ] Verificar @api es URL correcta
- [ ] Verificar @accessToken es válido
- [ ] Testear primero en desarrollo
- [ ] Verificar @testWallet existe en mainnet
- [ ] Revisar balance de wallets
- [ ] Tener backup de keys

### Antes de Desarrollo

- [ ] API corriendo localmente en `http://localhost:3001`
- [ ] Base de datos accesible
- [ ] Redis corriendo
- [ ] Network variable correcta

### Antes de Docker

- [ ] Servicio `api` levantado con `docker compose up api`
- [ ] Puertos expuestos correctamente
- [ ] Puerto host `3005` apuntando al contenedor `3001`

## 🚨 Debugging por Ambiente

### Producción - Error 500

```bash
# Ver logs remotos (si tienes acceso)
# o revisar email de alertas

# Ejecutar health check
GET https://servicioshilda.orioncaribe.com/api/v1/health

# Intentar desde diferente red
# (problema de firewall?)
```

### Desarrollo - Error 500

```bash
# Ver logs locales
docker compose logs api

# Reiniciar API
docker compose restart api

# Verificar variables ENV
docker compose exec api env | grep SOLANA
```

### Docker - Conexión rechazada

```bash
# Verificar contenedor corriendo
docker compose ps api

# Verificar logs
docker compose logs api

# Verificar red Docker
docker network ls
docker network inspect prowallet-network

# Probar desde tu host
curl http://localhost:3005/api/v1/health
```

## 📱 Variables por Tipo de Test

### Lectura (Safe - Producción OK)

```
GET endpoints (no modifican datos)
No requiere autenticación
Seguro ejecutar en producción
```

### Escritura (Cuidado - Probar en Dev primero)

```
POST/PUT/DELETE endpoints
Requiere autenticación
SIEMPRE probar en desarrollo primero
```

### Transacciones Blockchain (MUY CUIDADO)

```
Compras de tokens (dinero real)
Retiros (dinero real)
Transferencias (dinero real)
SOLO en producción cuando estés seguro
```

## 🔗 Referencias

- [REST Client Docs](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
- [Environment Variables en REST Client](https://github.com/Huachao/vscode-restclient#environment-variables)
- [Solana Devnet Faucet](https://solfaucet.com) - Solicitar SOL de prueba

---

**Configurado para**: ProWallet API v1.0.0
**Último update**: Diciembre 2024
