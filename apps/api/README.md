# ProWallet API

API REST para interactuar con el smart contract ProWallet en la blockchain Solana. Esta API proporciona endpoints para gestionar whitelist, ejecutar transferencias restringidas y consultar información del contrato.

## 🚀 Características

- **🔐 Seguridad**: Helmet, CORS, validación de entrada robusta
- **⚡ Performance**: Compresión gzip, rate limiting
- **🛡️ Validación**: Validación completa de direcciones Solana y parámetros
- **📊 Monitoreo**: Health checks y logging detallado
- **🔄 Rate Limiting**: Límites diferenciados para operaciones de lectura/escritura
- **🌐 Solana Integration**: Conexión nativa con devnet/mainnet

## 📋 Prerrequisitos

- Node.js >= 16
- pnpm >= 8
- Acceso a red Solana (devnet/mainnet)

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <repository-url>
cd prowallet-api

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
```

## ⚙️ Configuración

### Variables de Entorno (.env)

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Solana Configuration
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# ProWallet Smart Contract
PROWALLET_PROGRAM_ID=your_program_id_here

# API Configuration
API_VERSION=v1
API_PREFIX=/api

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://servicioshilda.orioncaribe.com/,http://localhost:5173

# Rate Limiting (requests per minute)
RATE_LIMIT=100
```

## 🚀 Uso

### Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Iniciar servidor de producción
pnpm start

# Compilar TypeScript
pnpm build

# Linting
pnpm lint

# Formateo de código
pnpm format
```

### Acceso a la API

- **Base URL**: `https://servicioshilda.orioncaribe.com/api/v1`
- **Documentación**: `https://servicioshilda.orioncaribe.com/api/docs`
- **Health Check**: `https://servicioshilda.orioncaribe.com/api/v1/health`

## 📚 Endpoints

### Health Check

#### `GET /api/v1/health`

Verificación básica del estado de la API.

**Respuesta:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0",
  "node": "v18.17.0",
  "memory": {
    "used": 45.67,
    "total": 67.89,
    "free": 22.22
  }
}
```

#### `GET /api/v1/health/solana`

Verificación de conectividad con la red Solana.

#### `GET /api/v1/health/deep`

Verificación completa de todos los servicios.

### Contrato ProWallet

#### `GET /api/v1/prowallet/contract-info`

Obtiene información del smart contract.

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "programId": "84BNHitUwsztYcTUaUjLLVn5WbfxyUgc8eD9L32zQ8vZ",
    "authority": "authority_address",
    "whitelistCount": 5,
    "network": "devnet"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Gestión de Whitelist

#### `GET /api/v1/prowallet/whitelist`

Obtiene la lista completa de wallets whitelisteadas.

#### `GET /api/v1/prowallet/whitelist/:wallet`

Verifica si una wallet específica está whitelisteada.

**Parámetros:**

- `wallet`: Dirección Solana válida

#### `POST /api/v1/prowallet/whitelist/add`

Añade una wallet a la whitelist.

**Body:**

```json
{
  "wallet": "wallet_address",
  "authority": "authority_address"
}
```

**Rate Limit:** 10 requests/minuto

#### `POST /api/v1/prowallet/whitelist/remove`

Remueve una wallet de la whitelist.

**Rate Limit:** 10 requests/minuto

### Transferencias

#### `POST /api/v1/prowallet/transfer`

Ejecuta una transferencia restringida entre wallets whitelisteadas.

**Body:**

```json
{
  "fromWallet": "from_wallet_address",
  "toWallet": "to_wallet_address",
  "amount": 100.5,
  "tokenMint": "token_mint_address"
}
```

**Rate Limit:** 10 requests/minuto

### Consultas de Balance y Transacciones

#### `GET /api/v1/prowallet/balance/:wallet`

Obtiene el balance de una wallet.

**Query Parameters:**

- `tokenMint` (optional): Dirección del token específico

#### `GET /api/v1/prowallet/transactions/:wallet`

Obtiene el historial de transacciones de una wallet.

**Query Parameters:**

- `limit` (optional): Número máximo de transacciones (default: 10, max: 50)

#### `GET /api/v1/prowallet/transaction/:signature`

Obtiene detalles de una transacción específica.

### Utilidades

#### `GET /api/v1/prowallet/validate-address/:address`

Valida si una dirección Solana es correcta.

## 🔒 Seguridad

### Rate Limiting

- **Lectura**: 100 requests/minuto por IP
- **Escritura**: 10 requests/minuto por IP

### Headers de Seguridad

- Content Security Policy
- HSTS (en producción)
- X-Frame-Options
- X-Content-Type-Options

### Validación

- Todas las direcciones Solana son validadas
- Parámetros de entrada son sanitizados
- Validación de tipos de datos estricta

## 🏗️ Arquitectura

```
src/
├── middleware/          # Middleware personalizado
│   └── index.ts        # Validación, rate limiting, seguridad
├── routes/             # Definición de rutas
│   ├── health.routes.ts
│   └── prowallet.routes.ts
├── services/           # Lógica de negocio
│   ├── solana.service.ts
│   └── prowallet.service.ts
├── app.ts             # Configuración de Express
└── server.ts          # Punto de entrada
```

## 🧪 Testing

```bash
# Ejecutar tests
pnpm test

# Tests con coverage
pnpm test:coverage

# Tests en modo watch
pnpm test:watch
```

## 📝 Respuestas de Error

### Estructura de Error

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Códigos de Estado HTTP

- `200` - Éxito
- `400` - Error de validación/parámetros incorrectos
- `404` - Recurso no encontrado
- `429` - Rate limit excedido
- `500` - Error interno del servidor
- `503` - Servicio no disponible

## 🔄 Rate Limits

Al exceder los límites, la API responde con:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

## 🐳 Docker

```dockerfile
# Dockerfile incluido para deployment
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📈 Monitoring

La API incluye:

- Health checks en múltiples niveles
- Logging estructurado
- Métricas de performance
- Monitoreo de conectividad Solana

## 🤝 Contribución

1. Fork el proyecto
2. Crea una branch para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la branch (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si encuentras algún problema o tienes preguntas:

1. Revisa la [documentación](#-endpoints)
2. Verifica los [health checks](#health-check)
3. Consulta los logs del servidor
4. Abre un issue en el repositorio

---

**Estado del Proyecto:** ✅ Producción Ready

**Última actualización:** $(date)
